import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import {
  DoubanUnavailableError,
  fetchDoubanJson,
  hasServerProxy,
} from '@/lib/douban.server';
import { DoubanItem, DoubanResult } from '@/lib/types';

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

  const collectionId =
    searchParams.get('collection_id') || searchParams.get('id');
  const start = parseInt(searchParams.get('start') || '0', 10);
  const count = parseInt(
    searchParams.get('count') || searchParams.get('limit') || '25',
    10
  );

  if (!collectionId) {
    return NextResponse.json(
      { error: '缺少必要参数: collection_id' },
      { status: 400 }
    );
  }

  if (count < 1 || count > 100) {
    return NextResponse.json(
      { error: 'count 必须在 1-100 之间' },
      { status: 400 }
    );
  }

  if (start < 0) {
    return NextResponse.json({ error: 'start 不能小于 0' }, { status: 400 });
  }

  const target = `https://m.douban.com/rexxar/api/v2/subject_collection/${encodeURIComponent(
    collectionId
  )}/items?start=${start}&count=${count}&for_mobile=1`;

  try {
    const doubanData = await fetchDoubanJson<DoubanSubjectCollectionResponse>(
      target
    );

    const list: DoubanItem[] = (doubanData.subject_collection_items || []).map(
      (item) => ({
        id: item.id,
        title: item.title,
        poster: item.pic?.normal || item.pic?.large || item.cover_url || '',
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
        year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      })
    );

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
        error: '获取豆瓣榜单数据失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
