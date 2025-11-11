
export interface User {
  email: string;
}

export interface Exercise {
  id: string;
  name:string;
  description: string;
  videoStorageKey?: string; 
  startTime?: number; 
  endTime?: number;   
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