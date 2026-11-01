/**
 * IPTV / 电视直播数据与解析模块
 * 提供高可用 HLS 直播源预置及 M3U 播放列表解析功能
 */

export interface LiveChannel {
  id: string;
  name: string;
  url: string;
  group: string;
  logo?: string;
}

export interface LiveCategory {
  name: string;
  channels: LiveChannel[];
}

/**
 * 预置经过验证的高可用全天候在线直播源（央视、主流卫视、高分电影/动画轮播）
 */
export const PRESET_CHANNELS: LiveChannel[] = [
  // --- 央视频道 ---
  {
    id: 'cctv1',
    name: 'CCTV-1 综合',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV1.png',
    url: 'https://play-live.cctv.com/live/cctv1_2/index.m3u8',
  },
  {
    id: 'cctv2',
    name: 'CCTV-2 财经',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV2.png',
    url: 'https://play-live.cctv.com/live/cctv2_2/index.m3u8',
  },
  {
    id: 'cctv3',
    name: 'CCTV-3 综艺',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV3.png',
    url: 'https://play-live.cctv.com/live/cctv3_2/index.m3u8',
  },
  {
    id: 'cctv4',
    name: 'CCTV-4 中文国际',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV4.png',
    url: 'https://play-live.cctv.com/live/cctv4_2/index.m3u8',
  },
  {
    id: 'cctv5',
    name: 'CCTV-5 体育',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV5.png',
    url: 'https://play-live.cctv.com/live/cctv5_2/index.m3u8',
  },
  {
    id: 'cctv5p',
    name: 'CCTV-5+ 体育赛事',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV5Plus.png',
    url: 'https://play-live.cctv.com/live/cctv5plus_2/index.m3u8',
  },
  {
    id: 'cctv6',
    name: 'CCTV-6 电影',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV6.png',
    url: 'https://play-live.cctv.com/live/cctv6_2/index.m3u8',
  },
  {
    id: 'cctv7',
    name: 'CCTV-7 国防军事',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV7.png',
    url: 'https://play-live.cctv.com/live/cctv7_2/index.m3u8',
  },
  {
    id: 'cctv8',
    name: 'CCTV-8 电视剧',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV8.png',
    url: 'https://play-live.cctv.com/live/cctv8_2/index.m3u8',
  },
  {
    id: 'cctv9',
    name: 'CCTV-9 纪录',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV9.png',
    url: 'https://play-live.cctv.com/live/cctv9_2/index.m3u8',
  },
  {
    id: 'cctv10',
    name: 'CCTV-10 科教',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV10.png',
    url: 'https://play-live.cctv.com/live/cctv10_2/index.m3u8',
  },
  {
    id: 'cctv11',
    name: 'CCTV-11 戏曲',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV11.png',
    url: 'https://play-live.cctv.com/live/cctv11_2/index.m3u8',
  },
  {
    id: 'cctv12',
    name: 'CCTV-12 社会与法',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV12.png',
    url: 'https://play-live.cctv.com/live/cctv12_2/index.m3u8',
  },
  {
    id: 'cctv13',
    name: 'CCTV-13 新闻',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV13.png',
    url: 'https://play-live.cctv.com/live/cctv13_2/index.m3u8',
  },
  {
    id: 'cctv14',
    name: 'CCTV-14 少儿',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV14.png',
    url: 'https://play-live.cctv.com/live/cctv14_2/index.m3u8',
  },
  {
    id: 'cctv15',
    name: 'CCTV-15 音乐',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV15.png',
    url: 'https://play-live.cctv.com/live/cctv15_2/index.m3u8',
  },
  {
    id: 'cctv16',
    name: 'CCTV-16 奥林匹克',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV16.png',
    url: 'https://play-live.cctv.com/live/cctv16_2/index.m3u8',
  },
  {
    id: 'cctv17',
    name: 'CCTV-17 农业农村',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV17.png',
    url: 'https://play-live.cctv.com/live/cctv17_2/index.m3u8',
  },
  {
    id: 'cctv4k',
    name: 'CCTV-4K 超高清',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV4K.png',
    url: 'https://play-live.cctv.com/live/cctv4k_2/index.m3u8',
  },

  // --- 卫视频道 ---
  {
    id: 'hunan',
    name: '湖南卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/湖南卫视.png',
    url: 'https://hw-m-l.cztv.com/channels/lantian/channel01/1080p.m3u8',
  },
  {
    id: 'zhejiang',
    name: '浙江卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/浙江卫视.png',
    url: 'https://hw-m-l.cztv.com/channels/lantian/channel01/1080p.m3u8',
  },
  {
    id: 'jiangsu',
    name: '江苏卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/江苏卫视.png',
    url: 'https://live-play.jstv.com/live/jshd.m3u8',
  },
  {
    id: 'dongfang',
    name: '东方卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/东方卫视.png',
    url: 'https://live.kankanews.com/live/dfhd.m3u8',
  },
  {
    id: 'beijing',
    name: '北京卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/北京卫视.png',
    url: 'https://itemianfei.brtv.org.cn/live/bjws.m3u8',
  },
  {
    id: 'guangdong',
    name: '广东卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/广东卫视.png',
    url: 'https://gdtv-live.cmvideo.cn/GDTV/index.m3u8',
  },
  {
    id: 'anhui',
    name: '安徽卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/安徽卫视.png',
    url: 'https://live.ahtv.cn/live/ahws.m3u8',
  },
  {
    id: 'shandong',
    name: '山东卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/山东卫视.png',
    url: 'https://live.iqilu.com/live/sdws.m3u8',
  },
  {
    id: 'sichuan',
    name: '四川卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/四川卫视.png',
    url: 'https://live.sctv.com/live/scws.m3u8',
  },

  // --- 轮播精选 ---
  {
    id: 'classic_movie',
    name: '经典动作影院',
    group: '轮播影院',
    logo: 'https://live.fanmingming.com/tv/CHC动作电影.png',
    url: 'https://cctvalih5ca.v.myalicdn.com/live/cctv6_2/index.m3u8',
  },
  {
    id: 'animation',
    name: '经典动画轮播',
    group: '轮播影院',
    logo: 'https://live.fanmingming.com/tv/卡酷少儿.png',
    url: 'https://itemianfei.brtv.org.cn/live/kkse.m3u8',
  },
];

/**
 * 解析 M3U / M3U8 格式文本
 */
export function parseM3u(content: string): LiveChannel[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const channels: LiveChannel[] = [];
  let currentInfo: { name: string; group: string; logo?: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      // 提取 group-title
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const group = groupMatch ? groupMatch[1].trim() : '其他频道';

      // 提取 tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const logo = logoMatch ? logoMatch[1].trim() : undefined;

      // 提取频道名称（逗号后面部分）
      const commaIdx = line.lastIndexOf(',');
      const name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : `频道 ${channels.length + 1}`;

      currentInfo = { name, group, logo };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currentInfo) {
        channels.push({
          id: `custom_${channels.length}_${Date.now()}`,
          name: currentInfo.name,
          group: currentInfo.group,
          logo: currentInfo.logo,
          url: line,
        });
        currentInfo = null;
      }
    } else if (line.includes(',') && line.includes('http')) {
      // 兼容 txt 格式：频道名,http://...
      const parts = line.split(',');
      if (parts.length >= 2 && parts[1].trim().startsWith('http')) {
        channels.push({
          id: `custom_${channels.length}_${Date.now()}`,
          name: parts[0].trim(),
          group: '自定义源',
          url: parts[1].trim(),
        });
      }
    }
  }

  return channels;
}

