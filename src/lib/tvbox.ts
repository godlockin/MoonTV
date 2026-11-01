/**
 * TVBox 配置订阅解析模块
 * 支持解析标准 TVBox JSON 配置、Base64 编码的 TVBox 订阅地址，提取可用的 Apple CMS 采集站点
 */

export interface ParsedCmsSite {
  key: string;
  name: string;
  api: string;
  detail?: string;
}

export interface TvBoxParseResult {
  success: boolean;
  totalFound: number;
  sites: ParsedCmsSite[];
  skippedSpiderCount: number;
  error?: string;
}

// 识别 Apple CMS 直连接口特征（非 XML 通道）
const CMS_API_PATTERN = /\/api\.php\/provide\/vod(?![^?#]*\/at\/xml)(?:[/?#]|$)/i;
// 识别 Spider 引擎脚本（csp_、.jar、.js、.py）
const SPIDER_PATTERN = /^csp_|\.(?:jar|js|py)(?:[?#].*)?$/i;

/**
 * 将任意字符串清理并生成唯一安全的 key
 */
function sanitizeKey(rawKey: string, index: number): string {
  const cleaned = rawKey.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || `tvbox_${index}_${Date.now()}`;
}

/**
 * 规范化 URL 地址
 */
function normalizeUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  // 去除尾部多余的问号、井号和斜杠
  url = url.replace(/[?#]+$/, '').replace(/\/+$/, '');
  return url;
}

/**
 * 解析 TVBox 配置文本（支持明文 JSON 及 Base64 编码的 JSON）
 */
export function parseTvBoxConfig(rawContent: string): TvBoxParseResult {
  try {
    let content = rawContent.trim();
    if (!content) {
      return { success: false, totalFound: 0, sites: [], skippedSpiderCount: 0, error: '配置内容为空' };
    }

    // 尝试直接 JSON 解析；如果失败，尝试 Base64 解码后再解析
    let json: any = null;
    try {
      json = JSON.parse(content);
    } catch {
      try {
        // 尝试去除空白后 Base64 解码
        const base64Clean = content.replace(/\s+/g, '');
        const decoded = typeof atob === 'function' ? atob(base64Clean) : Buffer.from(base64Clean, 'base64').toString('utf-8');
        json = JSON.parse(decoded);
      } catch (decodeErr) {
        return {
          success: false,
          totalFound: 0,
          sites: [],
          skippedSpiderCount: 0,
          error: '无法解析配置：既不是标准 JSON，也不是有效的 Base64 编码配置',
        };
      }
    }

    if (!json || typeof json !== 'object') {
      return { success: false, totalFound: 0, sites: [], skippedSpiderCount: 0, error: '配置格式不合法' };
    }

    const sitesRaw = Array.isArray(json.sites) ? json.sites : [];
    const validSites: ParsedCmsSite[] = [];
    const seenKeys = new Set<string>();
    const seenApis = new Set<string>();
    let skippedSpiderCount = 0;

    for (let i = 0; i < sitesRaw.length; i++) {
      const site = sitesRaw[i];
      if (!site || typeof site !== 'object') continue;

      const rawApi = typeof site.api === 'string' ? site.api.trim() : '';
      const rawName = typeof site.name === 'string' ? site.name.trim() : `源_${i + 1}`;
      const rawKey = typeof site.key === 'string' && site.key.trim() ? site.key.trim() : `site_${i + 1}`;
      const siteType = Number(site.type);

      // 过滤需要 Spider/jar/py 解释器的源
      if (
        siteType === 3 ||
        SPIDER_PATTERN.test(rawApi) ||
        (typeof site.jar === 'string' && site.jar.trim()) ||
        rawKey.startsWith('csp_')
      ) {
        skippedSpiderCount++;
        continue;
      }

      // 仅保留 http(s) 直连类 CMS 接口
      // 1. type === 1 (标准 JSON CMS)
      // 2. 或者 api 路径命中 /api.php/provide/vod
      const isCms = siteType === 1 || CMS_API_PATTERN.test(rawApi);
      if (!isCms || !rawApi.startsWith('http')) {
        continue;
      }

      const normalizedApi = normalizeUrl(rawApi);
      if (seenApis.has(normalizedApi)) {
        continue;
      }

      // 生成防冲突 key
      let finalKey = sanitizeKey(rawKey, i);
      while (seenKeys.has(finalKey)) {
        finalKey = `${finalKey}_${i}`;
      }

      seenKeys.add(finalKey);
      seenApis.add(normalizedApi);

      validSites.push({
        key: finalKey,
        name: rawName,
        api: normalizedApi,
        detail: typeof site.detail === 'string' ? normalizeUrl(site.detail) : undefined,
      });
    }

    return {
      success: true,
      totalFound: validSites.length,
      sites: validSites,
      skippedSpiderCount,
    };
  } catch (err) {
    return {
      success: false,
      totalFound: 0,
      sites: [],
      skippedSpiderCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

