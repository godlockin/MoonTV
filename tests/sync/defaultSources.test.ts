import { defaultSources } from '../../src/sync/defaultSources';

describe('defaultSources', () => {
  it('should contain only unique IDs', () => {
    const ids = defaultSources.map((s) => s.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('should have required fields', () => {
    for (const src of defaultSources) {
      expect(src.id).toBeTruthy();
      expect(src.url).toMatch(/^https?:\/\//);
    }
  });
});
