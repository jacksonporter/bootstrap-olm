export function getProjectRoot(): string {
  try {
    const { execSync } = require("child_process");

    // Check if git is installed
    try {
      execSync("git --version", { stdio: "ignore" });
    } catch {
      return process.cwd();
    }

    // Check if .git exists and get root
    try {
      const gitRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf8",
      }).trim();
      return gitRoot;
    } catch {
      return process.cwd();
    }
  } catch {
    return process.cwd();
  }
}
