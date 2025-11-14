/**
 * AI response caching service to avoid re-analyzing the same videos
 */

import { AICacheEntry } from '../types';

const CACHE_STORAGE_KEY = 'ai_workout_analysis_cache';
const CACHE_EXPIRY_DAYS = 30; // Cache expires after 30 days

/**
 * Get AI cache from localStorage
 */
const getCache = (): Record<string, AICacheEntry> => {
  const cacheJson = localStorage.getItem(CACHE_STORAGE_KEY);
  return cacheJson ? JSON.parse(cacheJson) : {};
};

/**
 * Save AI cache to localStorage
 */
const saveCache = (cache: Record<string, AICacheEntry>): void => {
  localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
};

/**
 * Check if a cache entry is expired
 */
const isExpired = (entry: AICacheEntry): boolean => {
  const entryDate = new Date(entry.timestamp);
  const now = new Date();
  const daysDiff = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > CACHE_EXPIRY_DAYS;
};

/**
 * Get cached AI analysis result for a video
 * @param videoHash The hash of the video
 * @param modelUsed The model that was used ('pro' or 'flash')
 * @returns Cached analysis result or null if not found/expired
 */
export const getCachedAnalysis = (
  videoHash: string,
  modelUsed: string
): any | null => {
  const cache = getCache();
  const key = `${videoHash}_${modelUsed}`;
  const entry = cache[key];

  if (!entry) {
    return null;
  }

  // Check if expired
  if (isExpired(entry)) {
    console.log(`Cache entry for ${videoHash} expired, removing...`);
    delete cache[key];
    saveCache(cache);
    return null;
  }

  console.log(`Using cached AI analysis for video hash: ${videoHash}`);
  return entry.analysisResult;
};

/**
 * Cache an AI analysis result
 * @param videoHash The hash of the video
 * @param analysisResult The AI analysis result
 * @param modelUsed The model that was used ('pro' or 'flash')
 */
export const cacheAnalysis = (
  videoHash: string,
  analysisResult: any,
  modelUsed: string
): void => {
  const cache = getCache();
  const key = `${videoHash}_${modelUsed}`;

  const entry: AICacheEntry = {
    videoHash,
    analysisResult,
    timestamp: new Date().toISOString(),
    modelUsed,
  };

  cache[key] = entry;
  saveCache(cache);
  console.log(`Cached AI analysis for video hash: ${videoHash}`);
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = (): number => {
  const cache = getCache();
  const keys = Object.keys(cache);
  let removedCount = 0;

  keys.forEach(key => {
    if (isExpired(cache[key])) {
      delete cache[key];
      removedCount++;
    }
  });

  if (removedCount > 0) {
    saveCache(cache);
    console.log(`Cleared ${removedCount} expired cache entries`);
  }

  return removedCount;
};

/**
 * Clear all cache
 */
export const clearAllCache = (): void => {
  localStorage.removeItem(CACHE_STORAGE_KEY);
  console.log('Cleared all AI analysis cache');
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): {
  totalEntries: number;
  expiredEntries: number;
  cacheSize: string;
} => {
  const cache = getCache();
  const keys = Object.keys(cache);
  const expiredCount = keys.filter(key => isExpired(cache[key])).length;

  // Estimate cache size
  const cacheJson = localStorage.getItem(CACHE_STORAGE_KEY) || '';
  const sizeInBytes = new Blob([cacheJson]).size;
  const sizeInKB = (sizeInBytes / 1024).toFixed(2);

  return {
    totalEntries: keys.length,
    expiredEntries: expiredCount,
    cacheSize: `${sizeInKB} KB`,
  };
};
