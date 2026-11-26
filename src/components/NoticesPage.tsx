import { useMemo, useState } from 'react';
import { ArrowLeft, Megaphone, Search } from 'lucide-react';
import type { BatchNotice, NoticeCategory, ViewMode } from '../types';
import { Reveal3D, TiltStage3D } from './Spatial3D';

interface NoticesPageProps {
  notices: BatchNotice[];
  onNavigate: (view: ViewMode) => void;
}

type CategoryFilter = 'All' | NoticeCategory;

export function NoticesPage({ notices, onNavigate }: NoticesPageProps) {
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [query, setQuery] = useState('');

  const activeNotices = useMemo(() => notices.filter((n) => n.active), [notices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...activeNotices]
      .filter((n) => {
        const matchesCat = category === 'All' || n.category === category;
        const matchesQuery =
          !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
        return matchesCat && matchesQuery;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [activeNotices, category, query]);

  return (
    <section className="pt-28 pb-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Notice Board · Rajshahi Collegiate School</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">Official Batch Notices</h1>
          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400 leading-relaxed">
            Announcements, event updates, and urgent alerts for Class of 2027 members.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('hoodie')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          View Hoodie '26-'27
        </button>
      </div>

      {/* Category Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-300 dark:border-zinc-800 w-fit">
          {(['All', 'General', 'Urgent', 'Event'] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                category === cat
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs dark:shadow-none'
                  : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notices..."
            aria-label="Search notices"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-14 text-center rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 space-y-2">
          <Megaphone className="w-8 h-8 text-zinc-500 dark:text-zinc-600 mx-auto" />
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-200">No active notices found</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-400">Check back later or clear your active filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((notice, idx) => (
            <Reveal3D key={notice.id} delay={Math.min(idx * 0.04, 0.2)}>
              <TiltStage3D maxTilt={4} scaleOnHover={1.008}>
                <article className="p-6 rounded-2xl bg-white/95 dark:bg-[#111114]/95 backdrop-blur-sm border border-zinc-300 dark:border-zinc-800/80 shadow-sm dark:shadow-lg space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        notice.category === 'Urgent'
                          ? 'text-rose-700 dark:text-rose-400'
                          : notice.category === 'Event'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {notice.category}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-500">{notice.createdAt}</span>
                    {notice.pinned && (
                      <>
                        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">·</span>
                        <span className="text-rose-700 dark:text-rose-400 font-semibold">Pinned</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">{notice.title}</h2>
                  <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">{notice.message}</p>
                </article>
              </TiltStage3D>
            </Reveal3D>
          ))}
        </div>
      )}
    </section>
  );
}
