import { ArrowLeft, ArrowUpRight, Calendar, Heart, Instagram, Target, Users } from 'lucide-react';
import type { SiteConfig, ViewMode } from '../types';

interface AboutPageProps {
  siteConfig: SiteConfig;
  batchmateCount: number;
  onNavigate: (view: ViewMode) => void;
}

export function AboutPage({ siteConfig, batchmateCount, onNavigate }: AboutPageProps) {
  return (
    <section className="pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>

        <div className="grid lg:grid-cols-12 gap-10 items-start pb-10 border-b border-zinc-300 dark:border-zinc-800/80">
          <div className="lg:col-span-7 space-y-5">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{siteConfig.aboutKicker}</p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance">
              {siteConfig.aboutTitle}
            </h1>
            <p className="text-base text-zinc-700 dark:text-zinc-400 leading-relaxed max-w-2xl">
              {siteConfig.aboutDescription}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('timeline')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                Explore Our Journey
              </button>
              <button
                type="button"
                onClick={() => onNavigate('batchmates')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#111114] dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 text-zinc-700 dark:text-zinc-400" />
                View Batchmates
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="p-8 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center">
                <Instagram className="w-7 h-7 text-rose-600 dark:text-rose-500" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-zinc-950 dark:text-white">{siteConfig.instagramHandle}</h2>
                <p className="text-sm text-zinc-700 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  {siteConfig.instagramBio}
                </p>
              </div>
              <a
                href={siteConfig.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
              >
                View Posts on Instagram
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Vision & Unity Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-7 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center">
            <Target className="w-5 h-5 text-rose-600 dark:text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-950 dark:text-white">{siteConfig.visionTitle}</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">{siteConfig.visionText}</p>
        </div>

        <div className="p-7 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-600 dark:text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-950 dark:text-white">{siteConfig.unityTitle}</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">{siteConfig.unityText}</p>
        </div>
      </div>

      {/* Cohort Key Figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        {(siteConfig.kpis || []).map((kpi, idx) => (
          <div key={kpi.id || idx} className="p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none">
            <p
              className={`text-3xl font-bold font-mono tabular-nums ${
                idx === (siteConfig.kpis || []).length - 1 ? 'text-rose-600 dark:text-rose-500' : 'text-zinc-950 dark:text-white'
              }`}
            >
              {kpi.autoBatchmateCount ? batchmateCount : kpi.value}
            </p>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-400 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
