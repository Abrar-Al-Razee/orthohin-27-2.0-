import { ArrowLeft, ArrowUpRight, UserPlus, Users } from 'lucide-react';
import type { SiteConfig, ViewMode } from '../types';
import { DEFAULT_PROFILE_IMAGE } from '../utils/storage';

interface DirectoryPageProps {
  siteConfig: SiteConfig;
  profileImage: string;
  batchmateCount: number;
  onNavigate: (view: ViewMode) => void;
}

export function DirectoryPage({ siteConfig, profileImage, batchmateCount, onNavigate }: DirectoryPageProps) {
  const resolvedAvatar =
    profileImage && profileImage !== '/src/assets/images/portrait_lead_abrar_1794766076468.jpg'
      ? profileImage
      : DEFAULT_PROFILE_IMAGE;

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

      <div className="text-center max-w-2xl mx-auto mb-12 space-y-2.5">
        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{siteConfig.leadSectionKicker}</p>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">{siteConfig.leadSectionTitle}</h1>
        <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400">{siteConfig.leadSectionSubtitle}</p>
      </div>

      <div className="max-w-xl mx-auto rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none p-8 sm:p-10 text-center space-y-6">
        <div className="w-36 h-36 mx-auto rounded-full overflow-hidden border-2 border-zinc-400 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900">
          <img
            src={resolvedAvatar}
            alt={siteConfig.leadName || 'Abrar Al Razee Oytizzoh'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-[center_22%]"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{siteConfig.leadRole}</p>
          <h2 className="text-2xl font-bold text-zinc-950 dark:text-white">{siteConfig.leadName}</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-500 font-mono tabular-nums">
            Orthohin '27 · {batchmateCount} Registered Batchmates
          </p>
        </div>

        <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">"{siteConfig.devNote}"</p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href={siteConfig.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
          >
            Connect on Instagram
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => onNavigate('batchmates')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            View All Batchmates
          </button>
          {siteConfig.registrationOpen !== false && (
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Register Yourself
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
