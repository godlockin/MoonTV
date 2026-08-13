/**
 * 豆瓣代理 — Vercel Serverless Function (Node.js runtime)
 *
 * 用途: MoonTV 部署在 Cloudflare Pages 时, CF Workers 出口 IP 被豆瓣封禁,
 *       /api/douban/* 全部失败。本代理跑在 Vercel (出口 IP 不同),
 *       转发请求并补齐 Referer, 让 MoonTV 经由此处访问豆瓣。
 *
 * 注: 用 Node.js runtime 而非 Edge —— Vercel 已禁止匿名部署使用 Edge runtime。
 *
 * 调用格式:
 *   GET /?url=<encodeURIComponent(豆瓣URL)>
 *   GET /health          健康检查
 *
 * 安全: 仅允许 douban.com / doubanio.com 及其子域, 拒绝后缀伪造与内网地址,
 *       不会成为开放代理。
 */

import type { IncomingMessage, ServerResponse } from 'http';

const ALLOWED_HOSTS = ['douban.com', 'doubanio.com'];

const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

const UPSTREAM_TIMEOUT_MS = 12000;

/**
 * 白名单校验: 精确匹配根域或其子域。
 * 用 endsWith('.' + allowed) 而非 includes, 避免 douban.com.evil.com 绕过。
 */
export function isAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

function applyCors(res: ServerResponse): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  applyCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: '仅支持 GET' });
    return;
  }

  // req.url 只含 path + query, 补个 base 才能用 URL 解析
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');

  if (
    requestUrl.pathname === '/health' ||
    requestUrl.pathname === '/api/health'
  ) {
    sendJson(res, 200, {
      ok: true,
      service: 'douban-proxy',
      platform: 'vercel-node',
      allowed: ALLOWED_HOSTS,
    });
    return;
  }

  const raw = requestUrl.searchParams.get('url');
  if (!raw) {
    sendJson(res, 400, {
      error: '缺少 url 参数',
      usage: '/?url=<encodeURIComponent(https://m.douban.com/...)>',
    });
    return;
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    sendJson(res, 400, { error: 'url 参数不是合法 URL' });
    return;
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    sendJson(res, 400, { error: '仅支持 http/https' });
    return;
  }

  if (!isAllowed(target.hostname)) {
    sendJson(res, 403, {
      error: '目标域名不在白名单内',
      host: target.hostname,
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const acceptHeader = req.headers.accept;
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': UPSTREAM_UA,
        // 豆瓣接口强校验 Referer, 必须补齐
        Referer: 'https://movie.douban.com/',
        Accept:
          typeof acceptHeader === 'string' && acceptHeader
            ? acceptHeader
            : 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    applyCors(res);
    res.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    // 成功结果短缓存, 减轻上游压力
    res.setHeader('Cache-Control', 'public, max-age=300');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (e) {
    clearTimeout(timeoutId);
    const message = e instanceof Error ? e.message : String(e);
    sendJson(res, 502, { error: '上游请求失败', details: message });
  }
}
