import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Film } from 'lucide-react';
import type { CustomMedia } from '../types/chat.ts';
import { EmojiPicker } from './EmojiPicker.tsx';
import { GifPicker } from './GifPicker.tsx';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<boolean>;
  onSendGif: (mediaUrl: string, name?: string) => Promise<boolean>;
  customEmojis: CustomMedia[];
  customGifs: CustomMedia[];
  onOpenUploadModal: (file: File, type: 'emoji' | 'gif') => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendGif,
  customEmojis,
  customGifs,
  onOpenUploadModal,
  onTyping,
  disabled = false,
}) => {
  const [content, setContent] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [activePicker, setActivePicker] = useState<'emoji' | 'gif' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  const MAX_LENGTH = 1000;

  const reportTyping = (textValue: string) => {
    if (!onTyping) return;
    if (textValue.trim().length > 0) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => {
        onTyping(false);
      }, 2500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      onTyping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (onTyping) onTyping(false);
    };
  }, [onTyping]);

  // Find emojis currently mentioned in content for visual preview
  const detectedEmojis = customEmojis.filter((e) =>
    content.toLowerCase().includes(`:${e.name.toLowerCase()}:`)
  );

  // Check if user is currently typing an emoji e.g. ":fir"
  const matchTyping = content.match(/:([a-zA-Z0-9_-]{1,20})$/);
  const matchingSuggestions = matchTyping
    ? customEmojis.filter((e) =>
        e.name.toLowerCase().startsWith(matchTyping[1].toLowerCase())
      )
    : [];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [content]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending || disabled || trimmed.length > MAX_LENGTH) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (onTyping) onTyping(false);

    setIsSending(true);
    const success = await onSendMessage(trimmed);
    setIsSending(false);

    if (success) {
      setContent('');
      setActivePicker(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = content.substring(0, start) + emoji + content.substring(end);
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSelectGif = async (url: string, name?: string) => {
    setActivePicker(null);
    setIsSending(true);
    await onSendGif(url, name);
    setIsSending(false);
  };

  const completeEmojiSuggestion = (emojiName: string) => {
    if (!matchTyping) return;
    const replaceTarget = matchTyping[0];
    const lastIndex = content.lastIndexOf(replaceTarget);
    if (lastIndex !== -1) {
      const newText =
        content.substring(0, lastIndex) + `:${emojiName}: ` + content.substring(lastIndex + replaceTarget.length);
      setContent(newText);
      textareaRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className="border-t border-[#22283a] bg-[#111522] p-3 sm:p-4 relative">
      {/* Autocomplete popup for typing :name */}
      {matchingSuggestions.length > 0 && (
        <div className="absolute bottom-full left-4 sm:left-6 mb-2 p-1.5 bg-[#171c2c] border border-[#2a344a] rounded-xl shadow-xl flex items-center gap-1.5 z-30 animate-fadeIn max-w-sm overflow-x-auto">
          <span className="text-[10px] text-zinc-400 px-1 font-semibold uppercase">Emoji match:</span>
          {matchingSuggestions.slice(0, 5).map((emoji) => (
            <button
              key={emoji.id}
              type="button"
              onClick={() => completeEmojiSuggestion(emoji.name)}
              className="px-2 py-1 bg-[#101420] hover:bg-indigo-600 rounded-lg text-xs font-mono text-zinc-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <img
                src={emoji.url}
                alt={emoji.name}
                className={`w-4 h-4 object-contain ${
                  emoji.shape === 'circle' ? 'rounded-full' : 'rounded-xs'
                }`}
              />
              <span>:{emoji.name}:</span>
            </button>
          ))}
        </div>
      )}

      {/* Pickers Popover Window */}
      {activePicker === 'emoji' && (
        <div className="absolute bottom-full left-4 sm:left-6 mb-3 z-40">
          <EmojiPicker
            customEmojis={customEmojis}
            onSelectEmoji={handleSelectEmoji}
            onOpenUpload={(file) => {
              setActivePicker(null);
              onOpenUploadModal(file, 'emoji');
            }}
            onClose={() => setActivePicker(null)}
          />
        </div>
      )}

      {activePicker === 'gif' && (
        <div className="absolute bottom-full left-14 sm:left-16 mb-3 z-40">
          <GifPicker
            customGifs={customGifs}
            onSelectGif={handleSelectGif}
            onOpenUpload={(file) => {
              setActivePicker(null);
              onOpenUploadModal(file, 'gif');
            }}
            onClose={() => setActivePicker(null)}
          />
        </div>
      )}

      {/* Detected Custom Emoji Preview Bar */}
      {detectedEmojis.length > 0 && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 px-3 py-1 bg-[#151926] border border-[#262f44] rounded-xl text-xs text-zinc-300">
          <span className="text-[10px] uppercase font-bold text-indigo-400">Emoji Preview:</span>
          <div className="flex items-center gap-2">
            {detectedEmojis.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1 bg-[#0c0f18] px-2 py-0.5 rounded-lg border border-[#222a3d]">
                <img
                  src={e.url}
                  alt={e.name}
                  className={`w-5 h-5 object-contain ${
                    e.shape === 'circle' ? 'rounded-full' : 'rounded-xs'
                  }`}
                />
                <span className="font-mono text-[11px] text-zinc-300">:{e.name}:</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex items-end gap-2">
        {/* EMOJI BUTTON */}
        <button
          type="button"
          onClick={() => setActivePicker((prev) => (prev === 'emoji' ? null : 'emoji'))}
          title="Open Emojis"
          className={`h-11 w-11 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center border ${
            activePicker === 'emoji'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white bg-[#151926] hover:bg-[#1f2538] border-[#252c40]'
          }`}
        >
          <Smile className="w-5 h-5 text-indigo-400" />
        </button>

        {/* GIF BUTTON */}
        <button
          type="button"
          onClick={() => setActivePicker((prev) => (prev === 'gif' ? null : 'gif'))}
          title="Open GIFs"
          className={`h-11 px-3.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5 border font-bold text-xs ${
            activePicker === 'gif'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white bg-[#151926] hover:bg-[#1f2538] border-[#252c40]'
          }`}
        >
          <Film className="w-4 h-4 text-indigo-400" />
          <span className="font-black text-[11px] tracking-wider">GIF</span>
        </button>

        {/* Text Area */}
        <div className="flex-1 min-h-[44px] relative bg-[#0c0f18] rounded-xl border border-[#22293d] focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all flex items-center">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              reportTyping(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message to 67 Gang... (Press Enter to send)"
            disabled={disabled}
            maxLength={MAX_LENGTH}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 px-3.5 py-2.5 focus:outline-none resize-none leading-relaxed block max-h-36 overflow-y-auto"
          />

          {content.length > 700 && (
            <div className="absolute right-2.5 bottom-1 text-[10px] text-zinc-500 font-mono">
              {content.length}/{MAX_LENGTH}
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!content.trim() || isSending || disabled || content.trim().length > MAX_LENGTH}
          className="h-11 w-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0 flex items-center justify-center"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
