import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, RefreshCw } from 'lucide-react';

interface AvatarCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onSave: (croppedDataUrl: string) => Promise<void> | void;
  isSaving?: boolean;
}

const CANVAS_SIZE = 340;
const CROP_DIAMETER = 250;
const EXPORT_SIZE = 300;

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onSave,
  isSaving = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(1);
  const [minScale, setMinScale] = useState<number>(0.5);
  const [maxScale, setMaxScale] = useState<number>(3.5);
  const [fitScale, setFitScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Drag state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch pinch zoom state
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(1);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate fit scale so image fills the crop circle
      const initialFit = Math.max(
        CROP_DIAMETER / img.naturalWidth,
        CROP_DIAMETER / img.naturalHeight
      );
      const computedMin = Math.max(0.1, initialFit * 0.5);
      const computedMax = Math.max(initialFit * 4.5, 3.5);

      setImage(img);
      setFitScale(initialFit);
      setScale(initialFit);
      setMinScale(computedMin);
      setMaxScale(computedMax);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
    };
    img.onerror = (err) => {
      console.error('Failed to load image for cropper:', err);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Live Canvas Rendering
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    // Center point of canvas + user pan offset
    ctx.translate(CANVAS_SIZE / 2 + offset.x, CANVAS_SIZE / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    // Draw centered
    ctx.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
      image.naturalWidth,
      image.naturalHeight
    );
    ctx.restore();
  }, [image, offset, scale, rotation]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Mouse wheel zoom on canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setScale((prev) => Math.min(Math.max(prev * zoomFactor, minScale), maxScale));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [minScale, maxScale]);

  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialOffsetRef.current = { ...offset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: initialOffsetRef.current.x + dx,
      y: initialOffsetRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch event handlers for mobile panning & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialOffsetRef.current = { ...offset };
      initialPinchDistRef.current = null;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialPinchDistRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setOffset({
        x: initialOffsetRef.current.x + dx,
        y: initialOffsetRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && initialPinchDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / initialPinchDistRef.current;
      const newScale = Math.min(Math.max(initialPinchScaleRef.current * ratio, minScale), maxScale);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    initialPinchDistRef.current = null;
  };

  // Rotate 90 degrees
  const handleRotate90 = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset transforms
  const handleReset = () => {
    setOffset({ x: 0, y: 0 });
    setScale(fitScale);
    setRotation(0);
  };

  // Save / Export masked circular crop to 300x300px offscreen canvas as JPEG base64 (0.88 quality)
  const handleExportAndSave = async () => {
    if (!image) return;

    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = EXPORT_SIZE;
      offscreen.height = EXPORT_SIZE;
      const octx = offscreen.getContext('2d');

      if (!octx) return;

      // Enable high-quality smoothing
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';

      // Circular clip mask
      octx.save();
      octx.beginPath();
      octx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
      octx.closePath();
      octx.clip();

      // Ratio between export size and crop preview diameter
      const ratio = EXPORT_SIZE / CROP_DIAMETER;

      octx.translate(
        EXPORT_SIZE / 2 + offset.x * ratio,
        EXPORT_SIZE / 2 + offset.y * ratio
      );
      octx.rotate((rotation * Math.PI) / 180);
      octx.scale(scale * ratio, scale * ratio);

      octx.drawImage(
        image,
        -image.naturalWidth / 2,
        -image.naturalHeight / 2,
        image.naturalWidth,
        image.naturalHeight
      );
      octx.restore();

      // Compressed JPEG base64 data URL at 0.88 quality per specification
      const croppedDataUrl = offscreen.toDataURL('image/jpeg', 0.88);

      await onSave(croppedDataUrl);
    } catch (err) {
      console.error('Error exporting cropped avatar:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#121624] border border-[#232a3f] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1f2639] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Crop Profile Picture</h3>
            <p className="text-xs text-zinc-400">Drag to position, pinch or scroll to zoom</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1f2638] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Viewport Container */}
        <div className="p-4 sm:p-5 flex flex-col items-center">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-[340px] h-[340px] bg-[#0c0f18] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center touch-none"
          >
            {/* HTML5 Canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="w-full h-full block"
            />

            {/* Circular Mask Overlay (250px diameter cutout with dark surroundings) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                style={{
                  width: `${CROP_DIAMETER}px`,
                  height: `${CROP_DIAMETER}px`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                }}
                className="rounded-full border border-white/60 relative flex items-center justify-center"
              >
                {/* Subtle Thirds Guide Lines */}
                <div className="w-full h-full rounded-full overflow-hidden opacity-30 flex flex-col justify-between pointer-events-none">
                  <div className="w-full h-[1px] bg-white/40 mt-[33%]" />
                  <div className="w-full h-[1px] bg-white/40 mb-[33%]" />
                </div>
                <div className="w-full h-full rounded-full overflow-hidden opacity-30 flex justify-between absolute pointer-events-none">
                  <div className="h-full w-[1px] bg-white/40 ml-[33%]" />
                  <div className="h-full w-[1px] bg-white/40 mr-[33%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Transform Controls Bar */}
          <div className="w-full max-w-[340px] mt-4 space-y-3.5">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3 bg-[#171d2c] px-3.5 py-2.5 rounded-xl border border-[#242d44]">
              <button
                type="button"
                onClick={() => setScale((prev) => Math.max(prev * 0.9, minScale))}
                title="Zoom Out"
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={minScale}
                max={maxScale}
                step={(maxScale - minScale) / 100}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <button
                type="button"
                onClick={() => setScale((prev) => Math.min(prev * 1.1, maxScale))}
                title="Zoom In"
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Buttons: Rotate & Reset */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotate90}
                  className="px-3 py-1.5 bg-[#171d2c] hover:bg-[#20273c] text-zinc-300 hover:text-white border border-[#242d44] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Rotate 90°</span>
                </button>
                {rotation !== 0 && (
                  <button
                    type="button"
                    onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                    title="Rotate counter-clockwise"
                    className="p-1.5 bg-[#171d2c] hover:bg-[#20273c] text-zinc-300 hover:text-white border border-[#242d44] rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 bg-[#171d2c] hover:bg-[#20273c] text-zinc-400 hover:text-zinc-200 border border-[#242d44] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1f2639] bg-[#0e121d] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-[#171d2c] hover:bg-[#20273c] text-zinc-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExportAndSave}
            disabled={isSaving || !image}
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Avatar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
