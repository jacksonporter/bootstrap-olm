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

function installYarnDependencies(): void {
  if (process.env.SKIP_YARN_INSTALL) {
    console.log("Skipping Yarn dependencies installation");
    return;
  }
  console.log("Installing Yarn dependencies");
  execSync("mise exec -- corepack enable");
  execSync("mise exec -- corepack prepare --activate");
  execSync("mise exec -- yarn install");
}

function installGoProjectDependencies(): void {
  if (process.env.SKIP_GO_DEPS) {
    console.log("Skipping Go dependencies installation");
    return;
  }
  console.log("Installing Go dependencies");
  execSync("mise exec -- go mod tidy");
}

function installGoTools(): void {
  if (process.env.SKIP_GO_TOOLS) {
    console.log("Skipping Go tools installation");
    return;
  }
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
    execSync(`mise exec -- go install ${tool}`, { stdio: "inherit" });
  }
}

function installPythonPipDependencies(): void {
  if (process.env.SKIP_PIP_INSTALL) {
    console.log("Skipping Python pip dependencies installation");
    return;
  }
  console.log("Installing Python pip dependencies");
  execSync("mise exec -- python -m pip install --upgrade pip");
  execSync("mise exec -- python -m pip install -r requirements.txt");
}

function installBundlerRubyGems(): void {
  if (process.env.SKIP_BUNDLE_INSTALL) {
    console.log("Skipping Bundler gems installation");
    return;
  }
  console.log("Installing Bundler gems");
  execSync("mise exec -- bundle install");
}

const packageManagerMap = {
  yarn: installYarnDependencies,
  "go-mod": installGoProjectDependencies,
  "go-tools": installGoTools,
  "python-pip": installPythonPipDependencies,
  "bundler-gems": installBundlerRubyGems,
};

function getEnabledPackageManagers(): string[] {
  const defaultManagers = ["yarn", "go-mod", "go-tools", "python-pip", "bundler-gems"];
  const enabledManagers = process.env.ENABLED_PACKAGE_MANAGERS
    ? process.env.ENABLED_PACKAGE_MANAGERS.split(",")
    : defaultManagers;

  // Check for any invalid package managers
  const invalidManagers = enabledManagers.filter(manager => !packageManagerMap[manager]);
  if (invalidManagers.length > 0) {
    throw new Error(`Invalid package managers in ENABLED_PACKAGE_MANAGERS: ${invalidManagers.join(", ")}`);
  }

  return enabledManagers;
}

function getPackageManagersToSkip(): string[] {
  const skipManagers = process.env.SKIP_PACKAGE_MANAGERS
    ? process.env.SKIP_PACKAGE_MANAGERS.split(",")
    : [];

  // Warn about any package managers that don't exist in packageManagerMap
  skipManagers.forEach(manager => {
    if (!packageManagerMap[manager]) {
      console.warn(`Warning: Unknown package manager "${manager}" in SKIP_PACKAGE_MANAGERS`);
    }
  });

  return skipManagers;
}

export function installProjectDependencies(): void {
  console.log("Installing dependencies");

  for (const packageManager of getEnabledPackageManagers()) {
    if (getPackageManagersToSkip().includes(packageManager)) {
      console.log(`Skipping ${packageManager} dependencies installation`);
      continue;
    }

    if (!packageManagerMap[packageManager]) {
      console.error(`Unknown package manager: ${packageManager}`);
      process.exit(1);
    }

    packageManagerMap[packageManager]();
  }
}
