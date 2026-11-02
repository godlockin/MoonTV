/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface CloudflareSocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  closed: Promise<void>;
  close(): Promise<void>;
}

/**
 * 判断目标 URL 是否为纯 IP 地址或非标准端口（80/443 以外）
 * Cloudflare Workers 的内置 fetch() 会直接拦截纯 IP 访问并返回 403 (error code: 1003)
 */
function isRawIpOrCustomPort(u: URL): boolean {
  const host = u.hostname;
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isIpv6 = host.includes(':') || host.startsWith('[');
  const isCustomPort = u.port !== '' && u.port !== '80' && u.port !== '443';
  return isIpv4 || isIpv6 || isCustomPort;
}

/**
 * 在两个字节数组中查找 \r\n\r\n (0x0d 0x0a 0x0d 0x0a) 的结束索引
 */
function findHeaderEndIndex(buf: Uint8Array): number {
  for (let i = 0; i <= buf.length - 4; i++) {
    if (
      buf[i] === 13 &&
      buf[i + 1] === 10 &&
      buf[i + 2] === 13 &&
      buf[i + 3] === 10
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * 使用 Cloudflare Workers 原生 TCP Socket (cloudflare:sockets) 发起 HTTP/1.0 请求
 * 彻底绕过 Cloudflare Edge fetch() 对纯 IP 地址 (Error 1003) 和非常规端口 (:81/:88 等) 的 403 拦截
 */
async function fetchViaRawSocket(
  urlStr: string,
  reqHeaders: Record<string, string>
): Promise<Response> {
  const u = new URL(urlStr);
  const isHttps = u.protocol === 'https:';
  const port = u.port ? parseInt(u.port, 10) : isHttps ? 443 : 80;

  const cfSocketsModule = 'cloudflare:sockets';
  const { connect } = (await import(
    /* webpackIgnore: true */ cfSocketsModule
  )) as {
    connect: (
      address: { hostname: string; port: number },
      options?: {
        secureTransport?: 'on' | 'off' | 'starttls';
        allowHalfOpen?: boolean;
      }
    ) => CloudflareSocket;
  };

  const socket = connect(
    { hostname: u.hostname, port },
    { secureTransport: isHttps ? 'on' : 'off', allowHalfOpen: false }
  );

  const pathWithQuery = `${u.pathname || '/'}${u.search || ''}`;
  const hostHeader = u.port ? `${u.hostname}:${u.port}` : u.hostname;

  const headerLines = [
    `GET ${pathWithQuery} HTTP/1.0`,
    `Host: ${hostHeader}`,
    `User-Agent: ${reqHeaders['User-Agent'] || 'okhttp/3.15'}`,
    `Accept: ${reqHeaders['Accept'] || '*/*'}`,
    'Connection: close',
  ];

  if (reqHeaders['Referer']) {
    headerLines.push(`Referer: ${reqHeaders['Referer']}`);
  }
  if (reqHeaders['Range']) {
    headerLines.push(`Range: ${reqHeaders['Range']}`);
  }

  const rawRequest = `${headerLines.join('\r\n')}\r\n\r\n`;
  const writer = socket.writable.getWriter();
  await writer.write(new TextEncoder().encode(rawRequest));
  writer.releaseLock();

  const reader = socket.readable.getReader();
  let buffer = new Uint8Array(0);
  let headerEndIdx = -1;

  while (headerEndIdx === -1 && buffer.length < 32768) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const nextBuf = new Uint8Array(buffer.length + value.length);
    nextBuf.set(buffer, 0);
    nextBuf.set(value, buffer.length);
    buffer = nextBuf;
    headerEndIdx = findHeaderEndIndex(buffer);
  }

  if (headerEndIdx === -1) {
    reader.releaseLock();
    socket.close().catch(() => undefined);
    throw new Error('Invalid HTTP response from upstream socket');
  }

  const headerText = new TextDecoder().decode(buffer.subarray(0, headerEndIdx));
  const initialBody = buffer.subarray(headerEndIdx + 4);
  const lines = headerText.split('\r\n');
  const statusLine = lines[0] || '';
  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})/);
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 200;

  const respHeaders = new Headers();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const k = line.substring(0, colonIdx).trim();
      const v = line.substring(colonIdx + 1).trim();
      respHeaders.append(k, v);
    }
  }

  // 如果是重定向状态码，无需读取后续 body，直接关闭连接返回头部
  if ([301, 302, 303, 307, 308].includes(statusCode)) {
    reader.releaseLock();
    socket.close().catch(() => undefined);
    return new Response(null, { status: statusCode, headers: respHeaders });
  }

  const bodyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (initialBody.byteLength > 0) {
        controller.enqueue(initialBody);
      }
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          reader.releaseLock();
          socket.close().catch(() => undefined);
        } else if (value) {
          controller.enqueue(value);
        }
      } catch (err: unknown) {
        controller.error(err);
        reader.releaseLock();
        socket.close().catch(() => undefined);
      }
    },
    cancel() {
      reader.releaseLock();
      socket.close().catch(() => undefined);
    },
  });

  return new Response(bodyStream, {
    status: statusCode,
    headers: respHeaders,
  });
}

