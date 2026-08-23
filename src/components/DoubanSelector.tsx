/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import React from 'react';

export interface FilterState {
  genres: string;
  countries: string;
  yearRange: string;
  range: string;
  sort: string;
}

export interface SelectorOption {
  label: string;
  value: string;
}

interface DoubanSelectorProps {
  type: 'movie' | 'tv' | 'show';
  primarySelection?: string;
  secondarySelection?: string;
  filterState?: FilterState;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onFilterChange?: (filters: FilterState) => void;
}

export const MOVIE_PRIMARY_OPTIONS: SelectorOption[] = [
  { label: '热门电影', value: '热门' },
  { label: '实时热门', value: 'collection_movie_real_time_hotest' },
  { label: 'Top 250', value: 'collection_movie_top250' },
  { label: '一周口碑', value: 'collection_movie_weekly_best' },
  { label: '院线热映', value: 'collection_movie_showing' },
  { label: '最新电影', value: '最新' },
  { label: '豆瓣高分', value: '豆瓣高分' },
  { label: '冷门佳片', value: '冷门佳片' },
  { label: '多维筛选 🔍', value: 'filter' },
];

export const TV_PRIMARY_OPTIONS: SelectorOption[] = [
  { label: '全部剧集', value: 'tv' },
  { label: '实时热门', value: 'collection_tv_real_time_hotest' },
  { label: '国产热播', value: 'collection_tv_domestic' },
  { label: '热门美剧', value: 'collection_tv_american_hot' },
  { label: '热门韩剧', value: 'collection_tv_korean_hot' },
  { label: '热门日剧', value: 'collection_tv_japanese_hot' },
  { label: '热门动漫', value: 'collection_tv_animation' },
  { label: '高分纪录片', value: 'collection_tv_documentary' },
  { label: 'Top 剧集', value: 'collection_tv_top250' },
  { label: '多维筛选 🔍', value: 'filter' },
];

export const SHOW_PRIMARY_OPTIONS: SelectorOption[] = [
  { label: '全部综艺', value: 'show' },
  { label: '国内综艺', value: 'collection_tv_variety_show' },
  { label: '国外综艺', value: 'collection_tv_foreign_variety_show' },
  { label: '多维筛选 🔍', value: 'filter' },
];

export const MOVIE_SECONDARY_OPTIONS: Record<string, SelectorOption[]> = {
  热门: [
    { label: '全部', value: '全部' },
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
  ],
  最新: [
    { label: '全部', value: '全部' },
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
  ],
  豆瓣高分: [
    { label: '全部', value: '全部' },
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
  ],
  冷门佳片: [
    { label: '全部', value: '全部' },
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
  ],
};

// 多维筛选选项配置
export const GENRE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '剧情', value: '剧情' },
  { label: '喜剧', value: '喜剧' },
  { label: '动作', value: '动作' },
  { label: '爱情', value: '爱情' },
  { label: '科幻', value: '科幻' },
  { label: '悬疑', value: '悬疑' },
  { label: '惊悚', value: '惊悚' },
  { label: '恐怖', value: '恐怖' },
  { label: '犯罪', value: '犯罪' },
  { label: '奇幻', value: '奇幻' },
  { label: '冒险', value: '冒险' },
  { label: '灾难', value: '灾难' },
  { label: '战争', value: '战争' },
  { label: '动画', value: '动画' },
  { label: '纪录片', value: '纪录片' },
  { label: '历史', value: '历史' },
  { label: '武侠', value: '武侠' },
  { label: '古装', value: '古装' },
];

export const COUNTRY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '中国大陆', value: '中国大陆' },
  { label: '中国香港', value: '中国香港' },
  { label: '中国台湾', value: '中国台湾' },
  { label: '美国', value: '美国' },
  { label: '日本', value: '日本' },
  { label: '韩国', value: '韩国' },
  { label: '英国', value: '英国' },
  { label: '法国', value: '法国' },
  { label: '德国', value: '德国' },
  { label: '意大利', value: '意大利' },
  { label: '西班牙', value: '西班牙' },
  { label: '印度', value: '印度' },
  { label: '泰国', value: '泰国' },
];

export const YEAR_OPTIONS = [
  { label: '全部', value: '' },
  { label: '2026', value: '2026,2026' },
  { label: '2025', value: '2025,2025' },
  { label: '2024', value: '2024,2024' },
  { label: '2020-2023', value: '2020,2023' },
  { label: '2010年代', value: '2010,2019' },
  { label: '2000年代', value: '2000,2009' },
  { label: '90年代', value: '1990,1999' },
  { label: '80年代', value: '1980,1989' },
  { label: '更早', value: '1,1979' },
];

