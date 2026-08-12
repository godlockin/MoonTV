/**
 * 豆瓣代理 — Vercel Edge Function
 *
 * 用途: MoonTV 部署在 Cloudflare Pages 时, CF Workers 出口 IP 被豆瓣封禁,
 *       /api/douban/* 全部失败。本代理跑在 Vercel (出口 IP 不同),
 *       转发请求并补齐 Referer, 让 MoonTV 经由此处访问豆瓣。
 *
 * 调用格式:
 *   GET /?url=<encodeURIComponent(豆瓣URL)>
 *   GET /health          健康检查
 *
 * 安全: 仅允许 douban.com / doubanio.com 及其子域, 拒绝后缀伪造与内网地址,
 *       不会成为开放代理。
 */

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = ['douban.com', 'doubanio.com'];

const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

/**
 * 白名单校验: 精确匹配根域或其子域。
 * 用 endsWith('.' + allowed) 而非 includes, 避免 douban.com.evil.com 绕过。
 */
function isAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return json({ error: '仅支持 GET' }, 405);
  }

  const url = new URL(request.url);

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    return json({
      ok: true,
      service: 'douban-proxy',
      platform: 'vercel-edge',
      allowed: ALLOWED_HOSTS,
    });
  }

  const raw = url.searchParams.get('url');
  if (!raw) {
    return json(
      {
        error: '缺少 url 参数',
        usage: '/?url=<encodeURIComponent(https://m.douban.com/...)>',
      },
      400
    );
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json({ error: 'url 参数不是合法 URL' }, 400);
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return json({ error: '仅支持 http/https' }, 400);
  }

  if (!isAllowed(target.hostname)) {
    return json({ error: '目标域名不在白名单内', host: target.hostname }, 403);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': UPSTREAM_UA,
        // 豆瓣接口强校验 Referer, 必须补齐
        Referer: 'https://movie.douban.com/',
        Accept:
          request.headers.get('Accept') ?? 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    const headers = new Headers(CORS_HEADERS);
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);
    // 成功结果短缓存, 减轻上游压力
    headers.set('Cache-Control', 'public, max-age=300');

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: '上游请求失败', details: message }, 502);
  }
}
