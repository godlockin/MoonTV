/**
 * 豆瓣服务端请求工具 (Edge Runtime 兼容)
 *
 * 背景: Cloudflare Workers 的出口 IP 段被豆瓣封禁, 导致 edge runtime 下
 *       直连 m.douban.com / movie.douban.com 会 403 / 超时。
 *
 * 策略 (按顺序尝试):
 *   1. 若配置了 DOUBAN_SERVER_PROXY, 走该代理 (推荐: Vercel / VPS, 非 Cloudflare)
 *   2. 直连豆瓣 (本地开发 / Vercel Node runtime 可用)
 *   3. 全部失败 → 抛 DoubanUnavailableError, 由 route 层降级为 200 + 空 list
 *
 * 环境变量:
 *   DOUBAN_SERVER_PROXY  服务端代理 URL 前缀, 形如 https://xxx.vercel.app/?url=
 *                        (末尾需能直接拼接 encodeURIComponent(目标URL))
 *                        部署见 deploy/douban-proxy-vercel/
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;

/** 豆瓣暂不可用 (上游封禁 / 超时 / 代理失效), 调用方应降级而非 500 */
export class DoubanUnavailableError extends Error {
  readonly attempts: string[];

  constructor(message: string, attempts: string[]) {
    super(message);
    this.name = 'DoubanUnavailableError';
    this.attempts = attempts;
  }
}

function getServerProxy(): string | null {
  const raw = process.env.DOUBAN_SERVER_PROXY;
  return raw && raw.trim() ? raw.trim() : null;
}

/**
 * 构造候选 URL 列表: 有代理时代理优先, 直连作为兜底
 */
function buildCandidateUrls(
  target: string
): Array<{ url: string; via: string }> {
  const candidates: Array<{ url: string; via: string }> = [];
  const proxy = getServerProxy();
  if (proxy) {
    candidates.push({
      url: `${proxy}${encodeURIComponent(target)}`,
      via: 'server-proxy',
    });
  }
  candidates.push({ url: target, via: 'direct' });
  return candidates;
}

async function fetchOnce(
  url: string,
  accept: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://movie.douban.com/',
        Accept: accept,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 取豆瓣 JSON。失败时抛 DoubanUnavailableError (含每次尝试的诊断信息)。
 */
export async function fetchDoubanJson<T>(target: string): Promise<T> {
  const attempts: string[] = [];

  for (const { url, via } of buildCandidateUrls(target)) {
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      try {
        const response = await fetchOnce(
          url,
          'application/json, text/plain, */*',
          DEFAULT_TIMEOUT_MS
        );
        if (!response.ok) {
          attempts.push(`${via}#${i}: HTTP ${response.status}`);
          continue;
        }
        const text = await response.text();
        try {
          return JSON.parse(text) as T;
        } catch {
          attempts.push(`${via}#${i}: 响应非 JSON (len=${text.length})`);
          continue;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push(`${via}#${i}: ${msg}`);
      }
    }
  }

  throw new DoubanUnavailableError('豆瓣数据源暂不可用', attempts);
}

/**
 * 取豆瓣 HTML (用于 top250 抓取)。失败时抛 DoubanUnavailableError。
 */
export async function fetchDoubanHtml(target: string): Promise<string> {
  const attempts: string[] = [];

  for (const { url, via } of buildCandidateUrls(target)) {
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      try {
        const response = await fetchOnce(
          url,
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          DEFAULT_TIMEOUT_MS
        );
        if (!response.ok) {
          attempts.push(`${via}#${i}: HTTP ${response.status}`);
          continue;
        }
        const html = await response.text();
        if (!html || html.length < 200) {
          attempts.push(`${via}#${i}: HTML 过短 (len=${html.length})`);
          continue;
        }
        return html;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push(`${via}#${i}: ${msg}`);
      }
    }
  }

  throw new DoubanUnavailableError('豆瓣数据源暂不可用', attempts);
}

/** 是否配置了服务端代理 (供诊断输出用) */
export function hasServerProxy(): boolean {
  return getServerProxy() !== null;
}
