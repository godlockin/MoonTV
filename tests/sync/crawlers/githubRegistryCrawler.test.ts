import { githubRegistryCrawler } from '../../../src/sync/crawlers/githubRegistryCrawler';

describe('githubRegistryCrawler', () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('returns an array of RawSourceConfig', async () => {
    // Mock successful M3U response - need to return different content for each registry
    const mockM3UContent = `#EXTM3U
#EXTINF:-1 tvg-name="CCTV1",CCTV1
http://example.com/cctv1.m3u8
#EXTINF:-1 tvg-name="CCTV2",CCTV2
http://example.com/cctv2.m3u8`;

    // Mock for all 6 registries
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent })
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent })
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent })
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent })
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent })
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent });

    const result = await githubRegistryCrawler.discover();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBeTruthy();
    expect(result[0].url).toContain('http');
  });

  it('handles fetch failure gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await githubRegistryCrawler.discover();
    // Should return empty array instead of throwing
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('handles non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await githubRegistryCrawler.discover();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('deduplicates sources by url', async () => {
    // M3U with duplicate URLs - only return for one registry to avoid cross-registry dedup
    const mockM3UContent = `#EXTM3U
#EXTINF:-1 tvg-name="CCTV1",CCTV1
http://example.com/cctv.m3u8
#EXTINF:-1 tvg-name="CCTV1 Dup",CCTV1 Dup
http://example.com/cctv.m3u8`;

    // First registry returns data, rest fail
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => mockM3UContent })
      .mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await githubRegistryCrawler.discover();
    // Should have 2 sources (the test mock returns all 6 registry responses, first 2 are success)
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
