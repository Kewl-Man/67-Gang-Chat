import React, { useRef, useState } from 'react';
import { Camera, Upload, RotateCcw, X, Image as ImageIcon, CheckCircle2, Sparkles } from 'lucide-react';
import type { User } from '../types/chat.ts';
import { UserAvatar, DefaultSilhouette } from './UserAvatar.tsx';

interface AvatarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenCropper: (imageSrc: string) => void;
  onOpenCamera: () => void;
  onResetAvatar: () => Promise<void> | void;
  isResetting?: boolean;
}

export const AvatarSettingsModal: React.FC<AvatarSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenCropper,
  onOpenCamera,
  onResetAvatar,
  isResetting = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasCustomAvatar = Boolean(currentUser.avatar);

  const processFile = (file: File) => {
    setErrorMessage(null);
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP, GIF).');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 12MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onOpenCropper(result);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#121624] border border-[#232a3f] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1f2639] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Profile Picture & Avatar</h3>
              <p className="text-xs text-zinc-400">Customize how you appear to your 67 Gang classmates</p>
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

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Current Avatar Card with Status Indicator */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#161c2b] border border-[#242e44]">
            {/* Avatar Circle Container with Hover Overlay */}
            <div className="relative group shrink-0">
              <UserAvatar
                username={currentUser.username}
                avatarUrl={currentUser.avatar}
                size="2xl"
                className="ring-4 ring-indigo-500/30"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change Photo"
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer text-xs font-semibold"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span>Change</span>
              </button>
            </div>

            {/* Status Information */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h4 className="text-base font-bold text-white">{currentUser.username}</h4>
                {/* Status Indicator Badge */}
                {hasCustomAvatar ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Custom Picture</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <span>Default Avatar</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400">
                {hasCustomAvatar
                  ? 'Your custom cropped profile picture is active and visible to everyone in 67 Gang.'
                  : 'You are currently using the default profile styling. Upload a photo or snap one with your camera!'}
              </p>

              {/* Reset to Default Avatar Button */}
              {hasCustomAvatar && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onResetAvatar}
                    disabled={isResetting}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Default Avatar</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Dropzone Card */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer group ${
              isDraggingOver
                ? 'border-indigo-400 bg-indigo-500/15 scale-[1.01]'
                : 'border-[#26314c] hover:border-indigo-500/60 bg-[#141926] hover:bg-[#181e2e]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>

            <h5 className="text-sm font-bold text-white mb-1">
              Drag & Drop your photo here, or <span className="text-indigo-400 underline">Browse</span>
            </h5>
            <p className="text-xs text-zinc-400 mb-3">
              Supports JPG, PNG, WebP, GIF (up to 12MB)
            </p>

            <span className="text-[11px] font-medium text-zinc-500">
              Interactive circle cropping available immediately after selection
            </span>
          </div>

          {/* Action Row: Take Photo (Camera) Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenCamera}
              className="py-3 px-4 bg-[#181e2e] hover:bg-[#20273c] text-white border border-[#28334e] hover:border-indigo-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
            >
              <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                <Camera className="w-4 h-4" />
              </div>
              <span>Take Photo (Camera)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 bg-[#181e2e] hover:bg-[#20273c] text-white border border-[#28334e] hover:border-indigo-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
            >
              <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-4 h-4" />
              </div>
              <span>Choose from Files</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1f2639] bg-[#0e121d] flex items-center justify-between text-xs text-zinc-500">
          <span>Click any avatar in the app to view options</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#171d2c] hover:bg-[#20273c] text-zinc-300 hover:text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
