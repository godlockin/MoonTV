// Orchestrator: loads all plugins, merges/dedupes results, normalizes, healthchecks, writes unified sources.json
import { defaultSources } from './defaultSources';
import { SourceCrawler, SourceAdapter, RawSourceConfig, StandardizedSource } from './types';

import { githubRegistryCrawler } from './crawlers/githubRegistryCrawler';
import { doubanAdapter } from './adapters/doubanAdapter';
import * as fs from 'fs';

const crawlers: SourceCrawler[] = [githubRegistryCrawler];
const adapters: SourceAdapter[] = [doubanAdapter];

export async function runOrchestration(log = false) {
  // Discover sources via crawlers
  const discovered = (await Promise.all(crawlers.map(c => c.discover()))).flat();
  const allRaw: RawSourceConfig[] = [...defaultSources, ...discovered];

  // Deduplicate by id
  const mergedMap = new Map<string, RawSourceConfig>();
  for (const src of allRaw) mergedMap.set(src.id, src);
  const merged = Array.from(mergedMap.values());

  // Normalize
  const normalized: StandardizedSource[] = merged.map(raw => {
    const adapter = adapters.find(a => a.supports(raw));
    if (!adapter) throw new Error(`No adapter found for ${raw.id}`);
    return adapter.toStandard(raw);
  });

  // Healthcheck
  for (const src of normalized) {
    const adapter = adapters.find(a => a.supports(src));
    src.active = adapter && adapter.healthcheck ? await adapter.healthcheck(src) : true;
    src.health = src.active ? 'healthy' : 'failing';
  }

  // Write out
  fs.writeFileSync('sources.json', JSON.stringify(normalized, null, 2));
  if (log) console.log(normalized);
  return normalized;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const log = argv.includes('--log');
  runOrchestration(log).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
