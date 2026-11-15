import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, UserPlus, X } from 'lucide-react';
import type { Batchmate } from '../types';
import { compressImage, getInitials } from '../utils/storage';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (batchmate: Batchmate) => Promise<void> | void;
}

const GROUP_OPTIONS = ['Science', 'Commerce', 'Humanities', 'Section A', 'Section B'];

export function RegisterModal({ isOpen, onClose, onRegister }: RegisterModalProps) {
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
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    const timer = setTimeout(() => nameInputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(timer);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

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

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-xl bg-[#111114] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-800/80">
          <div>
            <p className="text-xs font-medium text-rose-400 mb-1">Orthohin '27 · Official Cohort Directory</p>
            <h2 id="register-modal-title" className="text-xl font-bold text-white tracking-tight">
              Batchmate Registration Form
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 rounded-lg inline-flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
            aria-label="Close registration form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo Upload Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-zinc-700 bg-zinc-950 shrink-0 flex items-center justify-center">
              {photo ? (
                <img src={photo} alt="Registration preview" className="w-full h-full object-cover object-top" />
              ) : (
                <span className="text-lg font-bold text-zinc-400">{getInitials(name || 'O27')}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Profile Portrait</p>
              <p className="text-xs text-zinc-400 mt-0.5">
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
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPhoto ? (
                    <>
                      <Upload className="w-3.5 h-3.5 animate-pulse" /> Processing...
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 text-rose-400" /> {photo ? 'Change Photo' : 'Upload Photo'}
                    </>
                  )}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="reg-full-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="reg-full-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Abrar Al Razee Oytizzoh"
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Roll & Group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-roll" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Roll / ID Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="reg-roll"
                type="text"
                required
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                placeholder="e.g. 2714"
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="reg-group" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Group / Section
              </label>
              <select
                id="reg-group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
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
              <label htmlFor="reg-custom-group" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Specify Group or Institution
              </label>
              <input
                id="reg-custom-group"
                type="text"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="e.g. Arts / Section C"
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          )}

          {/* Social Handle */}
          <div>
            <label htmlFor="reg-social" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Instagram or Social Handle <span className="text-zinc-500">(Optional)</span>
            </label>
            <input
              id="reg-social"
              type="text"
              value={social}
              onChange={(e) => setSocial(e.target.value)}
              placeholder="e.g. @username"
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Batch Quote */}
          <div>
            <label htmlFor="reg-quote" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Memory or Note for Batch '27 <span className="text-zinc-500">(Optional)</span>
            </label>
            <textarea
              id="reg-quote"
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Share a favorite memory, milestone, or message for the cohort..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors resize-none"
            />
          </div>

          {error && (
            <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessingPhoto || isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
