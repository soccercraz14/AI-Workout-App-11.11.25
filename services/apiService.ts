import { Exercise, SavedWorkoutPlanEntry, User, FullUserDataBackup } from '../types';
import * as videoStorage from './videoStorage';

const MOCK_LATENCY = 300; // ms
const CURRENT_USER_SESSION_KEY = 'ai_workout_currentUser';

// --- Helper Functions to simulate backend behavior ---

const simulateDelay = () => new Promise(resolve => setTimeout(resolve, MOCK_LATENCY));

// This interface now ONLY describes what's in localStorage for the user.
export interface UserDataStore {
  exercises: Exercise[];
  savedPlans: SavedWorkoutPlanEntry[];
  // The 'videos' property is completely removed to avoid quota errors.
}

// --- Auth Functions ---

export const signup = async (email: string, password?: string): Promise<User> => {
  await simulateDelay();
  const storageKey = `user_${email}`;
  if (localStorage.getItem(storageKey)) {
    throw new Error('An account with this email already exists.');
  }
  const newUser: User = { email };
  const initialData: UserDataStore = {
    exercises: [],
    savedPlans: [],
  };
  localStorage.setItem(storageKey, JSON.stringify(initialData));
  localStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(newUser));
  return newUser;
};

export const login = async (email: string, password?: string): Promise<User> => {
  await simulateDelay();
  const storageKey = `user_${email}`;
  if (!localStorage.getItem(storageKey)) {
    throw new Error('No account found with this email.');
  }
  const user: User = { email };
  localStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(user));
  return user;
};

export const logout = async (): Promise<void> => {
  await simulateDelay();
  localStorage.removeItem(CURRENT_USER_SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
  const userJson = localStorage.getItem(CURRENT_USER_SESSION_KEY);
  return userJson ? JSON.parse(userJson) : null;
};


// --- Data Helper Functions ---

const getUserData = (): UserDataStore | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const dataJson = localStorage.getItem(`user_${user.email}`);
  return dataJson ? JSON.parse(dataJson) : { exercises: [], savedPlans: [] };
};

const saveUserData = (data: UserDataStore): void => {
  const user = getCurrentUser();
  if (!user) throw new Error('No authenticated user. Cannot save data.');
  localStorage.setItem(`user_${user.email}`, JSON.stringify(data));
};


// --- Video Functions ---
// These now delegate to the new videoStorage service which uses IndexedDB.

export const saveVideoFile = async (file: File): Promise<string> => {
  await simulateDelay();
  const user = getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }
  // Delegate to IndexedDB storage
  const key = await videoStorage.saveVideo(file);
  return key;
};

export const getVideoFile = async (key: string): Promise<File | null> => {
    await simulateDelay();
    // Delegate to IndexedDB storage
    return await videoStorage.getVideo(key);
};

// --- Exercise Functions ---

export const getAllExercises = async (): Promise<Exercise[]> => {
  await simulateDelay();
  const data = getUserData();
  return data?.exercises || [];
};

export const saveAllExercises = async (exercises: Exercise[]): Promise<void> => {
  await simulateDelay();
  const data = getUserData();
  if (!data) throw new Error("User not authenticated");
  data.exercises = exercises;
  saveUserData(data);
};

export const deleteExercise = async (exerciseId: string): Promise<void> => {
  await simulateDelay();
  const data = getUserData();
  if (!data) throw new Error("User not authenticated");
  data.exercises = data.exercises.filter(ex => ex.id !== exerciseId);
  saveUserData(data);
};

// --- Saved Plan Functions ---

export const getAllSavedPlanEntries = async (): Promise<SavedWorkoutPlanEntry[]> => {
    await simulateDelay();
    const data = getUserData();
    return data?.savedPlans || [];
};

export const getSavedPlanEntry = async (planId: string): Promise<SavedWorkoutPlanEntry | null> => {
    await simulateDelay();
    const data = getUserData();
    return data?.savedPlans.find(p => p.id === planId) || null;
};

export const savePlanEntry = async (entry: SavedWorkoutPlanEntry): Promise<void> => {
    await simulateDelay();
    const data = getUserData();
    if (!data) throw new Error("User not authenticated");
    const existingIndex = data.savedPlans.findIndex(p => p.id === entry.id);
    if (existingIndex > -1) {
        data.savedPlans[existingIndex] = entry;
    } else {
        data.savedPlans.push(entry);
    }
    saveUserData(data);
};

export const deleteSavedPlanEntry = async (planId: string): Promise<void> => {
    await simulateDelay();
    const data = getUserData();
    if (!data) throw new Error("User not authenticated");
    data.savedPlans = data.savedPlans.filter(p => p.id !== planId);
    saveUserData(data);
};

// --- Backup/Restore Functions ---

const fileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // result is "data:video/mp4;base64,.....", we want the part after the comma
        const base64Data = result.split(',')[1];
        resolve({ mimeType: file.type, data: base64Data });
    };
    reader.onerror = error => reject(error);
  });
};

const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
};


export const getAllUserDataForBackup = async (): Promise<FullUserDataBackup> => {
    await simulateDelay();
    const localData = getUserData();
    const exercises = localData?.exercises || [];
    const savedPlans = localData?.savedPlans || [];
    
    const videos: Record<string, { mimeType: string, data: string }> = {};
    const videoKeys = new Set<string>();
    
    // Collect all unique video storage keys from exercises
    exercises.forEach(ex => {
        if (ex.videoStorageKey) {
            videoKeys.add(ex.videoStorageKey);
        }
    });

    // Asynchronously fetch each video from IndexedDB and convert it to base64
    const videoConversionPromises = Array.from(videoKeys).map(async (key) => {
        const file = await videoStorage.getVideo(key);
        if (file) {
            const videoData = await fileToBase64(file);
            videos[key] = videoData;
        }
    });

    await Promise.all(videoConversionPromises);

    return { exercises, savedPlans, videos };
}

export const restoreUserData = async (dataToRestore: FullUserDataBackup): Promise<{
    exerciseCount: number;
    planCount: number;
    videoCount: number;
}> => {
    await simulateDelay();
    const user = getCurrentUser();
    if (!user) {
        throw new Error("You must be logged in to restore data.");
    }

    // 1. Restore exercises and plans to localStorage
    const userData: UserDataStore = {
        exercises: dataToRestore.exercises,
        savedPlans: dataToRestore.savedPlans,
    };
    saveUserData(userData);
    
    let videoCount = 0;
    // 2. Restore videos to IndexedDB
    if (dataToRestore.videos) {
        const videoRestorePromises: Promise<void>[] = [];
        for (const key in dataToRestore.videos) {
            const videoInfo = dataToRestore.videos[key];
            const file = base64ToFile(videoInfo.data, key, videoInfo.mimeType);
            // Save the file to IndexedDB with its original key
            videoRestorePromises.push(videoStorage.saveVideoWithKey(key, file));
            videoCount++;
        }
        await Promise.all(videoRestorePromises);
    }
    
    return {
        exerciseCount: dataToRestore.exercises.length,
        planCount: dataToRestore.savedPlans.length,
        videoCount,
    };
}