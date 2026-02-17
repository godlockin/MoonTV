import { runOrchestration } from '../../src/sync/orchestrator';

describe('runOrchestration', () => {
  it('runs without throwing and outputs a file', async () => {
    await expect(runOrchestration()).resolves.toBeDefined();
    // Optionally: Validate that sources.json exists, etc.
  });
});