import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowUpRight,
  Camera,
  ChevronRight,
  Heart,
  Instagram,
  Megaphone,
  Play,
  Shirt,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { AboutPage } from './components/AboutPage';
import { AdminModal } from './components/AdminModal';
import { BatchmatesView } from './components/BatchmatesView';
import { DirectoryPage } from './components/DirectoryPage';
import { GalleryPage } from './components/GalleryPage';
import { HoodieView } from './components/HoodieView';
import { LightboxModal } from './components/LightboxModal';
import { Navbar } from './components/Navbar';
import { NoticesPage } from './components/NoticesPage';
import { RegisterModal } from './components/RegisterModal';
import { RegisterPage } from './components/RegisterPage';
import { TimelinePage } from './components/TimelinePage';
import { auth } from './firebase';
import {
  addActivityLogInDb,
  createBatchmateInDb,
  createOrderInDb,
  fetchAdminData,
  fetchPublicPortal,
} from './services/apiService';
import type { Batchmate, GalleryItem, HoodieOrder, PortalState, ToastMessage, ViewMode } from './types';
import {
  AUTHORIZED_ADMIN_EMAIL,
  createDefaultState,
  DEFAULT_HERO_IMAGE,
  DEFAULT_PROFILE_IMAGE,
  mergeHoodieConfig,
  mergeSiteConfig,
} from './utils/storage';

const ROUTE_PATHS: Record<ViewMode, string> = {
  home: '/',
  gallery: '/gallery',
  batchmates: '/batchmates',
  hoodie: '/hoodie',
  directory: '/directory',
  notices: '/notices',
  about: '/about',
  timeline: '/timeline',
  register: '/register',
  admin: '/admin',
};

const ROUTE_TITLES: Record<ViewMode, string> = {
  home: "ORTHOHIN '27 · Official Batch Portal (Class of 2027)",
  gallery: "Gallery · ORTHOHIN '27",
  batchmates: "Batchmates · ORTHOHIN '27",
  hoodie: "Hoodie '26-'27 · ORTHOHIN '27",
  directory: "Directory · ORTHOHIN '27",
  notices: "Notices · ORTHOHIN '27",
  about: "About · ORTHOHIN '27",
  timeline: "Our Journey · ORTHOHIN '27",
  register: "Register · ORTHOHIN '27",
  admin: "Admin Panel · ORTHOHIN '27",
};

function resolveViewFromLocation(): ViewMode {
  if (typeof window === 'undefined') return 'home';
  const rawHash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const candidate = rawHash.startsWith('/') ? rawHash : rawPath;

  switch (candidate) {
    case '/admin':
    case '/admin-login':
      return 'admin';
    case '/gallery':
      return 'gallery';
    case '/batchmates':
      return 'batchmates';
    case '/hoodie':
      return 'hoodie';
    case '/directory':
      return 'directory';
    case '/notices':
      return 'notices';
    case '/about':
      return 'about';
    case '/timeline':
      return 'timeline';
    case '/register':
      return 'register';
    default:
      return 'home';
  }
}

