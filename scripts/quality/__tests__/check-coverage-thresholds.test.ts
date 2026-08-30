import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  findLoweredThresholds,
  parseCoverageThresholds,
  readBaseThresholds,
  readCoverageThresholdFile,
} from "../check-coverage-thresholds";

const temporaryDirectories: string[] = [];
const isolatedGitEnvironment = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runGit(directory: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: isolatedGitEnvironment,
  });
}

function createRepository(): string {
  const directory = mkdtempSync(join(tmpdir(), "makerbench-coverage-git-"));
  temporaryDirectories.push(directory);
  runGit(directory, ["init", "-q"]);
  runGit(directory, ["config", "user.email", "tests@example.invalid"]);
  runGit(directory, ["config", "user.name", "MakerBench tests"]);
  runGit(directory, ["config", "commit.gpgSign", "false"]);
  runGit(directory, ["config", "tag.gpgSign", "false"]);
  writeFileSync(join(directory, "README.md"), "coverage fixture\n");
  runGit(directory, ["add", "README.md"]);
  runGit(directory, ["commit", "-qm", "initial fixture"]);
  return directory;
}

describe("coverage threshold gate", () => {
  it("rejects malformed threshold files", () => {
    expect(() => parseCoverageThresholds("[]")).toThrow("JSON object");
    expect(() =>
      parseCoverageThresholds(
        '{"branches": 1, "functions": 1, "lines": 1, "statements": 1, "extra": 1}',
      ),
    ).toThrow("must contain only");
    expect(() =>
      parseCoverageThresholds(
        '{"branches": 1, "functions": 1, "lines": 1, "statements": 101}',
      ),
    ).toThrow("from 0 to 100");
  });

  it("rejects an oversized file before reading it", () => {
    const directory = mkdtempSync(join(tmpdir(), "makerbench-coverage-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "coverage-thresholds.json");

    writeFileSync(path, " ".repeat(4_097));

    expect(() => readCoverageThresholdFile(path)).toThrow("exceeds 4096 bytes");
  });

  it("reports only floors that become less strict", () => {
    const baseline = parseCoverageThresholds(
      '{"branches": 50, "functions": 60, "lines": 70, "statements": 80}',
    );
    const candidate = parseCoverageThresholds(
      '{"branches": 50, "functions": 61, "lines": 69, "statements": 80}',
    );

    expect(findLoweredThresholds(baseline, candidate)).toEqual(["lines"]);
  });

  it("treats a stack with no committed floor as an initial floor", () => {
    const directory = createRepository();

    expect(readBaseThresholds(directory, "HEAD")).toBeUndefined();
  });

  it("uses the strongest committed stack floor when no explicit base is selected", () => {
    const directory = createRepository();
    runGit(directory, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
    const floors =
      '{"branches": 60, "functions": 60, "lines": 60, "statements": 60}';
    writeFileSync(join(directory, "coverage-thresholds.json"), floors);
    runGit(directory, ["add", "coverage-thresholds.json"]);
    runGit(directory, ["commit", "-qm", "set coverage floors"]);
    writeFileSync(
      join(directory, "coverage-thresholds.json"),
      '{"branches": 59, "functions": 60, "lines": 60, "statements": 60}',
    );
    runGit(directory, ["add", "coverage-thresholds.json"]);
    runGit(directory, ["commit", "-qm", "attempt to lower coverage floors"]);

    const baseline = readBaseThresholds(directory);
    const candidate = readCoverageThresholdFile(
      join(directory, "coverage-thresholds.json"),
    );

    expect(baseline).toBeDefined();
    expect(findLoweredThresholds(baseline!, candidate)).toEqual(["branches"]);
  });

  it("rejects missing and stale Git base refs", () => {
    const directory = createRepository();
    const mainBranch = runGit(directory, ["branch", "--show-current"]).trim();

    expect(() => readBaseThresholds(directory, "missing-base")).toThrow(
      "rev-parse",
    );

    runGit(directory, ["checkout", "-qb", "stale-base"]);
    writeFileSync(join(directory, "stale.txt"), "stale\n");
    runGit(directory, ["add", "stale.txt"]);
    runGit(directory, ["commit", "-qm", "stale fixture"]);
    runGit(directory, ["checkout", "-q", mainBranch]);

    expect(() => readBaseThresholds(directory, "stale-base")).toThrow("stale");
  });
});
