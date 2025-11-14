/**
 * Video utility functions for compression, thumbnail generation, and hashing
 */

/**
 * Generate a thumbnail from a video file
 * @param videoFile The video file to generate thumbnail from
 * @param timeInSeconds Time position to capture thumbnail (default: 1s)
 * @returns Blob containing the thumbnail image
 */
export const generateThumbnail = async (
  videoFile: File,
  timeInSeconds: number = 1
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Set canvas size to video dimensions (max 400px width for smaller thumbnails)
      const maxWidth = 400;
      const scale = maxWidth / video.videoWidth;
      canvas.width = maxWidth;
      canvas.height = video.videoHeight * scale;

      // Seek to the specified time
      video.currentTime = Math.min(timeInSeconds, video.duration / 2);
    };

    video.onseeked = () => {
      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            URL.revokeObjectURL(video.src);
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail blob'));
          }
        },
        'image/jpeg',
        0.8 // Quality
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video for thumbnail'));
    };

    // Load the video
    video.src = URL.createObjectURL(videoFile);
  });
};

/**
 * Compress a video file (simple implementation using canvas re-encoding)
 * Note: For better compression, consider using ffmpeg.wasm in the future
 * @param videoFile The video file to compress
 * @param quality Quality factor (0.1 to 1.0)
 * @returns Compressed video file
 */
export const compressVideo = async (
  videoFile: File,
  quality: number = 0.7
): Promise<File> => {
  // For now, we'll implement a simple check:
  // If video is already small enough (< 50MB), don't compress
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (videoFile.size <= maxSize) {
    console.log(`Video ${videoFile.name} is already small enough (${(videoFile.size / 1024 / 1024).toFixed(2)}MB), skipping compression`);
    return videoFile;
  }

  console.log(`Video ${videoFile.name} is ${(videoFile.size / 1024 / 1024).toFixed(2)}MB, compression would be applied here`);

  // TODO: Implement actual video compression using ffmpeg.wasm or MediaRecorder API
  // For now, return the original file
  // This is a placeholder that you can enhance later with actual compression
  return videoFile;
};

/**
 * Generate a hash of a video file for caching purposes
 * Uses a simple approach: hash based on file size, name, and first chunk
 * @param file The video file
 * @returns Hash string
 */
export const generateVideoHash = async (file: File): Promise<string> => {
  // Read first 64KB of the file for hashing
  const chunkSize = 64 * 1024;
  const chunk = file.slice(0, Math.min(chunkSize, file.size));

  const arrayBuffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Combine with file metadata for better uniqueness
  const metadata = `${file.name}-${file.size}-${file.lastModified}`;
  const combined = `${hashHex}-${metadata}`;

  return combined;
};

/**
 * Trim a video file to a specific time range
 * @param videoFile The video file to trim
 * @param startTime Start time in seconds
 * @param endTime End time in seconds
 * @returns Trimmed video file
 */
export const trimVideo = async (
  videoFile: File,
  startTime: number,
  endTime: number
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      try {
        // Validate times
        const duration = video.duration;
        const validStart = Math.max(0, Math.min(startTime, duration));
        const validEnd = Math.max(validStart, Math.min(endTime, duration));

        // Use MediaRecorder to capture the trimmed portion
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Create a stream from canvas
        const stream = canvas.captureStream(30); // 30 fps
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 2500000, // 2.5 Mbps
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const trimmedFile = new File(
            [blob],
            `trimmed_${videoFile.name}`,
            { type: 'video/webm' }
          );
          URL.revokeObjectURL(video.src);
          resolve(trimmedFile);
        };

        // Start recording
        mediaRecorder.start();
        video.currentTime = validStart;

        // Draw frames
        const drawFrame = () => {
          if (video.currentTime < validEnd) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          } else {
            mediaRecorder.stop();
            video.pause();
          }
        };

        video.onseeked = () => {
          video.play();
          drawFrame();
        };
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video for trimming'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
};

/**
 * Get video duration
 * @param videoFile The video file
 * @returns Duration in seconds
 */
export const getVideoDuration = async (videoFile: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
};
