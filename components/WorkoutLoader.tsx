
import React, { useState, useEffect } from 'react';

const PIXEL_SIZE = 4; // size of each 'pixel' in px
const GRID_SIZE = 16; // 16x16 grid

// Color palette for the pixel art character
const COLORS = {
  0: 'transparent',       // Empty
  1: '#4A4A4A',           // Hair
  2: '#FFC8A2',           // Skin
  3: '#4A90E2',           // Shirt
  4: '#333333',           // Shorts
  5: '#FFFFFF',           // Shoes
  6: '#888888',           // Dumbbell
};

type Frame = number[][];

// Defines the pixel data for each animation frame
const frames: Frame[] = [
  // 0: Idle Frame
  [
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0],
    [0,0,0,2,2,3,3,3,3,2,2,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,4,4,4,4,2,0,0,0,0,0,0],
    [0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,2,0,0,2,2,0,0,0,0,0,0],
    [0,0,0,0,5,5,0,0,5,5,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  // 1: Squat Down Frame
  [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,2,2,3,3,3,3,2,2,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,4,4,4,4,2,0,0,0,0,0,0],
    [0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,2,0,0,2,2,0,0,0,0,0,0],
    [0,0,0,5,5,0,0,0,0,5,5,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  // 2: Jumping Jack Out Frame
  [
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0],
    [0,0,2,2,3,3,3,3,3,3,2,2,0,0,0,0],
    [0,2,2,0,0,3,3,3,3,0,0,2,2,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,4,4,4,4,2,0,0,0,0,0,0],
    [0,0,0,0,4,0,0,0,0,4,0,0,0,0,0,0],
    [0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0],
    [0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0],
    [0,5,5,0,0,0,0,0,0,0,0,5,5,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
   // 3: Bicep Curl Frame
  [
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,2,2,0,0,0,0,0],
    [0,0,0,6,6,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,6,6,2,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,4,4,4,4,2,0,0,0,0,0,0],
    [0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0],
    [0,0,0,0,2,2,0,0,2,2,0,0,0,0,0,0],
    [0,0,0,0,5,5,0,0,5,5,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
];

// The sequence of animations and their names
const workoutSequence = [
    { frameIndex: 1, name: "Squats" },
    { frameIndex: 0, name: "Up!" },
    { frameIndex: 2, name: "Jumping Jacks" },
    { frameIndex: 0, name: "Nice!" },
    { frameIndex: 3, name: "Bicep Curls" },
    { frameIndex: 0, name: "Strong!" },
];

const animationInterval = 600;

// Renders the pixel art grid. Memoized for performance.
const PixelArt: React.FC<{ frame: Frame }> = React.memo(({ frame }) => (
  <div
    className="grid"
    style={{
      gridTemplateColumns: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
      gridTemplateRows: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
      imageRendering: 'pixelated',
      width: GRID_SIZE * PIXEL_SIZE,
      height: GRID_SIZE * PIXEL_SIZE,
    }}
    aria-hidden="true"
  >
    {frame.map((row, y) =>
      row.map((colorIndex, x) => (
        <div
          key={`${y}-${x}`}
          style={{ backgroundColor: COLORS[colorIndex as keyof typeof COLORS] }}
        />
      ))
    )}
  </div>
));

interface WorkoutLoaderProps {
    statusMessage?: string | null;
}

const WorkoutLoader: React.FC<WorkoutLoaderProps> = ({ statusMessage }) => {
  const [sequenceIndex, setSequenceIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSequenceIndex((prevIndex) => (prevIndex + 1) % workoutSequence.length);
    }, animationInterval);
    return () => clearInterval(timer);
  }, []);

  const currentPose = workoutSequence[sequenceIndex];
  const currentFrame = frames[currentPose.frameIndex];
  const currentWorkoutName = currentPose.name;

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-gray-200 rounded-lg shadow-inner mb-4">
            <PixelArt frame={currentFrame} />
        </div>
        <p className="text-xl font-semibold text-primary-700 h-8 animate-pulse">
            {currentWorkoutName}
        </p>
        <p className="mt-2 text-sm text-gray-600 min-h-[40px]">
            {statusMessage || "Analyzing videos, identifying exercises & timings..."}
        </p>
    </div>
  );
};

export default WorkoutLoader;
