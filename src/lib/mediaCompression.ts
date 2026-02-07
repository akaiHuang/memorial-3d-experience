/**
 * Media compression utilities using Firebase Cloud Functions
 */

// Replace with your deployed function URLs after deployment
const COMPRESS_IMAGE_URL = process.env.NEXT_PUBLIC_COMPRESS_IMAGE_URL || '';
const COMPRESS_AUDIO_URL = process.env.NEXT_PUBLIC_COMPRESS_AUDIO_URL || '';

// Target file size: 1-2MB (we aim for under 1.5MB to be safe)
const TARGET_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5MB
const MIN_QUALITY = 20; // Don't go below this quality
const MIN_WIDTH = 800; // Don't go below this width

/**
 * Compress image using Cloud Function
 * Falls back to client-side compression if Cloud Function is unavailable
 */
export async function compressImage(file: File, options?: {
  maxWidth?: number;
  quality?: number;
  targetSize?: number;
}): Promise<File> {
  const { maxWidth = 1600, quality = 85, targetSize = TARGET_SIZE_BYTES } = options || {};
  
  // If Cloud Function URL is configured, use it
  if (COMPRESS_IMAGE_URL) {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('maxWidth', String(maxWidth));
      formData.append('quality', String(quality));
      
      const response = await fetch(COMPRESS_IMAGE_URL, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const blob = await response.blob();
        return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { 
          type: 'image/webp' 
        });
      }
    } catch (error) {
      console.warn('Cloud Function compression failed, falling back to client-side:', error);
    }
  }
  
  // Fallback to client-side compression with size target
  return compressImageClientSide(file, { maxWidth, quality, targetSize });
}

/**
 * Client-side image compression using Canvas API
 * Iteratively reduces quality and size until target file size is reached
 */
export async function compressImageClientSide(file: File, options?: {
  maxWidth?: number;
  quality?: number;
  targetSize?: number;
}): Promise<File> {
  const { maxWidth = 1600, quality = 85, targetSize = TARGET_SIZE_BYTES } = options || {};
  
  // Start with initial settings
  let currentMaxWidth = maxWidth;
  let currentQuality = quality;
  let result = await compressOnce(file, currentMaxWidth, currentQuality);
  
  console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)}MB, Initial compression: ${(result.size / 1024 / 1024).toFixed(2)}MB`);
  
  // If already small enough, return
  if (result.size <= targetSize) {
    return result;
  }
  
  // Iteratively reduce quality first
  while (result.size > targetSize && currentQuality > MIN_QUALITY) {
    currentQuality = Math.max(MIN_QUALITY, currentQuality - 10);
    result = await compressOnce(file, currentMaxWidth, currentQuality);
    console.log(`Quality ${currentQuality}%: ${(result.size / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // If still too large, reduce dimensions
  while (result.size > targetSize && currentMaxWidth > MIN_WIDTH) {
    currentMaxWidth = Math.max(MIN_WIDTH, currentMaxWidth - 200);
    // Try with higher quality first when reducing size
    currentQuality = 70;
    result = await compressOnce(file, currentMaxWidth, currentQuality);
    console.log(`Size ${currentMaxWidth}px, quality ${currentQuality}%: ${(result.size / 1024 / 1024).toFixed(2)}MB`);
    
    // If still too large at this size, reduce quality again
    while (result.size > targetSize && currentQuality > MIN_QUALITY) {
      currentQuality = Math.max(MIN_QUALITY, currentQuality - 10);
      result = await compressOnce(file, currentMaxWidth, currentQuality);
      console.log(`Size ${currentMaxWidth}px, quality ${currentQuality}%: ${(result.size / 1024 / 1024).toFixed(2)}MB`);
    }
  }
  
  console.log(`Final: ${(result.size / 1024 / 1024).toFixed(2)}MB (${currentMaxWidth}px, quality ${currentQuality}%)`);
  return result;
}

/**
 * Single compression pass
 */
async function compressOnce(file: File, maxWidth: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File(
              [blob], 
              file.name.replace(/\.[^.]+$/, '.webp'), 
              { type: 'image/webp' }
            );
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/webp',
        quality / 100
      );
      
      // Clean up
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Compress audio using Cloud Function
 */
export async function compressAudio(blob: Blob, options?: {
  bitrate?: string;
}): Promise<Blob> {
  const { bitrate = '64k' } = options || {};
  
  if (!COMPRESS_AUDIO_URL) {
    console.warn('Audio compression Cloud Function not configured');
    return blob;
  }
  
  try {
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');
    formData.append('bitrate', bitrate);
    
    const response = await fetch(COMPRESS_AUDIO_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (response.ok) {
      return await response.blob();
    }
  } catch (error) {
    console.warn('Audio compression failed:', error);
  }
  
  return blob;
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
