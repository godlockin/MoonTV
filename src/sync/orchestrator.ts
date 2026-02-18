// Orchestrator: loads all plugins, merges/dedupes results, normalizes, healthchecks
import { doubanAdapter } from './adapters/doubanAdapter';
import { githubRegistryCrawler } from './crawlers/githubRegistryCrawler';
import { defaultSources } from './defaultSources';
import {
  RawSourceConfig,
  SourceAdapter,
  SourceCrawler,
  StandardizedSource,
} from './types';

const crawlers: SourceCrawler[] = [githubRegistryCrawler];
const adapters: SourceAdapter[] = [doubanAdapter];

export interface SyncResult {
  sources: StandardizedSource[];
  stats: {
    total: number;
    active: number;
    failed: number;
    newDiscovered: number;
  };
}

export async function runOrchestration(
  log = false,
): Promise<StandardizedSource[]> {
  // Discover sources via crawlers
  const discovered = (
    await Promise.all(crawlers.map((c) => c.discover()))
  ).flat();
  const allRaw: RawSourceConfig[] = [...defaultSources, ...discovered];

  // Deduplicate by id
  const mergedMap = new Map<string, RawSourceConfig>();
  for (const src of allRaw) mergedMap.set(src.id, src);
  const merged = Array.from(mergedMap.values());

  // Normalize (skip sources without adapters)
  const normalized: StandardizedSource[] = [];
  for (const raw of merged) {
    const adapter = adapters.find((a) => a.supports(raw));
    if (!adapter) {
      // eslint-disable-next-line no-console
      console.warn(`No adapter found for ${raw.id}, skipping`);
      continue;
    }
    normalized.push(adapter.toStandard(raw));
  }

  // Healthcheck
  for (const src of normalized) {
    const adapter = adapters.find((a) => a.supports(src));
    src.active =
      adapter && adapter.healthcheck ? await adapter.healthcheck(src) : true;
    src.health = src.active ? 'healthy' : 'failing';
  }

  // Write to file (Node.js environment only, skip in Edge Runtime)
  try {
    // Check if we're in Node.js by checking for process.versions.node
    const isNode =
      typeof globalThis !== 'undefined' &&
      typeof (
        globalThis as typeof globalThis & {
          process?: { versions?: { node?: string } };
        }
      ).process !== 'undefined' &&
      (
        globalThis as typeof globalThis & {
          process?: { versions?: { node?: string } };
        }
      ).process?.versions?.node !== undefined;

    if (isNode) {
      // Use dynamic import to avoid webpack bundling fs in Edge Runtime
      const fs = await import('fs');
      fs.writeFileSync('sources.json', JSON.stringify(normalized, null, 2));
    }
  } catch {
    // Ignore file write errors in Edge Runtime or if fs is not available
  }

  // eslint-disable-next-line no-console
  if (log) console.log(normalized);
  return normalized;
}

import { validateEnv } from './validateEnv';

if (require.main === module) {
  try {
    validateEnv();
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        type: 'fatal',
        error: e instanceof Error ? e.message : String(e),
        at: 'startup',
      }),
    );
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const log = argv.includes('--log');
  runOrchestration(log).catch((e: unknown) => {
    const errObj =
      e instanceof Error
        ? { message: e.message, stack: e.stack }
        : { value: e };
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        type: 'runOrchestration-fatal',
        error: errObj,
        at: 'orchestrator',
      }),
    );
    process.exit(1);
  });
}
