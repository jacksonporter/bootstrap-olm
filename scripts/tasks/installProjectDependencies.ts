#!/usr/bin/env yarn node

import { installProjectDependencies } from "../lib/project.ts";

function main(): void {
  installProjectDependencies();
}

main();
