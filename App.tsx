
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
import { SparklesIcon, VideoCameraIcon, ArrowRightOnRectangleIcon, HomeIcon } from './components/icons';

export interface VideoAnalysisPayload {
    file: File;
}

type AppView = 'home' | 'library' | 'plans' | 'workout' | 'analyzing';

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

  const [currentView, setCurrentView] = useState<AppView>('home');
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
    setCurrentView('home');
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
    setCurrentView('home');
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
        setCurrentView('plans');
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
            setCurrentView('plans');
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
            }
        } catch (err) {
            setError("Failed to delete the plan.");
        }
    }
  };

  const handleStartWorkout = (session: WorkoutSession) => {
    setActiveWorkoutSession(session);
    setCurrentView('workout');
  };

  const handleFinishWorkout = () => {
    setActiveWorkoutSession(null);
    setCurrentView('plans');
    setSuccessMessage("Workout complete! Great job!");
  };

  const renderContent = () => {
    if (isLoadingVideo || currentView === 'analyzing') {
      return <WorkoutLoader statusMessage={statusMessage} />;
    }

    if (currentView === 'workout' && activeWorkoutSession) {
      return (
        <InteractiveWorkout
            session={activeWorkoutSession}
            libraryExercises={exercises}
            onFinish={handleFinishWorkout}
        />
      );
    }

    if (currentView === 'home') {
      return (
        <div className="space-y-8 fade-in">
          <VideoUploadForm onAnalyzeVideos={handleAnalyzeVideos} isLoading={isLoadingVideo} />
        </div>
      );
    }

    if (currentView === 'library') {
      return (
        <div className="fade-in">
          <ExerciseGallery exercises={exercises} onDeleteExercise={handleDeleteExercise} />
        </div>
      );
    }

    if (currentView === 'plans') {
      return (
        <div className="space-y-8 fade-in">
          {workoutPlan ? (
            <WorkoutPlanDisplay
                plan={workoutPlan}
                exercises={exercises}
                onSavePlan={handleSavePlan}
                isSavingPlan={isSavingPlan}
                onStartWorkout={handleStartWorkout}
            />
          ) : isLoadingPlan ? (
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800">
              <h3 className="text-2xl font-bold mb-6 text-white text-center">Generating Your Plan...</h3>
              <LoadingSpinner />
              {streamingPlanText && (
                  <pre className="mt-4 text-left text-xs bg-gray-950 text-gray-400 p-4 rounded-xl overflow-x-auto max-h-96 border border-gray-800">
                      <code>{streamingPlanText}</code>
                  </pre>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800">
                  <h2 className="text-3xl font-bold text-white mb-3 flex items-center">
                      <SparklesIcon className="w-8 h-8 mr-3" />
                      Generate Workout Plan
                  </h2>
                  <p className="text-gray-400 mb-6 text-lg">
                      Create a personalized weekly workout plan powered by AI.
                  </p>
                  <button
                      onClick={() => setPlanOptionsVisible(true)}
                      disabled={exercises.length === 0 || isLoadingPlan}
                      className="w-full bg-gradient-to-r from-white to-gray-200 text-black font-bold py-4 px-6 rounded-2xl hover:from-gray-100 hover:to-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg shadow-lg"
                  >
                      <SparklesIcon className="w-6 h-6 mr-2" />
                      {isLoadingPlan ? 'Generating...' : 'Create New Plan'}
                  </button>
                   {exercises.length === 0 && (
                    <p className="text-center mt-4 text-red-400 text-sm">
                      Add exercises from videos first in the Library tab.
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
          )}
        </div>
      );
    }

    return null;
  };

  if (isAuthLoading) {
    return <div className="flex justify-center items-center h-screen bg-black"><LoadingSpinner /></div>;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col justify-center py-12 px-4">
         {error && <p className="mb-4 text-center text-sm text-red-400 bg-red-950 border border-red-900 p-3 rounded-xl" role="alert">{error}</p>}
        <Auth onLogin={handleLogin} onSignup={handleLogin} setError={setError} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-sans text-white pb-20">
      {/* Top Header */}
      <header className="bg-gradient-to-b from-gray-950 to-black border-b border-gray-900 sticky top-0 z-40 backdrop-blur-xl bg-opacity-90" style={{paddingTop: 'env(safe-area-inset-top)'}}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-2 ml-16">
              <div className="bg-gradient-to-br from-white to-gray-400 p-1.5 rounded-lg">
                <SparklesIcon className="h-4 w-4 text-black" />
              </div>
              <h1 className="text-sm font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                AI Workout
              </h1>
            </div>
            <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-900 rounded-xl transition-all"
                title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Messages */}
        {error && (
          <div className="bg-red-950 border border-red-900 text-red-200 p-4 mb-6 rounded-2xl" role="alert">
            <p className="font-semibold text-sm">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
        {successMessage && (
           <div className="bg-green-950 border border-green-900 text-green-200 p-4 mb-6 rounded-2xl" role="alert">
            <p className="text-sm">{successMessage}</p>
          </div>
        )}

        {renderContent()}

        <PlanGenerationModal
          isVisible={isPlanOptionsVisible}
          onClose={() => setPlanOptionsVisible(false)}
          onGenerate={handleGeneratePlan}
          isLoading={isLoadingPlan}
        />
      </main>

      {/* Bottom Navigation */}
      {currentView !== 'workout' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-gray-950 to-transparent backdrop-blur-xl border-t border-gray-900 z-50" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center justify-around">
              <button
                onClick={() => setCurrentView('home')}
                className={`flex flex-col items-center space-y-0.5 px-4 py-1.5 rounded-xl transition-all ${
                  currentView === 'home'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <HomeIcon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Home</span>
              </button>

              <button
                onClick={() => setCurrentView('library')}
                className={`flex flex-col items-center space-y-0.5 px-4 py-1.5 rounded-xl transition-all ${
                  currentView === 'library'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <VideoCameraIcon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Library</span>
                {exercises.length > 0 && (
                  <span className="text-[8px] bg-gray-800 text-white px-1.5 py-0.5 rounded-full">
                    {exercises.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentView('plans')}
                className={`flex flex-col items-center space-y-0.5 px-4 py-1.5 rounded-xl transition-all ${
                  currentView === 'plans'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <SparklesIcon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Plans</span>
                {savedPlanEntries.length > 0 && (
                  <span className="text-[8px] bg-gray-800 text-white px-1.5 py-0.5 rounded-full">
                    {savedPlanEntries.length}
                  </span>
                )}
              </button>

              {workoutPlan && (
                <button
                  onClick={() => {
                    if (workoutPlan) {
                      const firstDay = workoutPlan.weeklyPlan.find(d => d.exercises.length > 0);
                      if (firstDay) {
                        handleStartWorkout({ plan: workoutPlan, day: firstDay });
                      }
                    }
                  }}
                  className="bg-gradient-to-r from-white to-gray-200 text-black font-bold px-6 py-2 rounded-xl hover:from-gray-100 hover:to-gray-300 transition-all shadow-lg flex items-center space-x-1.5"
                >
                  <span className="text-xl">💪</span>
                  <span className="text-xs">Start</span>
                </button>
              )}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};

export default App;
