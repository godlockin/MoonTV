/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * 电视直播流 CORS / 防盗链代理接口
 * 解决浏览器端播放 IPTV 时的跨域 (CORS)、防盗链 (Referer) 及 Mixed Content (HTTP on HTTPS) 问题
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
    // 构造请求头，伪装 UA 并将 Referer 设为目标源站自身以绕过防盗链
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Referer: `${targetUrl.protocol}//${targetUrl.host}/`,
      Accept: '*/*',
    };

    // 传递 Range 头以支持视频片段分段请求
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const response = await fetch(urlParam, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!response.ok && response.status !== 206) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': response.headers.get('content-type') || 'text/plain',
        },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const isM3u8 =
      urlParam.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegURL');

    // 如果是 M3U8 播放列表文本，需重写内部相对路径或绝对链接，保证所有 ts 切片同样通过代理中转
    if (isM3u8) {
      const text = await response.text();
      const currentFinalUrl = new URL(response.url || urlParam);
      const lines = text.split('\n');

      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // 处理含有 URI="..." 的标签（如加密密钥 EXT-X-KEY）
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

        // 处理媒体切片 URL
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

