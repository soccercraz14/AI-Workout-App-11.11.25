
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
    <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 space-y-6 border border-gray-800">
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-br from-white to-gray-400 p-2.5 rounded-xl">
          <VideoCameraIcon className="w-6 h-6 text-black" />
        </div>
        <h2 className="text-2xl font-bold text-white">Upload Videos</h2>
      </div>

      {videos.length === 0 ? (
        <div
          className="mt-1 flex justify-center px-6 py-12 border-2 border-gray-700 border-dashed rounded-2xl cursor-pointer hover:border-gray-600 hover:bg-gray-900/50 transition-all"
          onClick={handleButtonClick}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Video upload area, click or drag and drop files"
        >
          <div className="space-y-3 text-center">
            <ArrowUpTrayIcon className="mx-auto h-16 w-16 text-gray-600" />
            <div className="text-gray-300">
              <span className="font-semibold text-white">Click to upload</span>
              <span className="text-gray-500"> or drag and drop</span>
            </div>
            <p className="text-sm text-gray-500">MP4, MOV, AVI, WebM • Max {MAX_FILE_SIZE_MB}MB each</p>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.wmv" multiple onChange={handleFileChange} ref={fileInputRef} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Selected Files</h3>
              <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
                {videos.length} {videos.length === 1 ? 'video' : 'videos'}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-gray-950 rounded-xl border border-gray-800">
                {videos.map(video => (
                    <div key={video.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition-all">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate" title={video.file.name}>
                                {video.file.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {(video.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleRemoveVideo(video.id)}
                            className="ml-3 p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all"
                            aria-label={`Remove ${video.file.name}`}
                            title={`Remove ${video.file.name}`}
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={handleButtonClick}
                className="w-full text-sm text-gray-400 hover:text-white py-3 border border-dashed border-gray-700 rounded-xl hover:border-gray-600 hover:bg-gray-900/50 transition-all font-medium">
                + Add more videos
            </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 p-3 rounded-xl border border-red-900/30" role="alert">{error}</p>
      )}

      <div className="relative flex items-start bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex items-center h-5">
          <input
            id="advanced-analysis"
            name="advanced-analysis"
            type="checkbox"
            checked={useAdvancedAnalysis}
            onChange={(e) => setUseAdvancedAnalysis(e.target.checked)}
            className="w-4 h-4 text-white bg-gray-800 border-gray-700 rounded focus:ring-2 focus:ring-gray-600"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="advanced-analysis" className="font-semibold text-white flex items-center">
            Advanced Analysis <span className="ml-2 text-xs bg-gradient-to-r from-white to-gray-400 text-black px-2 py-0.5 rounded-full font-bold">PRO</span>
          </label>
          <p className="text-gray-400 text-xs mt-1">
            Slower, but provides more detailed descriptions and form tips
          </p>
        </div>
      </div>

      <div className="pt-2 space-y-3">
        {videos.length > 0 && (
          <button
              type="button"
              onClick={handleClearSelected}
              className="w-full text-sm text-center text-red-400 hover:text-red-300 py-2"
          >
              Clear All ({videos.length})
          </button>
        )}
        <button
          type="submit"
          disabled={videos.length === 0 || isLoading}
          className="w-full flex items-center justify-center px-6 py-4 text-base font-bold rounded-2xl shadow-lg bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SparklesIcon className="w-5 h-5 mr-2" />
          {isLoading ? `Analyzing ${videos.length} Video${videos.length > 1 ? 's' : ''}...` : `Analyze ${videos.length > 0 ? videos.length : ''} Video${videos.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  );
};

export default VideoUploadForm;
