import { doubanAdapter } from '../../../src/sync/adapters/doubanAdapter';
import { RawSourceConfig } from '../../../src/sync/types';

describe('doubanAdapter', () => {
  it('detects douban-like sources', () => {
    expect(
      doubanAdapter.supports({ id: 'd', url: 'https://douban.com/x' }),
    ).toBe(true);
    expect(
      doubanAdapter.supports({ id: 'x', url: 'https://other.com/y' }),
    ).toBe(false);
  });

  it('produces fully valid standardized source', () => {
    const raw: RawSourceConfig = {
      id: 'foo',
      url: 'https://douban.com',
      someProp: 42,
    };
    const std = doubanAdapter.toStandard(raw);
    expect(std.id).toBe('foo');
    expect(std.url).toBe('https://douban.com');
    expect(std.provider).toBe('douban');
    expect(std.active).toBe(true);
    expect(std.someProp).toBe(42);
  });

  it('healthcheck returns true', async () => {
    const std = doubanAdapter.toStandard({
      id: '1',
      url: 'https://douban.com',
    });
    await expect(doubanAdapter.healthcheck!(std)).resolves.toBe(true);
  });
});
