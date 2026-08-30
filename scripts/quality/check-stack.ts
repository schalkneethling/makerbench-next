import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface StackCheckFailure {
  setting: string;
  expected: string;
  actual: string;
}

/** Reads an effective Git configuration value. */
function readGitConfig(
  repositoryRoot: string,
  key: string,
  environment: NodeJS.ProcessEnv,
): string | undefined {
  try {
    return execFileSync("git", ["config", "--get", key], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: environment,
      maxBuffer: 4_096,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

/** Reports each non-mutating gh-stack preflight violation. */
export function checkStack(
  repositoryRoot: string,
  environment: NodeJS.ProcessEnv = process.env,
): StackCheckFailure[] {
  const failures: StackCheckFailure[] = [];
  const expectedConfig = {
    "rerere.enabled": "false",
    "rerere.autoupdate": "false",
    "gh-stack.rerere-declined": "true",
    "remote.pushDefault": "origin",
  } as const;

  for (const [setting, expected] of Object.entries(expectedConfig)) {
    const actual = readGitConfig(repositoryRoot, setting, environment);
    if (actual !== expected) {
      failures.push({ setting, expected, actual: actual ?? "unset" });
    }
  }

  try {
    const branch = execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: environment,
      maxBuffer: 4_096,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (branch === "main") {
      failures.push({
        setting: "branch",
        expected: "not main",
        actual: branch,
      });
    }
  } catch {
    failures.push({
      setting: "branch",
      expected: "a non-main branch",
      actual: "detached",
    });
  }

  try {
    execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: repositoryRoot,
      env: environment,
      stdio: "ignore",
    });
  } catch {
    failures.push({
      setting: "remote.origin",
      expected: "configured",
      actual: "missing",
    });
  }

  const unmerged = execFileSync("git", ["ls-files", "-u"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
    maxBuffer: 64 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (unmerged.trim() !== "") {
    failures.push({
      setting: "index",
      expected: "no unmerged entries",
      actual: "unmerged entries",
    });
  }
  return failures;
}

function main(): void {
  const failures = checkStack(process.cwd());
  if (failures.length === 0) {
    console.log("Stack preflight passed.");
    return;
  }
  throw new Error(
    `Stack preflight failed:\n${failures.map(({ setting, expected, actual }) => `- ${setting}: expected ${expected}, got ${actual}`).join("\n")}`,
  );
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
