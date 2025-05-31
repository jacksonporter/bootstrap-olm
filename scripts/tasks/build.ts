#!/usr/bin/env yarn node

import { execSync } from "child_process";

function buildWindows(): void {
  console.log("Building for Windows");
  execSync("go build -o bootstrap-olm.exe main.go", {
    stdio: "inherit",
  });
}

function buildUnixLike(): void {
  console.log("Building for Unix-like systems");
  execSync("go build -o bootstrap-olm main.go", {
    stdio: "inherit",
  });
}

function main(): void {
  console.log("Building bootstrap-olm");

  switch (process.platform) {
    case "win32":
      buildWindows();
      break;
    default:
      buildUnixLike();
      break;
  }
}

main();
