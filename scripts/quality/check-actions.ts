import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { x as extractTar } from "tar";

const ACTIONLINT_VERSION = "1.7.12";
export const MAX_ACTIONLINT_ARCHIVE_BYTES = 5 * 1024 * 1024;
export const ACTIONLINT_DOWNLOAD_TIMEOUT_MS = 30_000;
const WORKFLOW_EXTENSIONS = new Set([".yaml", ".yml"]);

const RELEASES = {
  "darwin-arm64": {
    archive: "actionlint_1.7.12_darwin_arm64.tar.gz",
    sha256: "aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f",
  },
  "linux-x64": {
    archive: "actionlint_1.7.12_linux_amd64.tar.gz",
    sha256: "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8",
  },
} as const;

type PlatformKey = keyof typeof RELEASES;

interface ActionlintLease {
  binaryPath: string;
  cleanup(): void;
}

export type ActionlintDownloader = (url: string) => Promise<Buffer>;
export type ActionlintFetch = (
  url: string,
  options: RequestInit,
) => Promise<Response>;

export interface ActionlintResult {
  status: number;
  stderr: string;
  stdout: string;
}

export type ActionlintExecutor = (
  repositoryRoot: string,
  workflowFiles: string[],
) => Promise<ActionlintResult>;

/** Lists GitHub Actions workflow files without treating other GitHub metadata as workflows. */
export function findWorkflowFiles(repositoryRoot: string): string[] {
  const workflowsDirectory = resolve(repositoryRoot, ".github", "workflows");

  try {
    return readdirSync(workflowsDirectory, {
      recursive: true,
      withFileTypes: true,
    })
      .filter(
        (entry) =>
          entry.isFile() &&
          WORKFLOW_EXTENSIONS.has(
            entry.name.slice(entry.name.lastIndexOf(".")),
          ),
      )
      .map((entry) => resolve(entry.parentPath, entry.name))
      .sort();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

/** Resolves the exact upstream release supported by the deterministic workflow gate. */
export function getRelease(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}` as PlatformKey;
  const release = RELEASES[key];

  if (release === undefined) {
    throw new Error(
      `No checksum-pinned actionlint ${ACTIONLINT_VERSION} release for ${platform}/${arch}.`,
    );
  }

  return {
    ...release,
    url: `https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${release.archive}`,
  };
}

/** Verifies a release archive before it can be extracted or executed. */
export function verifyArchiveChecksum(
  contents: Buffer,
  expectedSha256: string,
): void {
  const actualSha256 = createHash("sha256").update(contents).digest("hex");

  if (actualSha256 !== expectedSha256) {
    throw new Error(
      "The actionlint archive checksum does not match the pinned release.",
    );
  }
}

/** Reads an archive only after checking its bounded size, then rechecks after reading. */
export function readArchive(archivePath: string): Buffer {
  const metadata = lstatSync(archivePath);

  if (!metadata.isFile() || metadata.size > MAX_ACTIONLINT_ARCHIVE_BYTES) {
    throw new Error(
      "The actionlint archive is missing, not a regular file, or too large.",
    );
  }

  const contents = readFileSync(archivePath);

  if (contents.byteLength > MAX_ACTIONLINT_ARCHIVE_BYTES) {
    throw new Error(
      "The actionlint archive grew beyond the allowed size while reading.",
    );
  }

  return contents;
}

/** Downloads one immutable release archive, enforcing its advertised bounded size. */
export async function downloadArchive(
  url: string,
  fetchImplementation: ActionlintFetch = fetch,
  signal: AbortSignal = AbortSignal.timeout(ACTIONLINT_DOWNLOAD_TIMEOUT_MS),
): Promise<Buffer> {
  const response = await fetchImplementation(url, {
    redirect: "follow",
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to download pinned actionlint: ${response.status} ${response.statusText}.`,
    );
  }

  const contentLength = response.headers.get("content-length");

  if (
    contentLength !== null &&
    Number(contentLength) > MAX_ACTIONLINT_ARCHIVE_BYTES
  ) {
    throw new Error("The actionlint archive exceeds the allowed size.");
  }

  if (response.body === null) {
    throw new Error("The actionlint download did not include a response body.");
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_ACTIONLINT_ARCHIVE_BYTES) {
      await reader.cancel();
      throw new Error("The actionlint archive exceeds the allowed size.");
    }

    chunks.push(Buffer.from(value));
  }

  const contents = Buffer.concat(chunks, totalBytes);

  return contents;
}

