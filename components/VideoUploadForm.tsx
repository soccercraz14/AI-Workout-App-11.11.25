
import React, { useState, useRef, useCallback } from 'react';
import { VideoCameraIcon, ArrowUpTrayIcon, SparklesIcon, TrashIcon } from './icons';
import { VideoAnalysisPayload } from '../App';

export interface VideoPreview {
  id: string;
  file: File;
}

interface VideoUploadFormProps {
  onAnalyzeVideos: (payload: VideoAnalysisPayload[], useProModel: boolean) => void;
  isLoading: boolean;
}

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const VideoUploadForm: React.FC<VideoUploadFormProps> = ({ onAnalyzeVideos, isLoading }) => {
  const [videos, setVideos] = useState<VideoPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useAdvancedAnalysis, setUseAdvancedAnalysis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFilesArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    newFilesArray.forEach(file => {
      if (videos.some(v => v.file.name === file.name && v.file.lastModified === file.lastModified)) {
        // Skip duplicate
        return;
      }
      if (!file.type.startsWith('video/')) {
        errors.push(`${file.name}: Invalid file type. Must be a video.`);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name}: File is too large (max ${MAX_FILE_SIZE_MB}MB).`);
      } else {
        validFiles.push(file);
      }
    });

    const newVideoPreviews: VideoPreview[] = validFiles.map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
    }));

    setVideos(prev => [...prev, ...newVideoPreviews]);
    setError(errors.length > 0 ? errors.join(' ') : null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
  };
  
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    processFiles(event.dataTransfer.files);
  }, [videos]);

  const handleRemoveVideo = useCallback((id: string) => {
    setVideos(currentVideos => currentVideos.filter(v => v.id !== id));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videos.length > 0) {
      const payload: VideoAnalysisPayload[] = videos.map(({ file }) => ({ file }));
      onAnalyzeVideos(payload, useAdvancedAnalysis);
      setVideos([]); 
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
    } else {
      setError('Please select one or more video files first.');
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleClearSelected = () => {
    setVideos([]);
    setError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-lg space-y-4 mb-8">
      <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
        <VideoCameraIcon className="w-7 h-7 mr-3 text-primary-600" />
        Upload Videos
      </h2>
      
      {videos.length === 0 ? (
        <div 
          className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-primary-500 transition-colors"
          onClick={handleButtonClick}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Video upload area, click or drag and drop files"
        >
          <div className="space-y-1 text-center">
            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600">
              <span className="relative bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                <span>Upload files</span>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.wmv" multiple onChange={handleFileChange} ref={fileInputRef} />
              </span>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">MP4, MOV, AVI, WebM, etc. Max {MAX_FILE_SIZE_MB}MB each.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="space-y-2">
                <h3 className="text-md font-semibold text-gray-700">Selected Files ({videos.length})</h3>
                <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-lg border">
                    {videos.map(video => (
                        <div key={video.id} className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate" title={video.file.name}>
                                    {video.file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    ({(video.file.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveVideo(video.id)}
                                className="ml-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                aria-label={`Remove ${video.file.name}`}
                                title={`Remove ${video.file.name}`}
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <button
                type="button"
                onClick={handleButtonClick}
                className="w-full text-sm text-primary-600 hover:text-primary-800 py-2 border border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition-colors">
                + Add more videos...
            </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>
      )}
      
      <div className="relative flex items-start">
        <div className="flex items-center h-5">
          <input
            id="advanced-analysis"
            name="advanced-analysis"
            type="checkbox"
            checked={useAdvancedAnalysis}
            onChange={(e) => setUseAdvancedAnalysis(e.target.checked)}
            className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="advanced-analysis" className="font-medium text-gray-700">
            Use Advanced Analysis (Pro)
          </label>
          <p className="text-gray-500">
            Slower, but provides more detailed exercise descriptions and form tips.
          </p>
        </div>
      </div>

      <div className="pt-2 space-y-3">
        {videos.length > 0 && (
          <button 
              type="button" 
              onClick={handleClearSelected}
              className="w-full text-sm text-center text-red-500 hover:text-red-700"
          >
              Clear All ({videos.length})
          </button>
        )}
        <button
          type="submit"
          disabled={videos.length === 0 || isLoading}
          className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SparklesIcon className="w-5 h-5 mr-2" />
          {isLoading ? `Analyzing ${videos.length} Video(s)...` : `Analyze ${videos.length > 0 ? videos.length : ''} Video(s)`}
        </button>
      </div>
    </form>
  );
};

export default VideoUploadForm;
