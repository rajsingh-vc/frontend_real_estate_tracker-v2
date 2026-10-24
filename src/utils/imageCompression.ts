/**
 * Image and File compression utilities for Real Estate Tracker.
 * 
 * Enforces a 50 MB size limit for all uploads. If a photo/image exceeds 50 MB,
 * it is automatically compressed down to high-definition quality under 50 MB
 * before uploading to the server, preserving full visual fidelity for reports.
 */

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFile(file: File): boolean {
  if (file.type && file.type.toLowerCase().startsWith("image/")) {
    return true;
  }
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif") ||
    name.endsWith(".bmp") ||
    name.endsWith(".tiff") ||
    name.endsWith(".svg")
  );
}

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/**
 * Validates file size against the 50 MB limit.
 * If the file is an image exceeding 50 MB, automatically compresses it client-side
 * down to a crisp, high-resolution photo under 50 MB.
 */
export async function processFileForUpload(
  file: File,
  maxSizeBytes: number = MAX_UPLOAD_SIZE_BYTES
): Promise<CompressionResult> {
  // If file is already within 50MB limit, no compression needed
  if (file.size <= maxSizeBytes) {
    return {
      file,
      wasCompressed: false,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  // If file is not an image and exceeds 50MB, reject with friendly error
  if (!isImageFile(file)) {
    throw new Error(
      `File "${file.name}" (${formatBytes(file.size)}) exceeds the 50 MB upload limit.`
    );
  }

  // File is an image > 50MB: compress it client-side
  return compressImage(file, maxSizeBytes);
}

/**
 * Compresses an image file using an offscreen canvas.
 * Progressively optimizes dimensions and JPEG quality to ensure the result is under maxSizeBytes.
 */
async function compressImage(
  file: File,
  maxSizeBytes: number
): Promise<CompressionResult> {
  const originalSize = file.size;
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image for compression."));
      image.src = objectUrl;
    });

    let { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) {
      width = img.width || 3840;
      height = img.height || 2160;
    }

    // High-resolution ceiling: 4K UHD (3840px max dimension)
    const MAX_DIM = 3840;
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context is not available for image compression.");
    }

    // High quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    // Progressive quality attempt starting at 0.88 down to 0.70
    let quality = 0.88;
    let blob: Blob | null = null;

    while (quality >= 0.5) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", quality);
      });

      if (blob && blob.size <= maxSizeBytes) {
        break;
      }
      // If still above 50MB, decrease quality and slightly downscale
      quality -= 0.12;
      if (quality < 0.5 && blob && blob.size > maxSizeBytes) {
        // Halve dimensions as final safety fallback
        canvas.width = Math.round(canvas.width * 0.75);
        canvas.height = Math.round(canvas.height * 0.75);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        quality = 0.8;
      }
    }

    if (!blob || blob.size > maxSizeBytes) {
      throw new Error(
        `Unable to compress "${file.name}" to under 50 MB (compressed size: ${formatBytes(blob?.size || 0)}).`
      );
    }

    // Build the replacement File object with original name and .jpg extension if needed
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const compressedFileName = `${baseName}.jpg`;
    const compressedFile = new File([blob], compressedFileName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      wasCompressed: true,
      originalSize,
      compressedSize: compressedFile.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
