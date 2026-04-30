#!/usr/bin/env node
/* eslint-disable */
// AUTO-GENERATED SCRIPT: Converts config.json to TypeScript definition.
// Usage: node scripts/convert-config.js

const fs = require('fs');
const path = require('path');

// Resolve project root (one level up from scripts folder)
const projectRoot = path.resolve(__dirname, '..');

// Paths
const configPath = path.join(projectRoot, 'config.json');
const bakConfigPath = path.join(projectRoot, 'config_bak.json');
const libDir = path.join(projectRoot, 'src', 'lib');
const oldRuntimePath = path.join(libDir, 'runtime.ts');
const newRuntimePath = path.join(libDir, 'runtime.ts');

// Delete the old runtime.ts file if it exists
if (fs.existsSync(oldRuntimePath)) {
  fs.unlinkSync(oldRuntimePath);
  console.log('旧的 runtime.ts 已删除');
}

// Read and parse config.json
let rawConfig;
try {
  rawConfig = fs.readFileSync(configPath, 'utf8');
} catch (err) {
  console.error(`无法读取 ${configPath}:`, err);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(rawConfig);
} catch (err) {
  console.error('config.json 不是有效的 JSON:', err);
  process.exit(1);
}

// 尝试合并 config_bak.json 中的 api_site (如果存在的话)
try {
  if (fs.existsSync(bakConfigPath)) {
    const rawBakConfig = fs.readFileSync(bakConfigPath, 'utf8');
    const bakConfig = JSON.parse(rawBakConfig);
    if (bakConfig && bakConfig.api_site) {
      if (!config.api_site) {
        config.api_site = {};
      }
      // 合并逻辑：以 config_bak.json 中的配置作为补充，如果不覆盖原 config.json 的已有 key
      // 或直接把两个对象合起来（保留所有）
      for (const [key, value] of Object.entries(bakConfig.api_site)) {
        if (!config.api_site[key]) {
          config.api_site[key] = value;
        }
      }
      console.log(`成功合并 config_bak.json 中的 API 节点，总计 ${Object.keys(config.api_site).length} 个资源节点`);
    }
  }
} catch (err) {
  console.warn('解析 config_bak.json 失败或该文件不存在，跳过合并:', err.message);
}

// Prepare TypeScript file content
const tsContent =
  `// 该文件由 scripts/convert-config.js 自动生成，请勿手动修改\n` +
  `/* eslint-disable */\n\n` +
  `export const config = ${JSON.stringify(config, null, 2)} as const;\n\n` +
  `export type RuntimeConfig = typeof config;\n\n` +
  `export default config;\n`;

// Ensure lib directory exists
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// Write to runtime.ts
try {
  fs.writeFileSync(newRuntimePath, tsContent, 'utf8');
  console.log('已生成 src/lib/runtime.ts');
} catch (err) {
  console.error('写入 runtime.ts 失败:', err);
  process.exit(1);
}
