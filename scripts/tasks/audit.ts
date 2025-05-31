#!/usr/bin/env yarn node

import { execSync } from "child_process";

function auditUsingPreCommit(): void {
  console.log("Auditing code using Pre Commit");
  execSync("pre-commit run --all-files", { stdio: "inherit" });
}

function main(): void {
  console.log("Auditing code");
  auditUsingPreCommit();
}

main();
