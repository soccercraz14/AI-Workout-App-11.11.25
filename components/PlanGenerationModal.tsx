
import React, { useState } from 'react';
import { SparklesIcon } from './icons';

interface PlanGenerationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onGenerate: (options: { goal: string; trainingDays: number; useProModel: boolean }) => void;
  isLoading: boolean;
}

const goals = [
  "Build Muscle (Hypertrophy)",
  "Increase Strength",
  "Improve Endurance",
  "General Fitness & Fat Loss"
];

const trainingDaysOptions = [3, 4, 5];

const PlanGenerationModal: React.FC<PlanGenerationModalProps> = ({ isVisible, onClose, onGenerate, isLoading }) => {
  const [goal, setGoal] = useState(goals[0]);
  const [trainingDays, setTrainingDays] = useState(4);
  const [useProModel, setUseProModel] = useState(false);

  if (!isVisible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({ goal, trainingDays, useProModel });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-primary-700">Customize Your Plan</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-full" aria-label="Close">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-gray-600 mb-6">Tell the AI what you're training for to get a better plan.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-2">
              What is your primary goal?
            </label>
            <select
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              {goals.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">How many days per week can you train?</span>
            <div className="flex space-x-2">
              {trainingDaysOptions.map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTrainingDays(days)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                    trainingDays === days
                      ? 'bg-primary-600 text-white shadow'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-start">
            <div className="flex items-center h-5">
              <input
                id="pro-model"
                name="pro-model"
                type="checkbox"
                checked={useProModel}
                onChange={(e) => setUseProModel(e.target.checked)}
                className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="pro-model" className="font-medium text-gray-700">
                Use Pro Model (Advanced)
              </label>
              <p className="text-gray-500">
                Slower, but creates a more detailed, higher-quality plan using AI thinking mode.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
            >
              <SparklesIcon className="w-5 h-5 mr-2" />
              {isLoading ? 'Generating...' : 'Generate My Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanGenerationModal;
