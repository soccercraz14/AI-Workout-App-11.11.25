
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [isTipLoading, setIsTipLoading] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadVideo = async () => {
      if (exercise.videoStorageKey) {
        try {
          const file = await apiService.getVideoFile(exercise.videoStorageKey);
          if (file) {
            objectUrl = URL.createObjectURL(file);
            let srcWithFragment = objectUrl;
            if (exercise.startTime !== undefined) {
              srcWithFragment += `#t=${exercise.startTime}`;
              if (exercise.endTime !== undefined && exercise.endTime > exercise.startTime) {
                srcWithFragment += `,${exercise.endTime}`;
              }
            }
            setVideoSrc(srcWithFragment);
          }
        } catch (error) {
          console.error(`Failed to load video for ${exercise.name}:`, error);
        }
      }
    };

    loadVideo();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [exercise]);

  useEffect(() => {
    if (videoRef.current && videoSrc) {
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


  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="w-full aspect-[9/16] bg-black flex items-center justify-center relative">
        {videoSrc ? (
          <video
            ref={videoRef}
            key={videoSrc} 
            src={videoSrc}
            className="w-full h-full object-contain"
            loop
            muted
            playsInline
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading video...</p>
          </div>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <div>
            <h3 className="font-semibold text-primary-700 truncate" title={exercise.name}>{exercise.name}</h3>
            <p className="text-xs text-gray-500 mt-1 h-8 overflow-hidden" title={exercise.description}>
                {exercise.description}
            </p>
            {isTipLoading && <div className="mt-2"><LoadingSpinner /></div>}
            {tipError && <p className="mt-2 text-xs text-red-500">{tipError}</p>}
            {tip && <p className="mt-2 text-xs text-indigo-600 bg-indigo-50 p-2 rounded-md italic">"{tip}"</p>}
        </div>
        <div className="flex justify-between items-center mt-3">
             <button
                onClick={handleGetTip}
                disabled={isTipLoading}
                className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-100 rounded-full transition-colors self-end disabled:opacity-50"
                aria-label={`Get a quick tip for ${exercise.name}`}
                title={`Get a quick tip`}
            >
                <SparklesIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDeleteExercise(exercise.id)}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors self-end"
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
      <div className="text-center py-12 px-6 bg-white rounded-xl shadow-xl">
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">Exercise Gallery</h2>
        <p className="text-gray-500">No exercises found.</p>
        <p className="text-sm text-gray-400 mt-1">Upload videos and use the AI analysis to populate your gallery!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 sm:p-6 rounded-xl shadow-xl">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Your Exercise Gallery</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
