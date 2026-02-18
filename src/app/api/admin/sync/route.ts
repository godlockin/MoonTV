import { NextResponse } from 'next/server';

import { AdminConfig } from '@/lib/admin.types';
import { getStorage } from '@/lib/db';

import { runOrchestration } from '@/sync/orchestrator';

export const runtime = 'edge';

// 同步状态跟踪（内存中，适用于单实例部署）
const syncState = {
  isRunning: false,
  lastRun: null as number | null,
  lastResult: null as {
    total: number;
    new: number;
    failed: number;
    byRegistry: Record<string, number>;
    qualityDistribution: {
      high: number;
      medium: number;
      low: number;
    };
  } | null,
};

/**
 * POST /api/admin/sync
 * 触发视频源同步
 */
export async function POST(_request: Request) {
  try {
    // 检查是否已在运行
    if (syncState.isRunning) {
      return NextResponse.json(
        { error: 'Sync is already running' },
        { status: 409 },
      );
    }

    syncState.isRunning = true;

    try {
      // 执行同步
      const sources = await runOrchestration();

      // 将同步结果保存到数据库
      const storage = getStorage();
      if (storage) {
        const adminConfig = await storage.getAdminConfig();
        if (adminConfig) {
          // 合并新发现的源到现有配置
          const existingKeys = new Set(
            adminConfig.SourceConfig.map((s) => s.key),
          );
          const newSources: AdminConfig['SourceConfig'] = [];

          for (const source of sources) {
            if (!existingKeys.has(source.id)) {
              newSources.push({
                key: source.id,
                name: source.id,
                api: source.url || '',
                detail: source.url,
                from: 'custom' as const,
                disabled: !source.active,
              });
            }
          }

          // 更新配置
          adminConfig.SourceConfig = [
            ...adminConfig.SourceConfig,
            ...newSources,
          ];

          await storage.setAdminConfig(adminConfig);
        }
      }

      // 计算质量分布
      const qualityDistribution = { high: 0, medium: 0, low: 0 };
      const byRegistry: Record<string, number> = {};

      for (const source of sources) {
        // 按注册表统计
        const provider =
          (source as { provider?: string }).provider || 'unknown';
        byRegistry[provider] = (byRegistry[provider] || 0) + 1;

        // 质量分布
        const score = (source as { qualityScore?: number }).qualityScore || 0;
        if (score >= 80) qualityDistribution.high++;
        else if (score >= 40) qualityDistribution.medium++;
        else qualityDistribution.low++;
      }

      syncState.lastRun = Date.now();
      syncState.lastResult = {
        total: sources.length,
        new: sources.filter((s) => s.active).length,
        failed: sources.filter((s) => !s.active).length,
        byRegistry,
        qualityDistribution,
      };

      return NextResponse.json({
        success: true,
        message: `Sync completed: ${sources.length} sources found`,
        stats: syncState.lastResult,
      });
    } finally {
      syncState.isRunning = false;
    }
  } catch (error) {
    syncState.isRunning = false;
    // eslint-disable-next-line no-console
    console.error('Sync failed:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/sync
 * 获取同步状态
 */
export async function GET() {
  return NextResponse.json({
    isRunning: syncState.isRunning,
    lastRun: syncState.lastRun,
    lastResult: syncState.lastResult,
  });
}
