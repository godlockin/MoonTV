import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import {
  DoubanUnavailableError,
  fetchDoubanJson,
  hasServerProxy,
} from '@/lib/douban.server';
import { DoubanItem, DoubanResult } from '@/lib/types';

interface DoubanNewSearchResponse {
  data: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
    [key: string]: unknown;
  }>;
}

export const runtime = 'edge';

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

  const tags = searchParams.get('tags') || '电影';
  const genres = searchParams.get('genres') || '';
  const countries = searchParams.get('countries') || '';
  const yearRange = searchParams.get('year_range') || '';
  const range = searchParams.get('range') || '0,10';
  const sort = searchParams.get('sort') || 'T';
  const start = parseInt(searchParams.get('start') || '0', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  if (limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'limit 必须在 1-100 之间' },
      { status: 400 }
    );
  }

  if (start < 0) {
    return NextResponse.json({ error: 'start 不能小于 0' }, { status: 400 });
  }

  const queryParams = new URLSearchParams();
  queryParams.set('tags', tags);
  if (genres) queryParams.set('genres', genres);
  if (countries) queryParams.set('countries', countries);
  if (yearRange) queryParams.set('year_range', yearRange);
  if (range) queryParams.set('range', range);
  if (sort) queryParams.set('sort', sort);
  queryParams.set('start', start.toString());
  queryParams.set('limit', limit.toString());

  const target = `https://movie.douban.com/j/new_search_subjects?${queryParams.toString()}`;

  try {
    const doubanData = await fetchDoubanJson<DoubanNewSearchResponse>(target);

    const list: DoubanItem[] = (doubanData.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || '',
      rate: item.rate || '',
      year: '',
    }));

    const response: DoubanResult = {
      code: 200,
      message: '获取成功',
      list,
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
      {
        error: '获取豆瓣多维筛选数据失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
