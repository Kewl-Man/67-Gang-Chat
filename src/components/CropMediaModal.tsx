import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Square, Circle, Sparkles, AlertCircle, ZoomIn, ZoomOut, Check, Film, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { cropStaticImage, convertVideoToGif, CropShape, CropSettings } from '../utils/gifConverter.ts';

interface CropMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  mediaType: 'emoji' | 'gif';
  onSave: (payload: { name: string; type: 'emoji' | 'gif'; dataUrl: string; shape: CropShape | 'original' }) => Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CropMediaModal: React.FC<CropMediaModalProps> = ({
  isOpen,
  onClose,
  file,
  mediaType,
  onSave,
}) => {
  const [name, setName] = useState<string>('');
  const [shape, setShape] = useState<CropShape | 'original'>(mediaType === 'gif' ? 'original' : 'square');
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [isGifFile, setIsGifFile] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!file) return;

    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase()
      .slice(0, 24);
    setName(cleanName || (mediaType === 'emoji' ? 'custom_emoji' : 'custom_gif'));

    const isMp4 = file.type.includes('mp4') || file.name.endsWith('.mp4');
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    setIsVideo(isMp4);
    setIsGifFile(isGif);
    setShape(mediaType === 'gif' ? 'original' : 'square');
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setDurationError(null);
    setErrorMessage(null);
    setProgressPercent(0);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, mediaType]);

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setVideoDuration(dur);
      if (dur > 10.05) {
        setDurationError(`This video is ${dur.toFixed(1)}s long. MP4 must be 10 seconds or less!`);
      } else {
        setDurationError(null);
      }
    }
  };

  const updateCanvasPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const source = isVideo ? videoRef.current : imageRef.current;
    if (!source) return;

    const sourceW = isVideo ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).naturalWidth;
    const sourceH = isVideo ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).naturalHeight;
    if (!sourceW || !sourceH) return;

    const size = 280;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      ctx.roundRect(0, 0, size, size, size * 0.22);
    } else if (shape === 'square') {
      ctx.rect(0, 0, size, size);
    } else {
      // Original aspect ratio
      const ratio = sourceW / sourceH;
      let w = size;
      let h = size;
      if (ratio > 1) {
        h = size / ratio;
      } else {
        w = size * ratio;
      }
      ctx.rect((size - w) / 2, (size - h) / 2, w, h);
    }
    ctx.closePath();
    ctx.clip();

    const baseScale = Math.max(size / sourceW, size / sourceH);
    const finalScale = baseScale * zoom;
    const drawW = sourceW * finalScale;
    const drawH = sourceH * finalScale;

    const maxPanX = Math.max(0, (drawW - size) / 2);
    const maxPanY = Math.max(0, (drawH - size) / 2);

    const drawX = (size - drawW) / 2 + pan.x * maxPanX;
    const drawY = (size - drawH) / 2 + pan.y * maxPanY;

    ctx.drawImage(source, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [isVideo, shape, zoom, pan]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      updateCanvasPreview();
      if (isVideo && videoRef.current && !videoRef.current.paused) {
        animId = requestAnimationFrame(loop);
      }
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [updateCanvasPreview, isVideo]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const factor = 0.015 / zoom;
    setPan({
      x: Math.max(-1, Math.min(1, dragStartRef.current.startPanX + dx * factor)),
      y: Math.max(-1, Math.min(1, dragStartRef.current.startPanY + dy * factor)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDone = async () => {
    if (!name.trim()) {
      setErrorMessage('Please give your creation a name!');
      return;
    }
    if (durationError) {
      setErrorMessage(durationError);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const settings: CropSettings = {
      shape: shape === 'original' ? 'square' : shape,
      zoom,
      panX: pan.x,
      panY: pan.y,
    };

    try {
      let finalDataUrl = '';

      if (isGifFile && file) {
        // PRESERVE ANIMATED GIF: Always keep the genuine animated GIF file!
        finalDataUrl = await readFileAsDataUrl(file);
      } else if (isVideo && videoRef.current) {
        // Convert MP4 to animated looping GIF using gifenc
        finalDataUrl = await convertVideoToGif(videoRef.current, settings, 240, (pct) => {
          setProgressPercent(pct);
        });
      } else if (imageRef.current) {
        // Static image (e.g. PNG / JPG) for custom emoji
        finalDataUrl = await cropStaticImage(imageRef.current, settings, 140);
      }

      if (!finalDataUrl) {
        throw new Error('Failed to generate media.');
      }

      await onSave({
        name: name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        type: mediaType,
        dataUrl: finalDataUrl,
        shape,
      });

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process media';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-lg bg-[#141824] border border-[#2a344d] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#22283a] bg-[#171c2c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md">
              {mediaType === 'emoji' ? <ImageIcon className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Crop & Customize {mediaType === 'emoji' ? '67 Gang Emoji' : '67 Gang GIF'}</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {mediaType === 'emoji' ? 'Emoji' : 'GIF'}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isGifFile
                  ? 'Animated GIF detected! Animation will be 100% preserved.'
                  : mediaType === 'emoji'
                  ? 'Pick a shape & zoom. Available to all classmates.'
                  : 'MP4s under 10s are auto-converted to looping GIFs!'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#232b40] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden sources */}
        <div className="hidden">
          {isVideo ? (
            <video
              ref={videoRef}
              src={previewUrl || ''}
              onLoadedMetadata={handleVideoLoadedMetadata}
              autoPlay
              loop
              muted
              playsInline
              crossOrigin="anonymous"
            />
          ) : (
            <img
              ref={imageRef}
              src={previewUrl || ''}
              onLoad={updateCanvasPreview}
              alt="Source"
              crossOrigin="anonymous"
            />
          )}
        </div>

        {/* Main Content Area */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {(errorMessage || durationError) && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage || durationError}</span>
            </div>
          )}

          {isVideo && videoDuration !== null && (
            <div className="flex items-center justify-between text-xs px-3 py-2 bg-[#0e121c] rounded-xl border border-[#21293c]">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-indigo-400" />
                Video Duration:
              </span>
              <span
                className={`font-mono font-bold ${
                  videoDuration > 10.05 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {videoDuration.toFixed(1)}s / 10.0s max
              </span>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Name your {mediaType === 'emoji' ? 'emoji' : 'GIF'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-mono text-xs">
                :
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="name"
                maxLength={25}
                className="w-full bg-[#0d101a] border border-[#242b3d] text-white text-sm rounded-xl pl-6 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition-all"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 font-mono text-xs">
                :
              </span>
            </div>
          </div>

          {/* Interactive Crop Viewport */}
          <div className="flex flex-col items-center justify-center">
            {isGifFile && shape === 'original' ? (
              // Direct animated GIF preview
              <div className="relative max-w-[280px] max-h-[280px] bg-[#090b12] rounded-2xl border-2 border-indigo-500/40 shadow-inner flex items-center justify-center overflow-hidden p-2">
                <img
                  src={previewUrl || ''}
                  alt="Animated GIF Preview"
                  className="max-h-[260px] object-contain rounded-lg"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/80 text-[10px] font-bold text-white shadow-sm">
                  Animated GIF
                </div>
              </div>
            ) : (
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`relative w-[280px] h-[280px] bg-[#090b12] rounded-2xl border-2 border-indigo-500/40 shadow-inner flex items-center justify-center overflow-hidden ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={280}
                  className="pointer-events-none drop-shadow-md"
                />
                <div
                  className={`absolute inset-0 pointer-events-none border border-white/20 transition-all ${
                    shape === 'circle'
                      ? 'rounded-full'
                      : shape === 'rounded'
                      ? 'rounded-[22%]'
                      : 'rounded-none'
                  }`}
                />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-zinc-400 pointer-events-none">
                  Drag to reposition
                </div>
              </div>
            )}
          </div>

          {/* Zoom Slider (if not original GIF) */}
          {(!isGifFile || shape !== 'original') && (
            <div className="bg-[#0e121d] p-3 rounded-xl border border-[#20273a] flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <ZoomIn className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-xs font-mono text-zinc-400 w-10 text-right">{zoom.toFixed(1)}x</span>
            </div>
          )}

          {/* Preset Shapes Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Crop Shape</label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setShape('original')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                  shape === 'original'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-[#101420] text-zinc-400 border-[#222a3e] hover:text-zinc-200'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Original</span>
              </button>

              <button
                type="button"
                onClick={() => setShape('square')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                  shape === 'square'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-[#101420] text-zinc-400 border-[#222a3e] hover:text-zinc-200'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Square</span>
              </button>

              <button
                type="button"
                onClick={() => setShape('circle')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                  shape === 'circle'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-[#101420] text-zinc-400 border-[#222a3e] hover:text-zinc-200'
                }`}
              >
                <Circle className="w-3.5 h-3.5" />
                <span>Circle</span>
              </button>

              <button
                type="button"
                onClick={() => setShape('rounded')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                  shape === 'rounded'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-[#101420] text-zinc-400 border-[#222a3e] hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rounded</span>
              </button>
            </div>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-indigo-300">
                <span>{isVideo ? 'Converting MP4 to looping animated GIF...' : 'Saving media to 67 Gang...'}</span>
                {isVideo && <span className="font-mono font-bold">{progressPercent}%</span>}
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-150"
                  style={{ width: `${isVideo ? progressPercent : 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#22283a] bg-[#171c2c] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-[#222b40] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDone}
            disabled={isProcessing || !!durationError || !name.trim()}
            className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Done & Add to 67 Gang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
