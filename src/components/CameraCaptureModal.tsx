import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertTriangle, VideoOff } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (capturedDataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [canFlip, setCanFlip] = useState(true);

  // Stop current active stream tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.error('Error stopping track:', err);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your current browser.');
      return;
    }

    stopStream();
    setCameraError(null);
    setIsStarting(true);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 720 },
          height: { ideal: 720 },
          facingMode: { ideal: facingMode },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((playErr) => {
          console.warn('Video autoPlay prevented:', playErr);
        });
      }

      // Check available devices to see if flip is feasible
      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setCanFlip(videoDevices.length > 1);
        } catch {
          setCanFlip(true);
        }
      }
    } catch (err: unknown) {
      console.error('Camera stream error:', err);
      const error = err as { name?: string; message?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. Please connect a webcam or upload a file.');
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(error?.message || 'Unable to access camera.');
      }
    } finally {
      setIsStarting(false);
    }
  }, [facingMode, stopStream]);

  // Start on open, stop on close
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // Handle Flip Camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture photo from video feed
  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    // Determine square center crop
    const s = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - s) / 2;
    const sy = (video.videoHeight - s) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Mirror image if front-facing camera
    if (facingMode === 'user') {
      ctx.translate(s, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, s, s, 0, 0, s, s);

    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Stop camera and pass image to cropper
    stopStream();
    onCapture(capturedDataUrl);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#121624] border border-[#232a3f] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1f2639] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Take Profile Photo</h3>
              <p className="text-xs text-zinc-400">Frame your face inside the circle</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1f2638] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="p-4 sm:p-6 flex flex-col items-center">
          {cameraError ? (
            <div className="w-full aspect-square max-w-[320px] rounded-2xl bg-[#0c0f18] border border-rose-500/30 flex flex-col items-center justify-center p-6 text-center">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-full mb-3">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Camera Unavailable</h4>
              <p className="text-xs text-zinc-400 mb-4 max-w-[240px] leading-relaxed">
                {cameraError}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#1b2234] hover:bg-[#232c42] text-zinc-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center">
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
                className="w-full h-full object-cover"
              />

              {/* Circular framing guide overlay with dashed border and dark vignette */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* 240px circle cutout simulation */}
                <div className="w-56 h-56 sm:w-60 sm:h-60 rounded-full border-2 border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                  {/* Subtle center cross marker */}
                  <span className="w-2.5 h-[1px] bg-white/40 block absolute" />
                  <span className="h-2.5 w-[1px] bg-white/40 block absolute" />
                </div>
              </div>

              {/* Status / Loading indicator */}
              {isStarting && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <span className="text-xs text-zinc-300">Starting camera...</span>
                </div>
              )}

              {/* Camera Mode Badge */}
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[11px] font-medium text-zinc-300 border border-white/10 flex items-center gap-1.5 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{facingMode === 'user' ? 'Front Camera' : 'Rear Camera'}</span>
              </div>
            </div>
          )}

          {/* Camera Controls Bar */}
          {!cameraError && (
            <div className="w-full max-w-[320px] mt-5 flex items-center justify-between px-2">
              {/* Flip Camera Button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                disabled={!canFlip || isStarting}
                title="Flip Camera (Front / Rear)"
                className="p-3 text-zinc-300 hover:text-white bg-[#192032] hover:bg-[#232c44] border border-[#26314c] rounded-full transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center"
              >
                <RefreshCw className={`w-5 h-5 ${isStarting ? 'animate-spin' : ''}`} />
              </button>

              {/* Big Shutter / Capture Button */}
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={isStarting}
                title="Capture Photo"
                className="group relative w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-400 p-1 shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                <div className="w-full h-full rounded-full border-2 border-white/80 bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white shadow-sm" />
                </div>
              </button>

              {/* Close Button / Spacer */}
              <button
                type="button"
                onClick={onClose}
                title="Cancel"
                className="p-3 text-zinc-400 hover:text-rose-400 bg-[#192032] hover:bg-rose-500/10 border border-[#26314c] rounded-full transition-all cursor-pointer shadow-md flex items-center justify-center"
              >
                <VideoOff className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
