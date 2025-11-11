
import React from 'react';
import { SavedWorkoutPlanEntry } from '../types';
import { TrashIcon, VideoCameraIcon as EyeIcon } from './icons'; // Reusing VideoCameraIcon as an "Eye" icon for view

interface SavedPlansListProps {
  savedPlans: SavedWorkoutPlanEntry[];
  onViewPlan: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
  isLoading: boolean;
}

const SavedPlansList: React.FC<SavedPlansListProps> = ({ savedPlans, onViewPlan, onDeletePlan, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">Loading saved plans...</p>
      </div>
    );
  }
  
  if (savedPlans.length === 0) {
    return (
      <div className="text-center py-6 px-6 bg-white rounded-xl shadow-lg mt-6">
        <p className="text-gray-500">No workout plans saved yet.</p>
        <p className="text-xs text-gray-400 mt-1">Generate a plan and click the save icon to store it here.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-5 bg-white rounded-xl shadow-xl">
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Your Saved Workout Plans</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {savedPlans.slice().sort((a,b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).map((entry) => (
          <div key={entry.id} className="p-3 bg-gray-50 rounded-lg shadow-sm flex justify-between items-center">
            <div>
              <h4 className="font-medium text-primary-700">{entry.name}</h4>
              <p className="text-xs text-gray-500">
                Saved: {new Date(entry.savedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onViewPlan(entry.id)}
                className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
                aria-label={`View plan: ${entry.name}`}
                title="View Plan"
              >
                <EyeIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDeletePlan(entry.id)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors"
                aria-label={`Delete plan: ${entry.name}`}
                title="Delete Plan"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedPlansList;
