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
  isUsingFirestoreBackend,
  subscribeAdminDataInFirestore,
  subscribePublicPortalInFirestore,
} from './services/apiService';
import type { Batchmate, GalleryItem, HoodieOrder, PortalState, ToastMessage, ViewMode } from './types';
import {
  AUTHORIZED_ADMIN_EMAIL,
  createDefaultState,
  DEFAULT_HERO_IMAGE,
  DEFAULT_PROFILE_IMAGE,
  getInitials,
  mergeHoodieConfig,
  mergeSiteConfig,
  SITE_LOGO_SRC,
} from './utils/storage';
import { useTheme } from './utils/theme';

export const LIVE_SYNC_CHANNEL = 'orthohin27_live_sync';
export const LIVE_SYNC_STORAGE_KEY = 'orthohin27_live_sync_ping';

const ROUTE_PATHS: Record<ViewMode, string> = {
  home: '/',
  gallery: '/gallery',
  batchmates: '/batchmates',
  hoodie: '/hoodie',
  directory: '/admin-panel',
  notices: '/notices',
  about: '/about',
  timeline: '/timeline',
  register: '/register',
  admin: '/rcs-admin',
};

const ROUTE_TITLES: Record<ViewMode, string> = {
  home: "ORTHOHIN '27 · Official Batch Portal (Class of 2027)",
  gallery: "Gallery · ORTHOHIN '27",
  batchmates: "Batchmates · ORTHOHIN '27",
  hoodie: "Hoodie '26-'27 · ORTHOHIN '27",
  directory: "Admin Panel · ORTHOHIN '27",
  notices: "Notices · ORTHOHIN '27",
  about: "About · ORTHOHIN '27",
  timeline: "Our Journey · ORTHOHIN '27",
  register: "Register · ORTHOHIN '27",
  admin: "RCS Control · ORTHOHIN '27",
};

