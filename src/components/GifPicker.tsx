import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Film, Loader2 } from 'lucide-react';
import type { CustomMedia } from '../types/chat.ts';

interface GifPickerProps {
  customGifs: CustomMedia[];
  onSelectGif: (gifUrl: string, name?: string) => void;
  onOpenUpload: (file: File) => void;
  onClose: () => void;
}

const GIPHY_API_KEY = 'swZyfiQpn85rnj3lMXS16WZnpIpF2j7t';

interface GiphyItem {
  id: string;
  title: string;
  images: {
    fixed_height?: { url: string };
    downsized_medium?: { url: string };
    original?: { url: string };
  };
}

const GIF_QUICK_TABS = [
  { id: 'trending', name: 'Trending' },
  { id: 'laugh', name: 'Laugh' },
  { id: 'salute', name: 'Salute' },
  { id: 'hype', name: 'Hype' },
  { id: 'study', name: 'Study' },
  { id: 'memes', name: 'Memes' },
  { id: 'sad', name: 'Sad' },
  { id: 'clapping', name: 'Applause' },
];

export const GifPicker: React.FC<GifPickerProps> = ({
  customGifs,
  onSelectGif,
  onOpenUpload,
}) => {
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('trending');
  const [giphyResults, setGiphyResults] = useState<GiphyItem[]>([]);
  const [isLoadingGiphy, setIsLoadingGiphy] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenUpload(file);
      e.target.value = '';
    }
  };

  // Fetch GIPHY GIFs based on search or category tab
  useEffect(() => {
    let isCancelled = false;

    async function fetchGiphy() {
      setIsLoadingGiphy(true);
      try {
        let endpoint = '';
        if (search.trim()) {
          endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
            search.trim()
          )}&limit=24&rating=pg-13`;
        } else if (activeTab === 'trending') {
          endpoint = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg-13`;
        } else {
          endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
            activeTab
          )}&limit=24&rating=pg-13`;
        }

        const res = await fetch(endpoint);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && Array.isArray(json.data)) {
            setGiphyResults(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch from GIPHY:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingGiphy(false);
        }
      }
    }

    const timer = setTimeout(() => {
      fetchGiphy();
    }, search ? 350 : 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, activeTab]);

  const filteredCustom = customGifs.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 sm:w-96 bg-[#131724] border border-[#262f44] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 z-40 select-none animate-fadeIn">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif,video/mp4,video/webm"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Search */}
      <div className="p-3 border-b border-[#20273a] bg-[#161c2d] flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search millions of GIFs via GIPHY..."
            className="w-full bg-[#0d101a] border border-[#242c3f] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#20273a] bg-[#0f131f] overflow-x-auto text-xs scrollbar-none">
        {GIF_QUICK_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setSearch('');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id && !search
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a2133]'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* GIF Scroll Area */}
      <div className="p-3 overflow-y-auto max-h-80 space-y-4">
        {/* TOP SECTION: 67 Gang */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-[10px] text-white font-black">
                  67
                </span>
                67 Gang
              </span>
              <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded-full">
                {customGifs.length}
              </span>
            </div>

            {/* PLUS BUTTON: Upload Custom GIF */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload custom GIF or MP4 (<10s)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Upload Custom GIF</span>
            </button>
          </div>

          {/* Custom 67 Gang GIFs Grid */}
          {filteredCustom.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 p-2 bg-[#0c0f18] rounded-xl border border-[#1f2638]">
              {filteredCustom.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelectGif(gif.url, gif.name)}
                  className="group relative rounded-xl overflow-hidden bg-[#161c2c] border border-[#252f47] hover:border-indigo-500 transition-all cursor-pointer aspect-video flex items-center justify-center"
                >
                  <img
                    src={gif.url}
                    alt={gif.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white truncate text-center font-medium">
                    :{gif.name}:
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-[#0d101a] rounded-xl border border-dashed border-[#2b354d] hover:border-indigo-500/60 text-center cursor-pointer transition-colors group"
            >
              <p className="text-[11px] text-zinc-400 group-hover:text-zinc-200">
                No custom GIFs yet. Click <span className="text-indigo-400 font-bold">+ Upload Custom GIF</span> to add one for 67 Gang!
              </p>
            </div>
          )}
        </div>

        {/* GIPHY Live Section */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Film className="w-3 h-3 text-indigo-400" />
              <span>{search ? `Results for "${search}"` : 'Powered by GIPHY'}</span>
            </span>
            {isLoadingGiphy && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {giphyResults.map((gif) => {
              const url =
                gif.images.fixed_height?.url ||
                gif.images.downsized_medium?.url ||
                gif.images.original?.url;
              if (!url) return null;

              return (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelectGif(url, gif.title || 'Giphy GIF')}
                  className="group relative rounded-xl overflow-hidden bg-[#151a29] border border-[#232b3f] hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer aspect-video"
                >
                  <img
                    src={url}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
