
import React, { useState, useEffect, useCallback } from 'react';
import { WorkoutPlan, WorkoutDay, PlannedExercise, Exercise, WorkoutSession } from '../types';
import { VideoCameraIcon, ClipboardIcon, ArrowDownTrayIcon, SparklesIcon, PlayIcon } from './icons'; 
import * as apiService from '../services/apiService'; 

interface WorkoutPlanDisplayProps {
  plan: WorkoutPlan | null;
  exercises?: Exercise[];
  onSavePlan?: (planToSave: WorkoutPlan, planName: string) => void;
  isSavingPlan?: boolean;
  onStartWorkout: (session: WorkoutSession) => void;
}

const PlanInfoSection: React.FC<{ title: string; content?: string }> = ({ title, content }) => {
  if (!content) return null;
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <h4 className="font-semibold text-sm text-blue-700">{title}</h4>
      <p className="text-xs text-blue-600 whitespace-pre-line">{content}</p>
    </div>
  );
};

const formatWorkoutPlanAsMarkdown = (plan: WorkoutPlan): string => {
  let md = `# ${plan.title}\n\n`;

  if (plan.description) md += `## Trainer's Overview\n\n**Plan Focus:**\n${plan.description}\n\n`;
  if (plan.weeklySplitDescription) md += `**Weekly Split:**\n${plan.weeklySplitDescription}\n\n`;
  if (plan.warmupRecommendation) md += `**Warm-up:**\n${plan.warmupRecommendation}\n\n`;
  if (plan.cooldownRecommendation) md += `**Cool-down:**\n${plan.cooldownRecommendation}\n\n`;
  if (plan.progressionTips) md += `**Progression Tips:**\n${plan.progressionTips}\n\n`;

  plan.weeklyPlan.forEach(day => {
    md += `## ${day.day}${day.focus ? ` - ${day.focus}` : ''}\n\n`;
    if (day.notes) md += `**Note for the day:** ${day.notes}\n\n`;

    if (day.exercises && day.exercises.length > 0) {
      day.exercises.forEach(ex => {
        md += `- **${ex.name}**\n`;
        if (ex.sets) md += `  - Sets: ${ex.sets}\n`;
        if (ex.reps) md += `  - Reps: ${ex.reps}\n`;
        if (ex.rest) md += `  - Rest: ${ex.rest}\n`;
        // PlannedExercise.description removed
        md += "\n";
      });
    } else {
      md += "_No specific exercises planned, or rest day._\n\n";
    }
  });

  return md;
};


