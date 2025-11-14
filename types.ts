
export interface User {
  email: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  videoStorageKey?: string;
  thumbnailStorageKey?: string; // Thumbnail for quick preview
  startTime?: number;
  endTime?: number;
  muscleGroups?: string[]; // e.g., ["Chest", "Triceps"]
  equipment?: string; // e.g., "Barbell", "Dumbbells", "Bodyweight"
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  videoHash?: string; // Hash of video for AI cache lookup
}

export interface PlannedExercise {
  originalExerciseId: string; 
  name: string; 
  sets?: string; 
  reps?: string; 
  rest?: string; 
  // description?: string; // REMOVED as per user request
}

export interface WorkoutDay {
  day: string; 
  focus?: string; 
  exercises: PlannedExercise[];
  notes?: string; 
}

export interface WorkoutPlan {
  title: string; 
  description?: string; 
  weeklySplitDescription?: string; 
  warmupRecommendation?: string; 
  cooldownRecommendation?: string; 
  progressionTips?: string; 
  weeklyPlan: WorkoutDay[];
}

// New type for saved workout plans
export interface SavedWorkoutPlanEntry {
  id: string; // Unique ID for the saved plan (e.g., UUID or timestamp-based)
  name: string; // User-defined or auto-generated name for the plan
  plan: WorkoutPlan; // The actual workout plan object
  savedAt: string; // ISO string date when the plan was saved
}

// New type for the interactive workout session
export interface WorkoutSession {
  plan: WorkoutPlan;
  day: WorkoutDay;
}

/**
 * Defines the structure for a complete user data backup, including videos.
 * This is used for the export/import functionality.
 */
export interface FullUserDataBackup {
  exercises: Exercise[];
  savedPlans: SavedWorkoutPlanEntry[];
  // Videos are stored as a record mapping the storage key to the base64 data and mime type.
  videos?: Record<string, { mimeType: string; data: string }>;
}

/**
 * AI response cache entry
 */
export interface AICacheEntry {
  videoHash: string;
  analysisResult: any; // The parsed AI response
  timestamp: string;
  modelUsed: string; // 'pro' or 'flash'
}

/**
 * Upload queue item for background processing
 */
export interface UploadQueueItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
  retryCount: number;
  useProModel: boolean;
}