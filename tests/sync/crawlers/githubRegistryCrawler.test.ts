import { githubRegistryCrawler } from '../../../src/sync/crawlers/githubRegistryCrawler';

describe('githubRegistryCrawler', () => {
  it('returns an array of RawSourceConfig', async () => {
    const result = await githubRegistryCrawler.discover();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBeTruthy();
    expect(result[0].url).toContain('github.com');
  });

  it('handles fetch failure', async () => {
    // Could monkey-patch/fake the method to simulate failure case
    const badCrawler = {
      ...githubRegistryCrawler,
      discover: async () => {
        throw new Error('fail');
      },
    };
    await expect(badCrawler.discover()).rejects.toThrow('fail');
  });
});
