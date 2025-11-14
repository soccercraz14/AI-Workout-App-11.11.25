
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
    <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-5 space-y-4 border border-gray-800">
      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.wmv" multiple onChange={handleFileChange} ref={fileInputRef} />

      <div
        className="w-full"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={handleButtonClick}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 border border-gray-700"
        >
          <ArrowUpTrayIcon className="w-5 h-5" />
          <span>Click to Upload Videos</span>
        </button>
      </div>

      {videos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-white">Selected: {videos.length}</span>
            <button
              type="button"
              onClick={handleClearSelected}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1.5">
            {videos.map(video => (
              <div key={video.id} className="flex items-center justify-between p-2 bg-gray-950 rounded-lg border border-gray-800">
                <span className="text-xs text-white truncate flex-1" title={video.file.name}>
                  {video.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveVideo(video.id)}
                  className="ml-2 p-1 text-gray-500 hover:text-red-400 transition-all"
                  aria-label={`Remove ${video.file.name}`}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded-lg border border-red-900/30" role="alert">{error}</p>
      )}

      <div className="flex items-center space-x-2 bg-gray-900/50 p-3 rounded-xl border border-gray-800">
        <input
          id="advanced-analysis"
          name="advanced-analysis"
          type="checkbox"
          checked={useAdvancedAnalysis}
          onChange={(e) => setUseAdvancedAnalysis(e.target.checked)}
          className="w-4 h-4 text-white bg-gray-800 border-gray-700 rounded focus:ring-2 focus:ring-gray-600"
        />
        <label htmlFor="advanced-analysis" className="text-xs font-semibold text-white flex items-center">
          Advanced Analysis
          <span className="ml-1.5 text-[9px] bg-gradient-to-r from-white to-gray-400 text-black px-1.5 py-0.5 rounded-full font-bold">PRO</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={videos.length === 0 || isLoading}
        className="w-full flex items-center justify-center px-6 py-3 text-sm font-bold rounded-xl shadow-lg bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <SparklesIcon className="w-5 h-5 mr-2" />
        {isLoading ? `Analyzing...` : videos.length > 0 ? `Analyze ${videos.length} Video${videos.length > 1 ? 's' : ''}` : 'Analyze Videos'}
      </button>
    </form>
  );
};

export default VideoUploadForm;
