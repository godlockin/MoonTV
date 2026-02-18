import { RawSourceConfig, SourceAdapter, StandardizedSource } from '../types';

export const doubanAdapter: SourceAdapter = {
  name: 'douban',

  supports(raw: RawSourceConfig): boolean {
    // Example: recognize Douban-style configs
    return Boolean((raw.url ?? '').includes('douban.com'));
  },

  toStandard(raw: RawSourceConfig): StandardizedSource {
    return {
      provider: 'douban',
      active: true,
      ...raw,
    };
  },

  async healthcheck(_source: StandardizedSource): Promise<boolean> {
    // Faked healthcheck: always returns true for now
    return true;
  },
};
