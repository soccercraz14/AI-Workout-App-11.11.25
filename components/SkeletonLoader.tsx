import React from 'react';

/**
 * Skeleton loader for exercise cards
 */
export const ExerciseCardSkeleton: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden flex flex-col border border-gray-800 animate-pulse">
      {/* Video skeleton */}
      <div className="w-full aspect-[9/16] bg-gray-800" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title skeleton */}
        <div className="h-6 bg-gray-800 rounded-lg w-3/4" />

        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-5/6" />
        </div>

        {/* Buttons skeleton */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-800">
          <div className="h-10 w-10 bg-gray-800 rounded-xl" />
          <div className="h-10 w-10 bg-gray-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for video upload form
 */
export const UploadFormSkeleton: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-5 space-y-4 border border-gray-800 animate-pulse">
      <div className="h-12 bg-gray-800 rounded-xl w-full" />
      <div className="h-8 bg-gray-800 rounded-xl w-1/3" />
    </div>
  );
};

/**
 * Skeleton loader for workout plan
 */
export const WorkoutPlanSkeleton: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 animate-pulse space-y-6">
      {/* Title */}
      <div className="h-8 bg-gray-800 rounded-lg w-2/3" />

      {/* Description */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-800 rounded w-4/5" />
        <div className="h-4 bg-gray-800 rounded w-3/4" />
      </div>

      {/* Days */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-gray-800 rounded-xl space-y-2">
            <div className="h-6 bg-gray-700 rounded w-1/4" />
            <div className="h-4 bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton loader for library search/filter
 */
export const LibraryHeaderSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-800 rounded-lg w-1/4" />
        <div className="h-6 bg-gray-800 rounded-full w-20" />
      </div>
      <div className="h-12 bg-gray-800 rounded-xl w-full" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-800 rounded-lg w-20" />
        ))}
      </div>
    </div>
  );
};

/**
 * Generic inline skeleton for text
 */
export const TextSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <div className={`h-4 bg-gray-800 rounded animate-pulse ${className}`} />;
};

/**
 * Skeleton for video thumbnail in library
 */
export const ThumbnailSkeleton: React.FC = () => {
  return (
    <div className="w-full aspect-[9/16] bg-gray-800 animate-pulse flex items-center justify-center">
      <svg className="w-16 h-16 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
      </svg>
    </div>
  );
};

export default ExerciseCardSkeleton;
