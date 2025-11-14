
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutSession, Exercise, PlannedExercise } from '../types';
import * as apiService from '../services/apiService';
import * as videoStorage from '../services/videoStorage';
import { transcribeAudio } from '../services/geminiService';
import { MicrophoneIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface InteractiveWorkoutProps {
    session: WorkoutSession;
    libraryExercises: Exercise[];
    onFinish: () => void;
}

const parseRestTime = (restString?: string): number => {
    if (!restString) return 60; // Default rest
    const match = restString.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 60;
};

const InteractiveWorkout: React.FC<InteractiveWorkoutProps> = ({ session, libraryExercises, onFinish }) => {
    const { plan, day } = session;
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [currentSet, setCurrentSet] = useState(1);
    const [isResting, setIsResting] = useState(false);
    const [restTimeLeft, setRestTimeLeft] = useState(0);

    const [videoSrcMap, setVideoSrcMap] = useState<Record<string, string>>({});
    const videoRef = useRef<HTMLVideoElement>(null);
    const loadedKeysRef = useRef<Set<string>>(new Set());

    // Voice Note State
    const [isVoiceNoteModalOpen, setIsVoiceNoteModalOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcription, setTranscription] = useState<string | null>(null);
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const currentPlannedExercise = day.exercises[currentExerciseIndex];
    const fullExerciseDetails = useMemo(() =>
        libraryExercises.find(ex => ex.id === currentPlannedExercise.originalExerciseId),
        [libraryExercises, currentPlannedExercise]
    );

    useEffect(() => {
        const loadVideos = async () => {
            const newSrcMap: Record<string, string> = {};
            for (const plannedEx of day.exercises) {
                const fullEx = libraryExercises.find(e => e.id === plannedEx.originalExerciseId);
                if (fullEx?.videoStorageKey && !loadedKeysRef.current.has(fullEx.videoStorageKey)) {
                    // First try to get native file path (for iOS/Android)
                    const nativePath = await videoStorage.getVideoPath(fullEx.videoStorageKey);

                    if (nativePath) {
                        // Use the native file path directly
                        newSrcMap[fullEx.videoStorageKey] = nativePath;
                        loadedKeysRef.current.add(fullEx.videoStorageKey);
                    } else {
                        // Fallback to data URL for web
                        const file = await apiService.getVideoFile(fullEx.videoStorageKey);
                        if (file) {
                            try {
                                // Convert File to data URL for web compatibility
                                const dataUrl = await new Promise<string>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = () => resolve(reader.result as string);
                                    reader.onerror = () => reject(new Error('Failed to read video file'));
                                    reader.readAsDataURL(file);
                                });
                                newSrcMap[fullEx.videoStorageKey] = dataUrl;
                                loadedKeysRef.current.add(fullEx.videoStorageKey);
                            } catch (error) {
                                console.error(`Failed to convert video to data URL for ${fullEx.name}:`, error);
                            }
                        }
                    }
                }
            }
            if (Object.keys(newSrcMap).length > 0) {
                setVideoSrcMap(prev => ({ ...prev, ...newSrcMap }));
            }
        };
        loadVideos();
    }, [day.exercises, libraryExercises]);

    const videoSrc = useMemo(() => {
        if (!fullExerciseDetails?.videoStorageKey) return null;
        const baseUrl = videoSrcMap[fullExerciseDetails.videoStorageKey];
        if (!baseUrl) return null;
        // Don't add fragment identifiers - they don't work with data URLs
        return baseUrl;
    }, [fullExerciseDetails, videoSrcMap]);

    // Handle video time range (start/end time) after metadata loads
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoSrc || !fullExerciseDetails) return;

        const handleLoadedMetadata = () => {
            if (fullExerciseDetails.startTime !== undefined) {
                video.currentTime = fullExerciseDetails.startTime;
            }
        };

        const handleTimeUpdate = () => {
            if (fullExerciseDetails.endTime !== undefined && video.currentTime >= fullExerciseDetails.endTime) {
                video.currentTime = fullExerciseDetails.startTime || 0;
            }
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [videoSrc, fullExerciseDetails]);

    useEffect(() => {
        if (isResting && restTimeLeft > 0) {
            const timer = setTimeout(() => setRestTimeLeft(restTimeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
        if (isResting && restTimeLeft === 0) {
            setIsResting(false);
        }
    }, [isResting, restTimeLeft]);

    const handleStartRecording = async () => {
        setTranscription(null);
        setTranscriptionError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };
                mediaRecorderRef.current.onstop = handleTranscription;
                audioChunksRef.current = [];
                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (err) {
                setTranscriptionError("Microphone access denied. Please enable it in your browser settings.");
                console.error("Error accessing microphone:", err);
            }
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop mic access
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleTranscription = async () => {
        if (audioChunksRef.current.length === 0) return;
        setIsTranscribing(true);
        setTranscriptionError(null);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        try {
            const result = await transcribeAudio(audioBlob);
            setTranscription(result);
        } catch (err) {
            setTranscriptionError("Failed to transcribe audio. Please try again.");
            console.error(err);
        } finally {
            setIsTranscribing(false);
            audioChunksRef.current = [];
        }
    };

    const handleCompleteSet = () => {
        const totalSets = parseInt(currentPlannedExercise.sets?.match(/^\d+/)?.[0] || '1', 10);
        const restDuration = parseRestTime(currentPlannedExercise.rest);

        if (currentSet < totalSets) {
            setCurrentSet(currentSet + 1);
            setRestTimeLeft(restDuration);
            setIsResting(true);
        } else {
            handleNextExercise();
        }
    };
    
    const handleNextExercise = () => {
        setIsResting(false);
        if (currentExerciseIndex < day.exercises.length - 1) {
            setCurrentExerciseIndex(currentExerciseIndex + 1);
            setCurrentSet(1);
        } else {
            onFinish();
        }
    };

    const handlePrevExercise = () => {
        setIsResting(false);
        if (currentExerciseIndex > 0) {
            setCurrentExerciseIndex(currentExerciseIndex - 1);
            setCurrentSet(1);
        }
    };
    
    const handleSkipRest = () => {
        setIsResting(false);
        setRestTimeLeft(0);
    }

    if (isResting) {
        return (
            <div className="fixed inset-0 bg-primary-900 text-white flex flex-col items-center justify-center p-4 z-50">
                <p className="text-2xl font-semibold mb-4 text-primary-300">REST</p>
                <div className="text-8xl font-bold mb-8 tabular-nums">{restTimeLeft}</div>
                <p className="text-lg text-primary-200 mb-2">Next up:</p>
                <p className="text-2xl font-bold text-center">{currentSet} of {currentPlannedExercise.sets} - {currentPlannedExercise.name}</p>
                <button 
                    onClick={handleSkipRest}
                    className="mt-12 px-6 py-2 bg-white text-primary-800 font-semibold rounded-full shadow-lg"
                >
                    Skip Rest
                </button>
            </div>
        );
    }


    return (
        <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl shadow-2xl max-w-4xl mx-auto relative">
             <button 
                onClick={() => setIsVoiceNoteModalOpen(true)}
                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md text-primary-600 hover:bg-primary-100 transition"
                title="Add Voice Note"
            >
                <MicrophoneIcon className="w-6 h-6" />
            </button>
            <header className="mb-4 text-center">
                <h1 className="text-xl font-bold text-gray-500">{plan.title}</h1>
                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-700">{day.day}: {day.focus}</h2>
                <p className="text-sm text-gray-500">Exercise {currentExerciseIndex + 1} of {day.exercises.length}</p>
            </header>

            <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg mb-4">
                 {videoSrc ? (
                    <video
                        ref={videoRef}
                        key={videoSrc}
                        src={videoSrc}
                        className="w-full h-full object-contain"
                        controls
                        loop
                        muted
                        playsInline
                        preload="auto"
                    >
                        Your browser does not support the video tag.
                    </video>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">Loading video...</div>
                )}
            </div>

            <div className="text-center mb-6">
                <h3 className="text-4xl font-bold text-gray-800">{currentPlannedExercise.name}</h3>
                <p className="text-lg text-gray-600">{fullExerciseDetails?.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center mb-8">
                <div>
                    <span className="block text-sm font-medium text-gray-500">Set</span>
                    <span className="text-3xl font-bold text-primary-600">{currentSet} / {currentPlannedExercise.sets || 'N/A'}</span>
                </div>
                 <div>
                    <span className="block text-sm font-medium text-gray-500">Reps</span>
                    <span className="text-3xl font-bold text-primary-600">{currentPlannedExercise.reps || 'N/A'}</span>
                </div>
                 <div>
                    <span className="block text-sm font-medium text-gray-500">Rest</span>
                    <span className="text-3xl font-bold text-primary-600">{currentPlannedExercise.rest || 'N/A'}</span>
                </div>
            </div>

            <button
                onClick={handleCompleteSet}
                className="w-full py-4 text-xl font-bold text-white bg-green-500 rounded-lg shadow-lg hover:bg-green-600 transition-transform transform hover:scale-105"
            >
                Complete Set
            </button>

            <div className="flex justify-between mt-6">
                <button 
                    onClick={handlePrevExercise}
                    disabled={currentExerciseIndex === 0}
                    className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg disabled:opacity-50"
                >
                    &larr; Previous
                </button>
                <button 
                    onClick={onFinish}
                    className="px-6 py-2 text-red-700 bg-red-100 rounded-lg"
                >
                   Finish Workout
                </button>
                 <button 
                    onClick={handleNextExercise}
                    className="px-6 py-2 text-white bg-primary-500 rounded-lg"
                 >
                    {currentExerciseIndex === day.exercises.length - 1 ? 'Finish' : 'Next'} &rarr;
                </button>
            </div>
             {isVoiceNoteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setIsVoiceNoteModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Add Voice Note</h3>
                        {transcriptionError && <p className="text-sm text-red-600 mb-4">{transcriptionError}</p>}
                        
                        <div className="flex justify-center my-6">
                            {!isRecording ? (
                                <button onClick={handleStartRecording} className="p-4 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition">
                                    <MicrophoneIcon className="w-8 h-8"/>
                                </button>
                            ) : (
                                <button onClick={handleStopRecording} className="p-4 bg-red-500 text-white rounded-full shadow-lg animate-pulse">
                                    <MicrophoneIcon className="w-8 h-8"/>
                                </button>
                            )}
                        </div>
                        <p className="text-center text-gray-500 text-sm mb-4">{isRecording ? "Recording... Click to stop." : "Click to start recording."}</p>

                        {isTranscribing && <div className="my-4"><LoadingSpinner/></div>}
                        {transcription && (
                            <div className="mt-4 p-4 bg-gray-100 rounded-md">
                                <h4 className="font-semibold text-gray-700">Transcription:</h4>
                                <p className="text-gray-600 italic">"{transcription}"</p>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setIsVoiceNoteModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveWorkout;
