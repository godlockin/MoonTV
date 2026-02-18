import { RawSourceConfig, SourceCrawler } from '../types';

// 已知的视频源注册表列表
const REGISTRIES = [
  {
    name: 'video-source-registry',
    url: 'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/global.m3u',
    type: 'm3u',
  },
  {
    name: 'iptv-org',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    type: 'm3u',
  },
];

/**
 * 解析 M3U 文件内容，提取频道信息
 */
function parseM3U(content: string): RawSourceConfig[] {
  const sources: RawSourceConfig[] = [];
  const lines = content.split('\n');
  let currentName = '';
  let id = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 解析 EXTINF 行获取频道名称
    if (trimmed.startsWith('#EXTINF:')) {
      const match =
        trimmed.match(/tvg-name="([^"]+)"/) || trimmed.match(/,(.+)$/);
      currentName = match ? match[1].trim() : `channel_${id}`;
    }
    // 解析 URL 行
    else if (trimmed.startsWith('http') && currentName) {
      id++;
      sources.push({
        id: `iptv_${id}`,
        url: trimmed,
        name: currentName,
        note: `IPTV: ${currentName}`,
        region: 'global',
      });
      currentName = '';
    }
  }

  return sources;
}

/**
 * 从 GitHub Registry 获取视频源
 */
async function fetchFromRegistry(
  registry: (typeof REGISTRIES)[0],
): Promise<RawSourceConfig[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(registry.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MoonTV-Sync/1.0',
        Accept: '*/*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();

    if (registry.type === 'm3u') {
      return parseM3U(content);
    }

    return [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to fetch from ${registry.name}:`, error);
    return [];
  }
}

export const githubRegistryCrawler: SourceCrawler = {
  name: 'githubRegistry',

  async discover(): Promise<RawSourceConfig[]> {
    const allSources: RawSourceConfig[] = [];

    // 并行获取所有注册表
    const results = await Promise.allSettled(
      REGISTRIES.map((registry) => fetchFromRegistry(registry)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allSources.push(...result.value);
      }
    }

    // 去重
    const seen = new Set<string>();
    const unique = allSources.filter((source) => {
      if (seen.has(source.url)) {
        return false;
      }
      seen.add(source.url);
      return true;
    });

    // eslint-disable-next-line no-console
    console.log(
      `[GitHub Crawler] Discovered ${unique.length} sources from ${REGISTRIES.length} registries`,
    );

    return unique;
  },
};
