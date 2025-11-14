import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const DB_NAME = 'AIWorkoutVideoDB';
const DB_VERSION = 1;
const VIDEO_STORE_NAME = 'videos';

let dbPromise: Promise<IDBDatabase> | null = null;

// Check if we're running on a native platform (iOS/Android)
const isNativePlatform = Capacitor.isNativePlatform();

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('VideoStorage IndexedDB error:', request.error);
      dbPromise = null;
      reject('Error opening VideoStorage DB');
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        console.warn('VideoStorage DB connection closed.');
        dbPromise = null;
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        db.createObjectStore(VIDEO_STORE_NAME);
      }
    };
  });
  return dbPromise;
};

// Helper function to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Saves a video file to IndexedDB with a specific key.
 * This is used by the restore process.
 * @param key The key to save the video under.
 * @param file The video file to save.
 */
export const saveVideoWithKey = async (key: string, file: File): Promise<void> => {
  if (isNativePlatform) {
    // Save to native filesystem
    const base64Data = await fileToBase64(file);
    const fileName = `${key}.mp4`;
    await Filesystem.writeFile({
      path: `videos/${fileName}`,
      data: base64Data,
      directory: Directory.Data,
      recursive: true, // Create videos directory if it doesn't exist
    });
    console.log(`Video saved to filesystem: videos/${fileName}`);
  } else {
    // Save to IndexedDB for web
    const db = await initDB();
    const transaction = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VIDEO_STORE_NAME);
    store.put(file, key);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

/**
 * Saves a video file, generates a new unique key for it, and returns the key.
 * This is used for new video uploads.
 * @param file The video file to save.
 * @returns The unique key assigned to the video.
 */
export const saveVideo = async (file: File): Promise<string> => {
  const key = `video-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2,9)}`;
  await saveVideoWithKey(key, file);
  return key;
};

/**
 * Gets the native file path for a video (for native platforms)
 * Returns a URL that can be used directly in video src attribute
 */
export const getVideoPath = async (key: string): Promise<string | null> => {
  if (isNativePlatform) {
    try {
      const fileName = `${key}.mp4`;
      const result = await Filesystem.getUri({
        path: `videos/${fileName}`,
        directory: Directory.Data,
      });
      // Convert the native file URI to a WebView-compatible URL
      return Capacitor.convertFileSrc(result.uri);
    } catch (error) {
      console.error(`Failed to get video path for ${key}:`, error);
      return null;
    }
  } else {
    // For web, we'll return null and fall back to getVideo()
    return null;
  }
};

export const getVideo = async (key: string): Promise<File | null> => {
  if (isNativePlatform) {
    // For native, we don't return File objects - use getVideoPath() instead
    console.warn('getVideo() called on native platform - use getVideoPath() instead');
    return null;
  } else {
    const db = await initDB();
    const transaction = db.transaction(VIDEO_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VIDEO_STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
};