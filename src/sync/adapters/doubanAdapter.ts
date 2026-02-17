import { SourceAdapter, RawSourceConfig, StandardizedSource } from '../types';

export const doubanAdapter: SourceAdapter = {
  name: 'douban',

  supports(raw: RawSourceConfig): boolean {
    // Example: recognize Douban-style configs
    return Boolean((raw.url ?? '').includes('douban.com'));
  },

  toStandard(raw: RawSourceConfig): StandardizedSource {
    return {
      id: raw.id,
      url: raw.url,
      provider: 'douban',
      active: true,
      ...raw,
    };
  },

  async healthcheck(source: StandardizedSource): Promise<boolean> {
    // Faked healthcheck: always returns true for now
    return true;
  }
};
