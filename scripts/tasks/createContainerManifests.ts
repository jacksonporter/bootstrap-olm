#!/usr/bin/env yarn node

import { execSync } from "child_process";
import * as fs from "fs";
import * as toml from "toml";
import { getProjectRoot } from "../lib/project.ts";

type ImageType = "debug" | "production";
type BuildType = ImageType | "all";

interface ImageConfig {
  type: ImageType;
  repository: string;
  tag: string;
  target?: string;
  add_arch_before_manifest: boolean;
  containerfile: string;
  prepend_tag_with_version: boolean;
}

function readImageConfiguration(): Record<ImageType, ImageConfig> {
  const configPath = `${getProjectRoot()}/containers.toml`;
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Configuration file not found at ${configPath}`);
    process.exit(1);
  }

  const configContent = fs.readFileSync(configPath, "utf-8");
  const parsedConfig = toml.parse(configContent);

  // Validate and transform the TOML structure
  const config: Record<ImageType, ImageConfig> = {
    debug: {
      type: "debug",
      repository: parsedConfig.debug.repository,
      tag: parsedConfig.debug.tag,
      target: parsedConfig.debug.target,
      containerfile: parsedConfig.debug.containerfile,
      add_arch_before_manifest: parsedConfig.debug.add_arch_before_manifest,
      prepend_tag_with_version: parsedConfig.debug.prepend_tag_with_version,
    },
    production: {
      type: "production",
      repository: parsedConfig.production.repository,
      tag: parsedConfig.production.tag,
      containerfile: parsedConfig.production.containerfile,
      add_arch_before_manifest: parsedConfig.production.add_arch_before_manifest,
      prepend_tag_with_version: parsedConfig.production.prepend_tag_with_version,
    },
  };

  return config;
}

function readGoVersion(): string {
  return execSync("mise current go", { encoding: "utf8" }).trim();
}

function generateBuildCommand(config: ImageConfig, goVersion: string): string {
  const currentArchitecture = process.arch;
  const version = process.env.CONTAINER_VERSION

  let tag = config.tag;
  if (config.add_arch_before_manifest) {
    if (tag) {
      tag = `${tag}-${currentArchitecture}`;
    } else {
      tag = currentArchitecture;
    }
  }

  if (version && config.prepend_tag_with_version) {
    tag = `${version}-${tag}`;
  } else if (config.prepend_tag_with_version) {
    console.warn(
      `Warning: CONTAINER_VERSION is not set, but prepend_tag_with_version is true for ${config.type} image. Skipping adding version to tag.`,
    );
  }

  const fullURI = `${config.repository}:${tag || "latest"}`;

  const targetArg = config.target ? `--target ${config.target} ` : "";
  return (
    `podman build --build-arg GO_VERSION=${goVersion} ` +
    `${targetArg}` +
    `-t ${fullURI} ` +
    `-f ${config.containerfile} .`
  );
}

function runCommand(cmd: string): void {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (error) {
    console.error(`Error running command: ${cmd}`);
    if (error instanceof Error) {
      process.exit(1);
    }
    process.exit(error?.status || 1);
  }
}

function buildImage(config: ImageConfig, goVersion: string): void {
  if (!fs.existsSync(config.containerfile)) {
    console.error(`Error: Containerfile not found at ${config.containerfile}`);
    process.exit(1);
  }

  const cmd = generateBuildCommand(config, goVersion);
  console.log(`Building ${config.type} image...`);
  runCommand(cmd);
  console.log(`Successfully built ${config.type} image`);
}

function main(): void {
  const buildType = (process.argv[2] || "all") as BuildType;

  if (!["debug", "production", "all"].includes(buildType)) {
    console.error(
      "Invalid build type. Must be one of: debug, production, or all",
    );
    process.exit(1);
  }

  const goVersion = readGoVersion();
  console.log(`Building images with Go version: ${goVersion}`);

  const IMAGE_CONFIGURATION = readImageConfiguration();

  if (buildType === "all") {
    Object.values(IMAGE_CONFIGURATION).forEach((config) => {
      buildImage(config, goVersion);
    });
  } else {
    const config = IMAGE_CONFIGURATION[buildType];
    if (!config) {
      console.error(`Invalid build type: ${buildType}`);
      process.exit(1);
    }
    buildImage(config, goVersion);
  }
}

main();
