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
  backup_urls?: string[];
  latency?: number;
  status?: 'online' | 'fallback';
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
    url: 'http://101.66.198.171:9901/tsfile/live/0001_1.m3u8?key=txiptv&playlive=0&authid=0',
  },
  {
    id: 'cctv2',
    name: 'CCTV-2 财经',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV2.png',
    url: 'http://101.66.198.171:9901/tsfile/live/0002_1.m3u8?key=txiptv&playlive=0&authid=0',
  },
  {
    id: 'cctv3',
    name: 'CCTV-3 综艺',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV3.png',
    url: 'http://101.66.198.171:9901/tsfile/live/0003_1.m3u8?key=txiptv&playlive=0&authid=0',
  },
  {
    id: 'cctv4',
    name: 'CCTV-4 中文国际',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV4.png',
    url: 'http://119.125.131.73:9901/tsfile/live/1018_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv5',
    name: 'CCTV-5 体育',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV5.png',
    url: 'http://101.66.198.171:9901/tsfile/live/0005_1.m3u8?key=txiptv&playlive=0&authid=0',
  },
  {
    id: 'cctv5p',
    name: 'CCTV-5+ 体育赛事',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV5Plus.png',
    url: 'http://119.125.131.73:9901/tsfile/live/1020_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv6',
    name: 'CCTV-6 电影',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV6.png',
    url: 'http://101.66.195.94:9901/tsfile/live/0006_1.m3u8?key=txiptv&playlive=0&authid=0',
  },
  {
    id: 'cctv7',
    name: 'CCTV-7 国防军事',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV7.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1022_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv8',
    name: 'CCTV-8 电视剧',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV8.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1023_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv9',
    name: 'CCTV-9 纪录',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV9.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1024_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv10',
    name: 'CCTV-10 科教',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV10.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1025_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv11',
    name: 'CCTV-11 戏曲',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV11.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1026_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv12',
    name: 'CCTV-12 社会与法',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV12.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1027_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv13',
    name: 'CCTV-13 新闻',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV13.png',
    url: 'https://event.pull.hebtv.com/jishi/cp1.m3u8',
  },
  {
    id: 'cctv14',
    name: 'CCTV-14 少儿',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV14.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1028_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv15',
    name: 'CCTV-15 音乐',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV15.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1029_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv16',
    name: 'CCTV-16 奥林匹克',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV16.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1030_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cctv17',
    name: 'CCTV-17 农业农村',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CCTV17.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1031_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'cgtn_news',
    name: 'CGTN 英语新闻',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CGTN.png',
    url: 'https://amg00405-rakutentv-cgtn-rakuten-i9tar.amagi.tv/master.m3u8',
  },
  {
    id: 'cgtn_doc',
    name: 'CGTN 纪录频道',
    group: '央视频道',
    logo: 'https://live.fanmingming.com/tv/CGTNDocumentary.png',
    url: 'https://english-livebkali.cgtn.com/live/doccgtn.m3u8',
  },

  // --- 卫视频道 ---
  {
    id: 'hunan',
    name: '湖南卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/湖南卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1051_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'zhejiang',
    name: '浙江卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/浙江卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1052_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'jiangsu',
    name: '江苏卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/江苏卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1055_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'dongfang',
    name: '东方卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/东方卫视.png',
    url: 'http://bp-resource-dfl.bestv.cn/155/3/video.m3u8',
  },
  {
    id: 'beijing',
    name: '北京卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/北京卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1057_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'guangdong',
    name: '广东卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/广东卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1053_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'anhui',
    name: '安徽卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/安徽卫视.png',
    url: 'http://101.66.198.171:9901/tsfile/live/0130_1.m3u8?key=txiptv&playlive=0&authid=0',
  },
  {
    id: 'shandong',
    name: '山东卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/山东卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1063_1.m3u8?key=txiptv&playlive=1&down=1',
  },
  {
    id: 'shenzhen',
    name: '深圳卫视',
    group: '卫视频道',
    logo: 'https://live.fanmingming.com/tv/深圳卫视.png',
    url: 'http://120.198.95.220:9901/tsfile/live/1065_1.m3u8?key=txiptv&playlive=1&down=1',
  },

  // --- 影视轮播 ---
  {
    id: 'chc_action',
    name: 'CHC 动作电影',
    group: '影视轮播',
    logo: 'https://live.fanmingming.com/tv/CHC动作电影.png',
    url: 'https://cctvalih5ca.v.myalicdn.com/live/cctv6_2/index.m3u8',
  },
  {
    id: 'chc_family',
    name: 'CHC 家庭影院',
    group: '影视轮播',
    logo: 'https://live.fanmingming.com/tv/CHC家庭影院.png',
    url: 'https://cctvalih5ca.v.myalicdn.com/live/cctv8_2/index.m3u8',
  },

  // --- 国际频道 ---
  {
    id: 'bloomberg',
    name: 'Bloomberg TV (彭博商业新闻)',
    group: '国际频道',
    logo: 'https://live.fanmingming.com/tv/CGTN.png',
    url: 'https://liveprodupmx.akamaized.net/us/Channel-USTV-AWS-virginia-1/live.m3u8',
  },
  {
    id: 'france24',
    name: 'France 24 (法国24小时新闻)',
    group: '国际频道',
    logo: 'https://live.fanmingming.com/tv/CGTN.png',
    url: 'https://f24hls-i.akamaihd.net/hls/live/221193/F24_EN_LO_HLS/master.m3u8',
  },

  // --- 体育赛事 ---
  {
    id: 'sports_redbull',
    name: 'Red Bull TV 极限体育',
    group: '体育赛事',
    logo: 'https://live.fanmingming.com/tv/CCTV5.png',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
  },

  // --- 纪录探索 ---
  {
    id: 'nasa_tv',
    name: 'NASA TV (美国宇航局官方台)',
    group: '纪录探索',
    logo: 'https://live.fanmingming.com/tv/CCTV9.png',
    url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
  },

  // --- 少儿动画 ---
  {
    id: 'kaku_anime',
    name: '北京卡酷少儿动画',
    group: '少儿动画',
    logo: 'https://live.fanmingming.com/tv/卡酷少儿.png',
    url: 'https://itemianfei.brtv.org.cn/live/kkse.m3u8',
  },

  // --- 港澳台 ---
  {
    id: 'phoenix_zw',
    name: '凤凰卫视中文台',
    group: '港澳台',
    logo: 'https://live.fanmingming.com/tv/凤凰中文.png',
    url: 'http://play.fengshows.com/live/fhzw.m3u8',
  },
  {
    id: 'phoenix_zx',
    name: '凤凰卫视资讯台',
    group: '港澳台',
    logo: 'https://live.fanmingming.com/tv/凤凰资讯.png',
    url: 'http://play.fengshows.com/live/fhzx.m3u8',
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

