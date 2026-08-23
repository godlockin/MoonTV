import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import {
  DoubanUnavailableError,
  fetchDoubanJson,
  hasServerProxy,
} from '@/lib/douban.server';
import { DoubanItem, DoubanResult } from '@/lib/types';

interface DoubanApiResponse {
  subjects: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
  }>;
}

export const runtime = 'edge';

/** 豆瓣不可用时的降级响应: 200 + 空 list, 避免前端弹错误 */
function unavailableResponse() {
  const hint = hasServerProxy()
    ? '豆瓣数据源暂不可用（代理与直连均失败）'
    : '豆瓣数据源暂不可用，请配置 DOUBAN_SERVER_PROXY 环境变量';
  const response: DoubanResult = { code: 200, message: hint, list: [] };
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 获取参数
  const type = searchParams.get('type');
  const tag = searchParams.get('tag');
  const pageSize = parseInt(searchParams.get('pageSize') || '16');
  const pageStart = parseInt(searchParams.get('pageStart') || '0');

  // 验证参数
  if (!type || !tag) {
    return NextResponse.json(
      { error: '缺少必要参数: type 或 tag' },
      { status: 400 }
    );
  }

  if (!['tv', 'movie'].includes(type)) {
    return NextResponse.json(
      { error: 'type 参数必须是 tv 或 movie' },
      { status: 400 }
    );
  }

  if (pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: 'pageSize 必须在 1-100 之间' },
      { status: 400 }
    );
  }

  if (pageStart < 0) {
    return NextResponse.json(
      { error: 'pageStart 不能小于 0' },
      { status: 400 }
    );
  }

  if (tag === 'top250') {
    return handleTop250(pageStart, pageSize);
  }

  const target = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageSize}&page_start=${pageStart}`;

  try {
    const doubanData = await fetchDoubanJson<DoubanApiResponse>(target);

    // 转换数据格式
    const list: DoubanItem[] = (doubanData.subjects || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || '',
      rate: item.rate || '',
      year: '',
    }));

    const response: DoubanResult = {
      code: 200,
      message: '获取成功',
      list: list,
    };

    const cacheTime = await getCacheTime();
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    if (error instanceof DoubanUnavailableError) {
      return unavailableResponse();
    }
    return NextResponse.json(
      { error: '获取豆瓣数据失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

interface DoubanSubjectCollectionResponse {
  subject_collection_items: Array<{
    id: string;
    title: string;
    card_subtitle?: string;
    pic?: {
      large?: string;
      normal?: string;
    };
    rating?: {
      value?: number;
    };
    cover_url?: string;
  }>;
}

async function handleTop250(pageStart: number, pageSize = 25) {
  const target = `https://m.douban.com/rexxar/api/v2/subject_collection/movie_top250/items?start=${pageStart}&count=${pageSize}&for_mobile=1`;

  try {
    const doubanData = await fetchDoubanJson<DoubanSubjectCollectionResponse>(
      target
    );

    const movies: DoubanItem[] = (
      doubanData.subject_collection_items || []
    ).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || item.cover_url || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    const apiResponse: DoubanResult = {
      code: 200,
      message: '获取成功',
      list: movies,
    };

    const cacheTime = await getCacheTime();
    return NextResponse.json(apiResponse, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    if (error instanceof DoubanUnavailableError) {
      return unavailableResponse();
    }
    return NextResponse.json(
      {
        error: '获取豆瓣 Top250 数据失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
