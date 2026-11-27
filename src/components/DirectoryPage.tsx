import { ArrowLeft, ArrowUpRight, Shield, UserPlus, Users } from 'lucide-react';
import type { AdminTeamMember, SiteConfig, ViewMode } from '../types';
import { DEFAULT_PROFILE_IMAGE, getInitials } from '../utils/storage';
import { Reveal3D, TiltStage3D } from './Spatial3D';

interface DirectoryPageProps {
  siteConfig: SiteConfig;
  profileImage: string;
  adminTeam: AdminTeamMember[];
  batchmateCount: number;
  isLoading?: boolean;
  onNavigate: (view: ViewMode) => void;
}

function resolveSocialLink(raw?: string): { href: string; label: string } | null {
  const val = (raw || '').trim();
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) {
    return { href: val, label: 'Connect Profile' };
  }
  const cleanHandle = val.replace(/^@/, '');
  if (!cleanHandle) return null;
  return {
    href: `https://www.instagram.com/${encodeURIComponent(cleanHandle)}/`,
    label: `@${cleanHandle}`,
  };
}

export function DirectoryPage({
  siteConfig,
  profileImage,
  adminTeam,
  batchmateCount,
  isLoading = false,
  onNavigate,
}: DirectoryPageProps) {
  const fallbackAvatar =
    profileImage && profileImage !== '/src/assets/images/portrait_lead_abrar_1794766076468.jpg'
      ? profileImage
      : DEFAULT_PROFILE_IMAGE;

  const teamMembers: AdminTeamMember[] =
    adminTeam.length > 0
      ? adminTeam
      : isLoading
        ? []
        : [
          {
            id: 'admin-1',
            name: siteConfig.leadName || 'Abrar Al Razee Oytizzoh',
            role: siteConfig.leadRole || 'Lead Developer · Head Orthohin-27',
            bio: siteConfig.devNote || '',
            photo: fallbackAvatar,
            social: siteConfig.instagramUrl,
            sortOrder: 0,
          },
        ];

  const gridClass =
    teamMembers.length === 1
      ? 'max-w-xl mx-auto'
      : teamMembers.length === 2
        ? 'grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto'
        : 'grid sm:grid-cols-2 lg:grid-cols-3 gap-6';

  return (
    <section className="pt-28 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </button>

      <div className="text-center max-w-2xl mx-auto mb-12 space-y-2.5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
          <Shield className="w-3.5 h-3.5" />
          <span>{siteConfig.leadSectionKicker || "Core Organizers · Orthohin '27"}</span>
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">
          {siteConfig.leadSectionTitle || 'Admin Panel'}
        </h1>
        <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400">
          {siteConfig.leadSectionSubtitle || "The core organizers and admins running Orthohin '27."}
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-500 font-mono tabular-nums pt-1">
          {teamMembers.length} {teamMembers.length === 1 ? 'Organizer' : 'Organizers'} · {batchmateCount} Registered Batchmates
        </p>
      </div>

      {isLoading && teamMembers.length === 0 ? (
        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="h-80 rounded-2xl bg-zinc-100/80 dark:bg-[#111114]/80 border border-zinc-200 dark:border-zinc-800/80 animate-pulse"
            />
          ))}
        </div>
      ) : (
      <div className={gridClass}>
        {teamMembers.map((member, idx) => {
          const socialLink = resolveSocialLink(member.social);
          return (
            <Reveal3D key={member.id} delay={Math.min(idx * 0.05, 0.25)}>
              <TiltStage3D maxTilt={7} className="h-full">
                <article className="h-full rounded-2xl bg-white/95 dark:bg-[#111114]/95 backdrop-blur-sm border border-zinc-300 dark:border-zinc-800/80 shadow-sm dark:shadow-xl p-7 sm:p-8 flex flex-col items-center text-center space-y-5">
                  <div
                    style={{ transform: 'translateZ(24px)' }}
                    className="w-32 h-32 rounded-full overflow-hidden border-2 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 shadow-md"
                  >
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-[center_22%]"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                        {getInitials(member.name)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{member.role}</p>
                    <h2 className="text-xl font-bold text-zinc-950 dark:text-white">{member.name}</h2>
                  </div>

                  {member.bio && (
                    <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed flex-1">
                      "{member.bio}"
                    </p>
                  )}

                  {socialLink && (
                    <a
                      href={socialLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                    >
                      {socialLink.label}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </article>
              </TiltStage3D>
            </Reveal3D>
          );
        })}
      </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-10">
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
    </section>
  );
}
