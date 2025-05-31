import { execSync } from "child_process";
import fs from "fs";

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

function installGoProjectDependencies(): void {
  console.log("Installing Go dependencies");
  execSync("go mod tidy");
}

function installGoTools(): void {
  console.log("Installing Go tools");
  const toolsPath = `${getProjectRoot()}/gotools.txt`;

  if (!fs.existsSync(toolsPath)) {
    console.error(`Error: gotools.txt not found at ${toolsPath}`);
    process.exit(1);
  }

  const tools = fs
    .readFileSync(toolsPath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")); // Skip empty lines and comments

  for (const tool of tools) {
    console.log(`Installing ${tool}`);
    execSync(`go install ${tool}`, { stdio: "inherit" });
  }
}

function installPythonPipDependencies(): void {
  console.log("Installing Python pip dependencies");
  execSync("python -m pip install --upgrade pip");
  execSync("python -m pip install -r requirements.txt");
}

function installBundlerRubyGems(): void {
  console.log("Installing Bundler gems");
  execSync("bundle install");
}

export function installProjectDependencies(): void {
  console.log("Installing dependencies");

  installGoProjectDependencies();
  installGoTools();
  installPythonPipDependencies();
  installBundlerRubyGems();
}
