
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Exercise } from '../types';
import * as apiService from '../services/apiService';
import * as videoStorage from '../services/videoStorage';
import { getQuickExerciseTip } from '../services/geminiService';
import { TrashIcon, SparklesIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface ExerciseGalleryItemProps {
  exercise: Exercise;
  onDeleteExercise: (id: string) => void;
}

const ExerciseGalleryItem: React.FC<ExerciseGalleryItemProps> = ({ exercise, onDeleteExercise }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showFullVideo, setShowFullVideo] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [isTipLoading, setIsTipLoading] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);

  // Load thumbnail first
  useEffect(() => {
    const loadThumbnail = async () => {
      if (exercise.thumbnailStorageKey) {
        try {
          const thumbPath = await videoStorage.getThumbnailPath(exercise.thumbnailStorageKey);
          if (thumbPath) {
            setThumbnailSrc(thumbPath);
          } else {
            // Fallback to blob for web
            const thumbBlob = await videoStorage.getThumbnail(exercise.thumbnailStorageKey);
            if (thumbBlob) {
              setThumbnailSrc(URL.createObjectURL(thumbBlob));
            }
          }
        } catch (error) {
          console.error(`Failed to load thumbnail for ${exercise.name}:`, error);
        }
      }
    };
    loadThumbnail();
  }, [exercise]);

  // Load full video only when user clicks to play
  useEffect(() => {
    if (!showFullVideo) return;

    const loadVideo = async () => {
      if (exercise.videoStorageKey) {
        setIsVideoLoading(true);
        setVideoError(null);
        try {
          // First try to get native file path (for iOS/Android)
          const nativePath = await videoStorage.getVideoPath(exercise.videoStorageKey);

          if (nativePath) {
            // Use the native file path directly
            console.log(`Using native file path for ${exercise.name}: ${nativePath}`);
            setVideoSrc(nativePath);
            setIsVideoLoading(false);
          } else {
            // Fallback to data URL for web
            const file = await apiService.getVideoFile(exercise.videoStorageKey);
            if (file) {
              console.log(`Loading video for ${exercise.name}, file size: ${file.size} bytes`);
              // Convert File to data URL for web compatibility
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                console.log(`Video data URL created for ${exercise.name}, length: ${dataUrl.length}`);
                setVideoSrc(dataUrl);
                setIsVideoLoading(false);
              };
              reader.onerror = (e) => {
                console.error(`Failed to read video file for ${exercise.name}:`, e);
                setVideoError('Failed to load video');
                setIsVideoLoading(false);
              };
              reader.readAsDataURL(file);
            } else {
              console.error(`No file found for ${exercise.name}`);
              setVideoError('Video file not found');
              setIsVideoLoading(false);
            }
          }
        } catch (error) {
          console.error(`Failed to load video for ${exercise.name}:`, error);
          setVideoError('Failed to load video');
          setIsVideoLoading(false);
        }
      } else {
        setVideoError('No video available');
        setIsVideoLoading(false);
      }
    };

    loadVideo();

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [exercise, showFullVideo]);

  // Handle video time range (start/end time) after metadata loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    const handleLoadedMetadata = () => {
      if (exercise.startTime !== undefined) {
        video.currentTime = exercise.startTime;
      }
    };

    const handleTimeUpdate = () => {
      if (exercise.endTime !== undefined && video.currentTime >= exercise.endTime) {
        video.currentTime = exercise.startTime || 0;
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoSrc, exercise.startTime, exercise.endTime]);

  useEffect(() => {
    // Only enable autoplay on non-iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (videoRef.current && videoSrc && !isIOS) {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(e => console.warn("Autoplay prevented for:", exercise.name, e));
          } else {
            videoRef.current?.pause();
          }
        },
        { threshold: 0.5 } // Play when 50% of the video is visible
      );
      observerRef.current.observe(videoRef.current);
    }
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [videoSrc, exercise.name]);

  const handleGetTip = async () => {
    setIsTipLoading(true);
    setTip(null);
    setTipError(null);
    try {
        const generatedTip = await getQuickExerciseTip(exercise.name, exercise.description);
        setTip(generatedTip);
    } catch(err) {
        setTipError("Could not fetch tip.");
        console.error(err);
    } finally {
        setIsTipLoading(false);
    }
  }


  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video playback error for ${exercise.name}:`, e);
    setVideoError('Video playback failed');
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden flex flex-col border border-gray-800 hover:border-gray-700 transition-all">
      <div className="w-full aspect-[9/16] bg-black flex items-center justify-center relative">
        {videoError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <p className="text-red-400 text-sm mb-2">⚠️ {videoError}</p>
            <p className="text-gray-500 text-xs">Try re-uploading the video</p>
          </div>
        ) : !showFullVideo && thumbnailSrc ? (
          /* Show thumbnail with play button */
          <div className="w-full h-full relative cursor-pointer" onClick={() => setShowFullVideo(true)}>
            <img
              src={thumbnailSrc}
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center hover:bg-opacity-20 transition-all">
              <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </div>
        ) : showFullVideo ? (
          /* Show full video after clicking play */
          isVideoLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <LoadingSpinner />
                <p className="text-gray-500 text-xs mt-2">Loading video...</p>
              </div>
            </div>
          ) : videoSrc ? (
            <video
              ref={videoRef}
              key={videoSrc}
              src={videoSrc}
              className="w-full h-full object-contain"
              controls
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              onError={handleVideoError}
              onLoadedData={() => console.log(`Video loaded successfully: ${exercise.name}`)}
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-500 text-sm">No video available</p>
            </div>
          )
        ) : (
          /* No thumbnail available */
          <div className="w-full h-full flex items-center justify-center">
            <LoadingSpinner />
          </div>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between bg-gradient-to-b from-gray-900/50 to-transparent">
        <div>
            <h3 className="font-bold text-white text-lg truncate" title={exercise.name}>{exercise.name}</h3>
            <p className="text-sm text-gray-400 mt-2 line-clamp-2" title={exercise.description}>
                {exercise.description}
            </p>

            {/* Muscle Groups Tags */}
            {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {exercise.muscleGroups.map((group, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700"
                  >
                    {group}
                  </span>
                ))}
              </div>
            )}

            {/* Equipment Tag */}
            {exercise.equipment && (
              <div className="mt-1.5">
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                  🏋️ {exercise.equipment}
                </span>
              </div>
            )}

            {isTipLoading && <div className="mt-3"><LoadingSpinner /></div>}
            {tipError && <p className="mt-2 text-xs text-red-400">{tipError}</p>}
            {tip && <p className="mt-3 text-xs text-gray-300 bg-gray-800 p-3 rounded-xl italic border border-gray-700">"{tip}"</p>}
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-800">
             <button
                onClick={handleGetTip}
                disabled={isTipLoading}
                className="p-2.5 text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-all disabled:opacity-50"
                aria-label={`Get a quick tip for ${exercise.name}`}
                title={`Get AI tip`}
            >
                <SparklesIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDeleteExercise(exercise.id)}
              className="p-2.5 text-red-400 bg-red-950/30 hover:bg-red-950/50 rounded-xl transition-all border border-red-900/30"
              aria-label={`Delete exercise: ${exercise.name}`}
              title={`Delete ${exercise.name}`}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
};


interface ExerciseGalleryProps {
  exercises: Exercise[];
  onDeleteExercise: (id: string) => void;
}

const ExerciseGallery: React.FC<ExerciseGalleryProps> = ({ exercises, onDeleteExercise }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('All');

  // Get all unique muscle groups from exercises
  const allMuscleGroups = useMemo(() => {
    const groups = new Set<string>();
    exercises.forEach(ex => {
      ex.muscleGroups?.forEach(group => groups.add(group));
    });
    return ['All', ...Array.from(groups).sort()];
  }, [exercises]);

  // Filter exercises based on search and muscle group
  const filteredExercises = useMemo(() => {
    return exercises.filter(exercise => {
      const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exercise.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMuscleGroup = selectedMuscleGroup === 'All' ||
                                exercise.muscleGroups?.includes(selectedMuscleGroup);
      return matchesSearch && matchesMuscleGroup;
    });
  }, [exercises, searchQuery, selectedMuscleGroup]);

  if (exercises.length === 0) {
    return (
      <div className="text-center py-16 px-6 bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-gray-800">
        <div className="text-6xl mb-4">📹</div>
        <h2 className="text-2xl font-bold text-white mb-3">No Exercises Yet</h2>
        <p className="text-gray-400">Upload workout videos above to build your library</p>
        <p className="text-sm text-gray-500 mt-2">AI will analyze and extract exercises automatically</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Library</h2>
        <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
          {filteredExercises.length} of {exercises.length} {exercises.length === 1 ? 'Exercise' : 'Exercises'}
        </span>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search exercises..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-800 focus:border-white focus:outline-none transition-all placeholder-gray-500"
      />

      {/* Muscle Group Filter */}
      {allMuscleGroups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allMuscleGroups.map(group => (
            <button
              key={group}
              onClick={() => setSelectedMuscleGroup(group)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedMuscleGroup === group
                  ? 'bg-white text-black'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      )}

      {/* Exercise Grid */}
      {filteredExercises.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredExercises.map((exercise) => (
            <ExerciseGalleryItem
              key={exercise.id}
              exercise={exercise}
              onDeleteExercise={onDeleteExercise}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-gray-900 rounded-2xl border border-gray-800">
          <p className="text-gray-400">No exercises match your search</p>
        </div>
      )}
    </div>
  );
};

export default ExerciseGallery;