const WorkoutPlanDisplay: React.FC<WorkoutPlanDisplayProps> = ({ plan, exercises, onSavePlan, isSavingPlan, onStartWorkout }) => {
  const [copySuccessMessage, setCopySuccessMessage] = useState<string | null>(null);
  const [videoSrcMap, setVideoSrcMap] = useState<Record<string, string>>({});
  const [currentVideoModalSrc, setCurrentVideoModalSrc] = useState<string | null>(null);
  const [currentVideoModalTitle, setCurrentVideoModalTitle] = useState<string | null>(null);


  useEffect(() => {
    if (copySuccessMessage) {
      const timer = setTimeout(() => setCopySuccessMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccessMessage]);

  useEffect(() => {
    const currentVideoKeysInUse = new Set<string>();
    const promisesToLoad: Promise<{ key: string; url: string } | null>[] = [];

    if (plan && exercises) {
      plan.weeklyPlan.forEach(day => {
        day.exercises.forEach(plannedEx => {
          const fullExercise = exercises.find(e => e.id === plannedEx.originalExerciseId);
          if (fullExercise?.videoStorageKey) {
            currentVideoKeysInUse.add(fullExercise.videoStorageKey);
            if (!videoSrcMap[fullExercise.videoStorageKey]) { 
              promisesToLoad.push(
                apiService.getVideoFile(fullExercise.videoStorageKey)
                  .then(file => {
                    if (file) {
                      const objectURL = URL.createObjectURL(file);
                      return { key: fullExercise.videoStorageKey!, url: objectURL };
                    }
                    return null;
                  })
                  .catch(err => {
                    console.error(`Failed to load video for ${fullExercise.videoStorageKey}:`, err);
                    return null;
                  })
              );
            }
          }
        });
      });

      Promise.all(promisesToLoad).then(loadedVideos => {
        const newEntries = loadedVideos.reduce((acc, video) => {
          if (video) acc[video.key] = video.url;
          return acc;
        }, {} as Record<string, string>);

        if (Object.keys(newEntries).length > 0) {
          setVideoSrcMap(prevMap => ({ ...prevMap, ...newEntries }));
        }
      });
    }

    const keysToRevoke = Object.keys(videoSrcMap).filter(key => !currentVideoKeysInUse.has(key));
    if (keysToRevoke.length > 0) {
      keysToRevoke.forEach(key => {
        if (videoSrcMap[key]) {
            URL.revokeObjectURL(videoSrcMap[key]);
        }
      });
      setVideoSrcMap(prevMap => {
        const newMap = { ...prevMap };
        keysToRevoke.forEach(key => delete newMap[key]);
        return newMap;
      });
    }
    if ((!plan || !exercises || exercises.length === 0) && Object.keys(videoSrcMap).length > 0) {
        Object.values(videoSrcMap).forEach(url => URL.revokeObjectURL(url));
        setVideoSrcMap({});
    }

  }, [plan, exercises]); 

  useEffect(() => {
    const mapToClean = { ...videoSrcMap }; 
    return () => {
      Object.values(mapToClean).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []); 

  if (!plan) {
    return null;
  }

  const handleCopyToClipboard = () => {
    const markdownPlan = formatWorkoutPlanAsMarkdown(plan);
    navigator.clipboard.writeText(markdownPlan)
      .then(() => setCopySuccessMessage('Plan copied as Markdown!'))
      .catch(err => setCopySuccessMessage('Failed to copy plan.'));
  };

  const handleDownloadMarkdown = () => {
    const markdownPlan = formatWorkoutPlanAsMarkdown(plan);
    const blob = new Blob([markdownPlan], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.title.replace(/\s+/g, '_')}_Workout_Plan.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSavePlan = () => {
    if (onSavePlan && plan) {
        // Auto-generate a name for now
        const planName = `${plan.title} - ${new Date().toLocaleDateString()}`;
        onSavePlan(plan, planName);
    }
  };

  const handleCloseModal = () => {
    setCurrentVideoModalSrc(null);
    setCurrentVideoModalTitle(null);
  };

  return (
    <div className="p-5 bg-white rounded-xl shadow-2xl relative">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
        <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700">{plan.title}</h3>
        <div className="flex space-x-2 self-start sm:self-center">
           <button
            onClick={handleCopyToClipboard}
            title="Copy plan as Markdown"
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
            aria-label="Copy plan as Markdown"
          >
            <ClipboardIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownloadMarkdown}
            title="Download plan as Markdown"
            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors"
            aria-label="Download plan as Markdown"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
          </button>
           {onSavePlan && (
            <button
                onClick={handleSavePlan}
                disabled={isSavingPlan}
                title="Save this workout plan"
                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded-full transition-colors disabled:opacity-50"
                aria-label="Save this workout plan"
            >
                <SparklesIcon className={`w-5 h-5 ${isSavingPlan ? 'animate-pulse' : ''}`} />
            </button>
           )}
        </div>
      </div>

      {copySuccessMessage && (
        <div className="absolute top-0 right-0 mt-2 mr-2 p-2 text-xs bg-green-100 text-green-700 rounded shadow-md z-10">
          {copySuccessMessage}
        </div>
      )}

      <PlanInfoSection title="Trainer's Overview" content={plan.description} />
      <PlanInfoSection title="Weekly Split" content={plan.weeklySplitDescription} />

      <div className="space-y-6">
        {plan.weeklyPlan.map((day, dayIndex) => (
          <div key={dayIndex} className="p-4 bg-gray-50 rounded-lg shadow">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-lg font-semibold text-gray-700">{day.day}</h4>
                    {day.focus && <p className="text-sm text-indigo-600 font-medium mb-1">{day.focus}</p>}
                    {day.notes && <p className="text-xs text-gray-500 italic mb-2 whitespace-pre-line">{day.notes}</p>}
                </div>
                {day.exercises.length > 0 && plan && (
                     <button
                        onClick={() => onStartWorkout({ plan, day })}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-green-500 rounded-lg shadow hover:bg-green-600 transition-all"
                        title={`Start ${day.day} workout`}
                    >
                        <PlayIcon className="w-4 h-4" />
                        Start
                    </button>
                )}
            </div>
            

            {day.exercises.length > 0 ? (
              <ul className="space-y-3 mt-2">
                {day.exercises.map((exercise, exIndex) => {
                  const fullExercise = exercises?.find(e => e.id === exercise.originalExerciseId);
                  const videoKey = fullExercise?.videoStorageKey;
                  let videoClipSrc = videoKey ? videoSrcMap[videoKey] : null;
                  const startTime = fullExercise?.startTime;
                  const endTime = fullExercise?.endTime;

                  let inlineVideoSrcWithFragment = videoClipSrc;
                  if (videoClipSrc && startTime !== undefined) {
                      inlineVideoSrcWithFragment += `#t=${startTime}`;
                      if (endTime !== undefined && endTime > startTime) {
                          inlineVideoSrcWithFragment += `,${endTime}`;
                      }
                  }

                  return (
                    <li key={exIndex} className="p-3 bg-white rounded-md shadow-sm border border-gray-200">
                      <div className="flex justify-between items-center">
                        <strong className="text-md text-primary-700">{exercise.name}</strong>
                        {videoClipSrc && (
                           <button
                            onClick={() => {
                              if (videoClipSrc) { 
                                let modalSrcWithFragment = videoClipSrc;
                                if (startTime !== undefined) {
                                  modalSrcWithFragment += `#t=${startTime}`;
                                  if (endTime !== undefined && endTime > startTime) {
                                    modalSrcWithFragment += `,${endTime}`;
                                  }
                                }
                                setCurrentVideoModalSrc(modalSrcWithFragment);
                                setCurrentVideoModalTitle(exercise.name);
                              }
                            }}
                            className="ml-2 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
                            title={`Play ${exercise.name} clip in modal${startTime !== undefined ? ` (starts at ${startTime}s)` : ''}`}
                            aria-label={`Play video clip for ${exercise.name} in modal`}
                          >
                            <VideoCameraIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {inlineVideoSrcWithFragment && (
                        <video
                            key={inlineVideoSrcWithFragment}
                            src={inlineVideoSrcWithFragment}
                            controls
                            className="w-full rounded-md mt-2"
                            style={{maxHeight: '200px'}}
                            preload="metadata"
                        >
                            Your browser does not support the video tag.
                        </video>
                      )}

                      <div className="text-xs text-gray-600 mt-2 space-y-0.5">
                        {exercise.sets && <span>Sets: {exercise.sets}</span>}
                        {exercise.reps && <span className="ml-2">Reps: {exercise.reps}</span>}
                        {exercise.rest && <span className="ml-2">Rest: {exercise.rest}</span>}
                      </div>
                      {/* PlannedExercise.description (Trainer Note) removed */}
                      {/* fullExercise.description (Original exercise description) removed from plan display */}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic mt-2">Rest day or no specific exercises.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <PlanInfoSection title="Warm-up Recommendation" content={plan.warmupRecommendation} />
        <PlanInfoSection title="Cool-down Recommendation" content={plan.cooldownRecommendation} />
        <PlanInfoSection title="Progression Tips" content={plan.progressionTips} />
      </div>

      {currentVideoModalSrc && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          aria-modal="true"
          role="dialog"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-xl font-semibold text-primary-700">{currentVideoModalTitle || 'Video Clip'}</h5>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-200"
                aria-label="Close video player"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video
              key={currentVideoModalSrc}
              src={currentVideoModalSrc}
              controls
              autoPlay
              className="w-full rounded"
              style={{maxHeight: '70vh'}}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPlanDisplay;
