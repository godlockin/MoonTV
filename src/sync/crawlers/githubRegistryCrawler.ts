import { RawSourceConfig, SourceCrawler } from '../types';

// 视频源注册表配置
interface RegistryConfig {
  name: string;
  url: string;
  type: 'm3u' | 'json';
  category?: string;
  enabled: boolean;
}

// 已知的视频源注册表列表 - 持续更新
const REGISTRIES: RegistryConfig[] = [
  // IPTV 国际源
  {
    name: 'iptv-org-global',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    type: 'm3u',
    category: 'iptv',
    enabled: true,
  },
  {
    name: 'iptv-org-china',
    url: 'https://iptv-org.github.io/iptv/countries/cn.m3u',
    type: 'm3u',
    category: 'iptv',
    enabled: true,
  },
  // 国内 IPTV 源
  {
    name: 'fanmingming-live',
    url: 'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/global.m3u',
    type: 'm3u',
    category: 'iptv',
    enabled: true,
  },
  {
    name: 'yuechan-live',
    url: 'https://raw.githubusercontent.com/YueChan/Live/main/IPTV.m3u',
    type: 'm3u',
    category: 'iptv',
    enabled: true,
  },
  // 影视资源聚合
  {
    name: 'joevess-iptv',
    url: 'https://raw.githubusercontent.com/joevess/IPTV/main/iptv.m3u8',
    type: 'm3u',
    category: 'iptv',
    enabled: true,
  },
  {
    name: 'kimwang1978-collection',
    url: 'https://raw.githubusercontent.com/kimwang1978/collect-tv-txt/main/merged_output.m3u',
    type: 'm3u',
    category: 'iptv',
    enabled: true,
  },
];

// 资源质量检测结果
interface QualityCheckResult {
  url: string;
  responseTime: number;
  isAccessible: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * 解析 M3U 文件内容，提取频道信息
 */
function parseM3U(content: string, registryName: string): RawSourceConfig[] {
  const sources: RawSourceConfig[] = [];
  const lines = content.split('\n');
  let currentName = '';
  let currentGroup = '';
  let id = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 解析 EXTINF 行获取频道信息
    if (trimmed.startsWith('#EXTINF:')) {
      // 提取频道名称
      const nameMatch =
        trimmed.match(/tvg-name="([^"]+)"/) || trimmed.match(/,(.+)$/);
      currentName = nameMatch ? nameMatch[1].trim() : '';

      // 提取分组信息
      const groupMatch = trimmed.match(/group-title="([^"]+)"/);
      currentGroup = groupMatch ? groupMatch[1] : '';
    }
    // 解析 URL 行
    else if (trimmed.startsWith('http') && currentName) {
      id++;
      const sourceId = `${registryName.replace(/\s+/g, '_')}_${id}`;
      sources.push({
        id: sourceId,
        url: trimmed,
        name: currentName,
        note: currentGroup ? `${currentGroup}: ${currentName}` : currentName,
        region: detectRegion(currentName, currentGroup),
        provider: registryName,
      });
      currentName = '';
      currentGroup = '';
    }
  }

  return sources;
}

/**
 * 根据名称和分组检测地区
 */
function detectRegion(name: string, group: string): string {
  const text = `${name} ${group}`.toLowerCase();

  // 中文关键词
  if (/中国|央视|卫视|北京|上海|广州|深圳|浙江|江苏|湖南/.test(text))
    return 'cn';
  if (/台湾|台视|中视|华视/.test(text)) return 'tw';
  if (/香港|翡翠|明珠|tvb|hk/.test(text)) return 'hk';
  if (/澳门|澳视/.test(text)) return 'mo';

  // 国际关键词
  if (/japan|日本|nhk|tokyo/.test(text)) return 'jp';
  if (/korea|韩国|kbs|mbc|sbs/.test(text)) return 'kr';
  if (/usa|美国|cnn|fox|hbo|abc|nbc|cbs/.test(text)) return 'us';
  if (/uk|英国|bbc|itv|channel 4/.test(text)) return 'uk';

  return 'global';
}

/**
 * 检查资源质量（响应时间和可用性）
 */
