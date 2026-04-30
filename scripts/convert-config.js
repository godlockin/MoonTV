#!/usr/bin/env node
/* eslint-disable */
// AUTO-GENERATED SCRIPT: Converts config.json to TypeScript definition.
// Usage: node scripts/convert-config.js

const fs = require('fs');
const path = require('path');

// Resolve project root (one level up from scripts folder)
const projectRoot = path.resolve(__dirname, '..');

// Paths
const libDir = path.join(projectRoot, 'src', 'lib');
const oldRuntimePath = path.join(libDir, 'runtime.ts');
const newRuntimePath = path.join(libDir, 'runtime.ts');

// Delete the old runtime.ts file if it exists
if (fs.existsSync(oldRuntimePath)) {
  fs.unlinkSync(oldRuntimePath);
  console.log('旧的 runtime.ts 已删除');
}

let config = {
  api_site: {},
  cache_time: 7200
};

// 遍历根目录下所有的 config*.json
try {
  const files = fs.readdirSync(projectRoot);
  const configFiles = files.filter(file => file.startsWith('config') && file.endsWith('.json'));
  
  // 确保 config.json 排在第一个，作为基础配置
  configFiles.sort((a, b) => {
    if (a === 'config.json') return -1;
    if (b === 'config.json') return 1;
    return a.localeCompare(b);
  });

  for (const file of configFiles) {
    const filePath = path.join(projectRoot, file);
    try {
      const rawContent = fs.readFileSync(filePath, 'utf8');
      const parsedConfig = JSON.parse(rawContent);
      
      // 对于基础的 config.json，我们提取它的根级别配置
      if (file === 'config.json') {
        for (const [k, v] of Object.entries(parsedConfig)) {
          if (k !== 'api_site') {
            config[k] = v;
          }
        }
      }

      // 提取并合并 api_site
      if (parsedConfig && parsedConfig.api_site) {
        if (!config.api_site) {
          config.api_site = {};
        }
        
        let mergedCount = 0;
        for (const [key, value] of Object.entries(parsedConfig.api_site)) {
          if (!config.api_site[key]) {
            config.api_site[key] = value;
            mergedCount++;
          }
        }
        
        if (file !== 'config.json') {
          console.log(`从 ${file} 成功补充合并了 ${mergedCount} 个新的资源节点`);
        }
      }
    } catch (err) {
      console.warn(`解析 ${file} 失败，跳过该文件:`, err.message);
    }
  }
  
  console.log(`所有配置文件解析合并完成，总计包含 ${Object.keys(config.api_site || {}).length} 个资源节点`);

} catch (err) {
  console.error('读取项目根目录文件失败:', err);
  process.exit(1);
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
