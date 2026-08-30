import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkStack } from "../check-stack";
import { createIsolatedGitEnvironment } from "./git-environment";

const directories: string[] = [];
const gitEnvironment = createIsolatedGitEnvironment({
  ...process.env,
  GIT_DIR: "/parent/.git",
  GIT_WORK_TREE: "/parent",
});

afterEach(() =>
  directories
    .splice(0)
    .forEach((directory) =>
      rmSync(directory, { recursive: true, force: true }),
    ),
);

function git(directory: string, arguments_: string[], input?: string): string {
  return execFileSync("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
    env: gitEnvironment,
    input,
  });
}

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "makerbench-stack-"));
  directories.push(directory);
  git(directory, ["init", "-q", "-b", "stack-layer"]);
  git(directory, ["config", "user.email", "tests@example.invalid"]);
  git(directory, ["config", "user.name", "MakerBench tests"]);
  git(directory, ["config", "commit.gpgSign", "false"]);
  git(directory, [
    "remote",
    "add",
    "origin",
    "https://example.invalid/makerbench.git",
  ]);
  for (const [key, value] of [
    ["rerere.enabled", "false"],
    ["rerere.autoupdate", "false"],
    ["gh-stack.rerere-declined", "true"],
    ["remote.pushDefault", "origin"],
  ])
    git(directory, ["config", key, value]);
  writeFileSync(join(directory, "README.md"), "fixture\n");
  git(directory, ["add", "README.md"]);
  git(directory, ["commit", "-qm", "fixture"]);
  return directory;
}

describe("stack preflight", () => {
  it("removes repository context inherited from Git hooks", () => {
    expect(
      createIsolatedGitEnvironment({
        PATH: "/fixture/bin",
        GIT_DIR: "/parent/.git",
        GIT_WORK_TREE: "/parent",
      }),
    ).toMatchObject({
      PATH: "/fixture/bin",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
    });
    expect(
      createIsolatedGitEnvironment({ GIT_DIR: "/parent/.git" }),
    ).not.toHaveProperty("GIT_DIR");
  });

  it("accepts the required rerere-off stack configuration", () =>
    expect(checkStack(fixture(), gitEnvironment)).toEqual([]));
  it("reports missing rerere and push safeguards", () => {
    const directory = fixture();
    git(directory, ["config", "--unset", "rerere.enabled"]);
    git(directory, ["config", "rerere.autoupdate", "true"]);
    git(directory, ["config", "gh-stack.rerere-declined", "false"]);
    git(directory, ["config", "remote.pushDefault", "upstream"]);
    expect(checkStack(directory, gitEnvironment)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ setting: "rerere.enabled", actual: "unset" }),
        expect.objectContaining({
          setting: "rerere.autoupdate",
          actual: "true",
        }),
        expect.objectContaining({
          setting: "gh-stack.rerere-declined",
          actual: "false",
        }),
        expect.objectContaining({
          setting: "remote.pushDefault",
          actual: "upstream",
        }),
      ]),
    );
  });
  it("rejects main, missing origin, and unmerged entries", () => {
    const directory = fixture();
    const blob = git(directory, ["rev-parse", "HEAD:README.md"]).trim();
    git(directory, ["branch", "-M", "main"]);
    git(directory, ["remote", "remove", "origin"]);
    git(
      directory,
      ["update-index", "--index-info"],
      `100644 ${blob} 1\tREADME.md\n100644 ${blob} 2\tREADME.md\n`,
    );
    expect(checkStack(directory, gitEnvironment)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ setting: "branch", actual: "main" }),
        expect.objectContaining({
          setting: "remote.origin",
          actual: "missing",
        }),
        expect.objectContaining({
          setting: "index",
          actual: "unmerged entries",
        }),
      ]),
    );
  });
  it("rejects a detached HEAD", () => {
    const directory = fixture();
    git(directory, ["checkout", "--detach", "-q"]);

    expect(checkStack(directory, gitEnvironment)).toEqual([
      {
        setting: "branch",
        expected: "a non-main branch",
        actual: "detached",
      },
    ]);
  });
});