function resolveViewFromLocation(): ViewMode {
  if (typeof window === 'undefined') return 'home';
  const rawHash = window.location.hash.replace(/^#/, '').toLowerCase().replace(/\/+$/, '');
  const rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const rawSearch = window.location.search.toLowerCase();
  const candidate = rawHash.startsWith('/') ? rawHash : rawPath;

  if (
    candidate === '/rcs-admin' ||
    candidate.startsWith('/rcs-admin/') ||
    rawHash === 'rcs-admin' ||
    rawSearch.includes('rcs-admin')
  ) {
    return 'admin';
  }

  switch (candidate) {
    case '/gallery':
      return 'gallery';
    case '/batchmates':
      return 'batchmates';
    case '/hoodie':
      return 'hoodie';
    case '/admin-panel':
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
  const [firestoreRealtimeActive, setFirestoreRealtimeActive] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const toastTimerRef = useRef<number | null>(null);
  const settingsSeededRef = useRef(false);
  const keyBufferRef = useRef('');
  const lastLocalEditAtRef = useRef(0);

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
    const triggerRcsAdmin = (target?: HTMLElement | null) => {
      keyBufferRef.current = '';
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        (target as HTMLInputElement).blur();
      }
      if (window.location.pathname !== ROUTE_PATHS.admin) {
        window.history.pushState({}, '', ROUTE_PATHS.admin);
      }
      setIsRouteAdmin(true);
      setAdminOpen(true);
      setActiveView('admin');
      showToast('Admin gateway opened.', 'info');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (adminOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') {
        return;
      }

      if (e.key === 'Backspace') {
        keyBufferRef.current = keyBufferRef.current.slice(0, -1);
        return;
      }
      if (e.key === 'Escape') {
        keyBufferRef.current = '';
        return;
      }

      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        keyBufferRef.current = (keyBufferRef.current + e.key.toLowerCase()).slice(-24);
        if (keyBufferRef.current.endsWith('/rcs-admin')) {
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            e.preventDefault();
          }
          triggerRcsAdmin(target);
        }
      }
    };

    const onInput = (e: Event) => {
      if (adminOpen) return;
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') return;
      const val = (target.value || '').trim().toLowerCase();
      if (val === '/rcs-admin' || val.endsWith('/rcs-admin')) {
        target.value = '';
        triggerRcsAdmin(target);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('input', onInput, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('input', onInput, true);
    };
  }, [adminOpen, showToast]);

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
      setFirestoreRealtimeActive(isUsingFirestoreBackend());
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
        adminTeam:
          Array.isArray(payload.adminTeam) && payload.adminTeam.length > 0
            ? payload.adminTeam
            : hasSettings
              ? []
              : defaults.adminTeam,
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
      setFirestoreRealtimeActive(isUsingFirestoreBackend());
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
    const syncFromRemoteIfIdle = () => {
      if (Date.now() - lastLocalEditAtRef.current < 1600) return;
      void refreshPublicPortal();
      if (isFirebaseAdmin) {
        void refreshAdminData();
      }
    };
    const handleFocus = () => {
      syncFromRemoteIfIdle();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LIVE_SYNC_STORAGE_KEY) {
        syncFromRemoteIfIdle();
      }
    };
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(LIVE_SYNC_CHANNEL);
        bc.onmessage = () => {
          syncFromRemoteIfIdle();
        };
      }
    } catch {
      bc = null;
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [refreshPublicPortal, refreshAdminData, isFirebaseAdmin]);

  useEffect(() => {
    if (firestoreRealtimeActive || adminOpen) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastLocalEditAtRef.current >= 1600) {
        void refreshPublicPortal();
      }
    }, 6000);
    return () => window.clearInterval(id);
  }, [firestoreRealtimeActive, adminOpen, refreshPublicPortal]);

  useEffect(() => {
    void refreshAdminData();
  }, [refreshAdminData]);

  useEffect(() => {
    if (!firestoreRealtimeActive) return;
    const defaults = createDefaultState();
    return subscribePublicPortalInFirestore({
      onBatchmates: (batchmates) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        const hasSettings = settingsSeededRef.current;
        setState((prev) => ({
          ...prev,
          batchmates:
            batchmates.length > 0 || hasSettings
              ? hasSettings
                ? batchmates
                : [...batchmates, ...defaults.batchmates.filter((d) => !batchmates.some((i) => i.id === d.id))]
              : defaults.batchmates,
        }));
      },
      onNotices: (notices) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        const hasSettings = settingsSeededRef.current;
        setState((prev) => ({
          ...prev,
          notices: notices.length > 0 || hasSettings ? notices : defaults.notices,
        }));
      },
      onGallery: (gallery) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        const hasSettings = settingsSeededRef.current;
        setState((prev) => ({
          ...prev,
          gallery: gallery.length > 0 || hasSettings ? gallery : defaults.gallery,
        }));
      },
      onAdminTeam: (adminTeam) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        const hasSettings = settingsSeededRef.current;
        setState((prev) => ({
          ...prev,
          adminTeam: adminTeam.length > 0 || hasSettings ? adminTeam : defaults.adminTeam,
        }));
      },
      onSettings: (settings) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        if (settings !== null) {
          settingsSeededRef.current = true;
          setState((prev) => ({
            ...prev,
            profile: settings.profile || defaults.profile,
            hoodieConfig: mergeHoodieConfig(settings.hoodieConfig),
            siteConfig: mergeSiteConfig(settings.siteConfig),
          }));
        }
      },
    });
  }, [firestoreRealtimeActive]);

  useEffect(() => {
    if (!firestoreRealtimeActive || !isFirebaseAdmin) return;
    return subscribeAdminDataInFirestore({
      onOrders: (orders) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        setState((prev) => ({ ...prev, orders }));
      },
      onActivityLogs: (activityLog) => {
        setState((prev) => ({ ...prev, activityLog }));
      },
    });
  }, [firestoreRealtimeActive, isFirebaseAdmin]);

  const updateState = useCallback((next: PortalState) => {
    lastLocalEditAtRef.current = Date.now();
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
    setIsRouteAdmin(false);
    setActiveView('home');
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  }, []);

  const sc = mergeSiteConfig(state.siteConfig);
  const sec = sc.sections!;
  const isMaintenanceBlocked = Boolean(sc.maintenanceMode) && !adminOpen;

  if (isMaintenanceBlocked) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-zinc-50 dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 shadow-sm dark:shadow-none p-8 text-center space-y-4">
          <img
            src={SITE_LOGO_SRC}
            alt={`${sc.brandName} ${sc.brandAccent} logo`}
            className="w-16 h-16 mx-auto rounded-xl object-cover border border-zinc-300 dark:border-zinc-700/80 shadow-xs bg-black"
          />
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-700 dark:text-rose-400">
            {sc.brandName} {sc.brandAccent}
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 dark:text-white">Portal Temporarily Paused</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">{sc.maintenanceMessage}</p>
        </div>
      </div>
    );
  }

  if (activeView === 'admin') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#070709] text-zinc-950 dark:text-zinc-100">
        <AdminModal
          isOpen={true}
          isRouteAdmin={true}
          theme={theme}
          onToggleTheme={toggleTheme}
          state={{ ...state, siteConfig: sc, hoodieConfig: mergeHoodieConfig(state.hoodieConfig) }}
          authUser={authUser}
          isFirebaseAdmin={isFirebaseAdmin}
          onClose={handleCloseAdmin}
          onUpdateState={updateState}
          onRefreshData={refreshAllData}
          onOpenRegister={() => handleNavigate('register')}
          onToast={showToast}
        />

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-[60] px-4 py-3 rounded-xl border text-xs font-medium shadow-xl backdrop-blur-md ${
              toast.tone === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                : toast.tone === 'info'
                  ? 'bg-white dark:bg-zinc-900/95 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 flex flex-col transition-colors duration-150">
      <Navbar
        activeView={activeView}
        siteConfig={sc}
        theme={theme}
        showAdminButton={isFirebaseAdmin}
        onToggleTheme={toggleTheme}
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
          <div className="mt-16 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-300 dark:border-rose-500/30 px-4 py-2.5 text-center text-xs font-semibold text-rose-900 dark:text-rose-200">
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
                  <p className="text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-400">{sc.heroKicker}</p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.08] text-balance">
                    {sc.heroTitle} <span className="text-rose-600 dark:text-rose-500">{sc.heroHighlight}</span>
                  </h1>
                  <p className="text-base sm:text-lg text-zinc-700 dark:text-zinc-400 leading-relaxed max-w-xl">{sc.heroDescription}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {sc.registrationOpen !== false && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('register')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <UserPlus className="w-4 h-4" />
                        Register Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleNavigate('batchmates')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#111114] dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-zinc-700 dark:text-zinc-400" />
                      Batchmates Directory
                    </button>
                    {sec.hoodieNav && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('hoodie')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#111114] dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer"
                      >
                        <Shirt className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        Hoodie '26-'27
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-white shadow-sm dark:shadow-none h-full min-h-[280px] lg:min-h-[420px]">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 pt-10 border-t border-zinc-300 dark:border-zinc-800/80">
                {(sc.kpis || []).map((kpi, idx) => (
                  <button
                    key={kpi.id || idx}
                    type="button"
                    onClick={() => handleNavigate(kpi.autoBatchmateCount ? 'batchmates' : 'about')}
                    className="text-left p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none transition-colors cursor-pointer"
                  >
                    <p
                      className={`text-3xl font-bold font-mono tabular-nums ${
                        idx === (sc.kpis || []).length - 1 ? 'text-rose-600 dark:text-rose-500' : 'text-zinc-950 dark:text-white'
                      }`}
                    >
                      {kpi.autoBatchmateCount ? state.batchmates.length : kpi.value}
                    </p>
                    <p className="text-xs text-zinc-700 dark:text-zinc-400 mt-1">{kpi.label}</p>
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
                      className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>Official Batch Notices</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('notices')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
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
                          className="text-left p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none transition-colors space-y-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`font-semibold ${
                                notice.category === 'Urgent'
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : notice.category === 'Event'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {notice.category}
                            </span>
                            <span className="text-zinc-400 dark:text-zinc-600">·</span>
                            <span className="font-mono text-zinc-600 dark:text-zinc-500">{notice.createdAt}</span>
                            {notice.pinned && (
                              <>
                                <span className="text-zinc-400 dark:text-zinc-600">·</span>
                                <span className="text-rose-700 dark:text-rose-400 font-semibold">Pinned</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">{notice.title}</h3>
                          <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">{notice.message}</p>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>

            {/* About Section */}
            {sec.about && (
              <section id="about" className="py-20 bg-zinc-100 dark:bg-[#0b0b0e] border-y border-zinc-300 dark:border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{sc.aboutKicker}</p>
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        About Page
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance">
                      {sc.aboutTitle}
                    </h2>
                    <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-400 leading-relaxed max-w-2xl">
                      {sc.aboutDescription}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="text-left p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none transition-colors space-y-2 cursor-pointer"
                      >
                        <Target className="w-5 h-5 text-rose-600 dark:text-rose-500" />
                        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{sc.visionTitle}</h3>
                        <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{sc.visionText}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="text-left p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none transition-colors space-y-2 cursor-pointer"
                      >
                        <Heart className="w-5 h-5 text-rose-600 dark:text-rose-500" />
                        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{sc.unityTitle}</h3>
                        <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{sc.unityText}</p>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="p-8 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none text-center space-y-5">
                      <button
                        type="button"
                        onClick={() => handleNavigate('about')}
                        className="w-14 h-14 mx-auto rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-rose-500/60 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Open About Page"
                      >
                        <Instagram className="w-7 h-7 text-rose-600 dark:text-rose-500" />
                      </button>
                      <div className="space-y-1.5">
                        <h3 className="text-xl font-bold text-zinc-950 dark:text-white">{sc.instagramHandle}</h3>
                        <p className="text-sm text-zinc-700 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">{sc.instagramBio}</p>
                      </div>
                      <a
                        href={sc.instagramUrl}
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
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 mb-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Memory Vault
                    </button>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">Captured Moments</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('gallery')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-[#111114] dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-200 transition-colors cursor-pointer w-fit"
                  >
                    Open Gallery Page
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {state.gallery.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-zinc-50 dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80">
                    <Camera className="w-8 h-8 text-zinc-500 dark:text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-700 dark:text-zinc-400">No gallery moments added yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.gallery.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLightboxItem(item)}
                        className="text-left rounded-2xl overflow-hidden bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none transition-colors duration-150 group cursor-pointer flex flex-col"
                      >
                        {item.src && (
                          <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
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
                            {item.date && <p className="text-xs font-mono text-zinc-600 dark:text-zinc-500">{item.date}</p>}
                            <h3 className="text-base font-semibold text-zinc-950 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{item.caption}</p>
                          </div>
                          {!item.src && item.isVideo && (
                            <div className="pt-2 inline-flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
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

            {/* Public Admin Panel / Core Organizers Section */}
            {sec.directory && (
              <section id="directory" className="py-20 bg-zinc-100 dark:bg-[#0b0b0e] border-y border-zinc-300 dark:border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                      {sc.leadSectionKicker || "Core Organizers · Orthohin '27"}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                      {sc.leadSectionTitle || 'Admin Panel'}
                    </h2>
                    <p className="text-sm text-zinc-700 dark:text-zinc-400">
                      {sc.leadSectionSubtitle || "The core team and organizers running Orthohin '27."}
                    </p>
                  </div>

                  {(() => {
                    const fallbackAvatar =
                      state.profile &&
                      state.profile !== '/src/assets/images/portrait_lead_abrar_1794766076468.jpg'
                        ? state.profile
                        : DEFAULT_PROFILE_IMAGE;
                    const homeTeam =
                      state.adminTeam && state.adminTeam.length > 0
                        ? state.adminTeam
                        : [
                            {
                              id: 'admin-1',
                              name: sc.leadName || 'Abrar Al Razee Oytizzoh',
                              role: sc.leadRole || 'Lead Developer · Head Orthohin-27',
                              bio: sc.devNote || '',
                              photo: fallbackAvatar,
                              social: sc.instagramUrl,
                            },
                          ];
                    const visibleHomeTeam = homeTeam.slice(0, 3);
                    const gridCls =
                      visibleHomeTeam.length === 1
                        ? 'max-w-md mx-auto'
                        : visibleHomeTeam.length === 2
                          ? 'grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto'
                          : 'grid sm:grid-cols-2 lg:grid-cols-3 gap-6';

                    return (
                      <div className="space-y-8">
                        <div className={gridCls}>
                          {visibleHomeTeam.map((member) => {
                            const rawSocial = (member.social || '').trim();
                            const socialHref = rawSocial
                              ? /^https?:\/\//i.test(rawSocial)
                                ? rawSocial
                                : `https://www.instagram.com/${encodeURIComponent(rawSocial.replace(/^@/, ''))}/`
                              : null;

                            return (
                              <div
                                key={member.id}
                                className="rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-xs dark:shadow-none p-7 text-center flex flex-col items-center space-y-4"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleNavigate('directory')}
                                  className="w-28 h-28 mx-auto rounded-full overflow-hidden border-2 border-zinc-300 dark:border-zinc-700 hover:border-rose-500 transition-colors flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 cursor-pointer shrink-0"
                                  aria-label="Open Admin Panel Page"
                                >
                                  {member.photo ? (
                                    <img
                                      src={member.photo}
                                      alt={member.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover object-[center_22%]"
                                    />
                                  ) : (
                                    <span className="text-xl font-bold text-rose-700 dark:text-rose-400">
                                      {getInitials(member.name)}
                                    </span>
                                  )}
                                </button>

                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{member.role}</p>
                                  <h3 className="text-lg font-bold text-zinc-950 dark:text-white">{member.name}</h3>
                                </div>

                                {member.bio && (
                                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed flex-1">
                                    "{member.bio}"
                                  </p>
                                )}

                                {socialHref && (
                                  <a
                                    href={socialHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                                  >
                                    Connect
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleNavigate('directory')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            {homeTeam.length > 3 ? `View All ${homeTeam.length} Admins` : 'Open Admin Panel Page'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNavigate('batchmates')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                          >
                            View All Batchmates
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>
            )}

            {/* Timeline Section */}
            {sec.timeline && (sc.timeline || []).length > 0 && (
              <section id="timeline" className="py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 space-y-2">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Cohort Milestones</p>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">Our Journey</h2>
                  <button
                    type="button"
                    onClick={() => handleNavigate('timeline')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white pt-1 transition-colors cursor-pointer"
                  >
                    Open Journey Page
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ol className="relative border-l border-zinc-300 dark:border-zinc-800 space-y-8 ml-3">
                  {(sc.timeline || []).map((item, idx) => (
                    <li key={item.id || idx} className="pl-7 relative">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${
                          idx === (sc.timeline || []).length - 1 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-rose-600 dark:bg-rose-500'
                        }`}
                      />
                      <p
                        className={`text-xs font-mono font-semibold ${
                          idx === (sc.timeline || []).length - 1 ? 'text-zinc-600 dark:text-zinc-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {item.tag}
                      </p>
                      <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-0.5">{item.title}</h3>
                      <p className="text-sm text-zinc-700 dark:text-zinc-400 mt-1">{item.description}</p>
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
            adminTeam={state.adminTeam || []}
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
      <footer className="py-8 border-t border-zinc-300 dark:border-zinc-900 bg-zinc-50 dark:bg-transparent text-center px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600 dark:text-zinc-500">
          <div className="flex items-center gap-2.5">
            <img
              src={SITE_LOGO_SRC}
              alt={`${sc.brandName} ${sc.brandAccent} logo`}
              className="w-7 h-7 rounded-md object-cover border border-zinc-300 dark:border-zinc-800 shrink-0 bg-black"
            />
            <p className="text-left">{sc.footerText}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Home
            </button>
            {sec.notices && (
              <button
                type="button"
                onClick={() => handleNavigate('notices')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Notices
              </button>
            )}
            {sec.about && (
              <button
                type="button"
                onClick={() => handleNavigate('about')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                About
              </button>
            )}
            {sec.gallery && (
              <button
                type="button"
                onClick={() => handleNavigate('gallery')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Gallery
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNavigate('batchmates')}
              className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Batchmates
            </button>
            {sec.hoodieNav && (
              <button
                type="button"
                onClick={() => handleNavigate('hoodie')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Hoodie '26-'27
              </button>
            )}
            {sec.directory && (
              <button
                type="button"
                onClick={() => handleNavigate('directory')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Admin Panel
              </button>
            )}
            {sec.timeline && (
              <button
                type="button"
                onClick={() => handleNavigate('timeline')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Our Journey
              </button>
            )}
            {sc.registrationOpen !== false && (
              <button
                type="button"
                onClick={() => handleNavigate('register')}
                className="hover:text-zinc-950 dark:hover:text-zinc-200 transition-colors cursor-pointer"
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

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-xs font-medium shadow-xl backdrop-blur-md ${
            toast.tone === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
              : toast.tone === 'info'
                ? 'bg-white dark:bg-zinc-900/95 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200'
                : 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