/**
 * 单跳请求：自动根据目标地址类型选择 Socket 直连或标准 fetch，并在遇到 403/530 时自动回退重试
 */
async function fetchSingleHop(
  urlStr: string,
  baseHeaders: Record<string, string>
): Promise<Response> {
  const u = new URL(urlStr);

  // 1. 纯 IP 或非标准端口优先使用 Cloudflare 原生 TCP Socket 绕过 Error 1003
  if (isRawIpOrCustomPort(u)) {
    try {
      return await fetchViaRawSocket(urlStr, baseHeaders);
    } catch {
      // 本地 Node 开发环境无 cloudflare:sockets 时回退至标准 fetch
    }
  }

  // 2. 标准域名请求
  const res = await fetch(urlStr, {
    headers: baseHeaders,
    redirect: 'manual',
  });

  // 3. 若返回 403/530，可能是上游拒绝浏览器 Referer 或触发 Cloudflare Edge 限制
  if (res.status === 403 || res.status === 530) {
    const noRefererHeaders: Record<string, string> = {
      'User-Agent': 'okhttp/3.15',
      Accept: '*/*',
    };
    if (baseHeaders['Range']) {
      noRefererHeaders['Range'] = baseHeaders['Range'];
    }

    const retryRes = await fetch(urlStr, {
      headers: noRefererHeaders,
      redirect: 'manual',
    });

    if (retryRes.ok || [206, 301, 302, 303, 307, 308].includes(retryRes.status)) {
      return retryRes;
    }

    // 尝试通过原生 TCP Socket 绕过 Cloudflare HTTP 代理层限制
    try {
      return await fetchViaRawSocket(urlStr, noRefererHeaders);
    } catch {
      return retryRes;
    }
  }

  return res;
}

/**
 * 逐跳追踪重定向（最多 6 跳），支持从域名跳转到纯 IP + 非标准端口的场景
 */
async function fetchWithRedirects(
  initialUrl: string,
  baseHeaders: Record<string, string>,
  maxRedirects = 6
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const hopTarget = new URL(currentUrl);
    const hopHeaders: Record<string, string> = {
      ...baseHeaders,
      Referer: `${hopTarget.protocol}//${hopTarget.host}/`,
    };

    const response = await fetchSingleHop(currentUrl, hopHeaders);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location && hop < maxRedirects) {
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('Too many redirects');
}

/**
 * 电视直播流 CORS / 防盗链 / 纯 IP 代理接口
 * 解决浏览器端播放 IPTV 时的跨域 (CORS)、防盗链 (Referer)、Mixed Content 及 Cloudflare Error 1003 问题
 */
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: '无效的 url 格式' }, { status: 400 });
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Referer: `${targetUrl.protocol}//${targetUrl.host}/`,
      Accept: '*/*',
    };

    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const { response, finalUrl } = await fetchWithRedirects(
      urlParam,
      upstreamHeaders
    );

    if (!response.ok && response.status !== 206) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': response.headers.get('content-type') || 'text/plain',
        },
      });
    }

    const contentType = (
      response.headers.get('content-type') || ''
    ).toLowerCase();
    const isM3u8 =
      urlParam.includes('.m3u8') ||
      finalUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('m3u');

    // 如果是 M3U8 播放列表文本，重写内部相对路径或绝对链接，保证所有子播放列表及 ts 切片同样通过代理中转
    if (isM3u8) {
      const text = await response.text();
      const currentFinalUrl = new URL(finalUrl);
      const lines = text.split('\n');

      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // 处理含有 URI="..." 的标签（如加密密钥 EXT-X-KEY 或多音轨 EXT-X-MEDIA）
        if (trimmed.startsWith('#')) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (_, keyUri) => {
              try {
                const fullKeyUrl = new URL(keyUri, currentFinalUrl).href;
                return `URI="/api/live-proxy?url=${encodeURIComponent(fullKeyUrl)}"`;
              } catch {
                return `URI="${keyUri}"`;
              }
            });
          }
          return line;
        }

        // 处理媒体切片或子 M3U8 URL
        try {
          const fullSegmentUrl = new URL(trimmed, currentFinalUrl).href;
          return `/api/live-proxy?url=${encodeURIComponent(fullSegmentUrl)}`;
        } catch {
          return trimmed;
        }
      });

      return new Response(rewrittenLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // 媒体切片 (.ts) 或其他二进制流：直接透明流式转发
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (contentType) headers.set('Content-Type', contentType);
    const contentLength = response.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    const contentRange = response.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    headers.set('Cache-Control', 'public, max-age=60');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: `代理直播流失败: ${err instanceof Error ? err.message : String(err)}`,
      },
      {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
