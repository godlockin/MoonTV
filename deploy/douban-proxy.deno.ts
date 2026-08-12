/**
 * 豆瓣代理 — 部署到 Deno Deploy (非 Cloudflare, 出口 IP 未被豆瓣封禁)
 *
 * 用途: MoonTV 部署在 Cloudflare Pages 时, Workers 出口 IP 被豆瓣封禁,
 *       导致 /api/douban/* 全部失败。本代理转发请求并补齐 Referer,
 *       让 MoonTV 服务端 (或浏览器端) 经由 Deno Deploy 访问豆瓣。
 *
 * 部署 (3 步, 全免费):
 *   1. 打开 https://dash.deno.com → New Playground
 *   2. 把本文件内容整段粘贴进去 → Save & Deploy
 *   3. 复制分配的地址 (形如 https://xxx-yyy-123.deno.dev)
 *
 * 配置 MoonTV (Cloudflare Pages → Settings → Environment variables):
 *   服务端 (推荐, 走 /api/douban/*):
 *     DOUBAN_SERVER_PROXY = https://xxx.deno.dev/?url=
 *   浏览器端 (可选, 前端直连):
 *     NEXT_PUBLIC_DOUBAN_PROXY = https://xxx.deno.dev/?url=
 *   两者格式一致, 末尾必须是 ?url= (代理会拼接 encodeURIComponent 后的目标 URL)
 *
 * 调用格式:
 *   GET https://xxx.deno.dev/?url=<encodeURIComponent(豆瓣URL)>
 *   健康检查: GET https://xxx.deno.dev/health
 *
 * 安全: 仅允许 douban.com 及其子域, 防止被当作开放代理滥用。
 */

const ALLOWED_HOSTS = [
  'douban.com',
  'movie.douban.com',
  'm.douban.com',
  'api.douban.com',
  'img1.doubanio.com',
  'img2.doubanio.com',
  'img3.doubanio.com',
  'img9.doubanio.com',
];

const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return json({ ok: true, service: 'douban-proxy', allowed: ALLOWED_HOSTS });
  }

  if (url.pathname === '/') {
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
      // 白名单之外直接拒绝, 避免成为开放代理
      return json(
        { error: '目标域名不在白名单内', host: target.hostname },
        403
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const upstream = await fetch(target.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': UPSTREAM_UA,
          // 豆瓣接口校验 Referer, 必须补齐
          Referer: 'https://movie.douban.com/',
          Accept:
            request.headers.get('Accept') ??
            'application/json, text/plain, */*',
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

  return json({ error: 'Not Found', hint: '用 /?url= 或 /health' }, 404);
});
