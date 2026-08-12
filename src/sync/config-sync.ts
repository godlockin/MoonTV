// config-sync.ts
//
// 每日同步流程:
//   1. 从开源仓库 tushen6/Tomorrow/caiji.json 拉取最新采集源列表
//   2. 解析出 api.php/provide/vod 端点 (type=1, vod 点播)
//   3. 对每个候选做健康检测 (2/3 连续成功 + JSON 协议有效)
//   4. 按 api URL 去重 (既存跳过)
//   5. 备份现有 config.json 到 .github/sync-backups/config.json.YYYY-MM-DD.json
//   6. 通过检测的新节点追加到 config.json
//   7. 输出 diff 到 sync-report.md + sources-report.json
//
// 用法:
//   pnpm tsx src/sync/config-sync.ts [--dry-run]
//   pnpm tsx src/sync/config-sync.ts --source <url>  (本地测试其他源)
//
// 设计要点:
//   - 既存节点按 api URL 严格匹配去重, 永不被覆盖
//   - 检测失败的候选不会进入 config.json
//   - 写入前先备份, 失败可回滚
//   - 输出 git-style diff 方便 PR review

import * as fs from 'fs';
import * as path from 'path';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// 默认数据源: tushen6/Tomorrow (caiji.json), 2167 stars, 3 天前 commit, 43+ 条 vod API
const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/tushen6/Tomorrow/master/caiji.json';
const SOURCE_TIMEOUT_MS = 20000;
const HEALTH_CHECK_TIMEOUT_MS = 10000;
const HEALTH_CHECK_ATTEMPTS = 3;
const HEALTH_CHECK_PASS_THRESHOLD = 2; // 至少 2/3 通过
const REQUEST_DELAY_MS = 300;

interface ApiSite {
  api: string;
  name: string;
  detail?: string;
}

interface ConfigFile {
  api_site: Record<string, ApiSite>;
  cache_time?: number;
  custom_category?: unknown[];
}

interface HealthCheckResult {
  source: DiscoveredSource;
  passed: boolean;
  attempts: number;
  successes: number;
  failures: number;
  errors: string[];
  responseTimesMs: number[];
  totalTimeMs: number;
  alreadyExists: boolean;
}

interface DiscoveredSource {
  api: string;
  name: string;
  origin: string; // 来源仓库标识 (用于审计)
  rawKey: string;
}

interface SyncSummary {
  timestamp: string;
  sourceUrl: string;
  discoveredCount: number;
  passed: number;
  failed: number;
  alreadyExisted: number;
  newlyAdded: ApiSite[];
  backupPath?: string;
  healthChecks: HealthCheckResult[];
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config.json');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.github', 'sync-backups');
const REPORT_JSON_PATH = path.join(PROJECT_ROOT, 'sources-report.json');
const REPORT_MD_PATH = path.join(PROJECT_ROOT, 'sync-report.md');

/**
 * 从候选生成符合规范的 key (小写字母/数字/下划线)
 */
export function generateKey(
  api: string,
  name: string,
  existingKeys: Set<string>
): string {
  let baseKey = '';
  try {
    const url = new URL(api);
    baseKey = url.hostname.replace(/^www\./, '').replace(/\./g, '_');
    baseKey = baseKey.toLowerCase().replace(/[^a-z0-9_]/g, '');
  } catch {
    baseKey = 'unknown';
  }
  if (!baseKey) baseKey = 'unknown';

  let key = baseKey;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }
  return key;
}

/**
 * 清理 name: 去除 "电影丨天堂" 这种 | 分隔符, 取左半
 */
function cleanName(raw: string): string {
  return raw.split(/[丨|]/)[0].trim() || raw.trim();
}

/**
 * 从开源源 (caiji.json) 拉取并解析 vod API 列表
 */
