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

      syncState.lastRun = Date.now();
      syncState.lastResult = {
        total: sources.length,
        new: sources.filter((s) => s.active).length,
        failed: sources.filter((s) => !s.active).length,
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
