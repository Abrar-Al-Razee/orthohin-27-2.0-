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
import { PageStage3D, Reveal3D, SpatialMeshCanvas, TiltStage3D } from './components/Spatial3D';
import { TimelinePage } from './components/TimelinePage';
import { auth } from './firebase';
import {
  addActivityLogInDb,
  createBatchmateInDb,
  createOrderInDb,
  fetchAdminData,
  fetchLiveFirestoreSnapshot,
  fetchPublicPortal,
  isUsingFirestoreBackend,
  migrateFirestoreToRtdb,
  subscribeAdminDataInFirestore,
  subscribePublicPortalInFirestore,
} from './services/apiService';
import type {
  Batchmate,
  BatchmateContact,
  GalleryItem,
  HoodieOrder,
  PortalState,
  ToastMessage,
  ViewMode,
} from './types';
import {
  createDefaultState,
  DEFAULT_HERO_IMAGE,
  DEFAULT_PROFILE_IMAGE,
  getInitials,
  isAuthorizedAdminEmail,
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

function createInitialShellState(): PortalState {
  return {
    gallery: [],
    profile: DEFAULT_PROFILE_IMAGE,
    batchmates: [],
    orders: [],
    publicOrders: [],
    notices: [],
    hoodieConfig: mergeHoodieConfig(),
    siteConfig: mergeSiteConfig(),
    adminTeam: [],
    activityLog: [],
  };
}

export default function App() {
  const initialView = resolveViewFromLocation();
  const [state, setState] = useState<PortalState>(() => createInitialShellState());
  const [isPortalHydrated, setIsPortalHydrated] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const [rtdbRulesNeeded, setRtdbRulesNeeded] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>(initialView);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isRouteAdmin, setIsRouteAdmin] = useState<boolean>(initialView === 'admin');
  const [adminOpen, setAdminOpen] = useState<boolean>(initialView === 'admin');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [highlightedBatchmateId, setHighlightedBatchmateId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [firestoreRealtimeActive, setFirestoreRealtimeActive] = useState(() => isUsingFirestoreBackend());
  const { theme, toggleTheme } = useTheme();

  const toastTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const settingsSeededRef = useRef(false);
  const rtdbSettingsMissingRef = useRef(false);
  const autoMigrateAttemptedRef = useRef(false);
  const firestoreFallbackAttemptedRef = useRef(false);
  const showingFirestoreRecoveryRef = useRef(false);
  const rtdbRawStateRef = useRef<{
    batchmates: Batchmate[];
    gallery: GalleryItem[];
    publicOrders: HoodieOrder[];
  }>({ batchmates: [], gallery: [], publicOrders: [] });
  const hydratedRef = useRef(false);
  const quotaNotifiedRef = useRef(false);
  const lastLocalEditAtRef = useRef(0);
  const batchmateContactsRef = useRef<Record<string, BatchmateContact>>({});

  const isFirebaseAdmin = Boolean(
    authUser && isAuthorizedAdminEmail(authUser.email) && authUser.emailVerified
  );
  const isFirebaseAdminRef = useRef(isFirebaseAdmin);
  isFirebaseAdminRef.current = isFirebaseAdmin;

  const hydrateBatchmatesWithContacts = useCallback(
    (items: Batchmate[], adminActive: boolean): Batchmate[] => {
      if (!adminActive) {
        return items.map(({ email: _email, phone: _phone, ...publicFields }) => publicFields);
      }
      const contactMap = batchmateContactsRef.current;
      return items.map((item) => {
        const contact = contactMap[item.id];
        if (!contact) return item;
        return {
          ...item,
          email: contact.email ?? item.email,
          phone: contact.phone ?? item.phone,
        };
      });
    },
    []
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
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
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

      const hasRealData =
        hasSettings ||
        payload.batchmates.length > 0 ||
        payload.gallery.length > 0 ||
        payload.notices.length > 0 ||
        (Array.isArray(payload.adminTeam) && payload.adminTeam.length > 0);

      hydratedRef.current = true;
      retryAttemptRef.current = 0;
      setIsPortalHydrated(true);
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      setState((prev) => {
        const rawBatchmates = hasRealData ? payload.batchmates : defaults.batchmates;

        return {
          ...prev,
          batchmates: hydrateBatchmatesWithContacts(rawBatchmates, isFirebaseAdmin),
          notices: hasRealData ? payload.notices : defaults.notices,
          gallery: hasRealData ? payload.gallery : defaults.gallery,
          adminTeam: hasRealData
            ? Array.isArray(payload.adminTeam)
              ? payload.adminTeam
              : []
            : defaults.adminTeam,
          publicOrders: Array.isArray(payload.publicOrders) ? payload.publicOrders : prev.publicOrders || [],
          profile: payload.settings?.profile || defaults.profile,
          hoodieConfig: mergeHoodieConfig(payload.settings?.hoodieConfig),
          siteConfig: mergeSiteConfig(payload.settings?.siteConfig),
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('quota exceeded')) {
        showToast('Daily Firestore quota reached. Existing data is safe and resets tomorrow.', 'error');
        return;
      }
      if (!hydratedRef.current && !retryTimerRef.current) {
        const delayMs = Math.min(5000, 1500 * Math.pow(1.6, retryAttemptRef.current));
        retryAttemptRef.current += 1;
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null;
          void refreshPublicPortal();
        }, delayMs);
      }
    } finally {
      setFirestoreRealtimeActive(isUsingFirestoreBackend());
    }
  }, [hydrateBatchmatesWithContacts, isFirebaseAdmin, showToast]);

  const refreshAdminData = useCallback(async () => {
    if (!isFirebaseAdmin) {
      batchmateContactsRef.current = {};
      setState((prev) => ({
        ...prev,
        orders: [],
        activityLog: [],
        batchmates: hydrateBatchmatesWithContacts(prev.batchmates, false),
      }));
      return;
    }
    try {
      const adminPayload = await fetchAdminData();
      setFirestoreRealtimeActive(isUsingFirestoreBackend());
      if (Array.isArray(adminPayload.batchmateContacts)) {
        const nextMap: Record<string, BatchmateContact> = {};
        for (const c of adminPayload.batchmateContacts) {
          nextMap[c.batchmateId] = c;
        }
        batchmateContactsRef.current = nextMap;
      }
      setState((prev) => ({
        ...prev,
        orders: adminPayload.orders,
        activityLog: adminPayload.activityLog,
        batchmates: hydrateBatchmatesWithContacts(prev.batchmates, true),
      }));
    } catch {
      // Handled gracefully
    }
  }, [hydrateBatchmatesWithContacts, isFirebaseAdmin]);

  const refreshAllData = useCallback(async () => {
    if (firestoreRealtimeActive) return;
    await Promise.all([refreshPublicPortal(), refreshAdminData()]);
  }, [firestoreRealtimeActive, refreshPublicPortal, refreshAdminData]);

  useEffect(() => {
    if (!firestoreRealtimeActive) {
      void refreshPublicPortal();
    }
    const syncFromRemoteIfIdle = () => {
      if (firestoreRealtimeActive) return;
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
  }, [firestoreRealtimeActive, refreshPublicPortal, refreshAdminData, isFirebaseAdmin]);

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
    if (!firestoreRealtimeActive || !isFirebaseAdmin) {
      void refreshAdminData();
    }
  }, [firestoreRealtimeActive, isFirebaseAdmin, refreshAdminData]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      batchmates: hydrateBatchmatesWithContacts(prev.batchmates, isFirebaseAdmin),
    }));
  }, [isFirebaseAdmin, hydrateBatchmatesWithContacts]);

  const isOnlySampleDefaults = useCallback(
    (batchmates: Batchmate[], gallery: GalleryItem[], publicOrders: HoodieOrder[]) => {
      const bmDefault = batchmates.length === 0 || batchmates.every((b) => /^bm-[1-6]$/.test(b.id));
      const galDefault = gallery.length === 0 || gallery.every((g) => /^gal-[1-3]$/.test(g.id));
      const ordersDefault = (publicOrders || []).length === 0;
      return bmDefault && galDefault && ordersDefault;
    },
    []
  );

  useEffect(() => {
    if (!isPortalHydrated || firestoreFallbackAttemptedRef.current) return;
    const raw = rtdbRawStateRef.current;
    if (!rtdbSettingsMissingRef.current && !isOnlySampleDefaults(raw.batchmates, raw.gallery, raw.publicOrders)) {
      return;
    }
    firestoreFallbackAttemptedRef.current = true;
    void fetchLiveFirestoreSnapshot().then((live) => {
      if (!live) return;
      if (isOnlySampleDefaults(live.batchmates, live.gallery, live.publicOrders || [])) return;
      showingFirestoreRecoveryRef.current = true;
      setState((prev) => ({
        ...prev,
        batchmates: hydrateBatchmatesWithContacts(live.batchmates, isFirebaseAdminRef.current),
        notices: live.notices,
        gallery: live.gallery,
        adminTeam: live.adminTeam || [],
        publicOrders: live.publicOrders || [],
        profile: live.settings?.profile || prev.profile,
        hoodieConfig: live.settings?.hoodieConfig
          ? mergeHoodieConfig(live.settings.hoodieConfig)
          : prev.hoodieConfig,
        siteConfig: live.settings?.siteConfig ? mergeSiteConfig(live.settings.siteConfig) : prev.siteConfig,
      }));
    });
  }, [isPortalHydrated, hydrateBatchmatesWithContacts, isOnlySampleDefaults]);

  useEffect(() => {
    if (!isFirebaseAdmin || !isPortalHydrated || autoMigrateAttemptedRef.current) return;
    const raw = rtdbRawStateRef.current;
    const needsMigration =
      rtdbSettingsMissingRef.current || isOnlySampleDefaults(raw.batchmates, raw.gallery, raw.publicOrders);
    if (!needsMigration) {
      try {
        localStorage.setItem('orthohin27_rtdb_migrated_v2', 'true');
      } catch {
        // Ignore storage errors
      }
      return;
    }
    autoMigrateAttemptedRef.current = true;
    void migrateFirestoreToRtdb(state)
      .then((res) => {
        if (res.totalMoved > 0) {
          showingFirestoreRecoveryRef.current = false;
          try {
            localStorage.setItem('orthohin27_rtdb_migrated_v2', 'true');
          } catch {
            // Ignore storage access errors
          }
          showToast(
            `Transferred ${res.batchmates} batchmates, ${res.gallery} photos & ${res.orders} orders to Realtime DB.`,
            'success'
          );
        }
      })
      .catch(() => {
        // Firestore quota may still be cooling down; admin can retry from Security & Backup tab
      });
  }, [isFirebaseAdmin, isPortalHydrated, state, showToast, isOnlySampleDefaults]);

  useEffect(() => {
    if (!firestoreRealtimeActive) return;
    const defaults = createDefaultState();
    return subscribePublicPortalInFirestore({
      onBatchmates: (batchmates) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        rtdbRawStateRef.current.batchmates = batchmates;
        const raw = rtdbRawStateRef.current;
        if (!isOnlySampleDefaults(raw.batchmates, raw.gallery, raw.publicOrders)) {
          showingFirestoreRecoveryRef.current = false;
        }
        hydratedRef.current = true;
        setQuotaReached(false);
        setRtdbRulesNeeded(false);
        setIsPortalHydrated(true);
        if (showingFirestoreRecoveryRef.current) return;
        setState((prev) => ({
          ...prev,
          batchmates: hydrateBatchmatesWithContacts(batchmates, isFirebaseAdminRef.current),
        }));
      },
      onNotices: (notices) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        hydratedRef.current = true;
        setQuotaReached(false);
        setRtdbRulesNeeded(false);
        setIsPortalHydrated(true);
        if (showingFirestoreRecoveryRef.current) return;
        setState((prev) => ({
          ...prev,
          notices,
        }));
      },
      onGallery: (gallery) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        rtdbRawStateRef.current.gallery = gallery;
        const raw = rtdbRawStateRef.current;
        if (!isOnlySampleDefaults(raw.batchmates, raw.gallery, raw.publicOrders)) {
          showingFirestoreRecoveryRef.current = false;
        }
        hydratedRef.current = true;
        setQuotaReached(false);
        setRtdbRulesNeeded(false);
        setIsPortalHydrated(true);
        if (showingFirestoreRecoveryRef.current) return;
        setState((prev) => ({
          ...prev,
          gallery,
        }));
      },
      onAdminTeam: (adminTeam) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        hydratedRef.current = true;
        setQuotaReached(false);
        setRtdbRulesNeeded(false);
        setIsPortalHydrated(true);
        if (showingFirestoreRecoveryRef.current) return;
        setState((prev) => ({
          ...prev,
          adminTeam,
        }));
      },
      onPublicOrders: (publicOrders) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        rtdbRawStateRef.current.publicOrders = publicOrders;
        const raw = rtdbRawStateRef.current;
        if (!isOnlySampleDefaults(raw.batchmates, raw.gallery, raw.publicOrders)) {
          showingFirestoreRecoveryRef.current = false;
        }
        hydratedRef.current = true;
        setQuotaReached(false);
        setRtdbRulesNeeded(false);
        setIsPortalHydrated(true);
        if (showingFirestoreRecoveryRef.current) return;
        setState((prev) => ({
          ...prev,
          publicOrders,
        }));
      },
      onSettings: (settings) => {
        if (Date.now() - lastLocalEditAtRef.current < 1600) return;
        hydratedRef.current = true;
        setQuotaReached(false);
        setRtdbRulesNeeded(false);
        setIsPortalHydrated(true);
        if (settings !== null) {
          rtdbSettingsMissingRef.current = false;
          settingsSeededRef.current = true;
          if (showingFirestoreRecoveryRef.current) return;
          setState((prev) => ({
            ...prev,
            profile: settings.profile || defaults.profile,
            hoodieConfig: mergeHoodieConfig(settings.hoodieConfig),
            siteConfig: mergeSiteConfig(settings.siteConfig),
          }));
        } else {
          rtdbSettingsMissingRef.current = true;
        }
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('permission_denied') || msg.includes('permission denied')) {
          setRtdbRulesNeeded(true);
          setIsPortalHydrated(true);
          if (!quotaNotifiedRef.current) {
            quotaNotifiedRef.current = true;
            showToast('Publish database.rules.json in Firebase Realtime Database Rules to enable live sync.', 'error');
          }
          return;
        }
        if (msg.includes('quota') || msg.includes('resource-exhausted')) {
          setQuotaReached(true);
          setIsPortalHydrated(true);
          if (!quotaNotifiedRef.current) {
            quotaNotifiedRef.current = true;
            showToast('Daily Firebase quota reached. Data is safe and resets tomorrow.', 'error');
          }
        }
      },
    });
  }, [firestoreRealtimeActive, hydrateBatchmatesWithContacts, isOnlySampleDefaults, showToast]);

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
      onBatchmateContacts: (contacts) => {
        const nextMap: Record<string, BatchmateContact> = {};
        for (const c of contacts) {
          nextMap[c.batchmateId] = c;
        }
        batchmateContactsRef.current = nextMap;
        setState((prev) => ({
          ...prev,
          batchmates: hydrateBatchmatesWithContacts(prev.batchmates, true),
        }));
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('permission_denied') || msg.includes('permission denied')) {
          setRtdbRulesNeeded(true);
          return;
        }
        if (msg.includes('quota') || msg.includes('resource-exhausted')) {
          setQuotaReached(true);
          if (!quotaNotifiedRef.current) {
            quotaNotifiedRef.current = true;
            showToast('Daily Firebase quota reached. Data is safe and resets tomorrow.', 'error');
          }
        }
      },
    });
  }, [firestoreRealtimeActive, isFirebaseAdmin, hydrateBatchmatesWithContacts, showToast]);

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
          if (newBatchmate.email || newBatchmate.phone) {
            batchmateContactsRef.current[newBatchmate.id] = {
              id: newBatchmate.id,
              batchmateId: newBatchmate.id,
              email: newBatchmate.email,
              phone: newBatchmate.phone,
            };
          }
          void addActivityLogInDb(
            'New Registration',
            `${newBatchmate.name} (Roll ${newBatchmate.roll}) registered`
          );
        }
        lastLocalEditAtRef.current = Date.now();
        setState((prev) => ({
          ...prev,
          batchmates: [
            ...hydrateBatchmatesWithContacts([newBatchmate], isFirebaseAdmin),
            ...prev.batchmates.filter((b) => b.id !== newBatchmate.id),
          ],
        }));
        setHighlightedBatchmateId(newBatchmate.id);
        await refreshAllData();
        setRegisterOpen(false);
        handleNavigate('batchmates');
        showToast(`Welcome to Orthohin '27, ${newBatchmate.name}! Your profile card is now live.`, 'success');
      } catch (error) {
        showToast('Could not save your registration right now. Please retry.', 'error');
        throw error;
      }
    },
    [handleNavigate, hydrateBatchmatesWithContacts, isFirebaseAdmin, refreshAllData, showToast]
  );

  const handlePlaceOrder = useCallback(
    async (order: HoodieOrder) => {
      try {
        const savedOrder = await createOrderInDb(order);
        const publicMirror: HoodieOrder = {
          id: savedOrder.id,
          customerName: savedOrder.customerName,
          roll: savedOrder.roll,
          size: savedOrder.size,
          quantity: savedOrder.quantity,
          contact: '',
          notes: savedOrder.notes,
          status: savedOrder.status,
          paymentStatus: savedOrder.paymentStatus || 'Due',
          createdAt: savedOrder.createdAt,
        };
        if (isFirebaseAdmin) {
          void addActivityLogInDb(
            'Direct Hoodie Order',
            `${savedOrder.id}: ${savedOrder.customerName} (Size ${savedOrder.size} × ${savedOrder.quantity})`
          );
        }
        lastLocalEditAtRef.current = Date.now();
        setState((prev) => ({
          ...prev,
          publicOrders: [publicMirror, ...(prev.publicOrders || []).filter((o) => o.id !== publicMirror.id)],
          orders: isFirebaseAdmin
            ? [savedOrder, ...(prev.orders || []).filter((o) => o.id !== savedOrder.id)]
            : prev.orders,
        }));
        await refreshAllData();
        showToast(`Order ${savedOrder.id} registered! Your live profile card and invoice are ready.`, 'success');
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
    <div className="relative min-h-screen bg-white dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 flex flex-col transition-colors duration-150 overflow-x-clip">
      <SpatialMeshCanvas theme={theme} />

      <Navbar
        activeView={activeView}
        siteConfig={sc}
        notices={state.notices}
        theme={theme}
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

      <main className={`flex-1 relative z-10 ${state.notices.some((n) => n.active) ? 'pt-9' : ''}`}>
        {rtdbRulesNeeded && (
          <div className="mt-16 bg-amber-50/95 dark:bg-amber-950/60 backdrop-blur-sm border-b border-amber-300 dark:border-amber-500/30 px-4 py-2.5 text-center text-xs font-medium text-amber-950 dark:text-amber-200">
            Realtime Database connected, waiting for rules: paste <span className="font-mono font-semibold">database.rules.json</span> into Firebase Console → Realtime Database → Rules and publish.
          </div>
        )}
        {quotaReached && (
          <div className={`${rtdbRulesNeeded ? '' : 'mt-16 '}bg-amber-50/95 dark:bg-amber-950/60 backdrop-blur-sm border-b border-amber-300 dark:border-amber-500/30 px-4 py-2.5 text-center text-xs font-medium text-amber-950 dark:text-amber-200`}>
            Daily Firebase free-tier quota reached. Your database is completely safe and resets automatically tomorrow.
          </div>
        )}
        {sc.announcement.trim() && (
          <div className={`${rtdbRulesNeeded || quotaReached ? '' : 'mt-16 '}bg-rose-50/95 dark:bg-rose-950/60 backdrop-blur-sm border-b border-rose-300 dark:border-rose-500/30 px-4 py-2.5 text-center text-xs font-semibold text-rose-900 dark:text-rose-200`}>
            {sc.announcement}
          </div>
        )}

        <PageStage3D viewKey={activeView}>
        {activeView === 'home' && (
          <>
            {/* Split-Screen Hero */}
            <section
              className={`${
                rtdbRulesNeeded || quotaReached || sc.announcement.trim() ? 'pt-12' : 'pt-28 lg:pt-36'
              } pb-16 lg:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`}
            >
              <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                <Reveal3D immediate className="lg:col-span-6 flex flex-col justify-center space-y-6">
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
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-150 hover:-translate-y-0.5 shadow-sm hover:shadow-rose-600/25 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <UserPlus className="w-4 h-4" />
                        Register Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleNavigate('batchmates')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-zinc-100/95 hover:bg-zinc-200 dark:bg-[#111114]/95 dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-zinc-700 dark:text-zinc-400" />
                      Batchmates Directory
                    </button>
                    {sec.hoodieNav && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('hoodie')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-zinc-100/95 hover:bg-zinc-200 dark:bg-[#111114]/95 dark:hover:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-zinc-200 text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Shirt className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        Hoodie '26-'27
                      </button>
                    )}
                  </div>
                </Reveal3D>

                <Reveal3D immediate delay={0.08} className="lg:col-span-6">
                  <TiltStage3D maxTilt={8} scaleOnHover={1.015} className="h-full min-h-[280px] lg:min-h-[420px]">
                    <div className="relative rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg dark:shadow-2xl h-full min-h-[280px] lg:min-h-[420px] group">
                      <img
                        src={sc.heroImage || DEFAULT_HERO_IMAGE}
                        alt="Rajshahi Collegiate School (Est. 1828) gate showcase"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                      <div
                        style={{ transform: 'translateZ(22px)' }}
                        className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 text-white"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono uppercase tracking-widest text-rose-300">
                            Rajshahi Collegiate School · Est. 1828
                          </p>
                          <p className="text-sm font-bold truncate">
                            {sc.brandName} {sc.brandAccent} Heritage Campus
                          </p>
                        </div>
                      </div>
                    </div>
                  </TiltStage3D>
                </Reveal3D>
              </div>

              {/* Full-Width 4-Column KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 pt-10 border-t border-zinc-300 dark:border-zinc-800/80">
                {(sc.kpis || []).map((kpi, idx) => (
                  <Reveal3D key={kpi.id || idx} delay={idx * 0.05}>
                    <TiltStage3D maxTilt={6} className="h-full">
                      <button
                        type="button"
                        onClick={() => handleNavigate(kpi.autoBatchmateCount ? 'batchmates' : 'about')}
                        className="w-full h-full text-left p-5 rounded-2xl bg-white/95 dark:bg-[#111114]/95 backdrop-blur-sm border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-sm dark:shadow-lg transition-colors cursor-pointer"
                      >
                        <p
                          className={`text-3xl font-bold font-mono tabular-nums ${
                            idx === (sc.kpis || []).length - 1 ? 'text-rose-600 dark:text-rose-500' : 'text-zinc-950 dark:text-white'
                          }`}
                        >
                          {kpi.autoBatchmateCount ? (isPortalHydrated ? state.batchmates.length : '—') : kpi.value}
                        </p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-400 mt-1">{kpi.label}</p>
                      </button>
                    </TiltStage3D>
                  </Reveal3D>
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
                      .map((notice, idx) => (
                        <Reveal3D key={notice.id} delay={idx * 0.05}>
                          <TiltStage3D maxTilt={5} className="h-full">
                            <button
                              type="button"
                              onClick={() => handleNavigate('notices')}
                              className="w-full h-full text-left p-5 rounded-2xl bg-white/95 dark:bg-[#111114]/95 backdrop-blur-sm border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-sm dark:shadow-lg transition-colors space-y-2 cursor-pointer"
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
                          </TiltStage3D>
                        </Reveal3D>
                      ))}
                  </div>
                </div>
              )}
            </section>

            {/* About Section */}
            {sec.about && (
              <section id="about" className="py-20 bg-zinc-100/90 dark:bg-[#0b0b0e]/90 backdrop-blur-sm border-y border-zinc-300 dark:border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                  <Reveal3D className="lg:col-span-7 space-y-6">
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
                      <TiltStage3D maxTilt={6}>
                        <button
                          type="button"
                          onClick={() => handleNavigate('about')}
                          className="w-full h-full text-left p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-sm dark:shadow-lg transition-colors space-y-2 cursor-pointer"
                        >
                          <Target className="w-5 h-5 text-rose-600 dark:text-rose-500" />
                          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{sc.visionTitle}</h3>
                          <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{sc.visionText}</p>
                        </button>
                      </TiltStage3D>
                      <TiltStage3D maxTilt={6}>
                        <button
                          type="button"
                          onClick={() => handleNavigate('about')}
                          className="w-full h-full text-left p-5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-sm dark:shadow-lg transition-colors space-y-2 cursor-pointer"
                        >
                          <Heart className="w-5 h-5 text-rose-600 dark:text-rose-500" />
                          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{sc.unityTitle}</h3>
                          <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{sc.unityText}</p>
                        </button>
                      </TiltStage3D>
                    </div>
                  </Reveal3D>

                  <Reveal3D delay={0.08} className="lg:col-span-5">
                    <TiltStage3D maxTilt={8}>
                      <div className="p-8 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-md dark:shadow-2xl text-center space-y-5">
                        <button
                          type="button"
                          onClick={() => handleNavigate('about')}
                          style={{ transform: 'translateZ(20px)' }}
                          className="w-14 h-14 mx-auto rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-rose-500/60 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
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
                    </TiltStage3D>
                  </Reveal3D>
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

                {!isPortalHydrated && state.gallery.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[0, 1, 2].map((idx) => (
                      <div
                        key={idx}
                        className="h-72 rounded-2xl bg-zinc-100/80 dark:bg-[#111114]/80 border border-zinc-200 dark:border-zinc-800/80 animate-pulse"
                      />
                    ))}
                  </div>
                ) : state.gallery.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-zinc-50 dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80">
                    <Camera className="w-8 h-8 text-zinc-500 dark:text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-700 dark:text-zinc-400">No gallery moments added yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.gallery.map((item, idx) => (
                      <Reveal3D key={item.id} delay={Math.min(idx * 0.05, 0.25)}>
                        <TiltStage3D maxTilt={6.5} className="h-full">
                          <button
                            type="button"
                            onClick={() => setLightboxItem(item)}
                            className="w-full h-full text-left rounded-2xl overflow-hidden bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-sm dark:shadow-lg transition-colors duration-150 group cursor-pointer flex flex-col"
                          >
                            {item.src && (
                              <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                                <img
                                  src={item.src}
                                  alt={item.title}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
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
                        </TiltStage3D>
                      </Reveal3D>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Public Admin Panel / Core Organizers Section */}
            {sec.directory && (
              <section id="directory" className="py-20 bg-zinc-100/90 dark:bg-[#0b0b0e]/90 backdrop-blur-sm border-y border-zinc-300 dark:border-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <Reveal3D className="text-center max-w-2xl mx-auto mb-12 space-y-2">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                      {sc.leadSectionKicker || "Core Organizers · Orthohin '27"}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                      {sc.leadSectionTitle || 'Admin Panel'}
                    </h2>
                    <p className="text-sm text-zinc-700 dark:text-zinc-400">
                      {sc.leadSectionSubtitle || "The core team and organizers running Orthohin '27."}
                    </p>
                  </Reveal3D>

                  {(() => {
                    const fallbackAvatar =
                      state.profile &&
                      state.profile !== '/src/assets/images/portrait_lead_abrar_1794766076468.jpg'
                        ? state.profile
                        : DEFAULT_PROFILE_IMAGE;
                    const homeTeam =
                      state.adminTeam && state.adminTeam.length > 0
                        ? state.adminTeam
                        : !isPortalHydrated
                          ? []
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
                          {visibleHomeTeam.map((member, idx) => {
                            const rawSocial = (member.social || '').trim();
                            const socialHref = rawSocial
                              ? /^https?:\/\//i.test(rawSocial)
                                ? rawSocial
                                : `https://www.instagram.com/${encodeURIComponent(rawSocial.replace(/^@/, ''))}/`
                              : null;

                            return (
                              <Reveal3D key={member.id} delay={idx * 0.06}>
                                <TiltStage3D maxTilt={7} className="h-full">
                                  <div className="h-full rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800/80 shadow-sm dark:shadow-xl p-7 text-center flex flex-col items-center space-y-4">
                                    <button
                                      type="button"
                                      onClick={() => handleNavigate('directory')}
                                      style={{ transform: 'translateZ(22px)' }}
                                      className="w-28 h-28 mx-auto rounded-full overflow-hidden border-2 border-zinc-300 dark:border-zinc-700 hover:border-rose-500 transition-colors flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 cursor-pointer shrink-0 shadow-md"
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
                                </TiltStage3D>
                              </Reveal3D>
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
                <Reveal3D className="text-center mb-12 space-y-2">
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
                </Reveal3D>

                <ol className="relative border-l border-zinc-300 dark:border-zinc-800 space-y-8 ml-3">
                  {(sc.timeline || []).map((item, idx) => (
                    <li key={item.id || idx} className="pl-7 relative">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${
                          idx === (sc.timeline || []).length - 1 ? 'bg-zinc-500 dark:bg-zinc-600' : 'bg-rose-600 dark:bg-rose-500'
                        }`}
                      />
                      <Reveal3D delay={idx * 0.05}>
                        <div className="p-4 rounded-xl bg-white/80 dark:bg-[#111114]/80 border border-zinc-200/80 dark:border-zinc-800/60 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors">
                          <p
                            className={`text-xs font-mono font-semibold ${
                              idx === (sc.timeline || []).length - 1 ? 'text-zinc-600 dark:text-zinc-400' : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {item.tag}
                          </p>
                          <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-0.5">{item.title}</h3>
                          <p className="text-sm text-zinc-700 dark:text-zinc-400 mt-1">{item.description}</p>
                        </div>
                      </Reveal3D>
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
            isLoading={!isPortalHydrated}
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
            isLoading={!isPortalHydrated}
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
            isLoading={!isPortalHydrated}
            highlightedId={highlightedBatchmateId}
            onClearHighlight={() => setHighlightedBatchmateId(null)}
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
            publicOrders={state.publicOrders || []}
            batchmates={state.batchmates}
            onPlaceOrder={handlePlaceOrder}
            onViewBatchmates={() => handleNavigate('batchmates')}
            onBackHome={() => handleNavigate('home')}
          />
        )}
        </PageStage3D>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-zinc-300 dark:border-zinc-900 bg-zinc-50/90 dark:bg-[#070709]/85 backdrop-blur-sm text-center px-4">
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
