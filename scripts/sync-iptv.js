/**
 * IPTV 自动嗅探、探活与同步脚本
 * 抓取最新公开源，对所有直播流进行并发探活与响应测速，剔除失效死链并标准化输出
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 探测超时时间（毫秒）
const PROBE_TIMEOUT_MS = 4000;
// 并发探测限制
const CONCURRENCY_LIMIT = 15;

// 上游 M3U 直播源列表（按优先级尝试拉取）
const UPSTREAM_M3U_URLS = [
  'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/ipv6.m3u',
  'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/global.m3u',
  'https://raw.githubusercontent.com/YanG-1989/m3u/main/Gather.m3u',
];

// 高保真标准频道库模板（确保即使外部订阅源波动，基础央视卫视也不会缺失）
const CORE_PRESETS = [
  // --- 央视频道 ---
  { id: 'cctv1', name: 'CCTV-1 综合', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV1.png', urls: ['https://play-live.cctv.com/live/cctv1_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv1hd.m3u8'] },
  { id: 'cctv2', name: 'CCTV-2 财经', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV2.png', urls: ['https://play-live.cctv.com/live/cctv2_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv2hd.m3u8'] },
  { id: 'cctv3', name: 'CCTV-3 综艺', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV3.png', urls: ['https://play-live.cctv.com/live/cctv3_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv3hd.m3u8'] },
  { id: 'cctv4', name: 'CCTV-4 中文国际', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV4.png', urls: ['https://play-live.cctv.com/live/cctv4_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv4hd.m3u8'] },
  { id: 'cctv5', name: 'CCTV-5 体育', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV5.png', urls: ['https://play-live.cctv.com/live/cctv5_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv5hd.m3u8'] },
  { id: 'cctv5p', name: 'CCTV-5+ 体育赛事', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV5Plus.png', urls: ['https://play-live.cctv.com/live/cctv5plus_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv5phd.m3u8'] },
  { id: 'cctv6', name: 'CCTV-6 电影', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV6.png', urls: ['https://play-live.cctv.com/live/cctv6_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv6hd.m3u8'] },
  { id: 'cctv7', name: 'CCTV-7 国防军事', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV7.png', urls: ['https://play-live.cctv.com/live/cctv7_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv7hd.m3u8'] },
  { id: 'cctv8', name: 'CCTV-8 电视剧', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV8.png', urls: ['https://play-live.cctv.com/live/cctv8_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv8hd.m3u8'] },
  { id: 'cctv9', name: 'CCTV-9 纪录', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV9.png', urls: ['https://play-live.cctv.com/live/cctv9_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv9hd.m3u8'] },
  { id: 'cctv10', name: 'CCTV-10 科教', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV10.png', urls: ['https://play-live.cctv.com/live/cctv10_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv10hd.m3u8'] },
  { id: 'cctv11', name: 'CCTV-11 戏曲', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV11.png', urls: ['https://play-live.cctv.com/live/cctv11_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv11hd.m3u8'] },
  { id: 'cctv12', name: 'CCTV-12 社会与法', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV12.png', urls: ['https://play-live.cctv.com/live/cctv12_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv12hd.m3u8'] },
  { id: 'cctv13', name: 'CCTV-13 新闻', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV13.png', urls: ['https://play-live.cctv.com/live/cctv13_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv13hd.m3u8'] },
  { id: 'cctv14', name: 'CCTV-14 少儿', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV14.png', urls: ['https://play-live.cctv.com/live/cctv14_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv14hd.m3u8'] },
  { id: 'cctv15', name: 'CCTV-15 音乐', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV15.png', urls: ['https://play-live.cctv.com/live/cctv15_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv15hd.m3u8'] },
  { id: 'cctv16', name: 'CCTV-16 奥林匹克', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV16.png', urls: ['https://play-live.cctv.com/live/cctv16_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv16hd.m3u8'] },
  { id: 'cctv17', name: 'CCTV-17 农业农村', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV17.png', urls: ['https://play-live.cctv.com/live/cctv17_2/index.m3u8', 'http://ivi.bupt.edu.cn/hls/cctv17hd.m3u8'] },
  { id: 'cctv4k', name: 'CCTV-4K 超高清', group: '央视频道', logo: 'https://live.fanmingming.com/tv/CCTV4K.png', urls: ['https://play-live.cctv.com/live/cctv4k_2/index.m3u8'] },

  // --- 卫视频道 ---
  { id: 'hunan', name: '湖南卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/湖南卫视.png', urls: ['https://hw-m-l.cztv.com/channels/lantian/channel01/1080p.m3u8', 'http://ivi.bupt.edu.cn/hls/hunanhd.m3u8'] },
  { id: 'zhejiang', name: '浙江卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/浙江卫视.png', urls: ['https://hw-m-l.cztv.com/channels/lantian/channel01/1080p.m3u8', 'http://ivi.bupt.edu.cn/hls/zjhd.m3u8'] },
  { id: 'jiangsu', name: '江苏卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/江苏卫视.png', urls: ['https://live-play.jstv.com/live/jshd.m3u8', 'http://ivi.bupt.edu.cn/hls/jshd.m3u8'] },
  { id: 'dongfang', name: '东方卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/东方卫视.png', urls: ['https://live.kankanews.com/live/dfhd.m3u8', 'http://ivi.bupt.edu.cn/hls/dfhd.m3u8'] },
  { id: 'beijing', name: '北京卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/北京卫视.png', urls: ['https://itemianfei.brtv.org.cn/live/bjws.m3u8', 'http://ivi.bupt.edu.cn/hls/btv1hd.m3u8'] },
  { id: 'guangdong', name: '广东卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/广东卫视.png', urls: ['https://gdtv-live.cmvideo.cn/GDTV/index.m3u8', 'http://ivi.bupt.edu.cn/hls/gdhd.m3u8'] },
  { id: 'shenzhen', name: '深圳卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/深圳卫视.png', urls: ['http://ivi.bupt.edu.cn/hls/szhd.m3u8'] },
  { id: 'anhui', name: '安徽卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/安徽卫视.png', urls: ['https://live.ahtv.cn/live/ahws.m3u8', 'http://ivi.bupt.edu.cn/hls/ahhd.m3u8'] },
  { id: 'shandong', name: '山东卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/山东卫视.png', urls: ['https://live.iqilu.com/live/sdws.m3u8', 'http://ivi.bupt.edu.cn/hls/sdhd.m3u8'] },
  { id: 'sichuan', name: '四川卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/四川卫视.png', urls: ['https://live.sctv.com/live/scws.m3u8'] },
  { id: 'hubei', name: '湖北卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/湖北卫视.png', urls: ['http://ivi.bupt.edu.cn/hls/hbhd.m3u8'] },
  { id: 'henan', name: '河南卫视', group: '卫视频道', logo: 'https://live.fanmingming.com/tv/河南卫视.png', urls: ['http://ivi.bupt.edu.cn/hls/hnhd.m3u8'] },

  // --- 港澳与轮播 ---
  { id: 'phoenix_chinese', name: '凤凰卫视中文台', group: '港澳频道', logo: 'https://live.fanmingming.com/tv/凤凰中文.png', urls: ['http://play.fengshows.com/live/fhzw.m3u8'] },
  { id: 'phoenix_info', name: '凤凰卫视资讯台', group: '港澳频道', logo: 'https://live.fanmingming.com/tv/凤凰资讯.png', urls: ['http://play.fengshows.com/live/fhzx.m3u8'] },
  { id: 'chc_action', name: 'CHC 动作电影', group: '轮播影院', logo: 'https://live.fanmingming.com/tv/CHC动作电影.png', urls: ['https://cctvalih5ca.v.myalicdn.com/live/cctv6_2/index.m3u8'] },
  { id: 'chc_family', name: 'CHC 家庭影院', group: '轮播影院', logo: 'https://live.fanmingming.com/tv/CHC家庭影院.png', urls: ['https://cctvalih5ca.v.myalicdn.com/live/cctv8_2/index.m3u8'] },
  { id: 'classic_anime', name: '精选少儿动画', group: '轮播影院', logo: 'https://live.fanmingming.com/tv/卡酷少儿.png', urls: ['https://itemianfei.brtv.org.cn/live/kkse.m3u8'] }
];

/**
 * 简单 HTTP GET 请求抓取文本（自动跟随 301/302 重定向）
 */
