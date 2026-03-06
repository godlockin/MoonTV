import { RawSourceConfig } from './types';

// TODO: update with canonical defaults as project evolves
export const defaultSources: RawSourceConfig[] = [
  {
    id: 'youtube-official',
    url: 'https://www.youtube.com',
    note: 'Official YouTube main site',
  },
  {
    id: 'bilibili-cn',
    url: 'https://www.bilibili.com',
    region: 'CN',
  },
  // Extend as needed with more sources
];
