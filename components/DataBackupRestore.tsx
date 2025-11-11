import React, { useState, useRef } from 'react';
import { CloudArrowDownIcon, CloudArrowUpIcon } from './icons';
import * as apiService from '../services/apiService';
import { FullUserDataBackup } from '../types';

interface DataBackupRestoreProps {
  onRestore: () => Promise<void>; // Function to trigger a data reload in the parent component
}

const DataBackupRestore: React.FC<DataBackupRestoreProps> = ({ onRestore }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setSuccess('Generating backup... this may take a while for large video libraries.');
    try {
      const data = await apiService.getAllUserDataForBackup();
      const jsonString = JSON.stringify(data); // No pretty-print to save space
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-workout-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(`Data backup successful! File size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to create backup: ${message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      setError('Invalid file type. Please select a .json backup file.');
      return;
    }

    const isConfirmed = window.confirm(
      'Are you sure you want to restore from this file? This will OVERWRITE all existing exercises, plans, and videos on this device. This action cannot be undone.'
    );

    if (!isConfirmed) {
        setSuccess('Restore operation was cancelled.');
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    setIsLoading(true);
    setSuccess('Restoring data... This can take a long time depending on the backup file size. Please do not close this tab.');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Failed to read file.');
        
        const data = JSON.parse(text) as FullUserDataBackup;

        // Basic validation to ensure the file is in the correct format
        if (!data || !Array.isArray(data.exercises) || !Array.isArray(data.savedPlans)) {
            throw new Error('Invalid backup file format. The file does not contain the expected data.');
        }

        const restoreSummary = await apiService.restoreUserData(data);
        setSuccess(`Restore complete! ${restoreSummary.exerciseCount} exercises, ${restoreSummary.planCount} plans, and ${restoreSummary.videoCount} videos have been restored. Refreshing data...`);
        // Trigger a full data reload in the main App component
        await onRestore();

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse or restore the backup file.');
        console.error(err);
      } finally {
         setIsLoading(false);
         if (fileInputRef.current) {
            // Clear the file input so the user can select the same file again if needed
            fileInputRef.current.value = ""; 
         }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mt-6 p-5 bg-white rounded-xl shadow-xl">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Data Portability</h3>
      <p className="text-sm text-gray-600 mb-4">
        Create a complete, portable backup of all your data, including exercises, plans, and video clips.
        Move this file to another device and restore it to have an identical setup.
        <strong className="block mt-1 text-red-600">Warning: Backup files can be very large. The backup and restore process may take a long time.</strong>
      </p>
      
      {error && <p className="text-sm text-red-700 bg-red-100 p-2 rounded-md mb-2">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-100 p-2 rounded-md mb-2">{success}</p>}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleBackup}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <CloudArrowDownIcon className="w-5 h-5 mr-2" />
          {isLoading ? 'Processing...' : 'Backup All Data'}
        </button>
        <button
          onClick={handleRestoreClick}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <CloudArrowUpIcon className="w-5 h-5 mr-2" />
          {isLoading ? 'Processing...' : 'Restore from File'}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/json,.json"
          className="hidden"
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default DataBackupRestore;