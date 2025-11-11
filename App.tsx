
import React, { useState, useCallback, useEffect } from 'react';
import { Exercise, WorkoutPlan, SavedWorkoutPlanEntry, User, WorkoutSession } from './types';
import VideoUploadForm from './components/VideoUploadForm';
import ExerciseGallery from './components/ExerciseGallery';
import WorkoutPlanDisplay from './components/WorkoutPlanDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import SavedPlansList from './components/SavedPlansList';
import WorkoutLoader from './components/WorkoutLoader';
import Auth from './components/Auth';
import PlanGenerationModal from './components/PlanGenerationModal';
import InteractiveWorkout from './components/InteractiveWorkout';
import DataBackupRestore from './components/DataBackupRestore';
import { generateWorkoutPlanWithGemini, analyzeVideoAndExtractExercises } from './services/geminiService';
import * as apiService from './services/apiService';
import { SparklesIcon, VideoCameraIcon, ArrowRightOnRectangleIcon } from './components/icons';

export interface VideoAnalysisPayload {
    file: File;
}

type AppView = 'dashboard' | 'analyzing' | 'planFocus' | 'exerciseGallery' | 'workoutSession';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setAuthIsLoading] = useState<boolean>(true);
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [savedPlanEntries, setSavedPlanEntries] = useState<SavedWorkoutPlanEntry[]>([]);
  const [isLoadingSavedPlans, setIsLoadingSavedPlans] = useState<boolean>(false);
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);
  
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [isPlanOptionsVisible, setPlanOptionsVisible] = useState(false);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<WorkoutSession | null>(null);
  const [streamingPlanText, setStreamingPlanText] = useState<string | null>(null);

  // Check for logged-in user on mount
  useEffect(() => {
    const user = apiService.getCurrentUser();
    setCurrentUser(user);
    setAuthIsLoading(false);
  }, []);
  
  // Effect to show temporary success messages
  useEffect(() => {
    if (successMessage) {
        const timer = setTimeout(() => setSuccessMessage(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Load user data when user logs in
  const loadAllUserData = useCallback(async () => {
    if (!currentUser) return;

    setError(null);
    try {
        const [storedExercises, entries] = await Promise.all([
            apiService.getAllExercises(),
            apiService.getAllSavedPlanEntries()
        ]);
        setExercises(storedExercises);
        setSavedPlanEntries(entries);
    } catch (err) {
        console.error("Failed to load user data:", err);
        setError("Failed to load your account data. Please try again.");
    }
  }, [currentUser]);

  useEffect(() => {
    loadAllUserData();
  }, [loadAllUserData]);

  // --- Auth Handlers ---
  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    await loadAllUserData();
  };

  const handleLogout = async () => {
    await apiService.logout();
    setCurrentUser(null);
    setExercises([]);
    setSavedPlanEntries([]);
    setWorkoutPlan(null);
    setActiveWorkoutSession(null);
    setCurrentView('dashboard');
    setSuccessMessage("You have been logged out.");
  };

  // --- Core App Logic Handlers (adapted for API service) ---
  const handleVideoAnalyzed = useCallback(async (newlyExtractedExercises: Exercise[]) => {
    const currentExercises = await apiService.getAllExercises();
    const uniqueNewExercises = newlyExtractedExercises.filter(newEx => 
        !currentExercises.some(existingEx => 
          existingEx.name === newEx.name &&
          existingEx.videoStorageKey === newEx.videoStorageKey &&
          existingEx.startTime === newEx.startTime &&
          existingEx.endTime === newEx.endTime
        )
      );

    if (uniqueNewExercises.length > 0) {
      const updatedExercises = [...currentExercises, ...uniqueNewExercises];
      setExercises(updatedExercises);
      try {
        await apiService.saveAllExercises(updatedExercises);
      } catch (apiError) {
        console.error("Error saving exercises via API:", apiError);
        setError("Could not save new exercises to your account.");
      }
    }
  }, []);

  const handleDeleteExercise = useCallback(async (id: string) => {
    const exerciseToDelete = exercises.find(ex => ex.id === id);
    if (!exerciseToDelete) return;

    const updatedExercises = exercises.filter(ex => ex.id !== id);
    setExercises(updatedExercises);
    
    if (workoutPlan) {
        const newWeeklyPlan = workoutPlan.weeklyPlan.map(day => ({
            ...day,
            exercises: day.exercises.filter(plannedEx => plannedEx.originalExerciseId !== id)
        }));
        setWorkoutPlan(prevPlan => prevPlan ? {...prevPlan, weeklyPlan: newWeeklyPlan} : null);
    }

    try {
      await apiService.deleteExercise(id);
      setSuccessMessage(`Exercise "${exerciseToDelete.name}" deleted from your account.`);
    } catch (apiError) {
      console.error("Error deleting exercise via API:", apiError);
      setError("Could not delete exercise from your account. It might reappear on refresh.");
    }
  }, [exercises, workoutPlan]);

  const handleAnalyzeVideos = useCallback(async (videosToAnalyze: VideoAnalysisPayload[], useProModel: boolean) => {
    if (videosToAnalyze.length === 0) return;

    setIsLoadingVideo(true);
    setCurrentView('analyzing');
    setError(null);
    setSuccessMessage(null);
    setStatusMessage(`Starting analysis for ${videosToAnalyze.length} video(s)...`);
    
    const allNewlyExtractedExercises: Exercise[] = [];
    let filesProcessedSuccessfully = 0;
    let filesFailed = 0;
    const errorMessages: string[] = [];

    for (let i = 0; i < videosToAnalyze.length; i++) {
      const { file: videoFile } = videosToAnalyze[i];
      setStatusMessage(`Analyzing video ${i + 1} of ${videosToAnalyze.length}: ${videoFile.name}`);
      try {
        const videoStorageKey = await apiService.saveVideoFile(videoFile);
        const extractedData = await analyzeVideoAndExtractExercises(videoFile, useProModel);
        
        if (extractedData.length > 0) {
          const videoFileNameForId = videoFile.name.replace(/[^a-zA-Z0-9]/g, '') || 'video';
          const exercisesWithDetails: Exercise[] = extractedData.map((data, index) => ({
            id: `ex-${videoFileNameForId}-${Date.now()}-${index}`,
            name: data.name,
            description: data.description,
            videoStorageKey: videoStorageKey, 
            startTime: data.startTime,
            endTime: data.endTime,
          }));
          allNewlyExtractedExercises.push(...exercisesWithDetails);
        }
        filesProcessedSuccessfully++;
      } catch (err) {
        filesFailed++;
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        errorMessages.push(`Failed ${videoFile.name}: ${errorMessage}`);
        console.error(`Error analyzing ${videoFile.name}:`, err);
      }
    }

    let finalStatusMessage = "";
    if (allNewlyExtractedExercises.length > 0) {
      await handleVideoAnalyzed(allNewlyExtractedExercises); 
      setSuccessMessage(`${allNewlyExtractedExercises.length} new exercise(s) identified and added!`);
      finalStatusMessage = `Analysis complete. ${allNewlyExtractedExercises.length} new exercise(s) added.`;
    }

    if (filesFailed > 0) {
      setError(`Processed ${filesProcessedSuccessfully}; Failed ${filesFailed}: ${errorMessages.join('; ')}`);
       finalStatusMessage += ` ${filesFailed} video(s) failed analysis.`
    } else if (allNewlyExtractedExercises.length === 0 && filesProcessedSuccessfully > 0) {
      finalStatusMessage = "AI processed video(s) but found no distinct exercises. Try different videos.";
    }
    
    setStatusMessage(finalStatusMessage || null);
    setIsLoadingVideo(false);
    setCurrentView(allNewlyExtractedExercises.length > 0 ? 'exerciseGallery' : 'dashboard');
  }, [handleVideoAnalyzed]);

  const handleGeneratePlan = useCallback(async (options: { goal: string, trainingDays: number, useProModel: boolean }) => {
    if (exercises.length === 0) {
      setError("Please add exercises from videos before generating a plan. Go to the Exercise Gallery to manage your exercises.");
      setPlanOptionsVisible(false);
      return;
    }
    setIsLoadingPlan(true);
    setPlanOptionsVisible(false);
    setError(null);
    setWorkoutPlan(null);
    setStreamingPlanText(''); // Start with empty string

    try {
      const stream = generateWorkoutPlanWithGemini(exercises, options.goal, options.trainingDays, options.useProModel);
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        setStreamingPlanText(fullResponse);
      }

      const plan = JSON.parse(fullResponse);

      if (plan && plan.title && Array.isArray(plan.weeklyPlan)) {
        setWorkoutPlan(plan);
        setSuccessMessage("New workout plan generated!");
        setCurrentView('planFocus');
      } else {
        throw new Error("The AI returned an invalid or incomplete workout plan structure.");
      }
    } catch (err) {
      let errorMessage = "An unknown error occurred while generating the plan.";
      if (err instanceof Error) {
          errorMessage = err.message;
      }
      console.error("Failed to generate workout plan:", err);
      setError(`Failed to generate plan. ${errorMessage}`);
    } finally {
      setIsLoadingPlan(false);
      setStreamingPlanText(null);
    }
  }, [exercises]);

  const handleSavePlan = async (planToSave: WorkoutPlan, planName: string) => {
    setIsSavingPlan(true);
    try {
        const newEntry: SavedWorkoutPlanEntry = {
            id: `plan-${Date.now()}`,
            name: planName,
            plan: planToSave,
            savedAt: new Date().toISOString(),
        };
        await apiService.savePlanEntry(newEntry);
        setSavedPlanEntries(prev => [...prev, newEntry]);
        setSuccessMessage(`Plan "${planName}" saved!`);
    } catch (err) {
        setError("Failed to save the plan.");
    } finally {
        setIsSavingPlan(false);
    }
  };

  const handleViewPlan = async (planId: string) => {
    try {
        const entry = await apiService.getSavedPlanEntry(planId);
        if (entry) {
            setWorkoutPlan(entry.plan);
            setCurrentView('planFocus');
        } else {
            setError("Could not find the selected plan.");
        }
    } catch (err) {
        setError("Failed to load the plan.");
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (window.confirm("Are you sure you want to delete this plan? This cannot be undone.")) {
        try {
            await apiService.deleteSavedPlanEntry(planId);
            setSavedPlanEntries(prev => prev.filter(p => p.id !== planId));
            setSuccessMessage("Plan deleted.");
            if (workoutPlan && savedPlanEntries.find(p => p.id === planId)?.plan.title === workoutPlan.title) {
                setWorkoutPlan(null);
                setCurrentView('dashboard');
            }
        } catch (err) {
            setError("Failed to delete the plan.");
        }
    }
  };

  const handleStartWorkout = (session: WorkoutSession) => {
    setActiveWorkoutSession(session);
    setCurrentView('workoutSession');
  };

  const handleFinishWorkout = () => {
    setActiveWorkoutSession(null);
    setCurrentView('planFocus');
    setSuccessMessage("Workout complete! Great job!");
  };
  
  const renderContent = () => {
    if (isLoadingVideo || currentView === 'analyzing') {
      return <WorkoutLoader statusMessage={statusMessage} />;
    }
    
    if (currentView === 'workoutSession' && activeWorkoutSession) {
      return (
        <InteractiveWorkout 
            session={activeWorkoutSession} 
            libraryExercises={exercises} 
            onFinish={handleFinishWorkout} 
        />
      );
    }

    if (currentView === 'exerciseGallery') {
      return <ExerciseGallery exercises={exercises} onDeleteExercise={handleDeleteExercise} />;
    }

    if (currentView === 'planFocus' && workoutPlan) {
      return (
        <WorkoutPlanDisplay 
            plan={workoutPlan} 
            exercises={exercises} 
            onSavePlan={handleSavePlan} 
            isSavingPlan={isSavingPlan}
            onStartWorkout={handleStartWorkout}
        />
      );
    }
    
    if (currentView === 'planFocus' && isLoadingPlan) {
        return (
            <div className="text-center p-8 bg-white rounded-xl shadow-lg">
                <h3 className="text-2xl font-semibold mb-4 text-primary-700">Generating Your Plan...</h3>
                <LoadingSpinner />
                {streamingPlanText && (
                    <pre className="mt-4 text-left text-xs bg-gray-100 p-4 rounded-md overflow-x-auto max-h-96">
                        <code>{streamingPlanText}</code>
                    </pre>
                )}
            </div>
        );
    }
    
    // Default view is 'dashboard'
    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="lg:col-span-1 space-y-8">
              <VideoUploadForm onAnalyzeVideos={handleAnalyzeVideos} isLoading={isLoadingVideo} />
              <DataBackupRestore onRestore={loadAllUserData} />
            </div>
            <div className="lg:col-span-1 space-y-8">
              <div className="p-6 bg-white rounded-xl shadow-lg">
                  <h2 className="text-2xl font-semibold text-gray-800 flex items-center mb-4">
                      <SparklesIcon className="w-7 h-7 mr-3 text-primary-600" />
                      Generate Workout Plan
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                      Once you have exercises in your gallery, use our AI to generate a personalized weekly workout plan based on your goals.
                  </p>
                  <button
                      onClick={() => setPlanOptionsVisible(true)}
                      disabled={exercises.length === 0 || isLoadingPlan}
                      className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <SparklesIcon className="w-5 h-5 mr-2" />
                      {isLoadingPlan ? 'Generating...' : 'Create New Plan'}
                  </button>
                   {exercises.length === 0 && (
                    <p className="text-xs text-center mt-2 text-red-500">
                      You must add exercises from a video first.
                    </p>
                  )}
              </div>
              <SavedPlansList
                savedPlans={savedPlanEntries}
                onViewPlan={handleViewPlan}
                onDeletePlan={handleDeletePlan}
                isLoading={isLoadingSavedPlans}
              />
            </div>
        </div>
      </>
    );
  };

  if (isAuthLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }
  
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
         {error && <p className="mb-4 text-center text-sm text-red-600 bg-red-100 p-3 rounded-md" role="alert">{error}</p>}
        <Auth onLogin={handleLogin} onSignup={handleLogin} setError={setError} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <SparklesIcon className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-800">AI Workout Planner</h1>
            </div>
            <div className="flex items-center">
               <span className="text-sm text-gray-600 mr-4 hidden sm:block">Welcome, {currentUser.email}</span>
               <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                  title="Logout"
               >
                 <ArrowRightOnRectangleIcon className="w-6 h-6" />
               </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900">Dashboard</h2>
              <p className="text-md text-gray-500 mt-1">Manage your exercises, generate plans, and track your workouts.</p>
            </div>
             <div className="mt-4 sm:mt-0 flex space-x-2">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${currentView === 'dashboard' ? 'bg-primary-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    Home
                </button>
                 <button
                    onClick={() => setCurrentView('exerciseGallery')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${currentView === 'exerciseGallery' ? 'bg-primary-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    Exercise Gallery ({exercises.length})
                </button>
                {workoutPlan && currentView !== 'dashboard' && currentView !== 'exerciseGallery' && (
                  <button
                      onClick={() => setCurrentView('planFocus')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg ${currentView === 'planFocus' ? 'bg-primary-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                      Current Plan
                  </button>
                )}
             </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
          {successMessage && (
             <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded-md" role="alert">
              <p>{successMessage}</p>
            </div>
          )}

          {renderContent()}

          <PlanGenerationModal 
            isVisible={isPlanOptionsVisible}
            onClose={() => setPlanOptionsVisible(false)}
            onGenerate={handleGeneratePlan}
            isLoading={isLoadingPlan}
          />

        </div>
      </main>
    </div>
  );
};

export default App;