export default function App() {
  const initialView = resolveViewFromLocation();
  const [state, setState] = useState<PortalState>(() => createDefaultState());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>(initialView);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isRouteAdmin, setIsRouteAdmin] = useState<boolean>(initialView === 'admin');
  const [adminOpen, setAdminOpen] = useState<boolean>(initialView === 'admin');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const settingsSeededRef = useRef(false);

  const isFirebaseAdmin = Boolean(
    authUser && authUser.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL && authUser.emailVerified
  );

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  useEffect(() => {
    document.title = ROUTE_TITLES[activeView] || ROUTE_TITLES.home;
  }, [activeView]);

  useEffect(() => {
    const syncRoute = () => {
      const resolved = resolveViewFromLocation();
      const onAdmin = resolved === 'admin';
      setActiveView(resolved);
      setIsRouteAdmin(onAdmin);
      setAdminOpen(onAdmin);
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubAuth();
  }, []);

  const refreshPublicPortal = useCallback(async () => {
    try {
      const defaults = createDefaultState();
      const payload = await fetchPublicPortal();
      const hasSettings = payload.settings !== null;
      if (hasSettings) settingsSeededRef.current = true;

      setState((prev) => ({
        ...prev,
        batchmates:
          payload.batchmates.length > 0 || hasSettings
            ? hasSettings
              ? payload.batchmates
              : [
                  ...payload.batchmates,
                  ...defaults.batchmates.filter((d) => !payload.batchmates.some((i) => i.id === d.id)),
                ]
            : defaults.batchmates,
        notices: payload.notices.length > 0 || hasSettings ? payload.notices : defaults.notices,
        gallery: payload.gallery.length > 0 || hasSettings ? payload.gallery : defaults.gallery,
        profile: payload.settings?.profile || defaults.profile,
        hoodieConfig: mergeHoodieConfig(payload.settings?.hoodieConfig),
        siteConfig: mergeSiteConfig(payload.settings?.siteConfig),
      }));
    } catch {
      // Keep current/default state smoothly without exposing backend details
    }
  }, []);

  const refreshAdminData = useCallback(async () => {
    if (!isFirebaseAdmin) {
      setState((prev) => ({ ...prev, orders: [], activityLog: [] }));
      return;
    }
    try {
      const adminPayload = await fetchAdminData();
      setState((prev) => ({
        ...prev,
        orders: adminPayload.orders,
        activityLog: adminPayload.activityLog,
      }));
    } catch {
      // Handled gracefully
    }
  }, [isFirebaseAdmin]);

  const refreshAllData = useCallback(async () => {
    await Promise.all([refreshPublicPortal(), refreshAdminData()]);
  }, [refreshPublicPortal, refreshAdminData]);

  useEffect(() => {
    void refreshPublicPortal();
    const handleFocus = () => {
      void refreshPublicPortal();
      if (isFirebaseAdmin) {
        void refreshAdminData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshPublicPortal, refreshAdminData, isFirebaseAdmin]);

  useEffect(() => {
    void refreshAdminData();
  }, [refreshAdminData]);

  const updateState = useCallback((next: PortalState) => {
    setState(next);
  }, []);

  const handleNavigate = useCallback((view: ViewMode, sectionId?: string) => {
    const targetPath = ROUTE_PATHS[view] || '/';
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    if (view === 'admin') {
      setIsRouteAdmin(true);
      setAdminOpen(true);
    } else {
      setIsRouteAdmin(false);
      setAdminOpen(false);
    }

    setActiveView(view);
    if (sectionId && view === 'home') {
      window.setTimeout(() => {
        const target = document.getElementById(sectionId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleRegisterSubmit = useCallback(
    async (newBatchmate: Batchmate) => {
      try {
        await createBatchmateInDb(newBatchmate);
        if (isFirebaseAdmin) {
          void addActivityLogInDb(
            'New Registration',
            `${newBatchmate.name} (Roll ${newBatchmate.roll}) registered`
          );
        }
        await refreshAllData();
        setRegisterOpen(false);
        handleNavigate('batchmates');
        showToast(`Welcome to Orthohin '27, ${newBatchmate.name}! Your profile is now live.`, 'success');
      } catch (error) {
        showToast('Could not save your registration right now. Please retry.', 'error');
        throw error;
      }
    },
    [handleNavigate, isFirebaseAdmin, refreshAllData, showToast]
  );

  const handlePlaceOrder = useCallback(
    async (order: HoodieOrder) => {
      try {
        await createOrderInDb(order);
        if (isFirebaseAdmin) {
          void addActivityLogInDb(
            'Direct Hoodie Order',
            `${order.id}: ${order.customerName} (Size ${order.size} × ${order.quantity})`
          );
        }
        await refreshAllData();
        showToast(`Direct order ${order.id} placed for Size ${order.size}!`, 'success');
      } catch (error) {
        showToast('Could not place your direct order right now. Please retry.', 'error');
        throw error;
      }
    },
    [isFirebaseAdmin, refreshAllData, showToast]
  );

  const handleCloseAdmin = useCallback(() => {
    setAdminOpen(false);
    if (isRouteAdmin) {
      setIsRouteAdmin(false);
      setActiveView('home');
      window.history.pushState({}, '', '/');
    }
  }, [isRouteAdmin]);

  const sc = mergeSiteConfig(state.siteConfig);
  const sec = sc.sections!;
  const isMaintenanceBlocked = Boolean(sc.maintenanceMode) && !adminOpen;

  if (isMaintenanceBlocked) {
    return (
      <div className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-[#111114] border border-zinc-800 p-8 text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">
            {sc.brandName} {sc.brandAccent}
          </p>
          <h1 className="text-2xl font-bold text-white">Portal Temporarily Paused</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">{sc.maintenanceMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col">
      <Navbar
        activeView={activeView}
        siteConfig={sc}
        onNavigate={handleNavigate}
        onOpenRegister={() => {
          if (sc.registrationOpen !== false) {
            handleNavigate('register');
          } else {
            showToast('Batchmate registration is currently paused by the admin.', 'info');
          }
        }}
      />

      <main className="flex-1">
        {sc.announcement.trim() && (
          <div className="mt-16 bg-rose-950/60 border-b border-rose-500/30 px-4 py-2.5 text-center text-xs font-medium text-rose-200">
            {sc.announcement}
          </div>
        )}

        {activeView === 'home' && (
          <>
            {/* Split-Screen Hero */}
            <section
              className={`${
                sc.announcement.trim() ? 'pt-12' : 'pt-28 lg:pt-36'
              } pb-16 lg:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`}
            >
              <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                  <p className="text-xs sm:text-sm font-medium text-rose-400">{sc.heroKicker}</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] text-balance">
                    {sc.heroTitle} <span className="text-rose-500">{sc.heroHighlight}</span>
                  </h1>
                  <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-xl">{sc.heroDescription}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {sc.registrationOpen !== false && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('register')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      >
                        <UserPlus className="w-4 h-4" />
                        Register Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleNavigate('batchmates')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#111114] hover:bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-zinc-400" />
                      Batchmates Directory
                    </button>
                    {sec.hoodieNav && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('hoodie')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#111114] hover:bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer"
                      >
                        <Shirt className="w-4 h-4 text-rose-400" />
                        Hoodie '26-'27
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-white h-full min-h-[280px] lg:min-h-[420px]">
                    <img
                      src={sc.heroImage || DEFAULT_HERO_IMAGE}
                      alt="Rajshahi Collegiate School (Est. 1828) gate showcase"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                </div>
              </div>

              {/* Full-Width 4-Column KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 pt-10 border-t border-zinc-800/80">
                {(sc.kpis || []).map((kpi, idx) => (
                  <button
                    key={kpi.id || idx}
                    type="button"
                    onClick={() => handleNavigate(kpi.autoBatchmateCount ? 'batchmates' : 'about')}
                    className="text-left p-5 rounded-2xl bg-[#111114] border border-zinc-800/80 hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    <p
                      className={`text-3xl font-bold font-mono tabular-nums ${
                        idx === (sc.kpis || []).length - 1 ? 'text-rose-500' : 'text-white'
                      }`}
                    >
                      {kpi.autoBatchmateCount ? state.batchmates.length : kpi.value}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">{kpi.label}</p>
                  </button>
                ))}
              </div>

              {/* Official Notice Board */}
              {sec.notices && (state.notices || []).some((n) => n.active) && (
                <div className="mt-10 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => handleNavigate('notices')}
                      className="inline-flex items-center gap-2 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>Official Batch Notices</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('notices')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      View All Notices
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[...(state.notices || [])]
                      .filter((n) => n.active)
                      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
                      .map((notice) => (
                        <button
                          key={notice.id}
                          type="button"
                          onClick={() => handleNavigate('notices')}
                          className="text-left p-5 rounded-2xl bg-[#111114] border border-zinc-800/80 hover:border-zinc-700 transition-colors space-y-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`font-semibold ${
                                notice.category === 'Urgent'
                                  ? 'text-rose-400'
                                  : notice.category === 'Event'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                              }`}
                            >
                              {notice.category}
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span className="font-mono text-zinc-500">{notice.createdAt}</span>
                            {notice.pinned && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="text-rose-400 font-medium">Pinned</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-white">{notice.title}</h3>
                          <p className="text-sm text-zinc-400 leading-relaxed">{notice.message}</p>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>

            {/* About Section */}
            {sec.about && (
              <section id="about" className="py-20 bg-[#0b0b0e] border-y border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-medium text-rose-400">{sc.aboutKicker}</p>
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        About Page
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                      {sc.aboutTitle}
                    </h2>
                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
                      {sc.aboutDescription}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="text-left p-5 rounded-2xl bg-[#111114] border border-zinc-800/80 hover:border-zinc-700 transition-colors space-y-2 cursor-pointer"
                      >
                        <Target className="w-5 h-5 text-rose-500" />
                        <h3 className="text-sm font-semibold text-white">{sc.visionTitle}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{sc.visionText}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="text-left p-5 rounded-2xl bg-[#111114] border border-zinc-800/80 hover:border-zinc-700 transition-colors space-y-2 cursor-pointer"
                      >
                        <Heart className="w-5 h-5 text-rose-500" />
                        <h3 className="text-sm font-semibold text-white">{sc.unityTitle}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{sc.unityText}</p>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="p-8 rounded-2xl bg-[#111114] border border-zinc-800/80 text-center space-y-5">
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="w-14 h-14 mx-auto rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/40 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Open About Page"
                      >
                        <Instagram className="w-7 h-7 text-rose-500" />
                      </button>
                      <div className="space-y-1.5">
                        <h3 className="text-xl font-bold text-white">{sc.instagramHandle}</h3>
                        <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">{sc.instagramBio}</p>
                      </div>
                      <a
                        href={sc.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
                      >
                        View Posts on Instagram
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Gallery Section */}
            {sec.gallery && (
              <section id="gallery" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                  <div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('gallery')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 mb-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Memory Vault
                    </button>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Captured Moments</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('gallery')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111114] hover:bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer w-fit"
                  >
                    Open Gallery Page
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {state.gallery.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#111114] border border-zinc-800/80">
                    <Camera className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">No gallery moments added yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.gallery.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLightboxItem(item)}
                        className="text-left rounded-2xl overflow-hidden bg-[#111114] border border-zinc-800/80 hover:border-zinc-700 transition-colors duration-150 group cursor-pointer flex flex-col"
                      >
                        {item.src && (
                          <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-900">
                            <img
                              src={item.src}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                            />
                            {item.isVideo && (
                              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                <span className="w-12 h-12 rounded-full bg-rose-600 text-white inline-flex items-center justify-center shadow-lg">
                                  <Play className="w-5 h-5 fill-current ml-0.5" />
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            {item.date && <p className="text-xs font-mono text-zinc-500">{item.date}</p>}
                            <h3 className="text-base font-semibold text-white group-hover:text-rose-400 transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">{item.caption}</p>
                          </div>
                          {!item.src && item.isVideo && (
                            <div className="pt-2 inline-flex items-center gap-2 text-xs font-medium text-rose-400">
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Watch video memory</span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Directory / Leadership Section */}
            {sec.directory && (
              <section id="directory" className="py-20 bg-[#0b0b0e] border-y border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
                    <p className="text-xs font-medium text-rose-400">{sc.leadSectionKicker}</p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{sc.leadSectionTitle}</h2>
                    <p className="text-sm text-zinc-400">{sc.leadSectionSubtitle}</p>
                  </div>

                  <div className="max-w-md mx-auto rounded-2xl bg-[#111114] border border-zinc-800/80 p-8 text-center space-y-5">
                    <button
                      type="button"
                      onClick={() => handleNavigate('directory')}
                      className="w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-zinc-700 hover:border-rose-500 transition-colors block cursor-pointer"
                      aria-label="Open Directory Page"
                    >
                      <img
                        src={
                          state.profile &&
                          state.profile !== '/src/assets/images/portrait_lead_abrar_1794766076468.jpg'
                            ? state.profile
                            : DEFAULT_PROFILE_IMAGE
                        }
                        alt={sc.leadName || 'Abrar Al Razee Oytizzoh'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-[center_22%]"
                      />
                    </button>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-rose-400">{sc.leadRole}</p>
                      <h3 className="text-xl font-bold text-white">{sc.leadName}</h3>
                    </div>

                    <p className="text-sm text-zinc-400 leading-relaxed">"{sc.devNote}"</p>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <a
                        href={sc.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                      >
                        Connect on Instagram
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleNavigate('directory')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Directory Page
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('batchmates')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        View All Batchmates
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Timeline Section */}
            {sec.timeline && (sc.timeline || []).length > 0 && (
              <section id="timeline" className="py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 space-y-2">
                  <p className="text-xs font-medium text-rose-400">Cohort Milestones</p>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Our Journey</h2>
                  <button
                    type="button"
                    onClick={() => handleNavigate('timeline')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white pt-1 transition-colors cursor-pointer"
                  >
                    Open Journey Page
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ol className="relative border-l border-zinc-800 space-y-8 ml-3">
                  {(sc.timeline || []).map((item, idx) => (
                    <li key={item.id || idx} className="pl-7 relative">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${
                          idx === (sc.timeline || []).length - 1 ? 'bg-zinc-600' : 'bg-rose-500'
                        }`}
                      />
                      <p
                        className={`text-xs font-mono ${
                          idx === (sc.timeline || []).length - 1 ? 'text-zinc-400' : 'text-rose-400'
                        }`}
                      >
                        {item.tag}
                      </p>
                      <h3 className="text-base font-semibold text-white mt-0.5">{item.title}</h3>
                      <p className="text-sm text-zinc-400 mt-1">{item.description}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}

        {activeView === 'gallery' && (
          <GalleryPage
            gallery={state.gallery}
            onSelectLightbox={setLightboxItem}
            onNavigate={handleNavigate}
          />
        )}

        {activeView === 'notices' && <NoticesPage notices={state.notices} onNavigate={handleNavigate} />}

        {activeView === 'about' && (
          <AboutPage
            siteConfig={sc}
            batchmateCount={state.batchmates.length}
            onNavigate={handleNavigate}
          />
        )}

        {activeView === 'directory' && (
          <DirectoryPage
            siteConfig={sc}
            profileImage={state.profile}
            batchmateCount={state.batchmates.length}
            onNavigate={handleNavigate}
          />
        )}

        {activeView === 'timeline' && <TimelinePage siteConfig={sc} onNavigate={handleNavigate} />}

        {activeView === 'register' && (
          <RegisterPage
            registrationOpen={sc.registrationOpen !== false}
            onNavigate={handleNavigate}
            onRegister={handleRegisterSubmit}
          />
        )}

        {activeView === 'batchmates' && (
          <BatchmatesView
            batchmates={state.batchmates}
            onBackHome={() => handleNavigate('home')}
            onOpenRegister={() => {
              if (sc.registrationOpen !== false) {
                handleNavigate('register');
              } else {
                showToast('Batchmate registration is currently paused by the admin.', 'info');
              }
            }}
          />
        )}

        {activeView === 'hoodie' && (
          <HoodieView
            config={state.hoodieConfig}
            instagramUrl={sc.instagramUrl}
            onPlaceOrder={handlePlaceOrder}
            onViewBatchmates={() => handleNavigate('batchmates')}
            onBackHome={() => handleNavigate('home')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900 text-center px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>{sc.footerText}</p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className="hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Home
            </button>
            {sec.notices && (
              <button
                type="button"
                onClick={() => handleNavigate('notices')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Notices
              </button>
            )}
            {sec.about && (
              <button
                type="button"
                onClick={() => handleNavigate('about')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                About
              </button>
            )}
            {sec.gallery && (
              <button
                type="button"
                onClick={() => handleNavigate('gallery')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Gallery
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNavigate('batchmates')}
              className="hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Batchmates
            </button>
            {sec.hoodieNav && (
              <button
                type="button"
                onClick={() => handleNavigate('hoodie')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Hoodie '26-'27
              </button>
            )}
            {sec.directory && (
              <button
                type="button"
                onClick={() => handleNavigate('directory')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Directory
              </button>
            )}
            {sec.timeline && (
              <button
                type="button"
                onClick={() => handleNavigate('timeline')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Our Journey
              </button>
            )}
            {sc.registrationOpen !== false && (
              <button
                type="button"
                onClick={() => handleNavigate('register')}
                className="hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Register
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <RegisterModal
        isOpen={registerOpen && sc.registrationOpen !== false}
        onClose={() => setRegisterOpen(false)}
        onRegister={handleRegisterSubmit}
      />

      <LightboxModal item={lightboxItem} onClose={() => setLightboxItem(null)} />

      <AdminModal
        isOpen={adminOpen}
        isRouteAdmin={isRouteAdmin}
        state={{ ...state, siteConfig: sc, hoodieConfig: mergeHoodieConfig(state.hoodieConfig) }}
        authUser={authUser}
        isFirebaseAdmin={isFirebaseAdmin}
        onClose={handleCloseAdmin}
        onUpdateState={updateState}
        onRefreshData={refreshAllData}
        onOpenRegister={() => handleNavigate('register')}
        onToast={showToast}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-xs font-medium shadow-xl backdrop-blur-md ${
            toast.tone === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : toast.tone === 'info'
                ? 'bg-zinc-900/95 border-zinc-700 text-zinc-200'
                : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
