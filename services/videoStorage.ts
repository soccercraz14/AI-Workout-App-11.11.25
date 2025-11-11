
const DB_NAME = 'AIWorkoutVideoDB';
const DB_VERSION = 1;
const VIDEO_STORE_NAME = 'videos';

let dbPromise: Promise<IDBDatabase> | null = null;

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

/**
 * Saves a video file to IndexedDB with a specific key.
 * This is used by the restore process.
 * @param key The key to save the video under.
 * @param file The video file to save.
 */
export const saveVideoWithKey = async (key: string, file: File): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(VIDEO_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(VIDEO_STORE_NAME);
  store.put(file, key);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
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


export const getVideo = async (key: string): Promise<File | null> => {
  const db = await initDB();
  const transaction = db.transaction(VIDEO_STORE_NAME, 'readonly');
  const store = transaction.objectStore(VIDEO_STORE_NAME);
  const request = store.get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};