export const RATING_OPTIONS = [
  { label: '全部评分', value: '0,10' },
  { label: '9分以上', value: '9,10' },
  { label: '8分以上', value: '8,10' },
  { label: '7分以上', value: '7,10' },
];

export const SORT_OPTIONS = [
  { label: '综合热度', value: 'T' },
  { label: '最新上映/播出', value: 'R' },
  { label: '评分最高', value: 'S' },
];

const DoubanSelector: React.FC<DoubanSelectorProps> = ({
  type,
  primarySelection = '',
  secondarySelection = '',
  filterState = {
    genres: '',
    countries: '',
    yearRange: '',
    range: '0,10',
    sort: 'T',
  },
  onPrimaryChange,
  onSecondaryChange,
  onFilterChange,
}) => {
  // 根据主分类获取 primary 列表
  const primaryOptions =
    type === 'movie'
      ? MOVIE_PRIMARY_OPTIONS
      : type === 'tv'
      ? TV_PRIMARY_OPTIONS
      : SHOW_PRIMARY_OPTIONS;

  const currentPrimary = primarySelection || primaryOptions[0]?.value || '';
  const secondaryOptions = MOVIE_SECONDARY_OPTIONS[currentPrimary] || [];

  const handleFilterUpdate = (field: keyof FilterState, value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filterState,
      [field]: value,
    });
  };

  const isFilterMode = currentPrimary === 'filter';

  return (
    <div className='space-y-4 sm:space-y-5 bg-white/40 dark:bg-gray-800/40 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-md shadow-sm transition-all'>
      {/* 一级选择器 (榜单 / 模式) */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
        <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[52px] uppercase tracking-wider'>
          榜单/模式
        </span>
        <div className='flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
          {primaryOptions.map((option) => {
            const isActive = currentPrimary === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onPrimaryChange(option.value)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 dark:bg-blue-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/70 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 电影二级选择器 (仅当非多维筛选且有二级分类时显示) */}
      {!isFilterMode && secondaryOptions.length > 0 && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/30'>
          <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[52px] uppercase tracking-wider'>
            地区/分类
          </span>
          <div className='flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
            {secondaryOptions.map((option) => {
              const isActive = (secondarySelection || '全部') === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onSecondaryChange(option.value)}
                  className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-sm'
                      : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 多维复合筛选面板 */}
      {isFilterMode && (
        <div className='space-y-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/50 animate-fadeIn'>
          {/* 类型 / 题材 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[52px] uppercase tracking-wider'>
              题材
            </span>
            <div className='flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
              {GENRE_OPTIONS.map((item) => {
                const isActive = (filterState.genres || '') === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleFilterUpdate('genres', item.value)}
                    className={`px-2.5 py-1 text-xs sm:text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 制片地区 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[52px] uppercase tracking-wider'>
              地区
            </span>
            <div className='flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
              {COUNTRY_OPTIONS.map((item) => {
                const isActive = (filterState.countries || '') === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleFilterUpdate('countries', item.value)}
                    className={`px-2.5 py-1 text-xs sm:text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 上映年代 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[52px] uppercase tracking-wider'>
              年代
            </span>
            <div className='flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
              {YEAR_OPTIONS.map((item) => {
                const isActive = (filterState.yearRange || '') === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleFilterUpdate('yearRange', item.value)}
                    className={`px-2.5 py-1 text-xs sm:text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 评分与排序 */}
          <div className='flex flex-wrap items-center gap-4 sm:gap-6 pt-1'>
            {/* 评分 */}
            <div className='flex items-center gap-2'>
              <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[52px] uppercase tracking-wider'>
                评分
              </span>
              <div className='flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
                {RATING_OPTIONS.map((item) => {
                  const isActive = (filterState.range || '0,10') === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleFilterUpdate('range', item.value)}
                      className={`px-2.5 py-1 text-xs sm:text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 排序 */}
            <div className='flex items-center gap-2'>
              <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[36px] uppercase tracking-wider'>
                排序
              </span>
              <div className='flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none'>
                {SORT_OPTIONS.map((item) => {
                  const isActive = (filterState.sort || 'T') === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleFilterUpdate('sort', item.value)}
                      className={`px-2.5 py-1 text-xs sm:text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoubanSelector;
