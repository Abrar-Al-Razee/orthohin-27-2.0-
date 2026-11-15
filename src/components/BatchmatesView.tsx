import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import type { Batchmate } from '../types';
import { getInitials } from '../utils/storage';

interface BatchmatesViewProps {
  batchmates: Batchmate[];
  onOpenRegister: () => void;
}

export function BatchmatesView({ batchmates, onOpenRegister }: BatchmatesViewProps) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [selectedBatchmate, setSelectedBatchmate] = useState<Batchmate | null>(null);

  useEffect(() => {
    if (!selectedBatchmate) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedBatchmate(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedBatchmate]);

  const groups = useMemo(() => {
    const unique = Array.from(new Set(batchmates.map((b) => b.group || 'Batchmate')));
    return ['All', ...unique];
  }, [batchmates]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return batchmates.filter((b) => {
      const matchesGroup = activeGroup === 'All' || (b.group || 'Batchmate') === activeGroup;
      const matchesSearch =
        !query ||
        b.name.toLowerCase().includes(query) ||
        b.roll.toLowerCase().includes(query) ||
        (b.social && b.social.toLowerCase().includes(query));
      return matchesGroup && matchesSearch;
    });
  }, [batchmates, activeGroup, search]);

  return (
    <section className="pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-800/80">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-rose-400">Community Directory · Class of 2027</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">Registered Batchmates</h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Explore members of Orthohin '27. Click any card to view their profile note, or register to add yourself.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenRegister}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Register Now
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800 w-fit">
          {groups.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setActiveGroup(grp)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeGroup === grp ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, roll, or handle..."
            aria-label="Search batchmates"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>
      </div>

      {/* 3-in-a-Row Grid on Desktop */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-[#111114] border border-zinc-800/80">
          <p className="text-base font-medium text-zinc-200">No matching batchmates found</p>
          <p className="text-sm text-zinc-400 mt-1">Try adjusting your search or add a new member to the cohort.</p>
          <button
            type="button"
            onClick={onOpenRegister}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Register Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => setSelectedBatchmate(person)}
              className="text-left p-6 rounded-2xl bg-[#111114] border border-zinc-800/80 hover:border-zinc-700 transition-colors duration-150 cursor-pointer group flex items-start gap-4"
            >
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center">
                {person.photo ? (
                  <img
                    src={person.photo}
                    alt={person.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <span className="text-xl font-bold text-zinc-400">{getInitials(person.name)}</span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="text-base font-semibold text-white group-hover:text-rose-400 transition-colors truncate">
                  {person.name}
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400">
                  <span className="font-mono tabular-nums">Roll {person.roll || 'N/A'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{person.group || 'Batchmate'}</span>
                </div>
                {person.social && <p className="text-xs font-mono text-rose-400 truncate">{person.social}</p>}
                {person.quote && <p className="text-xs text-zinc-400 line-clamp-2 pt-1 leading-relaxed">{person.quote}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Batchmate Detail Modal */}
      {selectedBatchmate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBatchmate(null);
          }}
        >
          <div className="w-full max-w-md bg-[#111114] border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center">
                  {selectedBatchmate.photo ? (
                    <img
                      src={selectedBatchmate.photo}
                      alt={selectedBatchmate.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span className="text-lg font-bold text-zinc-400">{getInitials(selectedBatchmate.name)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedBatchmate.name}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    <span className="font-mono tabular-nums">Roll {selectedBatchmate.roll || 'N/A'}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{selectedBatchmate.group || 'Batchmate'}</span>
                  </p>
                  {selectedBatchmate.social && (
                    <p className="text-xs font-mono text-rose-400 mt-1">{selectedBatchmate.social}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchmate(null)}
                className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedBatchmate.quote ? (
              <p className="text-sm text-zinc-300 leading-relaxed pt-2 border-t border-zinc-800/80">
                "{selectedBatchmate.quote}"
              </p>
            ) : (
              <p className="text-sm text-zinc-500 pt-2 border-t border-zinc-800/80">
                Member of Orthohin '27 — Class of 2027.
              </p>
            )}

            {selectedBatchmate.registeredAt && (
              <p className="text-xs text-zinc-500 font-mono tabular-nums">
                Registered on {selectedBatchmate.registeredAt}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