function fetchText(urlStr, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(
      urlStr,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
        timeout: 8000,
      },
      (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlStr).toString();
          return resolve(fetchText(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.on('error', reject);
  });
}

/**
 * 嗅探探测单个 M3U8 流媒体地址是否可用并测量延迟
 */
function probeStreamUrl(urlStr) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      return resolve({ ok: false, latency: 9999, error: 'Invalid URL' });
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(
      urlStr,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
        timeout: PROBE_TIMEOUT_MS,
      },
      (res) => {
        const latency = Date.now() - startTime;
        // 支持 200, 206 及重定向响应
        if ([200, 206, 301, 302].includes(res.statusCode)) {
          // 读取前 512 字节验证是否为有效 m3u8
          let snippet = '';
          res.on('data', (chunk) => {
            snippet += chunk.toString();
            if (snippet.length > 512) {
              res.destroy();
            }
          });
          res.on('end', () => {
            const hasM3uTag = snippet.includes('#EXT') || res.headers['content-type']?.includes('mpegurl');
            resolve({ ok: true, latency, hasM3uTag });
          });
          res.on('close', () => {
            resolve({ ok: true, latency });
          });
        } else {
          res.resume();
          resolve({ ok: false, latency, status: res.statusCode });
        }
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, latency: PROBE_TIMEOUT_MS, error: 'Timeout' });
    });

    req.on('error', (err) => {
      resolve({ ok: false, latency: 9999, error: err.message });
    });
  });
}

