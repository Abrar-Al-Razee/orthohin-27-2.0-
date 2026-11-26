import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Play, X } from 'lucide-react';
import type { GalleryItem } from '../types';

interface LightboxModalProps {
  item: GalleryItem | null;
  onClose: () => void;
}

export function LightboxModal({ item, onClose }: LightboxModalProps) {
  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed top-4 right-4 w-11 h-11 rounded-lg bg-zinc-900/95 border border-zinc-700 text-white inline-flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        aria-label="Close lightbox"
      >
        <X className="w-5 h-5" />
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12, rotateX: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1200 }}
        className="w-full max-w-4xl space-y-4"
      >
        <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl">
          {item.src ? (
            <img
              src={item.src}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="w-full max-h-[72vh] object-contain mx-auto"
            />
          ) : (
            <div className="py-20 px-6 text-center space-y-3 bg-[#111114]">
              <p className="text-sm font-medium text-zinc-100">{item.title}</p>
              <p className="text-xs text-zinc-300 max-w-md mx-auto">
                {item.isVideo ? 'Open the Facebook video link below to watch this memory.' : item.caption}
              </p>
            </div>
          )}
          {item.isVideo && item.videoUrl && (
            <div
              className={`${
                item.src ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent' : 'border-t border-zinc-800 bg-zinc-950'
              } p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-rose-600 text-white inline-flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Video Memory Archive</p>
                  <p className="text-xs text-zinc-300">Watch the full reel on Facebook</p>
                </div>
              </div>
              <a
                href={item.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shrink-0"
              >
                Watch Video <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-base font-semibold text-white">{item.title}</h3>
            {item.caption && <p className="text-sm text-zinc-300">{item.caption}</p>}
          </div>
          {item.date && <p className="text-xs font-mono text-zinc-400 shrink-0">{item.date}</p>}
        </div>
      </motion.div>
    </div>
  );
}
