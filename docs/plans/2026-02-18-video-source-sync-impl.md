# Video Source Discovery & Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an extensible crawler/plugin system to discover, test, deduplicate, and normalize online video source registries/APIs, merging with default sources in code and outputting a validated unified config.

**Architecture:**

- All registry/API crawling is handled by plugin-style "crawler" modules with a simple interface. Each finds/parses one type of registry or list.
- Normalization of heterogeneous formats is handled by corresponding adapter modules.
- An orchestrator runs the workflow, merges/dedupes all sources, normalizes, healthchecks, and writes the config. Tied to a scheduled GitHub Action and supports CLI/manual runs.

**Tech Stack:** TypeScript (strict), Node.js, GitHub Actions

---

### Task 1: Set Up Sync Directory Structure

**Files:**

- Create: `src/sync/orchestrator.ts`
- Create: `src/sync/crawlers/`
- Create: `src/sync/adapters/`
- Create: `src/sync/defaultSources.ts`
- Create: `src/sync/types.ts`
- Test: N/A (structural)

_Step 1: Create above directories/files empty_

_Step 2: Commit_

```bash
git add src/sync/
git commit -m "chore: scaffold sync plugin module directories"
```

---

### Task 2: Define Types and Core Interfaces

**Files:**

- Modify: `src/sync/types.ts`
- Test: `tests/sync/types.test.ts`

_Step 1: Write types/interfaces for `SourceCrawler`, `SourceAdapter`, `RawSourceConfig`, `StandardizedSource`_

_Step 2: Write unit tests to ensure types are enforced (compile error expected on contract violations)_

_Step 3: Commit_

```bash
git add src/sync/types.ts tests/sync/types.test.ts
git commit -m "feat: add interfaces for source crawlers, adapters, configs"
```

---

### Task 3: Add Default Source List

**Files:**

- Modify: `src/sync/defaultSources.ts`
- Test: `tests/sync/defaultSources.test.ts`

_Step 1: Export an array of canonical default source configs (from prior project state)_

_Step 2: Write a test to ensure defaults are valid (no duplicate IDs, required fields present)_

_Step 3: Commit_

```bash
git add src/sync/defaultSources.ts tests/sync/defaultSources.test.ts
git commit -m "feat: add baseline default video sources"
```

---

### Task 4: Implement Example Crawler Plugin

**Files:**

- Create: `src/sync/crawlers/githubRegistryCrawler.ts`
- Test: `tests/sync/crawlers/githubRegistryCrawler.test.ts`

_Step 1: Implement minimal crawler plugin that fetches/parses a public registry index (mocked for test)_

_Step 2: Write tests for crawler: returns array, handles fetch failure, clear errors_

_Step 3: Commit_

```bash
git add src/sync/crawlers/githubRegistryCrawler.ts tests/sync/crawlers/githubRegistryCrawler.test.ts
git commit -m "feat: implement sample crawler and tests"
```

---

### Task 5: Implement Example Adapter Plugin

**Files:**

- Create: `src/sync/adapters/doubanAdapter.ts`
- Test: `tests/sync/adapters/doubanAdapter.test.ts`

_Step 1: Implement adapter for normalizing Douban-like API configs to standard fields_

_Step 2: Write tests for adapter: correctly detects/apply `supports()`, passes/fails healthcheck, produces all required fields_

_Step 3: Commit_

```bash
git add src/sync/adapters/doubanAdapter.ts tests/sync/adapters/doubanAdapter.test.ts
git commit -m "feat: add douban adapter with tests"
```

---

### Task 6: Orchestrator Implementation: Plugin Auto-Discovery & Workflow

**Files:**

- Modify: `src/sync/orchestrator.ts`
- Test: `tests/sync/orchestrator.test.ts`

_Step 1: Implement auto-loading of all `crawlers/` and `adapters/` (require/\_import glob)_
_Step 2: Load defaults, run all crawlers, merge results, deduplicate by unique key_
_Step 3: For each, find correct adapter, run normalization_
_Step 4: For each, healthcheck via adapter (or generic)_
_Step 5: Write output to `sources.json` (in project root or `src/sync/`), with disabled/failing sources clearly annotated_
_Step 6: Expose CLI params: e.g. `--update`, `--dry-run`, `--log`_
_Step 7: Write orchestrator workflow unit/integration tests (mocks for plugin I/O)_
_Step 8: Commit_

```bash
git add src/sync/orchestrator.ts tests/sync/orchestrator.test.ts
git commit -m "feat: orchestrator handles plugin load, normalization, output"
```

---

### Task 7: GitHub Action for Scheduled Sync

**Files:**

- Create: `.github/workflows/update-sources.yml`
- Test: Manual run/PR status check

_Step 1: Write a workflow file to schedule/trigger orchestrator CLI and commit changes_

_Step 2: Test with manual dispatch/branch, verify commit log and config diff_

_Step 3: Commit_

```bash
git add .github/workflows/update-sources.yml
git commit -m "ci: github action to schedule and auto-commit source sync"
```

---

### Task 8: Developer Documentation

**Files:**

- Create: `docs/SOURCES.md`
- Modify: `README.md`
- Test: None (markdown/docs)

_Step 1: Document how to add a new crawler/adapter plugin (copy/paste code sample, file/dir patterns)_

_Step 2: Show CLI usage, test instructions, and config format reference_

_Step 3: Commit_

```bash
git add docs/SOURCES.md README.md
git commit -m "docs: add plugin extension and usage docs"
```

---

### Task 9: Manual E2E and Validation

**Files:**

- Run: `node src/sync/orchestrator.ts --update`

_Step 1: Verify updated config/output, adapters run, errors graceful, action triggers and commits as expected_

_Step 2: Add tests/scenarios for all main edge cases encountered_

_Step 3: Commit any fixes, edge-case tests, or doc improvements found during validation_

---

**Plan complete and saved to `docs/plans/2026-02-18-video-source-sync-impl.md`.**

Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution, review at checkpoints.

**Which approach would you like to use for implementation?**
