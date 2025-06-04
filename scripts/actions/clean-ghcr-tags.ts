#!/usr/bin/env yarn node

import { Octokit } from "@octokit/rest";
import chalk from "chalk";

interface PackageVersion {
  id: number;
  name: string;
  metadata: {
    container: {
      tags: string[];
    };
  };
}

interface TagInfo {
  sha: string;
  tags: string[];
}

interface Package {
  name: string;
  package_type: string;
}

class Logger {
  static info(message: string) {
    console.info(chalk.blue("ℹ"), message);
  }

  static success(message: string) {
    console.info(chalk.green("✓"), message);
  }

  static warning(message: string) {
    console.warn(chalk.yellow("⚠"), message);
  }

  static error(message: string) {
    console.error(chalk.red("✖"), message);
  }
}

class GHCRCleaner {
  private octokit: Octokit;
  private username: string;
  private repo: string;

  constructor(token: string, repository: string) {
    this.octokit = new Octokit({ auth: token });
    const [username, repo] = repository.split("/");
    this.username = username;
    this.repo = repo;
  }

  private async getContainerPackages(): Promise<Package[]> {
    const { data: packages } = await this.octokit.rest.packages.listPackagesForUser({
      package_type: "container",
      username: this.username,
    });
    return packages;
  }

  private async getPackageVersions(pkg: Package): Promise<PackageVersion[]> {
    const { data: versions } = await this.octokit.rest.packages.getAllPackageVersionsForPackageOwnedByUser({
      package_name: pkg.name,
      package_type: "container",
      username: this.username,
    });
    return versions as PackageVersion[];
  }

  private groupTagsBySha(versions: PackageVersion[]): Map<string, TagInfo> {
    const tagsBySha = new Map<string, TagInfo>();
    for (const version of versions) {
      for (const tag of version.metadata.container.tags) {
        const sha = version.name;
        if (!tagsBySha.has(sha)) {
          tagsBySha.set(sha, { sha, tags: [] });
        }
        tagsBySha.get(sha)!.tags.push(tag);
      }
    }
    return tagsBySha;
  }

  private async deletePackageVersion(pkg: Package, versionId: number): Promise<void> {
    await this.octokit.rest.packages.deletePackageVersionForUser({
      package_name: pkg.name,
      package_type: "container",
      package_version_id: versionId,
      username: this.username,
    });
  }

  private async checkRefExists(refName: string): Promise<boolean> {
    try {
      await this.octokit.rest.git.getRef({
        owner: this.username,
        repo: this.repo,
        ref: `heads/${refName}`,
      });
      return true;
    } catch (error) {
      try {
        await this.octokit.rest.pulls.get({
          owner: this.username,
          repo: this.repo,
          pull_number: parseInt(refName),
        });
        return true;
      } catch (error) {
        return false;
      }
    }
  }

  private async processTestingTags(pkg: Package, tagsBySha: Map<string, TagInfo>, versions: PackageVersion[]): Promise<void> {
    const testingTags = new Set<string>();
    const nonTestingTags = new Set<string>();

    for (const [_, info] of tagsBySha) {
      for (const tag of info.tags) {
        if (tag.startsWith("testing-")) {
          testingTags.add(tag);
        } else {
          nonTestingTags.add(tag);
        }
      }
    }

    if (testingTags.size > 0 && testingTags.size + nonTestingTags.size > 1) {
      if (nonTestingTags.size === 0) {
        Logger.info(`All tags are testing tags for ${pkg.name}, keeping one`);
        const firstTestingTag = Array.from(testingTags)[0];
        testingTags.delete(firstTestingTag);
        Logger.success(`Keeping testing tag: ${pkg.name}:${firstTestingTag}`);
      }

      for (const tag of testingTags) {
        Logger.warning(`Deleting testing tag: ${pkg.name}:${tag}`);
        for (const [sha, info] of tagsBySha) {
          if (info.tags.includes(tag)) {
            const version = versions.find(v => v.name === sha);
            if (version) {
              await this.deletePackageVersion(pkg, version.id);
            }
            break;
          }
        }
      }
    }
  }

  private async processRefTags(pkg: Package, tagsBySha: Map<string, TagInfo>, versions: PackageVersion[]): Promise<void> {
    const refTags = new Set<string>();
    const nonTestingTags = new Set<string>();

    for (const [_, info] of tagsBySha) {
      for (const tag of info.tags) {
        if (!tag.startsWith("testing-")) {
          nonTestingTags.add(tag);
        }
        const refName = tag.split("-")[0];
        if (!(await this.checkRefExists(refName))) {
          refTags.add(tag);
        }
      }
    }

    if (refTags.size > 0 && refTags.size + nonTestingTags.size > 1) {
      for (const tag of refTags) {
        Logger.warning(`Deleting tag for non-existent ref: ${pkg.name}:${tag}`);
        for (const [sha, info] of tagsBySha) {
          if (info.tags.includes(tag)) {
            const version = versions.find(v => v.name === sha);
            if (version) {
              await this.deletePackageVersion(pkg, version.id);
            }
            break;
          }
        }
      }
    }
  }

  private async processUntaggedImages(pkg: Package, versions: PackageVersion[]): Promise<void> {
    // Get all versions that have no tags
    const untaggedVersions = versions.filter(version =>
      version.metadata.container.tags.length === 0
    );

    // If we have untagged versions and more than one version total
    if (untaggedVersions.length > 0 && versions.length > 1) {
      Logger.info(`Found ${untaggedVersions.length} untagged versions in ${pkg.name}`);

      // Keep one untagged version if all versions are untagged
      if (untaggedVersions.length === versions.length) {
        const keepVersion = untaggedVersions[0];
        Logger.success(`Keeping one untagged version in ${pkg.name} (SHA: ${keepVersion.name})`);
        untaggedVersions.shift(); // Remove the version we're keeping
      }

      // Delete remaining untagged versions
      for (const version of untaggedVersions) {
        Logger.warning(`Deleting untagged version in ${pkg.name} (SHA: ${version.name})`);
        await this.deletePackageVersion(pkg, version.id);
      }
    }
  }

  async clean(): Promise<void> {
    Logger.info("Starting GHCR tags cleanup");

    const packages = await this.getContainerPackages();
    Logger.info(`Found ${packages.length} container packages`);

    for (const pkg of packages) {
      Logger.info(`Processing package: ${pkg.name}`);
      const versions = await this.getPackageVersions(pkg);
      const tagsBySha = this.groupTagsBySha(versions);

      await this.processTestingTags(pkg, tagsBySha, versions);
      await this.processRefTags(pkg, tagsBySha, versions);
      await this.processUntaggedImages(pkg, versions);
    }

    Logger.success("GHCR tags cleanup completed");
  }
}

async function main() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
    Logger.error("Missing required environment variables: GITHUB_TOKEN or GITHUB_REPOSITORY");
    process.exit(1);
  }

  const cleaner = new GHCRCleaner(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
  await cleaner.clean();
}

main().catch((error) => {
  Logger.error(`Error: ${error.message}`);
  process.exit(1);
});
