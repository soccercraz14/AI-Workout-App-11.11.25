
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Exercise } from '../types';
import * as apiService from '../services/apiService';
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
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [isTipLoading, setIsTipLoading] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);

  useEffect(() => {
    const loadVideo = async () => {
      if (exercise.videoStorageKey) {
        setIsVideoLoading(true);
        setVideoError(null);
        try {
          const file = await apiService.getVideoFile(exercise.videoStorageKey);
          if (file) {
            console.log(`Loading video for ${exercise.name}, file size: ${file.size} bytes`);
            // Convert File to data URL for iOS compatibility
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
  }, [exercise]);

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
        ) : isVideoLoading ? (
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
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between bg-gradient-to-b from-gray-900/50 to-transparent">
        <div>
            <h3 className="font-bold text-white text-lg truncate" title={exercise.name}>{exercise.name}</h3>
            <p className="text-sm text-gray-400 mt-2 line-clamp-2" title={exercise.description}>
                {exercise.description}
            </p>
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Library</h2>
        <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
          {exercises.length} {exercises.length === 1 ? 'Exercise' : 'Exercises'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {exercises.map((exercise) => (
          <ExerciseGalleryItem
            key={exercise.id}
            exercise={exercise}
            onDeleteExercise={onDeleteExercise}
          />
        ))}
      </div>
    </div>
  );
};

export default ExerciseGallery;
