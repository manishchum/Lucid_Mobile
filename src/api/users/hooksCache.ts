import { logger } from "../../utils/UnifiedLogger";

export const processedModuleMetadata = new Map<
  string,
  { title: string; recommended_time: number }
>();

export interface CachedDashboardEntry {
  data: any;
  cards: any[];
  timestamp: number;
}

export const memoryDashboardCache = new Map<string, CachedDashboardEntry>();

export const clearHooksMemoryCaches = (): void => {
  logger.info("[HooksCache] 🧹 Clearing in-memory module metadata cache...");
  processedModuleMetadata.clear();
  memoryDashboardCache.clear();
};

