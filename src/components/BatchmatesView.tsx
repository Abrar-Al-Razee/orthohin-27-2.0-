import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Cake,
  Check,
  Compass,
  Copy,
  Download,
  Droplets,
  Eye,
  Heart,
  MapPin,
  RotateCw,
  Search,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import type { Batchmate } from '../types';
import {
  buildCardShareCaption,
  CARD_EDITIONS,
  downloadBatchmateCard,
  renderBatchmateCardToDataUrl,
  type CardEditionId,
} from '../utils/batchCardGenerator';
import { getInitials } from '../utils/storage';

interface BatchmatesViewProps {
  batchmates: Batchmate[];
  highlightedId?: string | null;
  onClearHighlight?: () => void;
  onOpenRegister: () => void;
  onBackHome?: () => void;
}

export function BatchmatesView({
  batchmates,
  highlightedId,
  onClearHighlight,
  onOpenRegister,
  onBackHome,
}: BatchmatesViewProps) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [selectedBatchmate, setSelectedBatchmate] = useState<Batchmate | null>(null);

  // Collectible Card Studio state
  const [cardStudioMember, setCardStudioMember] = useState<Batchmate | null>(null);
  const [cardEdition, setCardEdition] = useState<CardEditionId>('crimson');
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string>('');
  const [isRenderingCard, setIsRenderingCard] = useState(false);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  const highlightedMember = useMemo(
    () => (highlightedId ? batchmates.find((b) => b.id === highlightedId) || null : null),
    [batchmates, highlightedId]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cardStudioMember) setCardStudioMember(null);
        else if (selectedBatchmate) setSelectedBatchmate(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedBatchmate, cardStudioMember]);

  useEffect(() => {
    let active = true;
    if (!cardStudioMember) {
      setCardPreviewUrl('');
      return;
    }
    setIsRenderingCard(true);
    setCaptionCopied(false);
    renderBatchmateCardToDataUrl(cardStudioMember, cardEdition)
      .then((url) => {
        if (active) setCardPreviewUrl(url);
      })
      .catch(() => {
        if (active) setCardPreviewUrl('');
      })
      .finally(() => {
        if (active) setIsRenderingCard(false);
      });
    return () => {
      active = false;
    };
  }, [cardStudioMember, cardEdition]);

  const groups = useMemo(() => {
    const unique = Array.from(new Set(batchmates.map((b) => b.group || 'Batchmate')));
    return ['All', ...unique];
  }, [batchmates]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = batchmates.filter((b) => {
      const matchesGroup = activeGroup === 'All' || (b.group || 'Batchmate') === activeGroup;
      const matchesSearch =
        !query ||
        b.name.toLowerCase().includes(query) ||
        (b.nickname && b.nickname.toLowerCase().includes(query)) ||
        b.roll.toLowerCase().includes(query) ||
        (b.social && b.social.toLowerCase().includes(query)) ||
        (b.hobbies && b.hobbies.toLowerCase().includes(query)) ||
        (b.dreamGoal && b.dreamGoal.toLowerCase().includes(query)) ||
        (b.hangoutSpot && b.hangoutSpot.toLowerCase().includes(query)) ||
        (b.superpower && b.superpower.toLowerCase().includes(query));
      return matchesGroup && matchesSearch;
    });

    if (!highlightedId) return list;
    return [...list].sort((a, b) => (a.id === highlightedId ? -1 : b.id === highlightedId ? 1 : 0));
  }, [batchmates, activeGroup, search, highlightedId]);

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadFromStudio = async () => {
    if (!cardStudioMember || isDownloadingCard) return;
    setIsDownloadingCard(true);
    try {
      await downloadBatchmateCard(cardStudioMember, cardEdition);
    } finally {
      setIsDownloadingCard(false);
    }
  };

  const handleCopyShareCaption = async () => {
    if (!cardStudioMember) return;
    try {
      await navigator.clipboard.writeText(buildCardShareCaption(cardStudioMember));
      setCaptionCopied(true);
      window.setTimeout(() => setCaptionCopied(false), 2500);
    } catch {
      // Clipboard blocked cleanly ignored
    }
  };

  return (
    <section className="pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {onBackHome && (
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-300 dark:border-zinc-800/80">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Community Directory · Class of 2027</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Batchmates Profile Cards
          </h1>
          <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400 leading-relaxed">
            New registrations go live immediately without waiting for approval. Click any card to flip between main info and hobbies, memories, and goals—or download a collectible Batch '27 card.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenRegister}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Register Now
        </button>
      </div>

      {/* Instant Auto-Approved Celebration Strip */}
      {highlightedMember && (
        <div className="mt-6 p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-300 dark:border-rose-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Profile Card Published Instantly
            </p>
            <p className="text-sm font-bold text-zinc-950 dark:text-white">
              Welcome to Orthohin '27, {highlightedMember.name}!
            </p>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Your flip card is live right below. Flip it to see your details or download your high-res collectible card!
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => toggleFlip(highlightedMember.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Flip My Card
            </button>
            <button
              type="button"
              onClick={() => setCardStudioMember(highlightedMember)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Collectible Card
            </button>
            {onClearHighlight && (
              <button
                type="button"
                onClick={onClearHighlight}
                aria-label="Dismiss welcome banner"
                className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-300 dark:border-zinc-800 w-fit">
          {groups.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setActiveGroup(grp)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeGroup === grp
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs dark:shadow-none'
                  : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, roll, hobby, dream..."
            aria-label="Search batchmates"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
          />
        </div>
      </div>

      {/* 3-in-a-Row Grid of 3D Flip Cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-zinc-50 dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-200">No matching batchmates found</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Try adjusting your search or register as a new member of Orthohin '27.
          </p>
          <button
            type="button"
            onClick={onOpenRegister}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Register Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((person) => {
            const isFlipped = Boolean(flippedIds[person.id]);
            const isHighlighted = highlightedId === person.id;

            return (
              <div key={person.id} className="flex flex-col">
                {/* 3D Flip Stage */}
                <div className="perspective-1200 w-full h-[360px]">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFlipped}
                    aria-label={`${person.name} profile card, press to flip`}
                    onClick={() => toggleFlip(person.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleFlip(person.id);
                      }
                    }}
                    className={`relative w-full h-full transform-style-3d transition-transform duration-500 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-2xl ${
                      isFlipped ? 'rotate-y-180' : ''
                    }`}
                  >
                    {/* FRONT FACE — Main Info */}
                    <div
                      className={`absolute inset-0 backface-hidden rounded-2xl bg-white dark:bg-[#111114] border p-6 flex flex-col justify-between shadow-xs dark:shadow-none transition-colors ${
                        isHighlighted
                          ? 'border-rose-500 ring-2 ring-rose-500/25'
                          : 'border-zinc-300 dark:border-zinc-800/90 hover:border-zinc-500 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 shrink-0 flex items-center justify-center">
                            {person.photo ? (
                              <img
                                src={person.photo}
                                alt={person.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <span className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                                {getInitials(person.name)}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[11px] font-mono font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                              Roll {person.roll || 'N/A'} · {person.group || 'Batchmate'}
                            </p>
                            <h3 className="text-lg font-bold text-zinc-950 dark:text-white leading-snug line-clamp-2">
                              {person.name}
                            </h3>
                            {person.nickname && (
                              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
                                aka "{person.nickname}"
                              </p>
                            )}
                            {person.social && (
                              <p className="text-xs font-mono text-rose-700 dark:text-rose-400 truncate pt-0.5">
                                {person.social}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                          {person.quote ? (
                            <p className="text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed line-clamp-3">
                              "{person.quote}"
                            </p>
                          ) : (
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              Proud member of Orthohin '27 — Rajshahi Collegiate School.
                            </p>
                          )}

                          {person.superpower && (
                            <p className="text-xs text-zinc-700 dark:text-zinc-400 line-clamp-1">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-200">Known for:</span>{' '}
                              {person.superpower}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-mono tabular-nums">
                          {person.bloodGroup ? `${person.bloodGroup} · ` : ''}
                          {person.registeredAt || "Class of '27"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                          <RotateCw className="w-3.5 h-3.5" />
                          Tap to Flip
                        </span>
                      </div>
                    </div>

                    {/* BACK FACE — Hobbies, Dreams, Memories, Hangout, Birthday, Blood Group */}
                    <div
                      className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-zinc-50 dark:bg-[#141419] border p-5 flex flex-col justify-between shadow-xs dark:shadow-none ${
                        isHighlighted
                          ? 'border-rose-500 ring-2 ring-rose-500/25'
                          : 'border-zinc-300 dark:border-zinc-700/80'
                      }`}
                    >
                      <div className="space-y-3 overflow-y-auto pr-1">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400 truncate">
                              {person.name} · #{person.roll}
                            </p>
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                              About &amp; Campus Dossier
                            </h4>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
                            <RotateCw className="w-3 h-3" /> Back
                          </span>
                        </div>

                        <dl className="space-y-2.5 text-xs">
                          <div>
                            <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              Hobbies &amp; Interests
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5 line-clamp-2">
                              {person.hobbies || 'Music, campus adda & Orthohin events'}
                            </dd>
                          </div>

                          <div>
                            <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              Dream &amp; Ambition
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5 line-clamp-1">
                              {person.dreamGoal || 'Making Class of 2027 proud'}
                            </dd>
                          </div>

                          <div>
                            <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                              <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              Favorite RCS Memory
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5 line-clamp-2">
                              {person.favoriteMemory || 'Unforgettable afternoons at Rajshahi Collegiate School'}
                            </dd>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                Hangout
                              </dt>
                              <dd className="text-zinc-700 dark:text-zinc-400 truncate mt-0.5">
                                {person.hangoutSpot || 'RCS Field'}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                                <Droplets className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                Blood · B-Day
                              </dt>
                              <dd className="text-zinc-700 dark:text-zinc-400 font-mono truncate mt-0.5">
                                {[person.bloodGroup, person.birthday].filter(Boolean).join(' · ') || "Batch '27"}
                              </dd>
                            </div>
                          </div>
                        </dl>
                      </div>

                      <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                        <span>{person.superpower ? `Known for: ${person.superpower}` : `Joined ${person.registeredAt || '2026'}`}</span>
                        <span className="font-semibold text-rose-700 dark:text-rose-400 shrink-0 ml-2">Flip Front</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Strip Directly Below Profile Card */}
                <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => toggleFlip(person.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    {isFlipped ? 'Show Front' : 'Flip Card'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBatchmate(person)}
                      title="View full profile details"
                      aria-label={`View full details for ${person.name}`}
                      className="inline-flex items-center justify-center p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardStudioMember(person)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Card
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Profile Detail Modal */}
      {selectedBatchmate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/80 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBatchmate(null);
          }}
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 shrink-0 flex items-center justify-center">
                  {selectedBatchmate.photo ? (
                    <img
                      src={selectedBatchmate.photo}
                      alt={selectedBatchmate.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span className="text-lg font-bold text-rose-700 dark:text-rose-400">
                      {getInitials(selectedBatchmate.name)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-white">{selectedBatchmate.name}</h3>
                  {selectedBatchmate.nickname && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">aka "{selectedBatchmate.nickname}"</p>
                  )}
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    <span className="font-mono tabular-nums">Roll {selectedBatchmate.roll || 'N/A'}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{selectedBatchmate.group || 'Batchmate'}</span>
                  </p>
                  {selectedBatchmate.social && (
                    <p className="text-xs font-mono text-rose-700 dark:text-rose-400 mt-1">{selectedBatchmate.social}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchmate(null)}
                className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedBatchmate.quote && (
              <p className="text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
                "{selectedBatchmate.quote}"
              </p>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80 text-xs">
              <div>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-200">Hobbies &amp; Interests</dt>
                <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5">{selectedBatchmate.hobbies || 'Not specified'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-200">Dream Goal</dt>
                <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5">{selectedBatchmate.dreamGoal || 'Not specified'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-200">Known For / Superpower</dt>
                <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5">{selectedBatchmate.superpower || 'Not specified'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-200">Hangout Spot</dt>
                <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5">{selectedBatchmate.hangoutSpot || 'RCS Campus'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Blood Group
                </dt>
                <dd className="text-zinc-700 dark:text-zinc-400 font-mono mt-0.5">{selectedBatchmate.bloodGroup || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                  <Cake className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Birthday
                </dt>
                <dd className="text-zinc-700 dark:text-zinc-400 font-mono mt-0.5">{selectedBatchmate.birthday || '—'}</dd>
              </div>
              {selectedBatchmate.favoriteMemory && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-zinc-900 dark:text-zinc-200">Favorite RCS Campus Memory</dt>
                  <dd className="text-zinc-700 dark:text-zinc-400 mt-0.5 leading-relaxed">{selectedBatchmate.favoriteMemory}</dd>
                </div>
              )}
            </dl>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
              <span className="text-xs text-zinc-600 dark:text-zinc-500 font-mono tabular-nums">
                Joined {selectedBatchmate.registeredAt || '2026'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const target = selectedBatchmate;
                  setSelectedBatchmate(null);
                  setCardStudioMember(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Collectible Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collectible Batch '27 Card Download Studio Modal */}
      {cardStudioMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 dark:bg-black/85 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="card-studio-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCardStudioMember(null);
          }}
        >
          <div className="w-full max-w-4xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Collectible Cohort Card Studio · 1080 × 1520 PNG
                </p>
                <h3 id="card-studio-title" className="text-lg font-bold text-zinc-950 dark:text-white">
                  {cardStudioMember.name}'s Official Batch '27 Card
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCardStudioMember(null)}
                aria-label="Close card studio"
                className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-12 gap-6 p-6 items-start">
              {/* Live Rendered High-Res Card Preview */}
              <div className="md:col-span-6 flex items-center justify-center">
                <div className="w-full max-w-[330px] aspect-[1080/1520] rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center shadow-lg">
                  {isRenderingCard || !cardPreviewUrl ? (
                    <div className="p-6 text-center space-y-2">
                      <Sparkles className="w-6 h-6 text-rose-600 dark:text-rose-400 mx-auto animate-pulse" />
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">Crafting collectible card...</p>
                    </div>
                  ) : (
                    <img
                      src={cardPreviewUrl}
                      alt={`${cardStudioMember.name} collectible card preview`}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>

              {/* Edition Switcher & Download Controls */}
              <div className="md:col-span-6 space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">Choose Collector Edition</p>
                  <div className="space-y-2">
                    {CARD_EDITIONS.map((ed) => {
                      const active = cardEdition === ed.id;
                      return (
                        <button
                          key={ed.id}
                          type="button"
                          onClick={() => setCardEdition(ed.id)}
                          className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            active
                              ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-500 text-zinc-950 dark:text-white'
                              : 'bg-zinc-50 dark:bg-zinc-900/70 border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-5 h-5 rounded-full border border-white/40 shrink-0"
                              style={{ backgroundColor: ed.swatch }}
                            />
                            <div>
                              <p className="text-xs font-bold">{ed.label}</p>
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{ed.tagline}</p>
                            </div>
                          </div>
                          {active && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-950 dark:text-white">Included on this card</p>
                  <p>
                    Portrait · Serial RCS-{cardStudioMember.roll} · Cohort Vibe Stamp · Signature Quote · Hobbies, Dream Goal, Superpower, Hangout Spot, Blood Group &amp; Collectible Barcode
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadFromStudio}
                    disabled={isRenderingCard || isDownloadingCard}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isDownloadingCard ? 'Downloading PNG...' : 'Download High-Res Card (PNG)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyShareCaption}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {captionCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Share Caption Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Story / Post Caption
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
