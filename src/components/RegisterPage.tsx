import { useRef, useState } from 'react';
import { ArrowLeft, Camera, Lock, Sparkles, Upload, UserPlus, Users } from 'lucide-react';
import type { Batchmate, ViewMode } from '../types';
import { compressImage, getInitials } from '../utils/storage';

interface RegisterPageProps {
  registrationOpen: boolean;
  onNavigate: (view: ViewMode) => void;
  onRegister: (batchmate: Batchmate) => Promise<void> | void;
}

const GROUP_OPTIONS = ['Science', 'Commerce', 'Humanities', 'Section A', 'Section B'];
const BLOOD_GROUP_OPTIONS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function RegisterPage({ registrationOpen, onNavigate, onRegister }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [roll, setRoll] = useState('');
  const [group, setGroup] = useState('Science');
  const [customGroup, setCustomGroup] = useState('');
  const [social, setSocial] = useState('');
  const [quote, setQuote] = useState('');

  // Flip-card back profile details
  const [hobbies, setHobbies] = useState('');
  const [dreamGoal, setDreamGoal] = useState('');
  const [hangoutSpot, setHangoutSpot] = useState('');
  const [superpower, setSuperpower] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [birthday, setBirthday] = useState('');
  const [favoriteMemory, setFavoriteMemory] = useState('');

  // Private admin-only contact details
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

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
          <div className="px-6 sm:px-8 py-6 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Orthohin '27 · Instant Profile Card Activation</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
              Batchmate Registration &amp; Flip Card
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">
              Your profile card appears immediately in the Batchmates directory without waiting for approval. Main info shows on the front; hobbies, memories, and goals appear when anyone flips your card.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
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
                  Upload a crisp photo for your flip card and downloadable Batch '27 collectible card.
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

            {/* Front Card Info */}
            <div className="space-y-4">
              <div className="pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
                <h2 className="text-sm font-bold text-zinc-950 dark:text-white">01. Front Profile Card (Main Info)</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Shown immediately on the front face of your batchmate card.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div>
                  <label htmlFor="reg-page-nickname" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Nickname / Dak Nam <span className="text-zinc-500">(Optional)</span>
                  </label>
                  <input
                    id="reg-page-nickname"
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
                    Specify Group or Section
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

              <div>
                <label htmlFor="reg-page-social" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Instagram or Social Handle <span className="text-zinc-500">(Optional)</span>
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

              <div>
                <label htmlFor="reg-page-quote" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Signature Bio or Motto <span className="text-zinc-500">(Front card quote)</span>
                </label>
                <textarea
                  id="reg-page-quote"
                  rows={2}
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="One line that defines your Orthohin '27 spirit..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Flip Card Back Info */}
            <div className="space-y-4">
              <div className="pb-2 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    02. Back of Flip Card (Interests, Goals &amp; Memories)
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Revealed when batchmates flip your card and printed on your downloadable collectible card.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="reg-page-hobbies" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Hobbies &amp; Interests
                </label>
                <input
                  id="reg-page-hobbies"
                  type="text"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="e.g. Football, Photography, Guitar, Coding, Gaming"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-page-dream" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Dream Goal / Future Ambition
                  </label>
                  <input
                    id="reg-page-dream"
                    type="text"
                    value={dreamGoal}
                    onChange={(e) => setDreamGoal(e.target.value)}
                    placeholder="e.g. Software Architect, Doctor, Filmmaker"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-page-superpower" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Known For / Batch Superpower
                  </label>
                  <input
                    id="reg-page-superpower"
                    type="text"
                    value={superpower}
                    onChange={(e) => setSuperpower(e.target.value)}
                    placeholder="e.g. Last-minute exam savior, Meme supplier"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label htmlFor="reg-page-blood" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Blood Group
                  </label>
                  <select
                    id="reg-page-blood"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  >
                    {BLOOD_GROUP_OPTIONS.map((bg) => (
                      <option key={bg || 'none'} value={bg}>
                        {bg || 'Select Blood Group'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="reg-page-birthday" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Birthday (Day &amp; Month)
                  </label>
                  <input
                    id="reg-page-birthday"
                    type="text"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    placeholder="e.g. 14 Aug"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="reg-page-hangout" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Favorite Hangout Spot
                  </label>
                  <input
                    id="reg-page-hangout"
                    type="text"
                    value={hangoutSpot}
                    onChange={(e) => setHangoutSpot(e.target.value)}
                    placeholder="e.g. RCS Canteen / Field"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-page-memory" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Favorite RCS Campus Memory
                </label>
                <textarea
                  id="reg-page-memory"
                  rows={2}
                  value={favoriteMemory}
                  onChange={(e) => setFavoriteMemory(e.target.value)}
                  placeholder="A moment from Rajshahi Collegiate School you will never forget..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Private Admin-Only Contact Info */}
            <div className="space-y-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-300 dark:border-zinc-800">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 dark:text-white">03. Member Contact (Batch Admin Only)</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Used strictly by Orthohin '27 admins for reunion invites, hoodie updates, and batch emails. Never shown on public profile cards.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-page-email" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Email Address <span className="text-zinc-500">(Recommended for batch mail)</span>
                  </label>
                  <input
                    id="reg-page-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-page-phone" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                    Phone / WhatsApp <span className="text-zinc-500">(Optional)</span>
                  </label>
                  <input
                    id="reg-page-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs font-medium text-rose-800 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                No approval delay — your flip profile card goes live right away.
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
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
                  {isSubmitting ? 'Publishing Card...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
