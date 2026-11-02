/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

'use client';

import Artplayer from 'artplayer';
import Hls from 'hls.js';
import {
  ListFilter,
  Plus,
  Radio,
  Search,
  Trash2,
  Tv,
} from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { LiveChannel, parseM3u, PRESET_CHANNELS } from '@/lib/iptv';

import PageLayout from '@/components/PageLayout';

function LivePageClient() {
  const [channels, setChannels] = useState<LiveChannel[]>(PRESET_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel>(
    PRESET_CHANNELS[0]
  );
  const [activeGroup, setActiveGroup] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customM3uUrl, setCustomM3uUrl] = useState<string>('');
  const [customM3uContent, setCustomM3uContent] = useState<string>('');
  const [loadingCustom, setLoadingCustom] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState<boolean>(true);
  const [currentRouteIndex, setCurrentRouteIndex] = useState<number>(0);

  // 当切换频道时重置为主线路
  useEffect(() => {
    setCurrentRouteIndex(0);
  }, [selectedChannel?.id]);

  // 计算当前频道的所有可用线路 (主线 + 备用线路)
  const allRoutes = useMemo(() => {
    if (!selectedChannel) return [];
    const list = [selectedChannel.url];
    if (Array.isArray(selectedChannel.backup_urls)) {
      selectedChannel.backup_urls.forEach((u) => {
        if (u && !list.includes(u)) list.push(u);
      });
    }
    return list;
  }, [selectedChannel]);

  const currentStreamUrl = allRoutes[currentRouteIndex] || selectedChannel?.url || '';

  const artRef = useRef<HTMLDivElement>(null);
  const artPlayerInstance = useRef<any>(null);
  const hlsRef = useRef<any>(null);
  const activeHlsInstances = useRef<Set<any>>(new Set());

  // 优先拉取嗅探脚本同步更新的最新频道库，并叠加本地用户自定义频道
  useEffect(() => {
    const loadChannels = async () => {
      let baseList = PRESET_CHANNELS;
      try {
        const resp = await fetch(`/iptv/channels.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data?.channels) && data.channels.length > 0) {
            baseList = data.channels;
          }
        }
      } catch (_) {
        // 网络异常时回退到 PRESET_CHANNELS
      }

      try {
        const saved = localStorage.getItem('moontv_custom_live_channels');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            baseList = [...baseList, ...parsed];
          }
        }
      } catch (_) {
        // 忽略缓存错误
      }

      setChannels(baseList);
      if (baseList.length > 0) {
        setSelectedChannel(baseList[0]);
      }
    };

    loadChannels();
  }, []);

  // 常用大类优先排列顺序
  const GROUP_ORDER = useMemo(
    () => [
      '全部',
      '央视频道',
      '卫视频道',
      '影视轮播',
      '国际频道',
      '体育赛事',
      '音乐电台',
      '纪录探索',
      '少儿动画',
      '港澳台',
      '地方综合',
    ],
    []
  );

  // 计算每个分组的频道数量
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { 全部: channels.length };
    channels.forEach((c) => {
      const g = c.group || '其他频道';
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [channels]);

  // 计算智能有序的分组列表
  const groups = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => set.add(c.group || '其他频道'));
    const list = Array.from(set);

    list.sort((a, b) => {
      const idxA = GROUP_ORDER.indexOf(a);
      const idxB = GROUP_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (groupCounts[b] || 0) - (groupCounts[a] || 0);
    });

    return ['全部', ...list];
  }, [channels, GROUP_ORDER, groupCounts]);

  // 过滤后的频道
  const filteredChannels = useMemo(() => {
    return channels.filter((channel) => {
      const matchGroup =
        activeGroup === '全部' || channel.group === activeGroup;
      const matchSearch =
        !searchQuery.trim() ||
        channel.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchGroup && matchSearch;
    });
  }, [channels, activeGroup, searchQuery]);

  // 彻底安全销毁旧播放器与 HLS 实例，杜绝换台背景音残留与幽灵进程
  const teardownPlayer = () => {
    // 1. 彻底关停所有 HLS.js 实例的网络请求与解码线程
    for (const h of activeHlsInstances.current) {
      try {
        h.removeAllListeners();
        h.stopLoad();
        h.detachMedia();
        h.destroy();
      } catch (_) {}
    }
    activeHlsInstances.current.clear();

    if (hlsRef.current) {
      try {
        hlsRef.current.removeAllListeners();
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch (_) {}
      hlsRef.current = null;
    }

    // 2. 彻底静音、暂停并重置页面与容器中的所有 HTMLVideoElement
    if (typeof document !== 'undefined') {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach((video) => {
        try {
          video.pause();
          video.muted = true;
          if ((video as any).hls) {
            try {
              (video as any).hls.removeAllListeners();
              (video as any).hls.stopLoad();
              (video as any).hls.detachMedia();
              (video as any).hls.destroy();
            } catch (_) {}
            (video as any).hls = null;
          }
          video.src = '';
          video.removeAttribute('src');
          video.load();
        } catch (_) {}
      });
    }

    // 3. 销毁 ArtPlayer 实例
    if (artPlayerInstance.current) {
      try {
        const art = artPlayerInstance.current;
        if (art.video) {
          try {
            art.video.pause();
            art.video.muted = true;
            art.video.src = '';
            art.video.removeAttribute('src');
            art.video.load();
          } catch (_) {}
        }
        art.destroy(true);
      } catch (_) {}
      artPlayerInstance.current = null;
    }

    // 4. 清理 DOM 容器
    if (artRef.current) {
      artRef.current.innerHTML = '';
    }
  };

  // 换台处理：同步切断旧节目音视频，重置线路索引
  const handleSelectChannel = (channel: LiveChannel) => {
    if (selectedChannel?.id === channel.id) return;
    teardownPlayer();
    setCurrentRouteIndex(0);
    setSelectedChannel(channel);
  };

  // 切换线路处理
  const handleSwitchRoute = (idx: number) => {
    if (currentRouteIndex === idx) return;
    teardownPlayer();
    setCurrentRouteIndex(idx);
  };

  // 初始化 / 切换频道播放器
  useEffect(() => {
    if (!artRef.current || !selectedChannel) return;

    let isInstanceDestroyed = false;
    let art: any = null;

    setPlayerError(null);

    // 换台或重新初始化前，先彻底清理旧实例
    teardownPlayer();

    // 判定实际播放 URL：当开启代理，或在 HTTPS 生产站点下播放 HTTP 直播流时，通过内置边缘代理中转
    const isHttpsPage =
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:';
    const shouldProxy =
      useProxy ||
      (isHttpsPage && currentStreamUrl.startsWith('http://'));

    const targetUrl = shouldProxy
      ? `/api/live-proxy?url=${encodeURIComponent(currentStreamUrl)}`
      : currentStreamUrl;

    try {
      art = new Artplayer({
        container: artRef.current,
        url: targetUrl,
        type: 'm3u8',
        isLive: true,
        autoplay: true,
        autoMini: false, // 严禁进入浮动迷你播放器，防止脱离容器挂载到 body 继续播放
        mutex: true, // 强制互斥，其它播放器实例自动静音暂停
        setting: true,
        pip: true,
        fullscreen: true,
        fullscreenWeb: true,
        playsInline: true,
        playbackRate: false,
        theme: '#16a34a',
        customType: {
          m3u8: function (video: HTMLVideoElement, url: string, artInstance: any) {
            if (isInstanceDestroyed) return;

            if (Hls.isSupported()) {
              if (hlsRef.current) {
                try {
                  hlsRef.current.removeAllListeners();
                  hlsRef.current.stopLoad();
                  hlsRef.current.detachMedia();
                  hlsRef.current.destroy();
                } catch (_) {}
                activeHlsInstances.current.delete(hlsRef.current);
                hlsRef.current = null;
              }

              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false, // 关闭激进低延迟，防止紧贴切片边缘导致的频繁断流卡顿
                liveSyncDurationCount: 3, // 保持约 3 个切片的安全平滑缓冲区，极大提升抗抖动能力
                maxBufferLength: 30, // 允许前向缓冲 30 秒直播切片
                maxMaxBufferLength: 60,
                maxBufferHole: 0.5, // 轻微切片空洞平滑跳过
                highBufferWatchdogPeriod: 2,
                nudgeOffset: 0.2,
                nudgeMaxRetry: 5,
              });

              hlsRef.current = hls;
              activeHlsInstances.current.add(hls);

              hls.loadSource(url);
              hls.attachMedia(video);
              (video as any).hls = hls;

              // 监听播放器销毁事件，同步解绑并终止 HLS 解码
              artInstance.on('destroy', () => {
                if (isInstanceDestroyed) return;
                try {
                  hls.removeAllListeners();
                  hls.stopLoad();
                  hls.detachMedia();
                  hls.destroy();
                } catch (_) {}
                activeHlsInstances.current.delete(hls);
                if (hlsRef.current === hls) {
                  hlsRef.current = null;
                }
              });

              hls.on(Hls.Events.ERROR, function (_event: any, data: any) {
                // 如果本实例已被销毁或用户已切台，坚决不重试、不拉流、不触发切换线路！
                if (isInstanceDestroyed) return;

                if (data.fatal) {
                  // 若直连失败且当前尚未使用中转代理，自动尝试使用边缘代理自愈
                  if (
                    data.type === Hls.ErrorTypes.NETWORK_ERROR &&
                    !url.includes('/api/live-proxy')
                  ) {
                    console.warn(
                      '[IPTV] 直播流直连失败，自动切换至边缘代理中转...'
                    );
                    const proxiedUrl = `/api/live-proxy?url=${encodeURIComponent(
                      currentStreamUrl
                    )}`;
                    hls.loadSource(proxiedUrl);
                    hls.startLoad();
                    return;
                  }

                  // 如果有多线路且后续有备用源，自动切换至下一条线路
                  if (currentRouteIndex + 1 < allRoutes.length) {
                    console.warn(
                      `[IPTV] 线路 ${currentRouteIndex + 1} 异常，自动切换至线路 ${currentRouteIndex + 2}...`
                    );
                    setCurrentRouteIndex((prev) => prev + 1);
                    return;
                  }

                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.warn('[IPTV] 直播流网络错误，尝试重连...');
                      hls.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.warn('[IPTV] 媒体解析错误，尝试自愈...');
                      hls.recoverMediaError();
                      break;
                    default:
                      console.error('[IPTV] 直播流不可用');
                      setPlayerError(
                        '当前频道所有可用线路均已超时或失效，请尝试切换其他频道'
                      );
                      hls.destroy();
                      break;
                  }
                }
              });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            } else {
              artInstance.notice.show = '当前浏览器不支持播放 HLS 视频流';
            }
          },
        },
      });

      art.on('ready', () => {
        if (isInstanceDestroyed) return;
        art.play().catch((err: unknown) => {
          void err;
        });
      });

      art.on('error', () => {
        if (isInstanceDestroyed) return;
        setPlayerError('直播源连接失败，可能源站已失效或受到防盗链限制');
      });

      artPlayerInstance.current = art;
    } catch (err: unknown) {
      console.error('播放器初始化失败:', err);
    }

    return () => {
      isInstanceDestroyed = true;
      teardownPlayer();
    };
  }, [selectedChannel, useProxy, currentStreamUrl]);

  // 处理自定义 M3U 导入
  const handleImportCustomM3u = async () => {
    setLoadingCustom(true);
    try {
      let content = customM3uContent.trim();
      if (!content && customM3uUrl.trim()) {
        const resp = await fetch(customM3uUrl.trim());
        if (!resp.ok) {
          throw new Error(`拉取失败: ${resp.status} ${resp.statusText}`);
        }
        content = await resp.text();
      }

      if (!content) {
        throw new Error('请输入 M3U 订阅 URL 或粘贴播放列表内容');
      }

      const parsed = parseM3u(content);
      if (parsed.length === 0) {
        throw new Error('未解析到任何有效频道');
      }

      // 保存到本地存储
      const existingCustom = channels.filter(
        (c) => !PRESET_CHANNELS.some((p) => p.id === c.id)
      );
      const combined = [...existingCustom, ...parsed];
      localStorage.setItem(
        'moontv_custom_live_channels',
        JSON.stringify(combined)
      );

      setChannels([...PRESET_CHANNELS, ...combined]);
      setShowCustomModal(false);
      setCustomM3uUrl('');
      setCustomM3uContent('');
      alert(`成功导入 ${parsed.length} 个直播频道！`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoadingCustom(false);
    }
  };

  // 清除自定义频道
  const handleClearCustomChannels = () => {
    if (confirm('确定要清除所有已导入的自定义直播源并恢复预置吗？')) {
      localStorage.removeItem('moontv_custom_live_channels');
      setChannels(PRESET_CHANNELS);
      handleSelectChannel(PRESET_CHANNELS[0]);
    }
  };

  return (
    <PageLayout activePath='/live'>
      <div className='flex flex-col lg:flex-row gap-6 p-4 md:p-6 max-w-7xl mx-auto'>
        {/* 左侧/上方：视频播放区域 */}
        <div className='flex-1 flex flex-col space-y-4 min-w-0'>
          {/* 播放器容器 */}
          <div className='relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800'>
            <div ref={artRef} className='w-full h-full' />
            {playerError && (
              <div className='absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 text-white p-6 text-center space-y-3'>
                <Tv className='w-12 h-12 text-red-400 animate-pulse' />
                <p className='text-sm text-gray-200 max-w-md'>{playerError}</p>
                <button
                  onClick={() => {
                    const idx = channels.findIndex(
                      (c) => c.id === selectedChannel.id
                    );
                    const next = channels[(idx + 1) % channels.length];
                    if (next) handleSelectChannel(next);
                  }}
                  className='px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors shadow'
                >
                  换下一个台
                </button>
              </div>
            )}
          </div>

          {/* 当前频道信息栏 */}
          <div className='flex items-center justify-between bg-white/60 dark:bg-gray-900/60 backdrop-blur-md p-4 rounded-xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm'>
            <div className='flex items-center space-x-3.5 min-w-0'>
              <div className='w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0'>
                <Radio className='w-5 h-5 animate-pulse' />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center space-x-2'>
                  <h1 className='text-base font-bold text-gray-900 dark:text-gray-100 truncate'>
                    {selectedChannel.name}
                  </h1>
                  <span className='px-2 py-0.5 text-[11px] font-medium bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 rounded-full'>
                    {selectedChannel.group}
                  </span>
                  {selectedChannel.latency && (
                    <span className='px-2 py-0.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-full'>
                      {selectedChannel.latency}ms
                    </span>
                  )}
                </div>
                <div className='flex items-center space-x-2 mt-1'>
                  <p className='text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-xs md:max-w-md'>
                    {currentStreamUrl}
                  </p>
                  {allRoutes.length > 1 && (
                    <div className='flex items-center space-x-1 flex-shrink-0'>
                      <span className='text-[10px] text-gray-400'>线路:</span>
                      {allRoutes.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSwitchRoute(idx)}
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-all ${
                            currentRouteIndex === idx
                              ? 'bg-green-600 text-white shadow-xs'
                              : 'bg-gray-200/70 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                          }`}
                        >
                          {idx === 0 ? '主线' : `备用${idx}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='flex items-center space-x-2 flex-shrink-0'>
              <button
                onClick={() => setUseProxy(!useProxy)}
                title={
                  useProxy
                    ? '已开启 Cloudflare 边缘代理（抗跨域 CORS、抗防盗链及解决 HTTP/HTTPS 混合加载）'
                    : '已关闭代理（直接连接源站）'
                }
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shadow-sm ${
                  useProxy
                    ? 'bg-emerald-700/80 hover:bg-emerald-700 text-white border border-emerald-500/30'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span>{useProxy ? '边缘代理: 开' : '边缘代理: 关'}</span>
              </button>
              <button
                onClick={() => setShowCustomModal(true)}
                className='inline-flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm'
              >
                <Plus className='w-3.5 h-3.5' />
                <span className='hidden sm:inline'>添加直播源</span>
              </button>
              {channels.length > PRESET_CHANNELS.length && (
                <button
                  onClick={handleClearCustomChannels}
                  title='重置回预置频道'
                  className='p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 右侧/下方：频道选择列表 */}
        <div className='w-full lg:w-96 flex flex-col space-y-3.5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md p-4 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm h-[38rem]'>
          {/* 搜索与分组过滤 */}
          <div className='space-y-2.5'>
            <div className='relative'>
              <Search className='w-4 h-4 text-gray-400 absolute left-3 top-2.5' />
              <input
                type='text'
                placeholder='搜索频道名称 (如: CCTV、湖南)...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-9 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl border-none focus:ring-2 focus:ring-green-500'
              />
            </div>

            {/* 分组标签栏 */}
            <div className='space-y-1.5'>
              <div className='flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-medium px-0.5'>
                <span>分类导航 ({groups.length - 1} 个大类)</span>
                <span className='font-mono'>共 {channels.length} 个优质频道</span>
              </div>
              <div className='flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5'>
                {groups.map((group) => {
                  const count = groupCounts[group] ?? 0;
                  const isActive = activeGroup === group;
                  return (
                    <button
                      key={group}
                      onClick={() => setActiveGroup(group)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
                        isActive
                          ? 'bg-green-600 text-white shadow-xs font-semibold'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span>{group}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200/90 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 频道卡片列表 */}
          <div className='flex-1 overflow-y-auto space-y-1.5 pr-1'>
            {filteredChannels.length === 0 ? (
              <div className='text-center py-12 text-xs text-gray-400 space-y-2'>
                <ListFilter className='w-8 h-8 mx-auto opacity-40' />
                <p>未找到匹配频道</p>
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isSelected = selectedChannel.id === channel.id;
                return (
                  <button
                    key={channel.id}
                    onClick={() => handleSelectChannel(channel)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-green-500/15 border border-green-500/30 text-green-700 dark:text-green-300 shadow-sm'
                        : 'hover:bg-gray-100/70 dark:hover:bg-gray-800/50 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <div className='flex items-center space-x-3 min-w-0'>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-green-500 animate-ping' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      />
                      <span className='text-xs font-medium truncate'>
                        {channel.name}
                      </span>
                    </div>
                    <span className='text-[10px] text-gray-400 dark:text-gray-500 font-mono'>
                      {channel.group}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 自定义 M3U 导入弹窗 */}
      {showCustomModal && (
        <div className='fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
          <div className='bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-base font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2'>
                <Plus className='w-5 h-5 text-green-600' />
                <span>添加自定义直播源 (M3U)</span>
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              >
                ✕
              </button>
            </div>

            <div className='space-y-3'>
              <div>
                <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  M3U / M3U8 订阅链接 (URL)
                </label>
                <input
                  type='url'
                  placeholder='https://example.com/live.m3u'
                  value={customM3uUrl}
                  onChange={(e) => setCustomM3uUrl(e.target.value)}
                  className='w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500'
                />
              </div>

              <div>
                <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  或者直接粘贴 M3U 播放列表内容
                </label>
                <textarea
                  rows={4}
                  placeholder='#EXTM3U&#10;#EXTINF:-1,频道1&#10;https://...'
                  value={customM3uContent}
                  onChange={(e) => setCustomM3uContent(e.target.value)}
                  className='w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500'
                />
              </div>
            </div>

            <div className='flex items-center justify-end space-x-3 pt-2'>
              <button
                onClick={() => setShowCustomModal(false)}
                className='px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
              >
                取消
              </button>
              <button
                onClick={handleImportCustomM3u}
                disabled={loadingCustom || (!customM3uUrl.trim() && !customM3uContent.trim())}
                className='px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg transition-colors shadow-sm'
              >
                {loadingCustom ? '正在导入...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div className='p-8 text-center text-xs text-gray-400'>加载直播模块中...</div>}>
      <LivePageClient />
    </Suspense>
  );
}

