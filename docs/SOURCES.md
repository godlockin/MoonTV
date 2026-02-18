# Video Source Plugin System

MoonTV's video source registry sync is built on a modular plugin architecture with two extension points:

## Plugin Types

### 1. Crawlers (src/sync/crawlers/)

- **Purpose**: Discover, fetch and parse source registries/APIs/platforms
- **How to add**: Export an object matching `SourceCrawler` interface from a new file, then add to the orchestrator registry.

### 2. Adapters (src/sync/adapters/)

- **Purpose**: Normalize raw configs from different APIs/formats to standard shape
- **How to add**: Export object matching `SourceAdapter` and register in the orchestrator.

## CLI Usage

- **Manual sync**: `bun run tsx src/sync/orchestrator.ts --log`
- **Actions auto-sync**: See `.github/workflows/update-sources.yml`
- **Config output**: See generated `sources.json`

## Tests

- Type-only contract tests: `tests/sync/types.test.ts`
- Crawler/adapters: Corresponding `tests/sync/{crawlers,adapters}/*.test.ts`
- Orchestrator: `tests/sync/orchestrator.test.ts`

## Example: Adding a New Crawler

1. Create `src/sync/crawlers/myRegistryCrawler.ts`:

```ts
import { SourceCrawler } from '../types';
export const myRegistryCrawler: SourceCrawler = {
  name: 'myRegistry',
  async discover() {
    /* ... */ return [];
  },
};
```

2. Add to orchestrator's `crawlers[]` array.

## Example: Adding a New Adapter

1. Create `src/sync/adapters/fooAdapter.ts`:

```ts
import { SourceAdapter } from '../types';
export const fooAdapter: SourceAdapter = {
  /* ... */
};
```

2. Add to orchestrator `adapters[]` array.