async function fetchDiscoveredSources(
  sourceUrl: string
): Promise<DiscoveredSource[]> {
  const origin = sourceUrl.includes('tushen6/Tomorrow')
    ? 'tushen6/Tomorrow'
    : new URL(sourceUrl).pathname.split('/').slice(1, 3).join('/');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

  let data: unknown;
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    data = await response.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error(
      `拉取 ${sourceUrl} 失败: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (typeof data !== 'object' || data === null || !('sites' in data)) {
    throw new Error(`源数据缺少 'sites' 字段: ${sourceUrl}`);
  }

  const sites = (data as { sites: unknown }).sites;
  if (!Array.isArray(sites)) {
    throw new Error(`'sites' 不是数组: ${sourceUrl}`);
  }

  const result: DiscoveredSource[] = [];
  for (const s of sites) {
    if (typeof s !== 'object' || s === null) continue;
    const site = s as Record<string, unknown>;
    if (site.type !== 1) continue; // 仅 vod 点播
    const api = typeof site.api === 'string' ? site.api : '';
    if (!api.includes('api.php/provide/vod')) continue;
    const rawName = typeof site.name === 'string' ? site.name : '';
    const rawKey = typeof site.key === 'string' ? site.key : '';
    if (!api || !rawName) continue;
    result.push({
      api: api.replace(/\/+$/, ''),
      name: cleanName(rawName),
      origin,
      rawKey,
    });
  }

  return result;
}

/**
 * 单次健康检测
 */
async function singleHealthCheck(apiBase: string): Promise<{
  ok: boolean;
  error?: string;
  responseTimeMs: number;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS
    );

    const baseUrl = apiBase.replace(/\/+$/, '');
    const url = `${baseUrl}/api.php/provide/vod?ac=videolist&pg=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - start;

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, responseTimeMs };
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: '响应不是 JSON', responseTimeMs };
    }

    if (
      typeof data !== 'object' ||
      data === null ||
      !('list' in data) ||
      !Array.isArray((data as { list: unknown }).list)
    ) {
      return {
        ok: false,
        error: 'JSON 缺少 list 数组 (非 macCMS V10 协议)',
        responseTimeMs,
      };
    }

    return { ok: true, responseTimeMs };
  } catch (e) {
    const responseTimeMs = Date.now() - start;
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      responseTimeMs,
    };
  }
}

/**
 * 3 次连续检测, 至少 2 次成功
 */
