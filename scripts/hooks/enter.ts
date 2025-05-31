#!/usr/bin/env yarn node

import { installProjectDependencies } from "../tasks/installProjectDependencies.ts";

function main(): void {
  installProjectDependencies();
}

main();
