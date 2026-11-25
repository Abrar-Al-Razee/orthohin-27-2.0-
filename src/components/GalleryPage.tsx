import { useMemo, useState } from 'react';
import { ArrowLeft, Camera, Play, Search, UserPlus } from 'lucide-react';
import type { GalleryItem, ViewMode } from '../types';

interface GalleryPageProps {
  gallery: GalleryItem[];
  onSelectLightbox: (item: GalleryItem) => void;
  onNavigate: (view: ViewMode) => void;
}

type MediaFilter = 'all' | 'photos' | 'videos';

export function GalleryPage({ gallery, onSelectLightbox, onNavigate }: GalleryPageProps) {
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gallery.filter((item) => {
      const matchesType =
        filter === 'all' || (filter === 'videos' ? Boolean(item.isVideo) : !item.isVideo);
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.caption.toLowerCase().includes(q) ||
        (item.date && item.date.toLowerCase().includes(q));
      return matchesType && matchesQuery;
    });
  }, [gallery, filter, query]);

  const photoCount = useMemo(() => gallery.filter((g) => !g.isVideo).length, [gallery]);
  const videoCount = useMemo(() => gallery.filter((g) => Boolean(g.isVideo)).length, [gallery]);

  return (
    <section className="pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-300 dark:border-zinc-800/80">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Memory Vault · Class of 2027</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">Captured Moments</h1>
          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400 leading-relaxed">
            Every milestone, campus memory, and video reel from Orthohin '27. Select any frame to open the fullscreen viewer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('register')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Join Batch Directory
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-300 dark:border-zinc-800 w-fit">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs dark:shadow-none'
                : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            All ({gallery.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('photos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              filter === 'photos'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs dark:shadow-none'
                : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Photos ({photoCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('videos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              filter === 'videos'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs dark:shadow-none'
                : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Videos ({videoCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gallery by title or date..."
            aria-label="Search gallery"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-14 text-center rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 space-y-3">
          <Camera className="w-8 h-8 text-zinc-500 dark:text-zinc-600 mx-auto" />
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-200">No gallery moments match your filter</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-400">Try clearing the search query or switching media tabs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectLightbox(item)}
              className="text-left rounded-2xl overflow-hidden bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none transition-colors duration-150 group cursor-pointer flex flex-col"
            >
              {item.src && (
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                  <img
                    src={item.src}
                    alt={item.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                  {item.isVideo && (
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-rose-600 text-white inline-flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-500">
                    <span className="font-mono">{item.date || 'Cohort Archive'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.isVideo ? 'Video Reel' : 'Photograph'}</span>
                  </div>
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{item.caption}</p>
                </div>
                {!item.src && item.isVideo && (
                  <div className="pt-2 inline-flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Watch video memory</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