async function checkCandidate(apiBase: string): Promise<{
  passed: boolean;
  successes: number;
  failures: number;
  errors: string[];
  responseTimesMs: number[];
  totalTimeMs: number;
}> {
  const start = Date.now();
  const errors: string[] = [];
  const responseTimesMs: number[] = [];
  let successes = 0;
  let failures = 0;

  for (let i = 0; i < HEALTH_CHECK_ATTEMPTS; i++) {
    const result = await singleHealthCheck(apiBase);
    responseTimesMs.push(result.responseTimeMs);
    if (result.ok) {
      successes++;
    } else {
      failures++;
      errors.push(`attempt#${i + 1}: ${result.error}`);
    }
    if (i < HEALTH_CHECK_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  return {
    passed: successes >= HEALTH_CHECK_PASS_THRESHOLD,
    successes,
    failures,
    errors,
    responseTimesMs,
    totalTimeMs: Date.now() - start,
  };
}

/**
 * 加载 config.json
 */
function loadConfig(): ConfigFile {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { api_site: {}, cache_time: 7200 };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as ConfigFile;
}

/**
 * 备份 config.json 到 .github/sync-backups/config.json.YYYY-MM-DD.json
 * 返回备份文件路径, 用于 PR body / 回滚
 */
function backupConfig(): string | undefined {
  if (!fs.existsSync(CONFIG_PATH)) return undefined;
  const date = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(BACKUP_DIR, `config.json.${date}.json`);
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  fs.copyFileSync(CONFIG_PATH, backupPath);
  return backupPath;
}

/**
 * 写回 config.json (保持原 key 顺序, 仅追加新 key 在末尾)
 */
function saveConfig(config: ConfigFile): void {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * 生成 git-style diff 字符串
 */
function generateDiff(
  newlyAdded: Array<{ key: string; site: ApiSite }>
): string {
  if (newlyAdded.length === 0) {
    return '(无新增节点)';
  }

  const lines: string[] = [];
  lines.push('```diff');
  for (const { key, site } of newlyAdded) {
    const detailPart = site.detail ? `, "detail": "${site.detail}"` : '';
    lines.push(`+    "${key}": {`);
    lines.push(`+      "api": "${site.api}",`);
    lines.push(`+      "name": "${site.name}"${detailPart}`);
    lines.push(`+    }`);
  }
  lines.push('```');
  return lines.join('\n');
}

function generateMarkdownReport(
  summary: SyncSummary,
  diffText: string,
  dryRun: boolean
): string {
  const lines: string[] = [];
  lines.push('# config.json 每日同步报告');
  lines.push('');
  lines.push(`- **执行时间:** ${summary.timestamp}`);
  lines.push(
    `- **模式:** ${dryRun ? 'DRY-RUN (未实际修改)' : 'LIVE (已写入)'}`
  );
  lines.push(`- **数据源:** ${summary.sourceUrl}`);
  lines.push(`- **发现候选:** ${summary.discoveredCount}`);
  lines.push(`- **健康通过:** ${summary.passed}`);
  lines.push(`- **检测失败:** ${summary.failed}`);
  lines.push(`- **既存跳过:** ${summary.alreadyExisted}`);
  lines.push(`- **新增节点:** ${summary.newlyAdded.length}`);
  if (summary.backupPath) {
    lines.push(`- **备份路径:** \`${summary.backupPath}\``);
  }
  lines.push('');

  if (summary.newlyAdded.length > 0) {
    lines.push('## ✅ 新增资源节点');
    lines.push('');
    lines.push('| API | Name |');
    lines.push('|-----|------|');
    for (const site of summary.newlyAdded) {
      lines.push(`| \`${site.api}\` | ${site.name} |`);
    }
    lines.push('');
  }

  const failedChecks = summary.healthChecks.filter(
    (c) => !c.passed && !c.alreadyExists
  );
  if (failedChecks.length > 0) {
    lines.push('## ❌ 检测失败的候选 (不会进入 config.json)');
    lines.push('');
    lines.push('| API | Name | Success/Total | 错误 |');
    lines.push('|-----|------|---------------|------|');
    for (const c of failedChecks.slice(0, 20)) {
      const errSummary = c.errors.slice(0, 2).join('; ');
      lines.push(
        `| \`${c.source.api}\` | ${c.source.name} | ${c.successes}/${HEALTH_CHECK_ATTEMPTS} | ${errSummary} |`
      );
    }
    if (failedChecks.length > 20) {
      lines.push(`| ... | 还有 ${failedChecks.length - 20} 条失败 | | |`);
    }
    lines.push('');
  }

  lines.push('## 📝 config.json Diff');
  lines.push('');
  lines.push(diffText);
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const sourceIdx = argv.indexOf('--source');
  const sourceUrl =
    sourceIdx !== -1 && argv[sourceIdx + 1]
      ? argv[sourceIdx + 1]
      : DEFAULT_SOURCE_URL;

  // eslint-disable-next-line no-console
  console.log(
    `[config-sync] ${dryRun ? '干跑' : '同步'}模式, 数据源: ${sourceUrl}`
  );

  // 1. 拉取开源源
  let discovered: DiscoveredSource[];
  try {
    discovered = await fetchDiscoveredSources(sourceUrl);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[config-sync] FATAL: ${e instanceof Error ? e.message : String(e)}`
    );
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`[config-sync] 发现 ${discovered.length} 条 vod 候选`);

  // 2. 加载 config
  const config = loadConfig();
  const existingKeys = new Set(Object.keys(config.api_site));
  const existingApis = new Set(
    Object.values(config.api_site).map((s) => s.api.replace(/\/+$/, ''))
  );
  // eslint-disable-next-line no-console
  console.log(`[config-sync] config.json 既存 ${existingKeys.size} 个节点`);

  // 3. 去重 + 健康检测
  const healthChecks: HealthCheckResult[] = [];
  const newlyAdded: ApiSite[] = [];

  for (const source of discovered) {
    if (existingApis.has(source.api)) {
      healthChecks.push({
        source,
        passed: true,
        attempts: 0,
        successes: 0,
        failures: 0,
        errors: [],
        responseTimesMs: [],
        totalTimeMs: 0,
        alreadyExists: true,
      });
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(`  🔍 ${source.api}`);
    const result = await checkCandidate(source.api);
    healthChecks.push({
      source,
      ...result,
      attempts: HEALTH_CHECK_ATTEMPTS,
      alreadyExists: false,
    });

    if (result.passed) {
      const key = generateKey(source.api, source.name, existingKeys);
      existingKeys.add(key);
      newlyAdded.push({ api: source.api, name: source.name });
      // eslint-disable-next-line no-console
      console.log(
        `    ✅ ${result.successes}/${HEALTH_CHECK_ATTEMPTS} → key="${key}"`
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`    ❌ ${result.successes}/${HEALTH_CHECK_ATTEMPTS}`);
    }
  }

  // 4. 备份
  let backupPath: string | undefined;
  if (!dryRun && newlyAdded.length > 0) {
    backupPath = backupConfig();
    // eslint-disable-next-line no-console
    console.log(`[config-sync] 已备份到 ${backupPath}`);
  }

  // 5. 追加新节点到 config
  for (const site of newlyAdded) {
    const key = generateKey(site.api, site.name, existingKeys);
    config.api_site[key] = site;
    existingKeys.add(key);
  }

  // 6. diff (用原始 keys 基准)
  const diffEntries = newlyAdded.map((site) => {
    const beforeKeys = new Set(Object.keys(loadConfig()));
    return { key: generateKey(site.api, site.name, beforeKeys), site };
  });

  // 7. 写文件 (仅 LIVE 且有新增)
  if (!dryRun && newlyAdded.length > 0) {
    saveConfig(config);
    // eslint-disable-next-line no-console
    console.log(`[config-sync] 已写入 config.json (+${newlyAdded.length})`);
  }

  // 8. 生成报告
  const summary: SyncSummary = {
    timestamp: new Date().toISOString(),
    sourceUrl,
    discoveredCount: discovered.length,
    passed: healthChecks.filter((c) => c.passed && !c.alreadyExists).length,
    failed: healthChecks.filter((c) => !c.passed && !c.alreadyExists).length,
    alreadyExisted: healthChecks.filter((c) => c.alreadyExists).length,
    newlyAdded,
    backupPath,
    healthChecks,
  };

  if (!dryRun) {
    fs.writeFileSync(
      REPORT_JSON_PATH,
      JSON.stringify(summary, null, 2),
      'utf-8'
    );
  }
  fs.writeFileSync(
    REPORT_MD_PATH,
    generateMarkdownReport(summary, generateDiff(diffEntries), dryRun),
    'utf-8'
  );

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  // eslint-disable-next-line no-console
  console.log(
    `[config-sync] 完成: 通过=${summary.passed} 失败=${summary.failed} 既存=${summary.alreadyExisted} 新增=${summary.newlyAdded.length}`
  );
  // eslint-disable-next-line no-console
  console.log(`[config-sync] 报告: ${REPORT_MD_PATH}`);
}

// 仅在作为 CLI 入口执行时运行 main
const isMainModule = (() => {
  if (!require.main?.filename) return false;
  const base = path.basename(require.main.filename);
  return base === 'config-sync.ts' || base === 'config-sync.js';
})();

if (isMainModule) {
  main().catch((e: unknown) => {
    const errObj =
      e instanceof Error
        ? { message: e.message, stack: e.stack }
        : { value: e };
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ type: 'config-sync-fatal', error: errObj }));
    process.exit(1);
  });
}
