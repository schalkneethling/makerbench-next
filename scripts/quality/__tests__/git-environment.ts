/** Builds a Git fixture environment without inheriting the calling hook's repository. */
export function createIsolatedGitEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const nonGitEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.startsWith("GIT_")),
  );

  return {
    ...nonGitEnvironment,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  };
}
