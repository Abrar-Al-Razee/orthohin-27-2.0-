import { ArrowLeft, Camera, UserPlus } from 'lucide-react';
import type { SiteConfig, ViewMode } from '../types';

interface TimelinePageProps {
  siteConfig: SiteConfig;
  onNavigate: (view: ViewMode) => void;
}

export function TimelinePage({ siteConfig, onNavigate }: TimelinePageProps) {
  const milestones = siteConfig.timeline || [];

  return (
    <section className="pt-28 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b border-zinc-300 dark:border-zinc-800/80 mb-12">
        <div className="space-y-2 max-w-xl">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Cohort Milestones</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">Our Journey</h1>
          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400 leading-relaxed">
            A chronological record of the chapters shaping Rajshahi Collegiate School Batch '27.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('gallery')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#111114] dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Memory Vault
          </button>
          {siteConfig.registrationOpen !== false && (
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Register
            </button>
          )}
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-50 dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 text-sm text-zinc-600 dark:text-zinc-400">
          No timeline milestones have been added yet.
        </div>
      ) : (
        <ol className="relative border-l border-zinc-300 dark:border-zinc-800 space-y-10 ml-3">
          {milestones.map((item, idx) => (
            <li key={item.id || idx} className="pl-8 relative">
              <span
                className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${
                  idx === milestones.length - 1 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-rose-600 dark:bg-rose-500'
                }`}
              />
              <div className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none space-y-1.5">
                <p
                  className={`text-xs font-mono font-semibold ${
                    idx === milestones.length - 1 ? 'text-zinc-600 dark:text-zinc-400' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {item.tag}
                </p>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">{item.title}</h2>
                <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
