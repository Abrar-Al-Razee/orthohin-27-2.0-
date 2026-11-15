import { useEffect, useMemo, useRef, useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Lock,
  Megaphone,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Shirt,
  Sliders,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import {
  addActivityLogInDb,
  createNoticeInDb,
  deleteBatchmateInDb,
  deleteGalleryItemInDb,
  deleteNoticeInDb,
  deleteOrderInDb,
  reorderGalleryInDb,
  saveGalleryItemInDb,
  saveSettingsInDb,
  seedDefaultsIfEmptyInDb,
  syncPortalStateInDb,
  updateBatchmateInDb,
  updateNoticeInDb,
  updateOrderStatusInDb,
} from '../services/apiService';
import type {
  Batchmate,
  BatchNotice,
  GalleryItem,
  HoodieOrder,
  NoticeCategory,
  OrderStatus,
  PortalState,
} from '../types';
import {
  AUTHORIZED_ADMIN_EMAIL,
  compressImage,
  createDefaultState,
  DEFAULT_HOODIE_CONFIG,
  DEFAULT_PROFILE_IMAGE,
  downloadCsv,
  getAdminPassword,
  getInitials,
  resetAdminPassword,
  setAdminPassword,
} from '../utils/storage';

interface AdminModalProps {
  isOpen: boolean;
  isRouteAdmin: boolean;
  state: PortalState;
  authUser: User | null;
  isFirebaseAdmin: boolean;
  onClose: () => void;
  onUpdateState: (next: PortalState) => void;
  onRefreshData: () => Promise<void>;
  onOpenRegister: () => void;
  onToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'overview' | 'notices' | 'orders' | 'batchmates' | 'gallery' | 'hoodie' | 'site' | 'security';

export function AdminModal({
  isOpen,
  isRouteAdmin,
  state,
  authUser,
  isFirebaseAdmin,
  onClose,
  onUpdateState,
  onRefreshData,
  onOpenRegister,
  onToast,
}: AdminModalProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [authorizedAdmin, setAuthorizedAdmin] = useState('');
  const [emailInput, setEmailInput] = useState(AUTHORIZED_ADMIN_EMAIL);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Orders filters
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);

  // Batchmates filters & inline edit
  const [bmSearch, setBmSearch] = useState('');
  const [editingBmId, setEditingBmId] = useState<string | null>(null);
  const [confirmDeleteBmId, setConfirmDeleteBmId] = useState<string | null>(null);

  // Gallery states
  const [confirmDeleteGalleryId, setConfirmDeleteGalleryId] = useState<string | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const [videoDate, setVideoDate] = useState('November 2026');
  const [videoUrl, setVideoUrl] = useState('');

  // Hoodie admin states
  const [hoodieSideTarget, setHoodieSideTarget] = useState<'frontImage' | 'backImage'>('frontImage');

  // Site & Security states
  const [profileUrlInput, setProfileUrlInput] = useState(state.profile);
  const [newPassword, setNewPassword] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // Notice board states
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<NoticeCategory>('General');
  const [noticePinned, setNoticePinned] = useState(true);
  const [confirmDeleteNoticeId, setConfirmDeleteNoticeId] = useState<string | null>(null);

  const addPhotosInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const hoodiePhotoInputRef = useRef<HTMLInputElement>(null);
  const importBackupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfileUrlInput(state.profile);
  }, [state.profile]);

  useEffect(() => {
    if (!isFirebaseAdmin && unlocked) {
      setUnlocked(false);
      setAuthorizedAdmin('');
    }
  }, [isFirebaseAdmin, unlocked]);

  useEffect(() => {
    if (!isOpen) {
      setPasswordInput('');
      setLoginError('');
      setConfirmReset(false);
      setConfirmDeleteGalleryId(null);
      setConfirmDeleteBmId(null);
      setConfirmDeleteOrderId(null);
      setConfirmDeleteNoticeId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const analytics = useMemo(() => {
    const orders = state.orders || [];
    const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
    const confirmedOrders = orders.filter((o) => o.status === 'Confirmed').length;
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered').length;
    const totalHoodiesOrdered = orders.reduce((acc, o) => acc + (o.quantity || 1), 0);

    const groupCounts: Record<string, number> = {};
    for (const b of state.batchmates) {
      const grp = b.group || 'Other';
      groupCounts[grp] = (groupCounts[grp] || 0) + 1;
    }

    return {
      totalBatchmates: state.batchmates.length,
      totalOrders: orders.length,
      totalHoodiesOrdered,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      totalGallery: state.gallery.length,
      groupCounts: Object.entries(groupCounts).sort((a, b) => b[1] - a[1]),
    };
  }, [state]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return (state.orders || []).filter((o) => {
      const matchesStatus = orderStatusFilter === 'All' || o.status === orderStatusFilter;
      const matchesQuery =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.roll.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.contact.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [state.orders, orderStatusFilter, orderSearch]);

  const filteredBatchmates = useMemo(() => {
    const q = bmSearch.trim().toLowerCase();
    return state.batchmates.filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.roll.toLowerCase().includes(q) ||
        (b.group && b.group.toLowerCase().includes(q)) ||
        (b.social && b.social.toLowerCase().includes(q))
    );
  }, [state.batchmates, bmSearch]);

  if (!isOpen) return null;

  const completeUnlock = async (verifiedEmail: string) => {
    setUnlocked(true);
    setAuthorizedAdmin(verifiedEmail);
    setLoginError('');
    setPasswordInput('');
    try {
      await seedDefaultsIfEmptyInDb(createDefaultState());
      await addActivityLogInDb('Admin Signed In', `Authorized session started by ${verifiedEmail}`);
      await onRefreshData();
    } catch {
      onToast('Signed in, but could not finish data sync.', 'error');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoginError('');
    setIsAuthenticating(true);
    try {
      if (auth.currentUser && auth.currentUser.email?.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
        await signOut(auth);
      }
      const cred = await signInWithPopup(auth, googleProvider);
      const signedEmail = cred.user.email?.toLowerCase() || '';
      if (signedEmail !== AUTHORIZED_ADMIN_EMAIL || !cred.user.emailVerified) {
        await signOut(auth);
        setLoginError(
          `Unauthorized Google account (${signedEmail || 'unknown'}). Sign in strictly with ${AUTHORIZED_ADMIN_EMAIL}.`
        );
        return null;
      }
      setEmailInput(signedEmail);
      return cred.user;
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setLoginError('Google sign-in popup was closed before completing verification.');
      } else if (code === 'auth/popup-blocked') {
        setLoginError('Popup blocked by browser. Please allow popups and try again.');
      } else {
        setLoginError('Google sign-in failed. Please verify your account and try again.');
      }
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
      setLoginError(`Unauthorized email. Access is strictly restricted to ${AUTHORIZED_ADMIN_EMAIL}.`);
      return;
    }
    if (passwordInput !== getAdminPassword()) {
      setLoginError('Incorrect admin password. Please verify and try again.');
      return;
    }

    if (isFirebaseAdmin && authUser?.email) {
      setIsAuthenticating(true);
      await completeUnlock(authUser.email.toLowerCase());
      setIsAuthenticating(false);
      return;
    }

    const verifiedUser = await handleGoogleSignIn();
    if (verifiedUser?.email) {
      setIsAuthenticating(true);
      await completeUnlock(verifiedUser.email.toLowerCase());
      setIsAuthenticating(false);
    }
  };

  /* Orders Management */
  const handleOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatusInDb(orderId, status);
      void addActivityLogInDb('Order Updated', `Order ${orderId} marked as ${status}`);
      await onRefreshData();
      onToast(`Order ${orderId} marked as ${status}.`, 'success');
    } catch {
      onToast('Could not update order status.', 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrderInDb(orderId);
      void addActivityLogInDb('Order Removed', `Order ${orderId} deleted by admin`);
      await onRefreshData();
      setConfirmDeleteOrderId(null);
      onToast('Order removed.', 'info');
    } catch {
      onToast('Could not delete order.', 'error');
    }
  };

  const handleExportOrdersCsv = () => {
    downloadCsv(
      `orthohin27_rcs_orders_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order ID', 'Name', 'Roll', 'Size', 'Quantity', 'Contact', 'Notes', 'Status', 'Created At'],
      state.orders.map((o) => [
        o.id,
        o.customerName,
        o.roll,
        o.size,
        o.quantity,
        o.contact,
        o.notes || '',
        o.status,
        o.createdAt,
      ])
    );
    onToast('Orders CSV downloaded.', 'success');
  };

  /* Batchmates Management */
  const handleUpdateBatchmateField = (id: string, field: keyof Batchmate, value: string) => {
    onUpdateState({
      ...state,
      batchmates: state.batchmates.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    });
  };

  const handleSaveBatchmate = async (bm: Batchmate) => {
    if (!bm.name.trim() || !bm.roll.trim() || !bm.group.trim()) {
      onToast('Name, roll, and group cannot be empty.', 'error');
      return;
    }
    try {
      await updateBatchmateInDb(bm);
      void addActivityLogInDb('Batchmate Updated', `${bm.name} (Roll ${bm.roll}) updated`);
      await onRefreshData();
      setEditingBmId(null);
      onToast(`${bm.name} saved.`, 'success');
    } catch {
      onToast('Could not save batchmate changes.', 'error');
    }
  };

  const handleDeleteBatchmate = async (id: string) => {
    const target = state.batchmates.find((b) => b.id === id);
    try {
      await deleteBatchmateInDb(id);
      void addActivityLogInDb('Batchmate Removed', `${target?.name || id} removed from directory`);
      await onRefreshData();
      setConfirmDeleteBmId(null);
      onToast('Batchmate removed from directory.', 'info');
    } catch {
      onToast('Could not remove batchmate.', 'error');
    }
  };

  const handleExportBatchmatesCsv = () => {
    downloadCsv(
      `orthohin27_batchmates_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Roll', 'Group', 'Social', 'Quote', 'Registered At'],
      state.batchmates.map((b) => [b.name, b.roll, b.group, b.social || '', b.quote || '', b.registeredAt || ''])
    );
    onToast('Batchmates CSV downloaded.', 'success');
  };

  /* Gallery Management */
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const added: GalleryItem[] = [];
    for (const file of files) {
      try {
        const src = await compressImage(file, 900);
        added.push({
          id: `gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          src,
          title: file.name.replace(/\.[^/.]+$/, '') || 'Batch Memory',
          caption: 'Batch memory',
          date: 'November 2026',
        });
      } catch {
        // Skip invalid file
      }
    }
    if (added.length > 0) {
      const merged = [...added, ...state.gallery];
      try {
        await reorderGalleryInDb(merged);
        void addActivityLogInDb('Gallery Updated', `${added.length} photo(s) uploaded`);
        await onRefreshData();
        onToast(`${added.length} photo(s) uploaded.`, 'success');
      } catch {
        onToast('Could not upload photos.', 'error');
      }
    }
    e.target.value = '';
  };

  const handleAddVideoMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle.trim() || !videoUrl.trim()) {
      onToast('Video title and URL are required.', 'error');
      return;
    }
    const item: GalleryItem = {
      id: `gal-vid-${Date.now()}`,
      src: '',
      title: videoTitle.trim(),
      caption: videoCaption.trim() || 'Official batch video memory.',
      date: videoDate.trim() || 'November 2026',
      isVideo: true,
      videoUrl: videoUrl.trim(),
    };
    const merged = [item, ...state.gallery];
    try {
      await reorderGalleryInDb(merged);
      void addActivityLogInDb('Video Added', `Video "${item.title}" added to Memory Vault`);
      await onRefreshData();
      setVideoTitle('');
      setVideoCaption('');
      setVideoUrl('');
      setShowAddVideo(false);
      onToast('Video memory added.', 'success');
    } catch {
      onToast('Could not save video memory.', 'error');
    }
  };

  const handleReplacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetId) return;
    try {
      const src = await compressImage(file, 900);
      const idx = state.gallery.findIndex((item) => item.id === replaceTargetId);
      const target = state.gallery[idx];
      if (target) {
        await saveGalleryItemInDb({ ...target, src }, Math.max(0, idx));
        await onRefreshData();
        onToast('Gallery photo replaced.', 'success');
      }
    } catch {
      onToast('Failed to load or save replacement image.', 'error');
    } finally {
      setReplaceTargetId(null);
      e.target.value = '';
    }
  };

  const handleSaveGalleryItem = async (item: GalleryItem, idx: number) => {
    try {
      await saveGalleryItemInDb({ ...item, title: item.title.trim() || 'Untitled Memory' }, idx);
      await onRefreshData();
      onToast('Gallery item saved.', 'success');
    } catch {
      onToast('Could not save gallery item.', 'error');
    }
  };

  const handleMoveGallery = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= state.gallery.length) return;
    const copy = [...state.gallery];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdateState({ ...state, gallery: copy });
    try {
      await reorderGalleryInDb(copy);
      await onRefreshData();
    } catch {
      onToast('Could not reorder gallery.', 'error');
    }
  };

  const handleDeleteGallery = async (id: string) => {
    try {
      await deleteGalleryItemInDb(id);
      void addActivityLogInDb('Gallery Item Removed', `Item ${id} deleted`);
      await onRefreshData();
      setConfirmDeleteGalleryId(null);
      onToast('Gallery item removed.', 'info');
    } catch {
      onToast('Could not delete gallery item.', 'error');
    }
  };

  /* Settings helper */
  const persistSettings = async (
    nextProfile = state.profile,
    nextHoodie = state.hoodieConfig,
    nextSite = state.siteConfig,
    successMsg?: string
  ) => {
    setIsSyncing(true);
    try {
      await saveSettingsInDb(nextProfile, nextHoodie, nextSite);
      await onRefreshData();
      if (successMsg) onToast(successMsg, 'success');
    } catch {
      onToast('Could not save settings.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  /* Hoodie Config Management */
  const handleHoodiePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 900);
      const nextHoodie = { ...state.hoodieConfig, [hoodieSideTarget]: src };
      onUpdateState({ ...state, hoodieConfig: nextHoodie });
      await saveSettingsInDb(state.profile, nextHoodie, state.siteConfig);
      void addActivityLogInDb(
        'Hoodie Photo Updated',
        `Updated RCS Hoodie ${hoodieSideTarget === 'frontImage' ? 'Front' : 'Back'} photo`
      );
      await onRefreshData();
      onToast(`RCS Hoodie ${hoodieSideTarget === 'frontImage' ? 'Front' : 'Back'} image saved.`, 'success');
    } catch {
      onToast('Failed to process or upload hoodie image.', 'error');
    }
    e.target.value = '';
  };

  /* Profile & Backup */
  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 600);
      onUpdateState({ ...state, profile: src });
      await saveSettingsInDb(src, state.hoodieConfig, state.siteConfig);
      void addActivityLogInDb('Profile Updated', 'Leadership profile photo uploaded');
      await onRefreshData();
      onToast('Leadership profile photo saved.', 'success');
    } catch {
      onToast('Failed to upload profile photo.', 'error');
    }
    e.target.value = '';
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orthohin27_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onToast('Full JSON backup exported.', 'success');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        if (parsed && Array.isArray(parsed.gallery) && Array.isArray(parsed.batchmates)) {
          const restored: PortalState = {
            ...createDefaultState(),
            ...parsed,
          };
          setIsSyncing(true);
          await syncPortalStateInDb(restored, true);
          void addActivityLogInDb('Backup Imported', 'Portal data restored from JSON backup');
          await onRefreshData();
          onToast('Backup imported successfully.', 'success');
        } else {
          onToast('Invalid backup file format.', 'error');
        }
      } catch {
        onToast('Could not parse or import backup JSON.', 'error');
      } finally {
        setIsSyncing(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSavePassword = () => {
    if (newPassword.length < 6) {
      onToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setAdminPassword(newPassword);
    setNewPassword('');
    void addActivityLogInDb('Password Changed', 'Admin passcode updated');
    onToast('Admin passcode updated.', 'success');
  };

  /* Notices Management */
  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim()) {
      onToast('Notice title and message are required.', 'error');
      return;
    }
    const newNotice: BatchNotice = {
      id: `notice-${Date.now()}`,
      title: noticeTitle.trim(),
      message: noticeMessage.trim(),
      category: noticeCategory,
      pinned: noticePinned,
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    try {
      await createNoticeInDb(newNotice);
      void addActivityLogInDb('Notice Published', `${newNotice.category}: ${newNotice.title}`);
      await onRefreshData();
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeCategory('General');
      setNoticePinned(true);
      onToast('Batch notice published.', 'success');
    } catch {
      onToast('Could not publish notice.', 'error');
    }
  };

  const handleToggleNoticePin = async (notice: BatchNotice) => {
    try {
      await updateNoticeInDb({ ...notice, pinned: !notice.pinned });
      await onRefreshData();
    } catch {
      onToast('Could not update notice pin state.', 'error');
    }
  };

  const handleToggleNoticeActive = async (notice: BatchNotice) => {
    try {
      await updateNoticeInDb({ ...notice, active: !notice.active });
      await onRefreshData();
    } catch {
      onToast('Could not toggle notice visibility.', 'error');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteNoticeInDb(id);
      void addActivityLogInDb('Notice Removed', `Notice ${id} deleted`);
      await onRefreshData();
      setConfirmDeleteNoticeId(null);
      onToast('Notice deleted.', 'info');
    } catch {
      onToast('Could not delete notice.', 'error');
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: 'notices', label: `Notices (${(state.notices || []).length})`, icon: <Megaphone className="w-3.5 h-3.5" /> },
    { key: 'orders', label: `Orders (${state.orders.length})`, icon: <Shirt className="w-3.5 h-3.5" /> },
    { key: 'batchmates', label: `Batchmates (${state.batchmates.length})`, icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'gallery', label: `Gallery (${state.gallery.length})`, icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { key: 'hoodie', label: 'Hoodie Page', icon: <Sliders className="w-3.5 h-3.5" /> },
    { key: 'site', label: 'Site & Profile', icon: <Activity className="w-3.5 h-3.5" /> },
    { key: 'security', label: 'Backup & Security', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Admin Control Center"
      onClick={(e) => {
        if (!isRouteAdmin && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl bg-[#0e0e11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#111115]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600/15 border border-rose-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">ORTHOHIN '27 · Admin Control Center</h2>
              <p className="text-[11px] text-zinc-400">
                {unlocked ? `Authorized as ${authorizedAdmin}` : `Restricted access · ${AUTHORIZED_ADMIN_EMAIL}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close admin panel"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{isRouteAdmin ? 'Exit /admin' : 'Close'}</span>
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleLogin} className="max-w-md mx-auto p-8 space-y-5">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Authorized Admin Sign In</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Protected by Google verification & Admin Passcode. Only{' '}
                <span className="font-mono text-zinc-200">{AUTHORIZED_ADMIN_EMAIL}</span> is authorized.
              </p>
            </div>

            {/* Google Auth Status Pill */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">Google Account Verification</span>
                {isFirebaseAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400 font-medium">Required</span>
                )}
              </div>

              {isFirebaseAdmin ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-zinc-200 truncate">{authUser?.email}</span>
                  <button
                    type="button"
                    onClick={() => void signOut(auth)}
                    className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer shrink-0"
                  >
                    Switch account
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => void handleGoogleSignIn()}
                  className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isAuthenticating ? 'Verifying Google account...' : 'Sign in with Google (abraralraze@gmail.com)'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="admin-email-input" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Authorized Email
                </label>
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="abraralraze@gmail.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label htmlFor="admin-pass-input" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Admin Passcode
                </label>
                <input
                  id="admin-pass-input"
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin passcode"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {loginError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAuthenticating ? 'Unlocking Admin Panel...' : 'Verify & Unlock Admin Panel'}
            </button>
          </form>
        ) : (
          <div>
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 px-6 py-3 border-b border-zinc-800/80 bg-[#111115]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-rose-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
              {/* TAB 1: OVERVIEW & ANALYTICS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Admin Operational Notice */}
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Megaphone className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">Admin Notice</p>
                        <p className="text-xs text-zinc-300 mt-0.5">
                          {(state.notices || []).filter((n) => n.active).length} active batch notice(s) live on the
                          portal · Direct RCS Hoodie orders open for sizes S–XXXL.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('notices')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Manage Notices
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-white">{analytics.totalBatchmates}</p>
                      <p className="text-xs text-zinc-400 mt-1">Registered Batchmates</p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-rose-400">
                        {analytics.totalOrders}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Direct Orders ({analytics.totalHoodiesOrdered} hoodies)
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">
                        {analytics.pendingOrders}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">Pending Fulfillment</p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                        {analytics.confirmedOrders + analytics.deliveredOrders}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">Confirmed & Delivered</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Group Distribution */}
                    <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                      <h3 className="text-sm font-bold text-white">Batchmates by Group</h3>
                      <div className="space-y-3">
                        {analytics.groupCounts.map(([grp, count]) => {
                          const pct = Math.round((count / Math.max(1, analytics.totalBatchmates)) * 100);
                          return (
                            <div key={grp} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-300">{grp}</span>
                                <span className="font-mono tabular-nums text-zinc-400">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-rose-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                      <h3 className="text-sm font-bold text-white">Quick Admin Actions</h3>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleExportOrdersCsv}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-rose-400" /> Orders CSV
                        </button>
                        <button
                          type="button"
                          onClick={handleExportBatchmatesCsv}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Batchmates CSV
                        </button>
                        <button
                          type="button"
                          onClick={handleExportJson}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Full Backup JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenRegister();
                          }}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Register Member
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: NOTICES MANAGEMENT */}
              {activeTab === 'notices' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleAddNotice}
                    className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-rose-500" />
                        Publish New Batch Notice
                      </h3>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        value={noticeTitle}
                        onChange={(e) => setNoticeTitle(e.target.value)}
                        placeholder="Notice headline *"
                        className="sm:col-span-2 px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                      />
                      <select
                        value={noticeCategory}
                        onChange={(e) => setNoticeCategory(e.target.value as NoticeCategory)}
                        aria-label="Notice category"
                        className="px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="General">General</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Event">Event</option>
                      </select>
                    </div>

                    <textarea
                      rows={2}
                      required
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      placeholder="Write the official notice message for Orthohin '27 batchmates *"
                      className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 resize-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={noticePinned}
                          onChange={(e) => setNoticePinned(e.target.checked)}
                          className="accent-rose-600 rounded"
                        />
                        Pin this notice at top of portal
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Publish Notice
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    {(state.notices || []).length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400">
                        No batch notices published yet.
                      </div>
                    ) : (
                      (state.notices || []).map((notice) => (
                        <div
                          key={notice.id}
                          className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
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
                              <span className="font-mono text-zinc-400">{notice.createdAt}</span>
                              {notice.pinned && (
                                <>
                                  <span className="text-zinc-600">·</span>
                                  <span className="text-rose-400 font-medium">Pinned</span>
                                </>
                              )}
                              {!notice.active && (
                                <>
                                  <span className="text-zinc-600">·</span>
                                  <span className="text-zinc-500">Hidden</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm font-bold text-white">{notice.title}</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">{notice.message}</p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleToggleNoticePin(notice)}
                              title={notice.pinned ? 'Unpin notice' : 'Pin notice'}
                              className={`p-2 rounded-lg text-xs cursor-pointer ${
                                notice.pinned
                                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleNoticeActive(notice)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
                            >
                              {notice.active ? 'Hide' : 'Show'}
                            </button>

                            {confirmDeleteNoticeId === notice.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNotice(notice.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteNoticeId(null)}
                                  className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteNoticeId(notice.id)}
                                title="Delete notice"
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DIRECT ORDERS */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 w-fit">
                      {(['All', 'Pending', 'Confirmed', 'Delivered'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setOrderStatusFilter(status)}
                          className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                            orderStatusFilter === status
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="Search orders..."
                          className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleExportOrdersCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV
                      </button>
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="p-10 text-center rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-400">
                      No direct hoodie orders match this filter yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                              <span className="font-mono text-rose-400">{order.id}</span>
                              <span>·</span>
                              <span>{order.customerName}</span>
                              <span className="text-xs font-mono text-zinc-400">
                                (Roll {order.roll} · Size {order.size} × {order.quantity})
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400">
                              Contact: <span className="text-zinc-200">{order.contact}</span>
                              {order.notes ? ` · Note: ${order.notes}` : ''}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <select
                              value={order.status}
                              onChange={(e) => handleOrderStatus(order.id, e.target.value as OrderStatus)}
                              aria-label={`Order status for ${order.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium text-white focus:outline-none focus:border-rose-500"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Delivered">Delivered</option>
                            </select>

                            {confirmDeleteOrderId === order.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteOrderId(null)}
                                  className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteOrderId(order.id)}
                                title="Delete order"
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BATCHMATES */}
              {activeTab === 'batchmates' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={bmSearch}
                        onChange={(e) => setBmSearch(e.target.value)}
                        placeholder="Search name, roll, or group..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportBatchmatesCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenRegister();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Batchmate
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {filteredBatchmates.map((bm) => (
                      <div
                        key={bm.id}
                        className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 flex items-center justify-center">
                            {bm.photo ? (
                              <img src={bm.photo} alt={bm.name} className="w-full h-full object-cover object-top" />
                            ) : (
                              <span className="text-xs font-bold text-zinc-400">{getInitials(bm.name)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{bm.name}</p>
                            <p className="text-xs text-zinc-400">
                              <span className="font-mono tabular-nums">Roll {bm.roll || 'N/A'}</span> · {bm.group}
                              {bm.social ? ` · ${bm.social}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (editingBmId === bm.id) {
                                  void handleSaveBatchmate(bm);
                                } else {
                                  setEditingBmId(bm.id);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                                editingBmId === bm.id
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                              }`}
                            >
                              {editingBmId === bm.id ? 'Save' : 'Edit'}
                            </button>

                            {confirmDeleteBmId === bm.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBatchmate(bm.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteBmId(null)}
                                  className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBmId(bm.id)}
                                title="Remove batchmate"
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {editingBmId === bm.id && (
                          <div className="grid sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800">
                            <input
                              type="text"
                              value={bm.name}
                              onChange={(e) => handleUpdateBatchmateField(bm.id, 'name', e.target.value)}
                              placeholder="Name"
                              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={bm.roll}
                              onChange={(e) => handleUpdateBatchmateField(bm.id, 'roll', e.target.value)}
                              placeholder="Roll"
                              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                            />
                            <input
                              type="text"
                              value={bm.group}
                              onChange={(e) => handleUpdateBatchmateField(bm.id, 'group', e.target.value)}
                              placeholder="Group"
                              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={bm.social || ''}
                              onChange={(e) => handleUpdateBatchmateField(bm.id, 'social', e.target.value)}
                              placeholder="Social handle"
                              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={bm.quote || ''}
                              onChange={(e) => handleUpdateBatchmateField(bm.id, 'quote', e.target.value)}
                              placeholder="Bio / Quote"
                              className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: GALLERY */}
              {activeTab === 'gallery' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-400">
                      <span className="font-mono text-white">{state.gallery.length}</span> gallery items · reorder,
                      add photos, or link videos
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddVideo((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5 text-rose-400" /> Add Video Memory
                      </button>
                      <button
                        type="button"
                        onClick={() => addPhotosInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Upload Photos
                      </button>
                    </div>
                  </div>

                  {showAddVideo && (
                    <form
                      onSubmit={handleAddVideoMemory}
                      className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3"
                    >
                      <p className="text-xs font-bold text-white">New Facebook / External Video Memory</p>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          required
                          value={videoTitle}
                          onChange={(e) => setVideoTitle(e.target.value)}
                          placeholder="Video title *"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={videoDate}
                          onChange={(e) => setVideoDate(e.target.value)}
                          placeholder="Date (e.g. November 2026)"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                      </div>
                      <input
                        type="url"
                        required
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://www.facebook.com/share/v/..."
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={videoCaption}
                        onChange={(e) => setVideoCaption(e.target.value)}
                        placeholder="Caption"
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddVideo(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Add Video
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {state.gallery.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
                      >
                        {item.src ? (
                          <img
                            src={item.src}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-20 h-16 rounded-lg object-cover shrink-0 bg-zinc-950"
                          />
                        ) : (
                          <div className="w-20 h-16 rounded-lg shrink-0 bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
                            {item.isVideo ? <Video className="w-5 h-5 text-rose-400" /> : <ImageIcon className="w-5 h-5" />}
                          </div>
                        )}

                        <div className="flex-1 w-full space-y-2">
                          <div className="grid sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                onUpdateState({
                                  ...state,
                                  gallery: state.gallery.map((g) =>
                                    g.id === item.id ? { ...g, title: e.target.value } : g
                                  ),
                                })
                              }
                              onBlur={() => void handleSaveGalleryItem(item, idx)}
                              placeholder="Title"
                              className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={item.date || ''}
                              onChange={(e) =>
                                onUpdateState({
                                  ...state,
                                  gallery: state.gallery.map((g) =>
                                    g.id === item.id ? { ...g, date: e.target.value } : g
                                  ),
                                })
                              }
                              onBlur={() => void handleSaveGalleryItem(item, idx)}
                              placeholder="Date"
                              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                            />
                          </div>
                          <input
                            type="text"
                            value={item.caption}
                            onChange={(e) =>
                              onUpdateState({
                                ...state,
                                gallery: state.gallery.map((g) =>
                                  g.id === item.id ? { ...g, caption: e.target.value } : g
                                ),
                              })
                            }
                            onBlur={() => void handleSaveGalleryItem(item, idx)}
                            placeholder="Caption"
                            className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                          />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleSaveGalleryItem(item, idx)}
                            title="Save changes to Firebase"
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-emerald-600 text-zinc-200 hover:text-white cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveGallery(idx, -1)}
                            disabled={idx === 0}
                            title="Move up"
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveGallery(idx, 1)}
                            disabled={idx === state.gallery.length - 1}
                            title="Move down"
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplaceTargetId(item.id);
                              replacePhotoInputRef.current?.click();
                            }}
                            title="Upload / Replace photo"
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteGalleryId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteGallery(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteGalleryId(null)}
                                className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteGalleryId(item.id)}
                              title="Delete"
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: HOODIE PAGE SETTINGS (ADMIN-ONLY) */}
              {activeTab === 'hoodie' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <div>
                      <p className="text-sm font-bold text-white">Direct Ordering Status</p>
                      <p className="text-xs text-zinc-400">
                        Control whether batchmates can submit direct orders on the Hoodie page.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextHoodie = {
                          ...state.hoodieConfig,
                          directOrderOpen: !state.hoodieConfig.directOrderOpen,
                        };
                        onUpdateState({ ...state, hoodieConfig: nextHoodie });
                        void persistSettings(
                          state.profile,
                          nextHoodie,
                          state.siteConfig,
                          nextHoodie.directOrderOpen ? 'Direct orders opened.' : 'Direct orders paused.'
                        );
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                        state.hoodieConfig.directOrderOpen
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {state.hoodieConfig.directOrderOpen ? 'Direct Orders Open' : 'Direct Orders Paused'}
                    </button>
                  </div>

                  {/* Front & Back RCS Hoodie Image Controls */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                      <p className="text-xs font-bold text-white">RCS Hoodie — Front Pic</p>
                      <img
                        src={state.hoodieConfig.frontImage}
                        alt="Hoodie front"
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHoodieSideTarget('frontImage');
                          hoodiePhotoInputRef.current?.click();
                        }}
                        className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Change Front Pic
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                      <p className="text-xs font-bold text-white">RCS Hoodie — Back Pic</p>
                      <img
                        src={state.hoodieConfig.backImage}
                        alt="Hoodie back"
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHoodieSideTarget('backImage');
                          hoodiePhotoInputRef.current?.click();
                        }}
                        className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Change Back Pic
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Hoodie Page Title</label>
                      <input
                        type="text"
                        value={state.hoodieConfig.title}
                        onChange={(e) =>
                          onUpdateState({
                            ...state,
                            hoodieConfig: { ...state.hoodieConfig, title: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Hoodie Subtitle</label>
                      <textarea
                        rows={2}
                        value={state.hoodieConfig.subtitle}
                        onChange={(e) =>
                          onUpdateState({
                            ...state,
                            hoodieConfig: { ...state.hoodieConfig, subtitle: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-zinc-400">Specifications (4 lines)</label>
                      {state.hoodieConfig.specs.map((sp, i) => (
                        <input
                          key={i}
                          type="text"
                          value={sp}
                          onChange={(e) => {
                            const nextSpecs = [...state.hoodieConfig.specs];
                            nextSpecs[i] = e.target.value;
                            onUpdateState({
                              ...state,
                              hoodieConfig: { ...state.hoodieConfig, specs: nextSpecs },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() =>
                          void persistSettings(
                            state.profile,
                            state.hoodieConfig,
                            state.siteConfig,
                            'Hoodie page changes saved.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Hoodie Settings
                      </button>
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => {
                          const resetHoodie = { ...DEFAULT_HOODIE_CONFIG, specs: [...DEFAULT_HOODIE_CONFIG.specs] };
                          onUpdateState({ ...state, hoodieConfig: resetHoodie });
                          void persistSettings(
                            state.profile,
                            resetHoodie,
                            state.siteConfig,
                            'Hoodie page reset to default.'
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Hoodie Defaults
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SITE CONTENT & PROFILE */}
              {activeTab === 'site' && (
                <div className="space-y-6">
                  <div className="space-y-3 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <h3 className="text-sm font-bold text-white">Site-Wide Announcement Banner</h3>
                    <input
                      type="text"
                      value={state.siteConfig.announcement}
                      onChange={(e) =>
                        onUpdateState({
                          ...state,
                          siteConfig: { ...state.siteConfig, announcement: e.target.value },
                        })
                      }
                      placeholder="Optional notice banner shown at top of portal (leave blank to hide)"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-3 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <h3 className="text-sm font-bold text-white">Hero & Developer Note Copy</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={state.siteConfig.heroKicker}
                        onChange={(e) =>
                          onUpdateState({
                            ...state,
                            siteConfig: { ...state.siteConfig, heroKicker: e.target.value },
                          })
                        }
                        placeholder="Hero kicker"
                        className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                      <input
                        type="url"
                        value={state.siteConfig.instagramUrl}
                        onChange={(e) =>
                          onUpdateState({
                            ...state,
                            siteConfig: { ...state.siteConfig, instagramUrl: e.target.value },
                          })
                        }
                        placeholder="Instagram URL"
                        className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={state.siteConfig.heroDescription}
                      onChange={(e) =>
                        onUpdateState({
                          ...state,
                          siteConfig: { ...state.siteConfig, heroDescription: e.target.value },
                        })
                      }
                      placeholder="Hero description"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                    />
                    <textarea
                      rows={2}
                      value={state.siteConfig.devNote}
                      onChange={(e) =>
                        onUpdateState({
                          ...state,
                          siteConfig: { ...state.siteConfig, devNote: e.target.value },
                        })
                      }
                      placeholder="Developer note"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() =>
                          void persistSettings(
                            state.profile,
                            state.hoodieConfig,
                            state.siteConfig,
                            'Site content saved.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Site Copy
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <h3 className="text-sm font-bold text-white">Leadership Profile Photo</h3>
                    <div className="flex items-center gap-4">
                      <img
                        src={state.profile || DEFAULT_PROFILE_IMAGE}
                        alt="Lead profile preview"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-xl object-cover object-top border border-zinc-800 bg-zinc-950"
                      />
                      <input
                        type="text"
                        value={profileUrlInput}
                        onChange={(e) => setProfileUrlInput(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload New Photo
                      </button>
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => {
                          const nextProf = profileUrlInput.trim() || DEFAULT_PROFILE_IMAGE;
                          onUpdateState({ ...state, profile: nextProf });
                          void persistSettings(nextProf, state.hoodieConfig, state.siteConfig, 'Profile URL applied.');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                      >
                        Apply URL
                      </button>
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => {
                          onUpdateState({ ...state, profile: DEFAULT_PROFILE_IMAGE });
                          void persistSettings(
                            DEFAULT_PROFILE_IMAGE,
                            state.hoodieConfig,
                            state.siteConfig,
                            'Profile photo reset.'
                          );
                        }}
                        className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: BACKUP, ACTIVITY LOG & SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div className="space-y-2 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <h3 className="text-sm font-bold text-white">Backup & Restore</h3>
                    <p className="text-xs text-zinc-400">
                      Export all batchmates, direct orders, gallery items, and settings as JSON, or restore from a
                      saved backup.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Export Backup JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => importBackupInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Import Backup JSON
                      </button>

                      {confirmReset ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={async () => {
                              setIsSyncing(true);
                              try {
                                const defaults = createDefaultState();
                                await syncPortalStateInDb(defaults, true);
                                resetAdminPassword();
                                void addActivityLogInDb('Portal Reset', 'Portal data reset to factory defaults');
                                await onRefreshData();
                                setConfirmReset(false);
                                onToast('Portal data reset to defaults.', 'info');
                              } catch {
                                onToast('Failed to reset portal data.', 'error');
                              } finally {
                                setIsSyncing(false);
                              }
                            }}
                            className="px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Confirm Full Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmReset(false)}
                            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset All Data
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Password & Auth */}
                  <div className="space-y-3 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Authorization & Passcode</h3>
                      <span className="text-[11px] font-mono text-zinc-400">{AUTHORIZED_ADMIN_EMAIL}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New passcode (min 6 characters)"
                        className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={handleSavePassword}
                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Update Passcode
                      </button>
                    </div>
                  </div>

                  {/* Activity Log */}
                  <div className="space-y-2 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <h3 className="text-sm font-bold text-white">Recent Activity Log</h3>
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {(state.activityLog || []).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-3 text-xs py-1.5 border-b border-zinc-800/70 last:border-0"
                        >
                          <div>
                            <span className="font-semibold text-zinc-200">{entry.action}</span>
                            <span className="text-zinc-400"> — {entry.detail}</span>
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setUnlocked(false);
                        setAuthorizedAdmin('');
                        void signOut(auth);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" /> Lock & Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          ref={addPhotosInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddPhotos}
          className="hidden"
        />
        <input
          ref={replacePhotoInputRef}
          type="file"
          accept="image/*"
          onChange={handleReplacePhoto}
          className="hidden"
        />
        <input
          ref={profilePhotoInputRef}
          type="file"
          accept="image/*"
          onChange={handleProfileUpload}
          className="hidden"
        />
        <input
          ref={hoodiePhotoInputRef}
          type="file"
          accept="image/*"
          onChange={handleHoodiePhotoUpload}
          className="hidden"
        />
        <input
          ref={importBackupInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportJson}
          className="hidden"
        />
      </div>
    </div>
  );
}
