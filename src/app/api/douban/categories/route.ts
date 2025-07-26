import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { DoubanItem, DoubanResult } from '@/lib/types';

interface DoubanCategoryApiResponse {
  total: number;
  items: Array<{
    id: string;
    title: string;
    card_subtitle: string;
    pic: {
      large: string;
      normal: string;
    };
    rating: {
      value: number;
    };
  }>;
}

interface DoubanRecommendApiResponse {
  count: number;
  items: Array<{
    id: string;
    title: string;
    year?: string;
    pic?: {
      large?: string;
      normal?: string;
    };
    rating?: {
      value?: number;
    };
    card_subtitle?: string;
    item_type?: string;
  }>;
}

interface DoubanSearchApiResponse {
  subjects: Array<{
    id: string;
    title: string;
    year: string;
    cover: string;
    rate: string;
  }>;
}

async function fetchDoubanData(
  url: string,
): Promise<
  | DoubanCategoryApiResponse
  | DoubanRecommendApiResponse
  | DoubanSearchApiResponse
> {
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  // 设置请求选项，包括信号和头部
  const fetchOptions = {
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: 'https://movie.douban.com/',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://movie.douban.com',
    },
  };

  try {
    // 尝试直接访问豆瓣API
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 获取参数
  const kind = searchParams.get('kind') || 'movie';
  const category = searchParams.get('category');
  const type = searchParams.get('type');
  const pageLimit = 200; // 固定页面大小为200

  // 验证参数
  if (!kind) {
    return NextResponse.json({ error: '缺少必要参数: kind' }, { status: 400 });
  }

  if (!['tv', 'movie'].includes(kind)) {
    return NextResponse.json(
      { error: 'kind 参数必须是 tv 或 movie' },
      { status: 400 },
    );
  }

  // 确定使用的标签
  let tag = '';

  // 如果有type参数，优先使用type作为标签
  if (type && type !== '全部') {
    tag = type;
  } else if (category && category !== '热门电影' && category !== '热门') {
    // 否则使用category作为标签（排除通用分类）
    tag = category;
  } else {
    // 默认使用豆瓣高分
    tag = '豆瓣高分';
  }

  // 可信网站的标签列表
  const validMovieTags = [
    '热门',
    '最新',
    '经典',
    '豆瓣高分',
    '冷门佳片',
    '华语',
    '历史',
    '欧美',
    '韩国',
    '日本',
    '动作',
    '喜剧',
    '爱情',
    '科幻',
    '悬疑',
    '恐怖',
    '治愈',
    '动画',
    '伦理',
  ];
  const validTvTags = [
    '热门',
    '美剧',
    '英剧',
    '韩剧',
    '日剧',
    '国产剧',
    '港剧',
    '日本动画',
    '综艺',
    '纪录片',
  ];

  // 标签映射（处理一些特殊情况）
  const tagMapping: { [key: string]: string } = {
    喜剧片: '喜剧',
    爱情片: '爱情',
    科幻片: '科幻',
    动作片: '动作',
    悬疑片: '悬疑',
    恐怖片: '恐怖',
    治愈片: '治愈',
    动画片: '动画',
    热门电影: '热门',
    热门剧集: '热门',
    中国大陆: '华语',
    美国: '欧美',
    伦理: '伦理',
    英国: '欧美',
  };

  // 应用标签映射
  tag = tagMapping[tag] || tag;

  // 验证标签是否有效
  const validTags = kind === 'movie' ? validMovieTags : validTvTags;
  if (!validTags.includes(tag)) {
    // 如果标签无效，使用默认标签
    tag = kind === 'movie' ? '热门' : '热门';
  }

  // 统一使用豆瓣搜索API
  const target = `https://movie.douban.com/j/search_subjects?type=${kind}&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=${pageLimit}&page_start=0`;

  try {
    // 调用豆瓣 API
    const doubanData = (await fetchDoubanData(
      target,
    )) as DoubanSearchApiResponse;

    // 转换数据格式 - 统一使用搜索API的数据格式
    const list: DoubanItem[] =
      doubanData.subjects?.map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.cover || '',
        rate: item.rate || '',
        year: item.year || '',
      })) || [];

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
    return NextResponse.json(
      { error: '获取豆瓣数据失败', details: (error as Error).message },
      { status: 500 },
    );
  }
}
