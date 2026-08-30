import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACTIONLINT_DOWNLOAD_TIMEOUT_MS,
  acquireActionlint,
  type ActionlintDownloader,
  type ActionlintExecutor,
  downloadArchive,
  findWorkflowFiles,
  getRelease,
  MAX_ACTIONLINT_ARCHIVE_BYTES,
  readArchive,
  verifyActionlintFixtures,
  verifyArchiveChecksum,
} from "../check-actions";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("GitHub Actions workflow gate", () => {
  it("selects YAML workflow files and excludes other GitHub metadata", () => {
    const directory = mkdtempSync(join(tmpdir(), "makerbench-actions-"));
    temporaryDirectories.push(directory);
    const workflowsDirectory = join(
      directory,
      ".github",
      "workflows",
      "nested",
    );

    mkdirSync(workflowsDirectory, { recursive: true });
    writeFileSync(join(workflowsDirectory, "quality.yml"), "name: Quality\n");
    writeFileSync(join(workflowsDirectory, "release.yaml"), "name: Release\n");
    writeFileSync(join(workflowsDirectory, "notes.txt"), "not a workflow\n");

    expect(findWorkflowFiles(directory)).toEqual([
      join(workflowsDirectory, "quality.yml"),
      join(workflowsDirectory, "release.yaml"),
    ]);
  });

  it("succeeds when workflows have not been added yet", () => {
    const directory = mkdtempSync(join(tmpdir(), "makerbench-actions-"));
    temporaryDirectories.push(directory);

    expect(findWorkflowFiles(directory)).toEqual([]);
  });

  it("rejects a release archive with a mismatched checksum", () => {
    expect(() =>
      verifyArchiveChecksum(Buffer.from("not actionlint"), "0".repeat(64)),
    ).toThrow("checksum");
  });

  it("accepts an archive with its matching checksum", () => {
    const archive = Buffer.from("checksum fixture");
    const checksum =
      "4191d7d2f5f1960b7fac8168756a58090829157f780a45bbd5ba4aa020cfe86a";

    expect(() => verifyArchiveChecksum(archive, checksum)).not.toThrow();
  });

  it("rejects cached archives that are not regular files without downloading", async () => {
    const directory = mkdtempSync(join(tmpdir(), "makerbench-actions-"));
    temporaryDirectories.push(directory);
    const release = getRelease();
    const archivePath = join(directory, release.archive);
    const download = vi.fn<ActionlintDownloader>();
    mkdirSync(archivePath);

    await expect(acquireActionlint(directory, download)).rejects.toThrow(
      "not a regular file",
    );
    expect(download).not.toHaveBeenCalled();
  });

  it("deletes a checksum-mismatched cached archive without downloading", async () => {
    const directory = mkdtempSync(join(tmpdir(), "makerbench-actions-"));
    temporaryDirectories.push(directory);
    const release = getRelease();
    const archivePath = join(directory, release.archive);
    const download = vi.fn<ActionlintDownloader>();
    writeFileSync(archivePath, "mismatched cache");

    await expect(acquireActionlint(directory, download)).rejects.toThrow(
      "checksum",
    );
    expect(download).not.toHaveBeenCalled();
    expect(existsSync(archivePath)).toBe(false);
  });

  it("checks an archive's bounded size before reading it", () => {
    const directory = mkdtempSync(join(tmpdir(), "makerbench-actions-"));
    temporaryDirectories.push(directory);
    const archivePath = join(directory, "too-large.tar.gz");
    writeFileSync(archivePath, Buffer.alloc(MAX_ACTIONLINT_ARCHIVE_BYTES + 1));

    expect(() => readArchive(archivePath)).toThrow("too large");
  });

  it("rejects an advertised actionlint download that exceeds the limit", async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(null, {
          headers: {
            "content-length": String(MAX_ACTIONLINT_ARCHIVE_BYTES + 1),
          },
        }),
    );

    await expect(
      downloadArchive(
        "https://example.invalid/actionlint",
        fetchImplementation,
      ),
    ).rejects.toThrow("exceeds the allowed size");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://example.invalid/actionlint",
      expect.objectContaining({
        redirect: "follow",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("passes a bounded timeout signal to a network-free fetch implementation", async () => {
    const signal = AbortSignal.timeout(1);
    const fetchImplementation = vi.fn(
      async (_url: string, options: RequestInit): Promise<Response> => {
        const requestSignal = options.signal;

        if (requestSignal === null || requestSignal === undefined) {
          throw new Error("Expected an abort signal.");
        }

        return await new Promise<Response>((_resolve, reject) => {
          requestSignal.addEventListener(
            "abort",
            () => reject(requestSignal.reason),
            { once: true },
          );
        });
      },
    );

    await expect(
      downloadArchive(
        "https://example.invalid/actionlint",
        fetchImplementation,
        signal,
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(ACTIONLINT_DOWNLOAD_TIMEOUT_MS).toBe(30_000);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://example.invalid/actionlint",
      expect.objectContaining({ signal }),
    );
  });

  it("cancels a streamed actionlint download that grows beyond the limit", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_ACTIONLINT_ARCHIVE_BYTES + 1));
      },
      cancel,
    });
    const fetchImplementation = async () => new Response(stream);

    await expect(
      downloadArchive(
        "https://example.invalid/actionlint",
        fetchImplementation,
      ),
    ).rejects.toThrow("exceeds the allowed size");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("requires the valid fixture to pass and the invalid fixture to fail", async () => {
    const executions: string[][] = [];
    const executor: ActionlintExecutor = async (
      _repositoryRoot,
      workflowFiles,
    ) => {
      executions.push(workflowFiles);
      return {
        status: workflowFiles[0]?.includes("/valid/") ? 0 : 1,
        stderr: "",
        stdout: "",
      };
    };

    await verifyActionlintFixtures(executor);

    expect(executions).toHaveLength(2);
    expect(executions[0]?.[0]).toContain("/valid/.github/workflows/");
    expect(executions[1]?.[0]).toContain("/invalid/.github/workflows/");
  });

  it("rejects an executor that accepts the invalid fixture", async () => {
    const executor: ActionlintExecutor = async () => ({
      status: 0,
      stderr: "",
      stdout: "",
    });

    await expect(verifyActionlintFixtures(executor)).rejects.toThrow(
      "accepted the invalid fixture",
    );
  });

  it("reports when the pinned binary rejects the valid fixture", async () => {
    const executor: ActionlintExecutor = async () => ({
      status: 1,
      stderr: "fixture failure",
      stdout: "",
    });

    await expect(verifyActionlintFixtures(executor)).rejects.toThrow(
      "rejected the valid fixture",
    );
  });
});