async function checkSourceQuality(
  sources: RawSourceConfig[],
  maxCheckCount = 10,
): Promise<Map<string, QualityCheckResult>> {
  const results = new Map<string, QualityCheckResult>();

  // 只检查前 N 个源作为样本
  const sampleSources = sources.slice(0, maxCheckCount);

  const checkPromises = sampleSources.map(async (source) => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(source.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      results.set(source.url, {
        url: source.url,
        responseTime,
        isAccessible: response.ok,
        statusCode: response.status,
      });
    } catch (error) {
      results.set(source.url, {
        url: source.url,
        responseTime: Date.now() - startTime,
        isAccessible: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await Promise.allSettled(checkPromises);

  return results;
}

/**
 * 从注册表获取视频源
 */
async function fetchFromRegistry(
  registry: RegistryConfig,
): Promise<{
  sources: RawSourceConfig[];
  quality: Map<string, QualityCheckResult>;
}> {
  try {
    // eslint-disable-next-line no-console
    console.log(`[Crawler] Fetching from ${registry.name}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const startTime = Date.now();
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
    const fetchTime = Date.now() - startTime;

    // 解析内容
    let sources: RawSourceConfig[] = [];
    if (registry.type === 'm3u') {
      sources = parseM3U(content, registry.name);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[Crawler] ${registry.name}: Found ${sources.length} sources in ${fetchTime}ms`,
    );

    // 质量检测（只检查样本）
    const quality = await checkSourceQuality(sources, 5);

    return { sources, quality };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Crawler] Failed to fetch from ${registry.name}:`, error);
    return { sources: [], quality: new Map() };
  }
}

/**
 * 全局去重和质量评分
 */
function deduplicateAndScore(
  allSources: RawSourceConfig[],
  qualityMap: Map<string, QualityCheckResult>,
): RawSourceConfig[] {
  const urlMap = new Map<string, RawSourceConfig>();
  const nameCount = new Map<string, number>();

  // 统计名称出现次数
  for (const source of allSources) {
    const name = source.name || source.id || 'unknown';
    const count = nameCount.get(name) || 0;
    nameCount.set(name, count + 1);
  }

  // 去重并选择最佳来源
  for (const source of allSources) {
    const existing = urlMap.get(source.url);

    if (!existing) {
      urlMap.set(source.url, source);
    }
  }

  // 转换为数组并添加质量评分
  const uniqueSources = Array.from(urlMap.values()).map((source) => {
    const quality = qualityMap.get(source.url);
    const name = source.name || source.id || 'unknown';
    const popularity = nameCount.get(name) || 1;

    return {
      ...source,
      // 添加元数据用于后续处理
      qualityScore: calculateQualityScore(quality, popularity),
      checkedAt: quality ? new Date().toISOString() : undefined,
    } as RawSourceConfig;
  });

  // 按质量评分排序
  return uniqueSources.sort((a, b) => {
    const scoreA = (a as RawSourceConfig & { qualityScore: number })
      .qualityScore;
    const scoreB = (b as RawSourceConfig & { qualityScore: number })
      .qualityScore;
    return scoreB - scoreA;
  });
}

/**
 * 计算质量评分
 */
function calculateQualityScore(
  quality: QualityCheckResult | undefined,
  popularity: number,
): number {
  let score = 0;

  // 可访问性
  if (quality?.isAccessible) {
    score += 50;
  }

  // 响应速度
  if (quality) {
    if (quality.responseTime < 1000) score += 30;
    else if (quality.responseTime < 3000) score += 20;
    else if (quality.responseTime < 5000) score += 10;
  }

  // 流行度（出现次数越多越可靠）
  score += Math.min(popularity * 5, 20);

  return score;
}

// 爬虫实现
export const githubRegistryCrawler: SourceCrawler = {
  name: 'githubRegistry',

  async discover(): Promise<RawSourceConfig[]> {
    const enabledRegistries = REGISTRIES.filter((r) => r.enabled);
    const allSources: RawSourceConfig[] = [];
    const allQuality = new Map<string, QualityCheckResult>();

    // 串行获取以避免被限流
    for (const registry of enabledRegistries) {
      const { sources, quality } = await fetchFromRegistry(registry);
      allSources.push(...sources);

      // 合并质量数据
      quality.forEach((result, url) => {
        allQuality.set(url, result);
      });

      // 添加延迟避免限流
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 去重和质量评分
    const uniqueSources = deduplicateAndScore(allSources, allQuality);

    // eslint-disable-next-line no-console
    console.log(
      `[GitHub Crawler] Total: ${allSources.length}, Unique: ${uniqueSources.length} sources from ${enabledRegistries.length} registries`,
    );

    return uniqueSources;
  },
};

// 导出注册表配置供外部使用
export { REGISTRIES };