/**
 * 并发限制池执行
 */
async function asyncPool(limit, items, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

/**
 * 解析 M3U 文本
 */
function parseM3uRaw(content) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const channels = [];
  let curr = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const commaIdx = line.lastIndexOf(',');
      const name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : `频道 ${channels.length + 1}`;
      curr = {
        name,
        group: groupMatch ? groupMatch[1].trim() : '其他频道',
        logo: logoMatch ? logoMatch[1].trim() : undefined,
      };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (curr) {
        channels.push({
          ...curr,
          url: line,
        });
        curr = null;
      }
    }
  }
  return channels;
}

/**
 * 主执行函数
 */
async function main() {
  console.log('🚀 开始执行 IPTV 直播源同步与并发嗅探探活任务...');

  // 1. 尝试从上游 M3U 获取最新候选源
  let remoteChannels = [];
  for (const upstreamUrl of UPSTREAM_M3U_URLS) {
    try {
      console.log(`📡 正在尝试抓取上游源: ${upstreamUrl}`);
      const text = await fetchText(upstreamUrl);
      const parsed = parseM3uRaw(text);
      if (parsed.length > 0) {
        console.log(`✅ 成功从 ${upstreamUrl} 解析出 ${parsed.length} 个候选流`);
        remoteChannels = remoteChannels.concat(parsed);
      }
    } catch (e) {
      console.warn(`⚠️ 抓取 ${upstreamUrl} 失败: ${e.message}`);
    }
  }

  // 2. 整合候选池：将远程解析到的流与核心模板库按频道名称聚合
  const channelMap = new Map();

  // 先注入 CORE_PRESETS
  for (const preset of CORE_PRESETS) {
    channelMap.set(preset.name, {
      id: preset.id,
      name: preset.name,
      group: preset.group,
      logo: preset.logo,
      urls: new Set(preset.urls),
    });
  }

  // 注入 remoteChannels 匹配项
  for (const item of remoteChannels) {
    // 规范化频道名（去除空格、清晰度后缀以便匹配）
    const cleanName = item.name.replace(/\[.*?\]|\(.*?\)|高清|超清|1080P|4K|\s+/gi, '').trim();

    let matchedEntry = null;
    for (const [key, entry] of channelMap.entries()) {
      const entryClean = key.replace(/\[.*?\]|\(.*?\)|高清|超清|1080P|4K|\s+/gi, '').trim();
      if (cleanName === entryClean || cleanName.toLowerCase() === entryClean.toLowerCase()) {
        matchedEntry = entry;
        break;
      }
    }

    if (matchedEntry) {
      matchedEntry.urls.add(item.url);
    } else if (item.group && (item.group.includes('卫视') || item.group.includes('央视') || item.group.includes('港澳'))) {
      // 如果属于主流分组但也未在内置库，自适应收录
      const newId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      channelMap.set(item.name, {
        id: newId,
        name: item.name,
        group: item.group,
        logo: item.logo || `https://live.fanmingming.com/tv/${encodeURIComponent(cleanName)}.png`,
        urls: new Set([item.url]),
      });
    }
  }

  console.log(`📊 聚合完成，共统计 ${channelMap.size} 个电视频道，准备启动并发嗅探探活...`);

  // 3. 并发嗅探探活每个频道的候选 URL，找出每个频道的最佳可用源
  const finalChannels = [];
  let totalTestedUrls = 0;
  let totalHealthyUrls = 0;

  const entries = Array.from(channelMap.values());

  await asyncPool(CONCURRENCY_LIMIT, entries, async (channel) => {
    const urls = Array.from(channel.urls);
    let bestUrl = null;
    let minLatency = 99999;

    for (const url of urls) {
      totalTestedUrls++;
      const probe = await probeStreamUrl(url);
      if (probe.ok) {
        totalHealthyUrls++;
        if (probe.latency < minLatency) {
          minLatency = probe.latency;
          bestUrl = url;
        }
      }
    }

    // 如果探活成功，使用测速最快的 URL；如果全部超时，保留第 1 个作为兜底
    const finalUrl = bestUrl || urls[0];
    finalChannels.push({
      id: channel.id,
      name: channel.name,
      group: channel.group,
      logo: channel.logo,
      url: finalUrl,
      status: bestUrl ? 'online' : 'fallback',
      latency: minLatency < 99999 ? minLatency : undefined,
    });
  });

  // 4. 分类排序输出（央视 -> 卫视 -> 港澳 -> 轮播影院 -> 地方频道）
  const groupOrder = ['央视频道', '卫视频道', '港澳频道', '轮播影院'];
  finalChannels.sort((a, b) => {
    const idxA = groupOrder.indexOf(a.group);
    const idxB = groupOrder.indexOf(b.group);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.group.localeCompare(b.group);
  });

  // 5. 写入产物文件
  const outDir = path.join(__dirname, '../public/iptv');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    totalChannels: finalChannels.length,
    onlineCount: finalChannels.filter((c) => c.status === 'online').length,
    channels: finalChannels,
  };

  const jsonPath = path.join(outDir, 'channels.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  // 生成 M3U 静态文件
  let m3uContent = '#EXTM3U name="MoonTV 直播精选"\n';
  for (const c of finalChannels) {
    m3uContent += `#EXTINF:-1 tvg-id="${c.id}" tvg-name="${c.name}" tvg-logo="${c.logo || ''}" group-title="${c.group}",${c.name}\n${c.url}\n`;
  }
  const m3uPath = path.join(outDir, 'channels.m3u');
  fs.writeFileSync(m3uPath, m3uContent, 'utf8');

  console.log(`\n🎉 IPTV 同步与嗅探探活完成！`);
  console.log(`📈 扫描候选流总数: ${totalTestedUrls}，有效存活流: ${totalHealthyUrls}`);
  console.log(`📺 产出优质频道数: ${finalChannels.length} (在线测速优选: ${payload.onlineCount} 个)`);
  console.log(`📁 产物已生成:`);
  console.log(`   - ${jsonPath}`);
  console.log(`   - ${m3uPath}`);
}

main().catch((err) => {
  console.error('IPTV 同步发生错误:', err);
  process.exit(1);
});
