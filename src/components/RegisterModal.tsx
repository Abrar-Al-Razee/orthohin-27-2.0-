import { useEffect, useRef, useState } from 'react';
import { Camera, Lock, Sparkles, Upload, UserPlus, X } from 'lucide-react';
import type { Batchmate } from '../types';
import { compressImage, getInitials } from '../utils/storage';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (batchmate: Batchmate) => Promise<void> | void;
}

const GROUP_OPTIONS = ['Science', 'Commerce', 'Humanities', 'Section A', 'Section B'];
const BLOOD_GROUP_OPTIONS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function RegisterModal({ isOpen, onClose, onRegister }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [roll, setRoll] = useState('');
  const [group, setGroup] = useState('Science');
  const [customGroup, setCustomGroup] = useState('');
  const [social, setSocial] = useState('');
  const [quote, setQuote] = useState('');

  // Flip-card back info
  const [hobbies, setHobbies] = useState('');
  const [dreamGoal, setDreamGoal] = useState('');
  const [hangoutSpot, setHangoutSpot] = useState('');
  const [superpower, setSuperpower] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [birthday, setBirthday] = useState('');
  const [favoriteMemory, setFavoriteMemory] = useState('');

  // Admin-only contact
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

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
      const compressed = await compressImage(file, 600, 180000);
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
    setNickname('');
    setRoll('');
    setGroup('Science');
    setCustomGroup('');
    setSocial('');
    setQuote('');
    setHobbies('');
    setDreamGoal('');
    setHangoutSpot('');
    setSuperpower('');
    setBloodGroup('');
    setBirthday('');
    setFavoriteMemory('');
    setEmail('');
    setPhone('');
    setPhoto('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const trimmedRoll = roll.trim();
    const trimmedEmail = email.trim();
    const resolvedGroup = (group === 'Other' ? customGroup.trim() : group.trim()) || 'Batchmate';

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }

    if (!trimmedRoll) {
      setError('Please enter your Roll or ID number.');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address or leave it blank.');
      return;
    }

    const newBatchmate: Batchmate = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      nickname: nickname.trim() || undefined,
      roll: trimmedRoll,
      group: resolvedGroup,
      social: social.trim() || undefined,
      quote: quote.trim() || undefined,
      photo: photo || undefined,
      hobbies: hobbies.trim() || undefined,
      bloodGroup: bloodGroup.trim() || undefined,
      dreamGoal: dreamGoal.trim() || undefined,
      favoriteMemory: favoriteMemory.trim() || undefined,
      hangoutSpot: hangoutSpot.trim() || undefined,
      birthday: birthday.trim() || undefined,
      superpower: superpower.trim() || undefined,
      email: trimmedEmail || undefined,
      phone: phone.trim() || undefined,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">Orthohin '27 · Instant Profile Activation</p>
            <h2 id="register-modal-title" className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">
              Batchmate Registration &amp; Flip Card
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 rounded-lg inline-flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
            aria-label="Close registration form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Photo Upload Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 shrink-0 flex items-center justify-center">
              {photo ? (
                <img src={photo} alt="Registration preview" className="w-full h-full object-cover object-top" />
              ) : (
                <span className="text-lg font-bold text-zinc-600 dark:text-zinc-400">{getInitials(name || 'O27')}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Profile Card Portrait</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Upload a portrait photo for your flip card and collectible Batch '27 PNG card.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-full-name" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Full Name <span className="text-rose-600 dark:text-rose-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="reg-full-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Abrar Al Razee Oytizzoh"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="reg-nickname" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Nickname / Dak Nam
              </label>
              <input
                id="reg-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Oytizzoh"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-roll" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Roll / ID Number <span className="text-rose-600 dark:text-rose-500">*</span>
              </label>
              <input
                id="reg-roll"
                type="text"
                required
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                placeholder="e.g. 2714"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-mono text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="reg-group" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Group / Section
              </label>
              <select
                id="reg-group"
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
              <label htmlFor="reg-custom-group" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Specify Group or Section
              </label>
              <input
                id="reg-custom-group"
                type="text"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="e.g. Arts / Section C"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label htmlFor="reg-social" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
              Instagram or Social Handle
            </label>
            <input
              id="reg-social"
              type="text"
              value={social}
              onChange={(e) => setSocial(e.target.value)}
              placeholder="e.g. @username"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="reg-quote" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
              Signature Quote <span className="text-zinc-500">(Front card)</span>
            </label>
            <textarea
              id="reg-quote"
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Share a favorite motto or message for Batch '27..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors resize-none"
            />
          </div>

          {/* Flip Card Back Fields */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-4">
            <p className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Back of Flip Card Details
            </p>

            <div>
              <label htmlFor="reg-hobbies" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Hobbies &amp; Interests
              </label>
              <input
                id="reg-hobbies"
                type="text"
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                placeholder="e.g. Football, Photography, Guitar, Coding"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-dream" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Dream Goal / Future Ambition
                </label>
                <input
                  id="reg-dream"
                  type="text"
                  value={dreamGoal}
                  onChange={(e) => setDreamGoal(e.target.value)}
                  placeholder="e.g. Software Architect, Doctor"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="reg-superpower" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Known For / Superpower
                </label>
                <input
                  id="reg-superpower"
                  type="text"
                  value={superpower}
                  onChange={(e) => setSuperpower(e.target.value)}
                  placeholder="e.g. Fixing laptops, Last-minute notes"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="reg-blood" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Blood Group
                </label>
                <select
                  id="reg-blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                >
                  {BLOOD_GROUP_OPTIONS.map((bg) => (
                    <option key={bg || 'none'} value={bg}>
                      {bg || 'Select'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-birthday" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Birthday
                </label>
                <input
                  id="reg-birthday"
                  type="text"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  placeholder="e.g. 14 Aug"
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="reg-hangout" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Hangout Spot
                </label>
                <input
                  id="reg-hangout"
                  type="text"
                  value={hangoutSpot}
                  onChange={(e) => setHangoutSpot(e.target.value)}
                  placeholder="e.g. RCS Canteen"
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-memory" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                Favorite RCS Campus Memory
              </label>
              <textarea
                id="reg-memory"
                rows={2}
                value={favoriteMemory}
                onChange={(e) => setFavoriteMemory(e.target.value)}
                placeholder="Best RCS memory you want preserved on the back of your card..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Private Admin-Only Contact */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-300 dark:border-zinc-800 space-y-3">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Admin-Only Contact (Hidden from public cards)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for batch updates (optional)"
                aria-label="Email address"
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone / WhatsApp (optional)"
                aria-label="Phone number"
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs font-medium text-rose-800 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={handleClose}
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
              {isSubmitting ? 'Publishing...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
