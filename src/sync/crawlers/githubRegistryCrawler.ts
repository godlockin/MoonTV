import { SourceCrawler, RawSourceConfig } from '../types';

export const githubRegistryCrawler: SourceCrawler = {
  name: 'githubRegistry',
  async discover(): Promise<RawSourceConfig[]> {
    // Simulate fetch + parse: In unit test, will mock the result
    try {
      // Placeholder for actual fetch logic
      return [
        { id: 'gh1', url: 'https://github.com/example/registry1' },
        { id: 'gh2', url: 'https://github.com/example/registry2' },
      ];
    } catch (e: unknown) {
      throw new Error('Failed to discover GitHub registries');
    }
  },
};
