/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import React, { useEffect, useRef, useState } from 'react';

interface SelectorOption {
  label: string;
  value: string;
}

interface DoubanSelectorProps {
  type: 'movie' | 'tv' | 'show';
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
}

const DoubanSelector: React.FC<DoubanSelectorProps> = ({
  type,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  // 为不同的选择器创建独立的refs和状态
  const primaryContainerRef = useRef<HTMLDivElement>(null);
  const primaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [primaryIndicatorStyle, setPrimaryIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [secondaryIndicatorStyle, setSecondaryIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  // 电影的一级选择器选项 - 基于豆瓣API验证的标签扩展
  const moviePrimaryOptions: SelectorOption[] = [
    { label: '热门电影', value: '热门' },
    { label: '最新电影', value: '最新' },
    { label: '经典电影', value: '经典' },
    { label: '豆瓣高分', value: '豆瓣高分' },
    { label: '冷门佳片', value: '冷门佳片' },
    { label: '文艺电影', value: '文艺' },
  ];

  // 电影的二级选择器选项 - 基于豆瓣API验证的标签大幅扩展
  const movieSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    // 地区分类
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
    { label: '中国大陆', value: '中国大陆' },
    { label: '美国', value: '美国' },
    { label: '中国香港', value: '中国香港' },
    { label: '中国台湾', value: '中国台湾' },
    { label: '英国', value: '英国' },
    { label: '法国', value: '法国' },
    { label: '德国', value: '德国' },
    { label: '意大利', value: '意大利' },
    { label: '西班牙', value: '西班牙' },
    { label: '印度', value: '印度' },
    { label: '泰国', value: '泰国' },
    { label: '俄罗斯', value: '俄罗斯' },
    { label: '加拿大', value: '加拿大' },
    { label: '澳大利亚', value: '澳大利亚' },
    // 类型分类
    { label: '喜剧片', value: '喜剧' },
    { label: '爱情片', value: '爱情' },
    { label: '动作片', value: '动作' },
    { label: '科幻片', value: '科幻' },
    { label: '动画片', value: '动画' },
    { label: '悬疑片', value: '悬疑' },
    { label: '犯罪片', value: '犯罪' },
    { label: '惊悚片', value: '惊悚' },
    { label: '冒险片', value: '冒险' },
    { label: '音乐片', value: '音乐' },
    { label: '历史片', value: '历史' },
    { label: '奇幻片', value: '奇幻' },
    { label: '恐怖片', value: '恐怖' },
    { label: '战争片', value: '战争' },
    { label: '传记片', value: '传记' },
    { label: '歌舞片', value: '歌舞' },
    { label: '武侠片', value: '武侠' },
    { label: '灾难片', value: '灾难' },
    { label: '西部片', value: '西部' },
    { label: '纪录片', value: '纪录片' },
    { label: '短片', value: '短片' },
    { label: '治愈系', value: '治愈' },
  ];

  // 电视剧选择器选项 - 基于豆瓣API验证的标签扩展
  const tvOptions: SelectorOption[] = [
    { label: '热门剧集', value: '热门' },
    { label: '美剧', value: '美剧' },
    { label: '英剧', value: '英剧' },
    { label: '韩剧', value: '韩剧' },
    { label: '日剧', value: '日剧' },
    { label: '国产剧', value: '国产剧' },
    { label: '港剧', value: '港剧' },
    { label: '台剧', value: '台剧' },
    { label: '泰剧', value: '泰剧' },
    { label: '日本动画', value: '日本动画' },
    { label: '综艺', value: '综艺' },
    { label: '纪录片', value: '纪录片' },
    { label: '真人秀', value: '真人秀' },
  ];

  // 综艺选择器选项 - 基于豆瓣API验证的标签扩展
  const showOptions: SelectorOption[] = [
    { label: '热门综艺', value: '热门' },
    { label: '脱口秀', value: '脱口秀' },
    { label: '真人秀', value: '真人秀' },
    { label: '音乐', value: '音乐' },
    { label: '访谈', value: '访谈' },
    { label: '播报', value: '播报' },
    { label: '纪实', value: '纪实' },
    { label: '选秀', value: '选秀' },
    { label: '益智', value: '益智' },
    { label: '情感', value: '情感' },
    { label: '美食', value: '美食' },
    { label: '旅游', value: '旅游' },
    { label: '时尚', value: '时尚' },
    { label: '财经', value: '财经' },
    { label: '求职', value: '求职' },
  ];

  // 更新指示器位置的通用函数
  const updateIndicatorPosition = (
    activeIndex: number,
    containerRef: React.RefObject<HTMLDivElement | null>,
    buttonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    setIndicatorStyle: React.Dispatch<
      React.SetStateAction<{ left: number; width: number }>
    >,
  ) => {
    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current
    ) {
      const timeoutId = setTimeout(() => {
        const button = buttonRefs.current[activeIndex];
        const container = containerRef.current;
        if (button && container) {
          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          if (buttonRect.width > 0) {
            setIndicatorStyle({
              left: buttonRect.left - containerRect.left,
              width: buttonRect.width,
            });
          }
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  };

  // 组件挂载时立即计算初始位置
  useEffect(() => {
    // 主选择器初始位置
    if (type === 'movie') {
      const activeIndex = moviePrimaryOptions.findIndex(
        (opt) =>
          opt.value === (primarySelection || moviePrimaryOptions[0].value),
      );
      updateIndicatorPosition(
        activeIndex,
        primaryContainerRef,
        primaryButtonRefs,
        setPrimaryIndicatorStyle,
      );
    }

    // 副选择器初始位置
    let secondaryActiveIndex = -1;
    if (type === 'movie') {
      secondaryActiveIndex = movieSecondaryOptions.findIndex(
        (opt) =>
          opt.value === (secondarySelection || movieSecondaryOptions[0].value),
      );
    } else if (type === 'tv') {
      secondaryActiveIndex = tvOptions.findIndex(
        (opt) => opt.value === (secondarySelection || tvOptions[0].value),
      );
    } else if (type === 'show') {
      secondaryActiveIndex = showOptions.findIndex(
        (opt) => opt.value === (secondarySelection || showOptions[0].value),
      );
    }

    if (secondaryActiveIndex >= 0) {
      updateIndicatorPosition(
        secondaryActiveIndex,
        secondaryContainerRef,
        secondaryButtonRefs,
        setSecondaryIndicatorStyle,
      );
    }
  }, [type]); // 只在type变化时重新计算

  // 监听主选择器变化
  useEffect(() => {
    if (type === 'movie') {
      const activeIndex = moviePrimaryOptions.findIndex(
        (opt) => opt.value === primarySelection,
      );
      const cleanup = updateIndicatorPosition(
        activeIndex,
        primaryContainerRef,
        primaryButtonRefs,
        setPrimaryIndicatorStyle,
      );
      return cleanup;
    }
  }, [primarySelection]);

  // 监听副选择器变化
  useEffect(() => {
    let activeIndex = -1;
    let options: SelectorOption[] = [];

    if (type === 'movie') {
      activeIndex = movieSecondaryOptions.findIndex(
        (opt) => opt.value === secondarySelection,
      );
      options = movieSecondaryOptions;
    } else if (type === 'tv') {
      activeIndex = tvOptions.findIndex(
        (opt) => opt.value === secondarySelection,
      );
      options = tvOptions;
    } else if (type === 'show') {
      activeIndex = showOptions.findIndex(
        (opt) => opt.value === secondarySelection,
      );
      options = showOptions;
    }

    if (options.length > 0) {
      const cleanup = updateIndicatorPosition(
        activeIndex,
        secondaryContainerRef,
        secondaryButtonRefs,
        setSecondaryIndicatorStyle,
      );
      return cleanup;
    }
  }, [secondarySelection]);

  // 渲染胶囊式选择器
  const renderCapsuleSelector = (
    options: SelectorOption[],
    activeValue: string | undefined,
    onChange: (value: string) => void,
    isPrimary = false,
  ) => {
    const containerRef = isPrimary
      ? primaryContainerRef
      : secondaryContainerRef;
    const buttonRefs = isPrimary ? primaryButtonRefs : secondaryButtonRefs;
    const indicatorStyle = isPrimary
      ? primaryIndicatorStyle
      : secondaryIndicatorStyle;

    return (
      <div
        ref={containerRef}
        className='relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm'
      >
        {/* 滑动的白色背景指示器 */}
        {indicatorStyle.width > 0 && (
          <div
            className='absolute top-0.5 bottom-0.5 sm:top-1 sm:bottom-1 bg-white dark:bg-gray-500 rounded-full shadow-sm transition-all duration-300 ease-out'
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />
        )}

        {options.map((option, index) => {
          const isActive = activeValue === option.value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onChange(option.value)}
              className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100 cursor-default'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 电影类型 - 显示两级选择器 */}
      {type === 'movie' && (
        <div className='space-y-3 sm:space-y-4'>
          {/* 一级选择器 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
              分类
            </span>
            <div className='overflow-x-auto'>
              {renderCapsuleSelector(
                moviePrimaryOptions,
                primarySelection || moviePrimaryOptions[0].value,
                onPrimaryChange,
                true,
              )}
            </div>
          </div>

          {/* 二级选择器 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
              地区
            </span>
            <div className='overflow-x-auto'>
              {renderCapsuleSelector(
                movieSecondaryOptions,
                secondarySelection || movieSecondaryOptions[0].value,
                onSecondaryChange,
                false,
              )}
            </div>
          </div>
        </div>
      )}

      {/* 电视剧类型 - 只显示一级选择器 */}
      {type === 'tv' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
            类型
          </span>
          <div className='overflow-x-auto'>
            {renderCapsuleSelector(
              tvOptions,
              secondarySelection || tvOptions[0].value,
              onSecondaryChange,
              false,
            )}
          </div>
        </div>
      )}

      {/* 综艺类型 - 只显示一级选择器 */}
      {type === 'show' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
            类型
          </span>
          <div className='overflow-x-auto'>
            {renderCapsuleSelector(
              showOptions,
              secondarySelection || showOptions[0].value,
              onSecondaryChange,
              false,
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DoubanSelector;
