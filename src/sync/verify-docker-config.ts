// 验证脚本: 在临时目录模拟 DOCKER_ENV=true 场景, 验证 loadDockerConfig 行为
// 不动真实 config.json / config_bak.json
/* eslint-disable no-console, simple-import-sort/imports */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'moontv-config-test-'));
console.log('[verify] TMP dir:', TMP);

// 模拟 config.json (基础)
fs.writeFileSync(
  path.join(TMP, 'config.json'),
  JSON.stringify(
    {
      cache_time: 7200,
      custom_category: [{ name: '华语', type: 'movie', query: '华语' }],
      api_site: {
        bfzy: { api: 'https://bfzy.com', name: '暴风' },
        mainonly: { api: 'https://main-only.com', name: '主用专属' },
      },
    },
    null,
    2
  )
);

// 模拟 config_bak.json (备份)
fs.writeFileSync(
  path.join(TMP, 'config_bak.json'),
  JSON.stringify(
    {
      api_site: {
        bfzy: { api: 'https://OVERRIDE-SHOULD-NOT-WORK.com', name: '不应覆盖' },
        bakonly: { api: 'https://bak-only.com', name: '备份专属' },
      },
    },
    null,
    2
  )
);

// 模拟 config_extra.json (其他, 验证遍历)
fs.writeFileSync(
  path.join(TMP, 'config_extra.json'),
  JSON.stringify(
    {
      api_site: {
        extranode: { api: 'https://extra.com', name: '额外节点' },
      },
    },
    null,
    2
  )
);

// 模拟非 config*.json (应被忽略)
fs.writeFileSync(
  path.join(TMP, 'package.json'),
  JSON.stringify({ name: 'fake' })
);

// 提取 loadDockerConfig 函数 (复制自 src/lib/config.ts)
function loadDockerConfig(): {
  cache_time?: number;
  api_site: Record<string, { api: string; name: string; detail?: string }>;
  custom_category?: unknown[];
} {
  const fsM = fs;
  const pathM = path;
  const cwd = TMP;

  const allFiles = fsM.readdirSync(cwd);
  const configFiles = allFiles
    .filter((f) => f.startsWith('config') && f.endsWith('.json'))
    .sort((a, b) => {
      if (a === 'config.json') return -1;
      if (b === 'config.json') return 1;
      return a.localeCompare(b);
    });

  const merged: ReturnType<typeof loadDockerConfig> = { api_site: {} };

  for (const file of configFiles) {
    const filePath = pathM.join(cwd, file);
    const parsed = JSON.parse(fsM.readFileSync(filePath, 'utf-8'));
    if (file === 'config.json') {
      for (const [k, v] of Object.entries(parsed)) {
        if (k !== 'api_site') {
          (merged as unknown as Record<string, unknown>)[k] = v;
        }
      }
    }
    if (parsed.api_site) {
      for (const [key, value] of Object.entries(
        parsed.api_site as Record<string, { api: string; name: string }>
      )) {
        if (!merged.api_site[key]) {
          merged.api_site[key] = value;
        }
      }
    }
  }

  return merged;
}

const result = loadDockerConfig();

// === 断言 ===
const checks: Array<[string, boolean]> = [
  // 1. config.json 提供根级配置
  ['cache_time=7200 来自 config.json', result.cache_time === 7200],
  [
    'custom_category 来自 config.json',
    Array.isArray(result.custom_category) &&
      result.custom_category.length === 1,
  ],

  // 2. config.json 的 api_site 优先
  [
    'bfzy.api 来自 config.json (未被 bak 覆盖)',
    result.api_site.bfzy?.api === 'https://bfzy.com',
  ],

  // 3. config_bak.json 追加新节点
  [
    'bakonly 来自 config_bak.json',
    result.api_site.bakonly?.api === 'https://bak-only.com',
  ],

  // 4. config_extra.json 也被遍历
  [
    'extranode 来自 config_extra.json',
    result.api_site.extranode?.api === 'https://extra.com',
  ],

  // 5. package.json 被忽略
  ['package.json 未被当作配置', !('name' in result)],

  // 6. 总数正确: bfzy(来自 config.json) + mainonly + bakonly + extranode = 4
  //    bfzy 在 config_bak.json 也有, 但 config.json 优先, 不重复
  ['api_site 总数=4', Object.keys(result.api_site).length === 4],
  // 7. bfzy 来源是 config.json (因为按文件排序 config.json 第一)
  ['bfzy 来源是 config.json 的 name', result.api_site.bfzy?.name === '暴风'],
];

let pass = 0;
let fail = 0;
for (const [label, ok] of checks) {
  if (ok) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.error(`  ❌ ${label}`);
    fail++;
  }
}

// 清理
fs.rmSync(TMP, { recursive: true, force: true });

console.log(`\n[verify] ${pass}/${pass + fail} 通过`);
if (fail > 0) {
  console.error('[verify] FAILED');
  process.exit(1);
}
console.log('[verify] ✅ 全部通过');
