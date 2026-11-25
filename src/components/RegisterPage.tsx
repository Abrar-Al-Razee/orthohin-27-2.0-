import { useRef, useState } from 'react';
import { ArrowLeft, Camera, Upload, UserPlus, Users } from 'lucide-react';
import type { Batchmate, ViewMode } from '../types';
import { compressImage, getInitials } from '../utils/storage';

interface RegisterPageProps {
  registrationOpen: boolean;
  onNavigate: (view: ViewMode) => void;
  onRegister: (batchmate: Batchmate) => Promise<void> | void;
}

const GROUP_OPTIONS = ['Science', 'Commerce', 'Humanities', 'Section A', 'Section B'];

export function RegisterPage({ registrationOpen, onNavigate, onRegister }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [group, setGroup] = useState('Science');
  const [customGroup, setCustomGroup] = useState('');
  const [social, setSocial] = useState('');
  const [quote, setQuote] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressImage(file, 600);
      setPhoto(compressed);
    } catch {
      setError('Could not process that image. Please choose a valid JPG or PNG file.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const resetForm = () => {
    setName('');
    setRoll('');
    setGroup('Science');
    setCustomGroup('');
    setSocial('');
    setQuote('');
    setPhoto('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const trimmedRoll = roll.trim();
    const resolvedGroup = (group === 'Other' ? customGroup.trim() : group.trim()) || 'Batchmate';

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }

    if (!trimmedRoll) {
      setError('Please enter your Roll or ID number.');
      return;
    }

    const newBatchmate: Batchmate = {
      id: `bm-${Date.now()}`,
      name: trimmedName,
      roll: trimmedRoll,
      group: resolvedGroup,
      social: social.trim() || undefined,
      quote: quote.trim() || undefined,
      photo: photo || undefined,
      registeredAt: new Date().toISOString().slice(0, 10),
    };

    setIsSubmitting(true);
    setError('');
    try {
      await onRegister(newBatchmate);
      resetForm();
    } catch {
      setError('Could not save your registration right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="pt-28 pb-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>

        <button
          type="button"
          onClick={() => onNavigate('batchmates')}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" />
          View Batchmates Directory
        </button>
      </div>

      {!registrationOpen ? (
        <div className="rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none p-8 sm:p-10 text-center space-y-4">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Orthohin '27 · Registration</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white">Registration Currently Paused</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-400 max-w-md mx-auto">
            New batchmate directory sign-ups are temporarily paused by the batch admin. You can still browse existing batchmates.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('batchmates')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Browse Batchmates
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Orthohin '27 · Official Cohort Directory</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
              Batchmate Registration Form
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Add your profile to the official Rajshahi Collegiate School Batch '27 directory.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {/* Photo Upload Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800">
              <div className="w-20 h-20 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 shrink-0 flex items-center justify-center">
                {photo ? (
                  <img src={photo} alt="Registration preview" className="w-full h-full object-cover object-top" />
                ) : (
                  <span className="text-lg font-bold text-zinc-600 dark:text-zinc-400">{getInitials(name || 'O27')}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-950 dark:text-white">Profile Portrait</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Upload a clear portrait photo for your directory card, or skip to use your initials.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPhoto ? (
                      <>
                        <Upload className="w-3.5 h-3.5 animate-pulse" /> Processing...
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> {photo ? 'Change Photo' : 'Upload Photo'}
                      </>
                    )}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => setPhoto('')}
                      className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="reg-page-full-name" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Full Name <span className="text-rose-600 dark:text-rose-500">*</span>
              </label>
              <input
                id="reg-page-full-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Abrar Al Razee Oytizzoh"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>

            {/* Roll & Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-page-roll" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Roll / ID Number <span className="text-rose-600 dark:text-rose-500">*</span>
                </label>
                <input
                  id="reg-page-roll"
                  type="text"
                  required
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="e.g. 2714"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-mono text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="reg-page-group" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Group / Section
                </label>
                <select
                  id="reg-page-group"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                >
                  {GROUP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {group === 'Other' && (
              <div>
                <label htmlFor="reg-page-custom-group" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Specify Group or Institution
                </label>
                <input
                  id="reg-page-custom-group"
                  type="text"
                  value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)}
                  placeholder="e.g. Arts / Section C"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>
            )}

            {/* Social Handle */}
            <div>
              <label htmlFor="reg-page-social" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Instagram or Social Handle <span className="text-zinc-600 dark:text-zinc-500">(Optional)</span>
              </label>
              <input
                id="reg-page-social"
                type="text"
                value={social}
                onChange={(e) => setSocial(e.target.value)}
                placeholder="e.g. @username"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>

            {/* Batch Quote */}
            <div>
              <label htmlFor="reg-page-quote" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Memory or Note for Batch '27 <span className="text-zinc-600 dark:text-zinc-500">(Optional)</span>
              </label>
              <textarea
                id="reg-page-quote"
                rows={3}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Share a favorite memory, milestone, or message for the cohort..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors resize-none"
              />
            </div>

            {error && (
              <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs font-medium text-rose-800 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => onNavigate('batchmates')}
                className="px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingPhoto || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