/** Acquires a checksum-verified binary into a temporary, controlled extraction directory. */
export async function acquireActionlint(
  cacheDirectory: string,
  download: ActionlintDownloader = downloadArchive,
): Promise<ActionlintLease> {
  const release = getRelease();
  mkdirSync(cacheDirectory, { recursive: true });
  const archivePath = join(cacheDirectory, release.archive);
  let archive: Buffer;

  try {
    archive = readArchive(archivePath);
  } catch (error: unknown) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }

    archive = await download(release.url);
    verifyArchiveChecksum(archive, release.sha256);
    const temporaryArchivePath = join(
      cacheDirectory,
      `.${release.archive}.${process.pid}.partial`,
    );
    writeFileSync(temporaryArchivePath, archive, { flag: "wx" });
    renameSync(temporaryArchivePath, archivePath);
  }

  try {
    verifyArchiveChecksum(archive, release.sha256);
  } catch (error) {
    unlinkSync(archivePath);
    throw error;
  }

  const extractionDirectory = mkdtempSync(
    join(tmpdir(), "makerbench-actionlint-"),
  );
  await extractTar({
    file: archivePath,
    cwd: extractionDirectory,
    strict: true,
  });
  const binaryPath = join(extractionDirectory, "actionlint");
  const binaryMetadata = lstatSync(binaryPath);

  if (!binaryMetadata.isFile() || binaryMetadata.isSymbolicLink()) {
    rmSync(extractionDirectory, { recursive: true, force: true });
    throw new Error(
      "The checksum-verified actionlint archive did not contain a regular executable.",
    );
  }

  return {
    binaryPath,
    cleanup: () =>
      rmSync(extractionDirectory, { recursive: true, force: true }),
  };
}

/** Lints workflows with optional ambient linters explicitly disabled for hermetic results. */
export async function lintWorkflowFiles(
  repositoryRoot: string,
  workflowFiles: string[],
  cacheDirectory = resolve(
    repositoryRoot,
    "node_modules/.cache/makerbench-actionlint",
  ),
): Promise<ActionlintResult> {
  const lease = await acquireActionlint(cacheDirectory);

  try {
    const result = spawnSync(
      lease.binaryPath,
      ["-color=false", "-shellcheck=", "-pyflakes=", ...workflowFiles],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    if (result.error !== undefined) {
      throw result.error;
    }

    return {
      status: result.status ?? 1,
      stderr: result.stderr ?? "",
      stdout: result.stdout ?? "",
    };
  } finally {
    lease.cleanup();
  }
}

/** Returns the maintained valid and invalid workflows that prove this checker is active. */
function fixtureWorkflowFiles(kind: "valid" | "invalid"): string[] {
  const fixtureDirectory = fileURLToPath(
    new URL(`./fixtures/actionlint/${kind}`, import.meta.url),
  );
  const workflowFiles = findWorkflowFiles(fixtureDirectory);

  if (workflowFiles.length === 0) {
    throw new Error(`The actionlint ${kind} workflow fixture is missing.`);
  }

  return workflowFiles;
}

/** Requires the pinned binary to accept the valid fixture and reject the invalid fixture. */
export async function verifyActionlintFixtures(
  executor: ActionlintExecutor = lintWorkflowFiles,
): Promise<void> {
  const repositoryRoot = process.cwd();
  const validResult = await executor(
    repositoryRoot,
    fixtureWorkflowFiles("valid"),
  );

  if (validResult.status !== 0) {
    throw new Error(
      `Pinned actionlint rejected the valid fixture:\n${validResult.stdout}${validResult.stderr}`,
    );
  }

  const invalidResult = await executor(
    repositoryRoot,
    fixtureWorkflowFiles("invalid"),
  );

  if (invalidResult.status === 0) {
    throw new Error("Pinned actionlint accepted the invalid fixture.");
  }
}

/** Runs the checksum-pinned actionlint release against fixtures and repository workflows. */
async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const workflowFiles = findWorkflowFiles(repositoryRoot);

  await verifyActionlintFixtures();

  if (workflowFiles.length === 0) {
    console.log("No GitHub Actions workflows to lint yet.");
    return;
  }

  const result = await lintWorkflowFiles(repositoryRoot, workflowFiles);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exitCode = result.status;
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
