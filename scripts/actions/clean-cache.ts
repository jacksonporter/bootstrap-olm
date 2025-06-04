#!/usr/bin/env yarn node

import { Octokit } from "@octokit/rest";
import chalk from "chalk";

interface Cache {
  id: number;
  ref: string;
  key: string;
  version: string;
  last_accessed_at: string;
  created_at: string;
  size_in_bytes: number;
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

class CacheCleaner {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repository: string) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = repository.split("/");
    this.owner = owner;
    this.repo = repo;
  }

  private async getCaches(): Promise<Cache[]> {
    const { data: caches } = await this.octokit.rest.actions.getActionsCacheList({
      owner: this.owner,
      repo: this.repo,
    });
    return caches.actions_caches as Cache[];
  }

  private async deleteCache(cacheId: number): Promise<void> {
    await this.octokit.rest.actions.deleteActionsCacheById({
      owner: this.owner,
      repo: this.repo,
      cache_id: cacheId,
    });
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  }

  private async processCaches(caches: Cache[]): Promise<void> {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    // Group caches by key
    const cachesByKey = new Map<string, Cache[]>();
    for (const cache of caches) {
      if (!cachesByKey.has(cache.key)) {
        cachesByKey.set(cache.key, []);
      }
      cachesByKey.get(cache.key)!.push(cache);
    }

    // Process each group of caches
    for (const [key, cacheGroup] of cachesByKey) {
      // First, remove any caches older than 7 days or unused for 3 days
      const recentCaches = cacheGroup.filter(cache => {
        const lastAccessed = new Date(cache.last_accessed_at).getTime();
        const created = new Date(cache.created_at).getTime();
        const isRecent = now - lastAccessed < THREE_DAYS_MS;
        const isNotTooOld = now - created < SEVEN_DAYS_MS;

        if (!isRecent || !isNotTooOld) {
          const size = this.formatBytes(cache.size_in_bytes);
          const reason = !isRecent ? "unused for 3+ days" : "older than 7 days";
          Logger.warning(`Deleting cache for key: ${key} (Size: ${size}, Reason: ${reason}, Last accessed: ${new Date(cache.last_accessed_at).toISOString()})`);
          this.deleteCache(cache.id);
        }

        return isRecent && isNotTooOld;
      });

      // Then process remaining caches for duplicates
      if (recentCaches.length > 1) {
        Logger.info(`Found ${recentCaches.length} recent caches for key: ${key}`);

        // Sort by last accessed date, most recent first
        recentCaches.sort((a, b) =>
          new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime()
        );

        // Keep the most recently accessed cache
        const keepCache = recentCaches[0];
        Logger.success(`Keeping most recent cache for key: ${key} (Last accessed: ${new Date(keepCache.last_accessed_at).toISOString()})`);

        // Delete older caches
        for (const cache of recentCaches.slice(1)) {
          const size = this.formatBytes(cache.size_in_bytes);
          Logger.warning(`Deleting duplicate cache for key: ${key} (Size: ${size}, Last accessed: ${new Date(cache.last_accessed_at).toISOString()})`);
          await this.deleteCache(cache.id);
        }
      } else if (recentCaches.length === 1) {
        Logger.success(`Keeping single cache for key: ${key} (Last accessed: ${new Date(recentCaches[0].last_accessed_at).toISOString()})`);
      }
    }
  }

  async clean(): Promise<void> {
    Logger.info("Starting GitHub Actions cache cleanup");

    const caches = await this.getCaches();
    Logger.info(`Found ${caches.length} total caches`);

    await this.processCaches(caches);

    Logger.success("GitHub Actions cache cleanup completed");
  }
}

async function main() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
    Logger.error("Missing required environment variables: GITHUB_TOKEN or GITHUB_REPOSITORY");
    process.exit(1);
  }

  const cleaner = new CacheCleaner(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
  await cleaner.clean();
}

main().catch((error) => {
  Logger.error(`Error: ${error.message}`);
  process.exit(1);
});
