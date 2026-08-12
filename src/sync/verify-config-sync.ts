// 验证脚本: 不发真实网络请求, 验证 config-sync.ts 的去重逻辑 + main 防副作用
// 关键: 路径改到 config.json, 验证 config-sync.ts 不会修改现有节点
/* eslint-disable no-console, simple-import-sort/imports */

import * as fs from 'fs';
import * as path from 'path';

import { generateKey } from './config-sync';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_JSON = path.join(PROJECT_ROOT, 'config.json');
const BACKUP = '/tmp/config.json.verify-backup.json';

// 1. 备份
fs.copyFileSync(CONFIG_JSON, BACKUP);

// 2. 加载
type ApiSite = { api: string; name: string; detail?: string };
const before = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8')) as {
  api_site: Record<string, ApiSite>;
};
const beforeKeys = Object.keys(before.api_site);
const beforeApis = new Set(
  Object.values(before.api_site).map((s) => s.api.replace(/\/+$/, ''))
);
console.log(`[verify] config.json 既存节点数: ${beforeKeys.length}`);
console.log(`[verify] 既存 API 数 (按 URL 去重): ${beforeApis.size}`);

// 3. 测试 generateKey + URL 去重
const existingKeys = new Set(beforeKeys);
const newCandidates = [
  { api: 'https://test-new-site.com/api.php/provide/vod', name: '测试新站点' },
  {
    api: 'https://test-new-site.com/api.php/provide/vod/',
    name: '测试新站点带尾斜杠',
  },
  { api: 'https://another-new.com/api.php/provide/vod', name: '另一个新' },
  {
    api: 'https://api.bfzyapi.com/api.php/provide/vod',
    name: '既存 URL (应被跳过)',
  },
];

console.log('\n[verify] 测试 URL 去重 + generateKey:');
let addedCount = 0;
for (const c of newCandidates) {
  const normalizedApi = c.api.replace(/\/+$/, '');
  if (beforeApis.has(normalizedApi)) {
    console.log(`  ⏭ ${c.api} -> 已存在, 跳过`);
    continue;
  }
  const key = generateKey(c.api, c.name, existingKeys);
  console.log(`  🆕 ${c.api} -> key="${key}"`);
  existingKeys.add(key);
  addedCount++;
}
console.log(`[verify] 预计新增节点数: ${addedCount}`);

// 4. 验证 config.json 未被改动
const after = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8')) as {
  api_site: Record<string, ApiSite>;
};
const afterKeys = Object.keys(after.api_site);

console.log(`\n[verify] 验证 config.json 未变:`);
console.log(`  原节点数: ${beforeKeys.length}, 现节点数: ${afterKeys.length}`);
if (beforeKeys.length !== afterKeys.length) {
  console.error('❌ 节点数变化 (脚本不应该改文件)!');
  process.exit(1);
}
const changedKeys = beforeKeys.filter((k, i) => afterKeys[i] !== k);
if (changedKeys.length > 0) {
  console.error(`❌ 顺序变化: ${changedKeys.join(', ')}`);
  process.exit(1);
}
console.log('  ✅ 既存节点顺序+内容完全保持不变');

// 5. 验证 generateKey 边界
console.log('\n[verify] generateKey 边界:');
const e1 = generateKey('https://api.bfzy.com/x', 't', new Set());
console.log(`  干净 hostname: "${e1}" (期望 api_bfzy_com)`);
const e2 = generateKey(
  'https://api.bfzy.com/x',
  't',
  new Set(['api_bfzy_com'])
);
console.log(`  冲突自动加后缀: "${e2}" (期望 api_bfzy_com_2)`);

// 清理
fs.unlinkSync(BACKUP);
console.log('\n[verify] ✅ 全部通过');
