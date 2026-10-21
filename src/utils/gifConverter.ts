import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type CropShape = 'square' | 'circle' | 'rounded';

export interface CropSettings {
  shape: CropShape;
  zoom: number; // 1 to 3
  panX: number; // -1 to 1 normalized offset
  panY: number; // -1 to 1 normalized offset
}

/**
 * Clips canvas context to the specified preset shape
 */
function applyClipShape(ctx: CanvasRenderingContext2D, width: number, height: number, shape: CropShape) {
  ctx.beginPath();
  if (shape === 'circle') {
    const radius = Math.min(width, height) / 2;
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  } else if (shape === 'rounded') {
    const r = Math.min(width, height) * 0.22;
    ctx.roundRect(0, 0, width, height, r);
    ctx.closePath();
    ctx.clip();
  } else {
    // Square
    ctx.rect(0, 0, width, height);
    ctx.closePath();
    ctx.clip();
  }
}

/**
 * Draws image/video source onto target canvas using crop settings
 */
export function drawCroppedSource(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetSize: number,
  settings: CropSettings
) {
  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.save();

  // Apply clipping shape
  applyClipShape(ctx, targetSize, targetSize, settings.shape);

  // Calculate scaling so image fills the square crop box
  const baseScale = Math.max(targetSize / sourceWidth, targetSize / sourceHeight);
  const finalScale = baseScale * settings.zoom;

  const drawWidth = sourceWidth * finalScale;
  const drawHeight = sourceHeight * finalScale;

  // Center plus pan offset
  const maxPanX = Math.max(0, (drawWidth - targetSize) / 2);
  const maxPanY = Math.max(0, (drawHeight - targetSize) / 2);

  const drawX = (targetSize - drawWidth) / 2 + settings.panX * maxPanX;
  const drawY = (targetSize - drawHeight) / 2 + settings.panY * maxPanY;

  ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

/**
 * Crops a static image file to a PNG/WebP Data URL
 */
export async function cropStaticImage(
  imageSource: HTMLImageElement,
  settings: CropSettings,
  targetSize: number = 256
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  drawCroppedSource(
    ctx,
    imageSource,
    imageSource.naturalWidth || imageSource.width,
    imageSource.naturalHeight || imageSource.height,
    targetSize,
    settings
  );

  return canvas.toDataURL('image/png');
}

/**
 * Converts an MP4 video or looping video (< 10s) into an animated GIF
 */
export async function convertVideoToGif(
  video: HTMLVideoElement,
  settings: CropSettings,
  targetSize: number = 240,
  onProgress?: (percent: number) => void
): Promise<string> {
  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    throw new Error('Could not determine video duration.');
  }

  if (duration > 10.05) {
    throw new Error(`Video duration is ${duration.toFixed(1)}s. MP4 must be less than 10 seconds!`);
  }

  const fps = 10; // 10 frames per second gives smooth animation and reasonable GIF file size
  const totalFrames = Math.max(2, Math.floor(duration * fps));
  const frameDelay = Math.round(1000 / fps);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas context');

  const gif = GIFEncoder();
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  // Store original video time
  const origTime = video.currentTime;

  for (let i = 0; i < totalFrames; i++) {
    const targetTime = (i / totalFrames) * duration;
    await seekVideo(video, targetTime);

    // Draw frame onto cropped canvas
    ctx.clearRect(0, 0, targetSize, targetSize);
    drawCroppedSource(ctx, video, sourceWidth, sourceHeight, targetSize, settings);

    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const { data } = imageData;

    // Palette quantization using gifenc
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, targetSize, targetSize, {
      palette,
      delay: frameDelay,
      transparent: settings.shape === 'circle' ? true : false,
    });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFrames) * 100));
    }
  }

  gif.finish();
  video.currentTime = origTime;

  const bytes = gif.bytes();
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}
