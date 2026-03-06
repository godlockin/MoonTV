# Video Source Discovery, Sync & Adapter System: Design Doc

**Date:** 2026-02-18

---

## Overview

Design an extensible system to regularly discover, test, deduplicate, and normalize video source registries/APIs. Integrates default (code-defined) and dynamically crawled open sources into a unified config, driven by scheduled GitHub Actions.

---

## 1. System Architecture

### A. Default Source Set

- Maintained in `defaultSources.ts`.
- Always included in the sync result; provides baseline stability.

### B. Plugin-Based Crawlers

- Each crawler module in `src/sync/crawlers/` implements:
  - `name: string`
  - `crawl(): Promise<RawSourceConfig[]>`
- Handles fetching, parsing, and initial error handling for a specific source/registry type.
- Extensible: new crawlers can be added as standalone files.

### C. Adapters/"Adopters"

- Each adapter module in `src/sync/adapters/` implements:
  - `supports(raw: RawSourceConfig): boolean` (detection)
  - `adopt(raw: RawSourceConfig): StandardizedSource` (normalization)
  - Optional: `test(source: StandardizedSource): Promise<boolean>` (healthcheck)
- Converts heterogeneous source configs to a standard schema.

### D. Orchestrator

- Script in `src/sync/orchestrator.ts` coordinates:
  - Loads defaults / runs all crawlers
  - Deduplication & merge
  - Adapter normalization
  - Source healthchecks
  - Output config/document update
- CLI for manual runs; tied to a scheduled GitHub Action for automation.

### E. Directory Structure

```
src/
  sync/
    orchestrator.ts
    defaultSources.ts
    adapters/
      ... (1 per source format)
    crawlers/
      ... (1 per registry/API type)
```

---

## 2. Sync/Merge/Dataflow

1. Load defaults from `defaultSources.ts`
2. Dynamically load/run all crawler plugins (`crawlers/`)
3. Merge results, dedupe by `id`/canonical `apiUrl` (newest/healthiest wins)
4. Normalize each merged item using relevant adapter in `adapters/`
5. Run healthchecks (adapter or generic); filter/annotate failing sources
6. Save final list to config (`sources.json`), plus docs if needed

---

## 3. Crawler/Adapter Plugin Standards

### Crawler Example

```typescript
const myCrawler: SourceCrawler = {
  name: 'GitHub JSON index crawler',
  async crawl() {
    // ...
    return sources;
  },
};
export default myCrawler;
```

### Adapter Example

```typescript
const myAdapter: SourceAdapter = {
  supports(raw) { return raw.type === 'bilibili_api'; },
  adopt(raw) { return { id: ..., name: ..., apiUrl: ..., type: ..., ... }; },
  async test(source) { ... }
};
export default myAdapter;
```

- Registration is automatic (no central registry)
- `RawSourceConfig` can be flexible; `StandardizedSource` must include:
  - `id: string`
  - `name: string`
  - `apiUrl: string`
  - `type: string`
  - `enabled: boolean`
  - `lastChecked: ISOString` (optional)

---

## 4. Orchestration Flow & Error Handling

1. Load defaults & crawlers
2. Merge, deduplicate
3. Use `supports` to select adapter, normalize all
4. Run health/test
5. Write output config and docs
6. Print logs/summary

- All plugin/adapters must NOT throw uncaught errors; failures after logging return empty values.
- Healthcheck failures = excluded & logged (with annotation for review).
- Process fails fully only if all sources are invalid/down.

---

## 5. Output Formats

### sources.json

```jsonc
[
  {
    "id": "douban-main",
    "name": "Douban Video",
    "apiUrl": "https://api.douban.com/v2/video",
    "type": "json",
    "enabled": true,
    "lastChecked": "2026-02-18T12:00:00.000Z",
  },
]
```

### Optional: Markdown/CSV table (for docs/debugging)

- Columns: Name, ID, API URL, Status, Last Checked

### Commit/Action

- Run in GitHub Action; commit changes with summary
- Log all key events, successes, and failures

---

## 6. Extensibility & Maintenance

- To add a new registry/API, create a new file in `crawlers/` (and in `adapters/` if a new format is needed).
- No changes to orchestrator or core logic required for most future integrations.
- Fields/formats adaptable via adapters.

---

**Approved by user on: 2026-02-18**
