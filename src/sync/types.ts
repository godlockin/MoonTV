// Sync system type definitions

/**
 * Raw source configuration from crawlers or default sources
 */
export interface RawSourceConfig {
  id: string;
  url: string;
  note?: string;
  region?: string;
  [key: string]: unknown;
}

/**
 * Standardized source format used throughout the application
 */
export interface StandardizedSource extends RawSourceConfig {
  provider: string;
  active: boolean;
  health?: 'healthy' | 'failing' | 'unknown';
}

/**
 * Source crawler interface for discovering new sources
 */
export interface SourceCrawler {
  name: string;
  discover(): Promise<RawSourceConfig[]>;
}

/**
 * Source adapter interface for normalizing and health checking sources
 */
export interface SourceAdapter {
  name: string;
  supports(raw: RawSourceConfig | StandardizedSource): boolean;
  toStandard(raw: RawSourceConfig): StandardizedSource;
  healthcheck?(source: StandardizedSource): Promise<boolean>;
}
