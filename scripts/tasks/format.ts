#!/usr/bin/env yarn node

import { execSync } from "child_process";

function formatUsingPrettier(): void {
  console.log("Formatting code using Prettier");
  execSync("yarn prettier --write .");
}

function formatUsingGo(): void {
  console.log("Formatting code using Go fmt...");
  execSync("go fmt ./...");
}

function main(): void {
  console.log("Formatting code");
  formatUsingPrettier();
  formatUsingGo();
}

main();
