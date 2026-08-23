import { DoubanItem, DoubanResult } from './types';
import { getDoubanProxyUrl } from './utils';

export interface DoubanCategoriesParams {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

export interface DoubanCollectionParams {
  collectionId: string;
  pageLimit?: number;
  pageStart?: number;
}

export interface DoubanFilterParams {
  tags?: string;
  genres?: string;
  countries?: string;
  yearRange?: string;
  range?: string;
  sort?: string;
  pageLimit?: number;
  pageStart?: number;
}

export interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

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

interface DoubanSubjectCollectionResponse {
  total?: number;
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

interface DoubanSearchSubjectsResponse {
  subjects: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
    [key: string]: unknown;
  }>;
}

interface DoubanNewSearchResponse {
  data: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
    [key: string]: unknown;
  }>;
}

/**
 * 带超时的 fetch 请求
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  // 检查是否使用代理
  const proxyUrl = getDoubanProxyUrl();
  const finalUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;

  let referer = 'https://movie.douban.com/';
  if (url.includes('m.douban.com') || url.includes('subject_collection')) {
    referer = 'https://m.douban.com/';
  } else if (url.includes('new_search_subjects')) {
    referer = 'https://movie.douban.com/explore';
  }

  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: referer,
      Accept: 'application/json, text/plain, */*',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(finalUrl, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 检查是否应该使用客户端获取豆瓣数据
 */
export function shouldUseDoubanClient(): boolean {
  return getDoubanProxyUrl() !== null;
}

/**
 * 浏览器端豆瓣分类数据获取函数
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  if (!['tv', 'movie'].includes(kind)) {
    throw new Error('kind 参数必须是 tv 或 movie');
  }

  if (!category || !type) {
    throw new Error('category 和 type 参数不能为空');
  }

  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  const target = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = doubanData.items.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list,
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣分类数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

/**
 * 统一的豆瓣分类数据获取函数
 */
export async function getDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  if (shouldUseDoubanClient()) {
    return fetchDoubanCategories(params);
  } else {
    const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;
    const response = await fetch(
      `/api/douban/categories?kind=${kind}&category=${category}&type=${type}&limit=${pageLimit}&start=${pageStart}`
    );

    if (!response.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('globalError', {
            detail: { message: '获取豆瓣分类数据失败' },
          })
        );
      }
      throw new Error('获取豆瓣分类数据失败');
    }

    return response.json();
  }
}

/**
 * 客户端直连或代理获取 subject_collection 榜单合集数据
 */
export async function fetchDoubanCollection(
  params: DoubanCollectionParams
): Promise<DoubanResult> {
  const { collectionId, pageLimit = 25, pageStart = 0 } = params;

  if (!collectionId) {
    throw new Error('collectionId 不能为空');
  }

  const target = `https://m.douban.com/rexxar/api/v2/subject_collection/${encodeURIComponent(
    collectionId
  )}/items?start=${pageStart}&count=${pageLimit}&for_mobile=1`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanSubjectCollectionResponse = await response.json();

    const list: DoubanItem[] = (doubanData.subject_collection_items || []).map(
      (item) => ({
        id: item.id,
        title: item.title,
        poster: item.pic?.normal || item.pic?.large || item.cover_url || '',
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
        year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      })
    );

    return {
      code: 200,
      message: '获取成功',
      list,
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣榜单数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣榜单数据失败: ${(error as Error).message}`);
  }
}

/**
 * 统一获取 subject_collection 榜单合集
 */
export async function getDoubanCollection(
  params: DoubanCollectionParams
): Promise<DoubanResult> {
  if (shouldUseDoubanClient()) {
    return fetchDoubanCollection(params);
  } else {
    const { collectionId, pageLimit = 25, pageStart = 0 } = params;
    const response = await fetch(
      `/api/douban/collection?collection_id=${encodeURIComponent(
        collectionId
      )}&limit=${pageLimit}&start=${pageStart}`
    );

    if (!response.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('globalError', {
            detail: { message: '获取豆瓣榜单数据失败' },
          })
        );
      }
      throw new Error('获取豆瓣榜单数据失败');
    }

    return response.json();
  }
}

/**
 * 客户端直连或代理获取多维复合筛选 (new_search_subjects) 数据
 */
export async function fetchDoubanFilter(
  params: DoubanFilterParams
): Promise<DoubanResult> {
  const {
    tags = '电影',
    genres = '',
    countries = '',
    yearRange = '',
    range = '0,10',
    sort = 'T',
    pageLimit = 25,
    pageStart = 0,
  } = params;

  const queryParams = new URLSearchParams();
  queryParams.set('tags', tags);
  if (genres) queryParams.set('genres', genres);
  if (countries) queryParams.set('countries', countries);
  if (yearRange) queryParams.set('year_range', yearRange);
  if (range) queryParams.set('range', range);
  if (sort) queryParams.set('sort', sort);
  queryParams.set('start', pageStart.toString());
  queryParams.set('limit', pageLimit.toString());

  const target = `https://movie.douban.com/j/new_search_subjects?${queryParams.toString()}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanNewSearchResponse = await response.json();

    const list: DoubanItem[] = (doubanData.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || '',
      rate: item.rate || '',
      year: '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list,
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣筛选数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣筛选数据失败: ${(error as Error).message}`);
  }
}

/**
 * 统一获取多维筛选数据
 */
export async function getDoubanFilter(
  params: DoubanFilterParams
): Promise<DoubanResult> {
  if (shouldUseDoubanClient()) {
    return fetchDoubanFilter(params);
  } else {
    const {
      tags = '电影',
      genres = '',
      countries = '',
      yearRange = '',
      range = '0,10',
      sort = 'T',
      pageLimit = 25,
      pageStart = 0,
    } = params;

    const queryParams = new URLSearchParams();
    queryParams.set('tags', tags);
    if (genres) queryParams.set('genres', genres);
    if (countries) queryParams.set('countries', countries);
    if (yearRange) queryParams.set('year_range', yearRange);
    if (range) queryParams.set('range', range);
    if (sort) queryParams.set('sort', sort);
    queryParams.set('start', pageStart.toString());
    queryParams.set('limit', pageLimit.toString());

    const response = await fetch(
      `/api/douban/filter?${queryParams.toString()}`
    );

    if (!response.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('globalError', {
            detail: { message: '获取豆瓣筛选数据失败' },
          })
        );
      }
      throw new Error('获取豆瓣筛选数据失败');
    }

    return response.json();
  }
}

export async function getDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;
  if (shouldUseDoubanClient()) {
    return fetchDoubanList(params);
  } else {
    const response = await fetch(
      `/api/douban?tag=${encodeURIComponent(tag)}&type=${encodeURIComponent(
        type
      )}&pageSize=${pageLimit}&pageStart=${pageStart}`
    );

    if (!response.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('globalError', {
            detail: { message: '获取豆瓣列表数据失败' },
          })
        );
      }
      throw new Error('获取豆瓣列表数据失败');
    }

    return response.json();
  }
}

export async function fetchDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  if (!tag || !type) {
    throw new Error('tag 和 type 参数不能为空');
  }

  if (!['tv', 'movie'].includes(type)) {
    throw new Error('type 参数必须是 tv 或 movie');
  }

  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  const target = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${encodeURIComponent(
    tag
  )}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanSearchSubjectsResponse = await response.json();

    const list: DoubanItem[] = (doubanData.subjects || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || '',
      rate: item.rate || '',
      year: '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list,
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣列表数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}
