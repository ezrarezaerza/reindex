import { FileItem } from '../types';

const DB_NAME = 'ReIndex_BrowserCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'drive_catalogs';

export interface CacheMetadata {
  id: string; // driveId
  lastUpdated: string;
  fileCount: number;
  cachedAt: number;
  originalSize: number;
  compressedSize: number;
  compressionActive: boolean;
}

export interface CacheEntry extends CacheMetadata {
  compressedData?: ArrayBuffer;
  rawData?: FileItem[];
}

/**
 * Helper to check if CompressionStream is supported in the browser environment.
 */
function isCompressionSupported(): boolean {
  return typeof globalThis.CompressionStream !== 'undefined' && 
         typeof globalThis.DecompressionStream !== 'undefined';
}

/**
 * Compresses a string to a gzip ArrayBuffer.
 */
async function compressString(str: string): Promise<ArrayBuffer> {
  const stream = new Response(str).body;
  if (!stream) throw new Error('Could not create readable stream from string');
  const compressedStream = stream.pipeThrough(new globalThis.CompressionStream('gzip'));
  return await new Response(compressedStream).arrayBuffer();
}

/**
 * Decompresses a gzip ArrayBuffer to a string.
 */
async function decompressString(buffer: ArrayBuffer): Promise<string> {
  const stream = new Response(buffer).body;
  if (!stream) throw new Error('Could not create readable stream from buffer');
  const decompressedStream = stream.pipeThrough(new globalThis.DecompressionStream('gzip'));
  return await new Response(decompressedStream).text();
}

/**
 * Initialize IndexedDB for caching.
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves a drive's file catalog into the IndexedDB cache, compressing it if possible.
 */
export async function setCache(
  driveId: string,
  lastUpdated: string,
  fileCount: number,
  files: FileItem[]
): Promise<CacheMetadata> {
  const db = await initDB();
  const serialized = JSON.stringify(files);
  const originalSize = new Blob([serialized]).size;
  
  let compressedData: ArrayBuffer | undefined;
  let rawData: FileItem[] | undefined;
  const compressionActive = isCompressionSupported();

  let compressedSize = originalSize;

  if (compressionActive) {
    try {
      compressedData = await compressString(serialized);
      compressedSize = compressedData.byteLength;
    } catch (err) {
      console.warn('CompressionStream failed, falling back to uncompressed storage:', err);
      rawData = files;
    }
  } else {
    rawData = files;
  }

  const metadata: CacheMetadata = {
    id: driveId,
    lastUpdated,
    fileCount,
    cachedAt: Date.now(),
    originalSize,
    compressedSize,
    compressionActive: compressionActive && !!compressedData
  };

  const entry: CacheEntry = {
    ...metadata,
    compressedData,
    rawData
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);

    request.onsuccess = () => {
      console.log(`💾 Saved cache for drive '${driveId}': original size = ${(originalSize / 1024 / 1024).toFixed(2)}MB, compressed size = ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% savings)`);
      resolve(metadata);
    };

    request.onerror = () => {
      console.error(`Failed to cache drive ${driveId}:`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieves a drive's file catalog from the IndexedDB cache.
 * Automatically handles decompression if the data was compressed.
 */
export async function getCache(
  driveId: string
): Promise<{ lastUpdated: string; fileCount: number; files: FileItem[]; metadata: CacheMetadata } | null> {
  try {
    const db = await initDB();
    const entry = await new Promise<CacheEntry | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(driveId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    if (!entry) {
      return null;
    }

    let files: FileItem[] = [];

    if (entry.compressionActive && entry.compressedData) {
      try {
        const decompressed = await decompressString(entry.compressedData);
        files = JSON.parse(decompressed);
      } catch (err) {
        console.error(`Failed to decompress cached drive data for ${driveId}:`, err);
        return null;
      }
    } else if (entry.rawData) {
      files = entry.rawData;
    } else {
      console.warn(`Cache entry for ${driveId} is missing file payload.`);
      return null;
    }

    const metadata: CacheMetadata = {
      id: entry.id,
      lastUpdated: entry.lastUpdated,
      fileCount: entry.fileCount,
      cachedAt: entry.cachedAt,
      originalSize: entry.originalSize,
      compressedSize: entry.compressedSize,
      compressionActive: entry.compressionActive
    };

    return {
      lastUpdated: entry.lastUpdated,
      fileCount: entry.fileCount,
      files,
      metadata
    };
  } catch (err) {
    console.warn(`Failed to retrieve cache for drive ${driveId}:`, err);
    return null;
  }
}

/**
 * Clears cached entries for a specific drive, or clears all cached drives.
 */
export async function clearCache(driveId?: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = driveId ? store.delete(driveId) : store.clear();

    request.onsuccess = () => {
      console.log(driveId ? `🧹 Cleared cache for drive '${driveId}'` : '🧹 Cleared entire IndexedDB catalog cache');
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Fetches all cache status entries for displaying in the caching manager UI.
 */
export async function getCacheStatsList(): Promise<CacheMetadata[]> {
  try {
    const db = await initDB();
    return new Promise<CacheMetadata[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Map to metadata only to prevent holding large buffers in memory
        const stats = results.map(entry => ({
          id: entry.id,
          lastUpdated: entry.lastUpdated,
          fileCount: entry.fileCount,
          cachedAt: entry.cachedAt,
          originalSize: entry.originalSize,
          compressedSize: entry.compressedSize,
          compressionActive: entry.compressionActive
        }));
        resolve(stats);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Failed to get cache statistics:', err);
    return [];
  }
}
