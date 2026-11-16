import { useEffect, useMemo, useRef, useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Camera,
  Check,
  CheckSquare,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe,
  Image as ImageIcon,
  Lock,
  Megaphone,
  Menu,
  Pin,
  Plus,
  RefreshCw,
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
  createBatchmateInDb,
  createNoticeInDb,
  createOrderInDb,
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
  SectionVisibility,
  TimelineMilestone,
} from '../types';
import {
  AUTHORIZED_ADMIN_EMAIL,
  compressImage,
  createDefaultState,
  DEFAULT_HERO_IMAGE,
  DEFAULT_HOODIE_CONFIG,
  DEFAULT_PROFILE_IMAGE,
  DEFAULT_SITE_CONFIG,
  downloadCsv,
  getAdminPassword,
  getInitials,
  mergeHoodieConfig,
  mergeSiteConfig,
  resetAdminPassword,
  setAdminPassword,
} from '../utils/storage';
import { downloadOrderInvoicePng } from '../utils/invoice';

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
type SiteSubTab = 'global' | 'hero' | 'about' | 'leadership' | 'timeline';

const HOODIE_SIZES: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

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
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [siteSubTab, setSiteSubTab] = useState<SiteSubTab>('global');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  // Orders filters, add & full edit
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [orderSizeFilter, setOrderSizeFilter] = useState<'All' | HoodieOrder['size']>('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [newOrderName, setNewOrderName] = useState('');
  const [newOrderRoll, setNewOrderRoll] = useState('');
  const [newOrderSize, setNewOrderSize] = useState<HoodieOrder['size']>('L');
  const [newOrderQty, setNewOrderQty] = useState(1);
  const [newOrderContact, setNewOrderContact] = useState('');
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState<HoodieOrder | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);

  // Batchmates filters, add & full edit
  const [bmSearch, setBmSearch] = useState('');
  const [bmGroupFilter, setBmGroupFilter] = useState('All');
  const [showAddBm, setShowAddBm] = useState(false);
  const [newBmName, setNewBmName] = useState('');
  const [newBmRoll, setNewBmRoll] = useState('');
  const [newBmGroup, setNewBmGroup] = useState('Science');
  const [newBmSocial, setNewBmSocial] = useState('');
  const [newBmQuote, setNewBmQuote] = useState('');
  const [newBmPhoto, setNewBmPhoto] = useState('');
  const [editingBmId, setEditingBmId] = useState<string | null>(null);
  const [bmPhotoTargetId, setBmPhotoTargetId] = useState<string | null>(null);
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
  const [logSearch, setLogSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // Notice board states
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<NoticeCategory>('General');
  const [noticePinned, setNoticePinned] = useState(true);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<BatchNotice | null>(null);
  const [confirmDeleteNoticeId, setConfirmDeleteNoticeId] = useState<string | null>(null);

  const addPhotosInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const heroPhotoInputRef = useRef<HTMLInputElement>(null);
  const hoodiePhotoInputRef = useRef<HTMLInputElement>(null);
  const bmPhotoInputRef = useRef<HTMLInputElement>(null);
  const newBmPhotoInputRef = useRef<HTMLInputElement>(null);
  const importBackupInputRef = useRef<HTMLInputElement>(null);

  const sc = useMemo(() => mergeSiteConfig(state.siteConfig), [state.siteConfig]);
  const hc = useMemo(() => mergeHoodieConfig(state.hoodieConfig), [state.hoodieConfig]);

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
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSecondsLeft(remaining);
      if (remaining === 0) {
        setLockUntil(0);
        setFailedAttempts(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  useEffect(() => {
    if (!isOpen) {
      setPasswordInput('');
      setLoginError('');
      setConfirmReset(false);
      setConfirmDeleteGalleryId(null);
      setConfirmDeleteBmId(null);
      setConfirmDeleteOrderId(null);
      setConfirmDeleteNoticeId(null);
      setSelectedOrderIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRouteAdmin) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isRouteAdmin, onClose]);

  const analytics = useMemo(() => {
    const orders = state.orders || [];
    const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
    const confirmedOrders = orders.filter((o) => o.status === 'Confirmed').length;
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered').length;
    const totalHoodiesOrdered = orders.reduce((acc, o) => acc + (o.quantity || 1), 0);

    const sizeBreakdown: Record<HoodieOrder['size'], number> = {
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      XXXL: 0,
    };
    for (const o of orders) {
      if (sizeBreakdown[o.size] !== undefined) {
        sizeBreakdown[o.size] += o.quantity || 1;
      }
    }

    const groupCounts: Record<string, number> = {};
    const rollCounts: Record<string, number> = {};
    for (const b of state.batchmates) {
      const grp = b.group || 'Other';
      groupCounts[grp] = (groupCounts[grp] || 0) + 1;
      const normalizedRoll = b.roll.trim();
      if (normalizedRoll) {
        rollCounts[normalizedRoll] = (rollCounts[normalizedRoll] || 0) + 1;
      }
    }
    const duplicateRolls = Object.entries(rollCounts)
      .filter(([, count]) => count > 1)
      .map(([roll]) => roll);

    return {
      totalBatchmates: state.batchmates.length,
      totalOrders: orders.length,
      totalHoodiesOrdered,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      activeNotices: (state.notices || []).filter((n) => n.active).length,
      totalGallery: state.gallery.length,
      sizeBreakdown,
      duplicateRolls,
      groupNames: Object.keys(groupCounts).sort(),
      groupCounts: Object.entries(groupCounts).sort((a, b) => b[1] - a[1]),
    };
  }, [state]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return (state.orders || []).filter((o) => {
      const matchesStatus = orderStatusFilter === 'All' || o.status === orderStatusFilter;
      const matchesSize = orderSizeFilter === 'All' || o.size === orderSizeFilter;
      const matchesQuery =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.roll.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.contact.toLowerCase().includes(q) ||
        (o.notes && o.notes.toLowerCase().includes(q));
      return matchesStatus && matchesSize && matchesQuery;
    });
  }, [state.orders, orderStatusFilter, orderSizeFilter, orderSearch]);

  const filteredBatchmates = useMemo(() => {
    const q = bmSearch.trim().toLowerCase();
    return state.batchmates.filter((b) => {
      const matchesGroup = bmGroupFilter === 'All' || (b.group || 'Other') === bmGroupFilter;
      const matchesQuery =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.roll.toLowerCase().includes(q) ||
        (b.group && b.group.toLowerCase().includes(q)) ||
        (b.social && b.social.toLowerCase().includes(q));
      return matchesGroup && matchesQuery;
    });
  }, [state.batchmates, bmSearch, bmGroupFilter]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return (state.activityLog || []).filter(
      (entry) =>
        !q || entry.action.toLowerCase().includes(q) || entry.detail.toLowerCase().includes(q)
    );
  }, [state.activityLog, logSearch]);

  const quickSearchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return null;
    const matchedOrders = (state.orders || [])
      .filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.roll.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedMembers = state.batchmates
      .filter((b) => b.name.toLowerCase().includes(q) || b.roll.toLowerCase().includes(q))
      .slice(0, 4);
    const matchedNotices = (state.notices || [])
      .filter((n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q))
      .slice(0, 3);
    return { matchedOrders, matchedMembers, matchedNotices };
  }, [globalQuery, state.orders, state.batchmates, state.notices]);

  if (!isOpen) return null;

  const completeUnlock = async (verifiedEmail: string) => {
    setUnlocked(true);
    setAuthorizedAdmin(verifiedEmail);
    setLoginError('');
    setPasswordInput('');
    setFailedAttempts(0);
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
        setLoginError('Google verification failed. Please confirm your account and try again.');
      }
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating || lockSecondsLeft > 0) return;

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
      setLoginError(`Unauthorized email. Access is strictly restricted to ${AUTHORIZED_ADMIN_EMAIL}.`);
      return;
    }
    if (passwordInput !== getAdminPassword()) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setLockUntil(Date.now() + 30000);
        setLoginError('Too many incorrect passcode attempts. Locked for 30 seconds.');
      } else {
        setLoginError(`Incorrect passcode (${5 - nextAttempts} attempts left).`);
      }
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

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    try {
      await onRefreshData();
      onToast('Portal data refreshed.', 'info');
    } catch {
      onToast('Could not refresh portal data.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySizeSummary = async () => {
    const lines = [
      `RCS HOODIE '26-'27 — SIZE SUMMARY`,
      ...HOODIE_SIZES.map((sz) => `${sz}: ${analytics.sizeBreakdown[sz]} pcs`),
      `Total: ${analytics.totalHoodiesOrdered} pcs (${analytics.totalOrders} orders)`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      onToast('Hoodie size breakdown copied to clipboard.', 'success');
    } catch {
      onToast('Could not copy to clipboard.', 'error');
    }
  };

  /* Settings helper */
  const persistSettings = async (
    nextProfile = state.profile,
    nextHoodie = hc,
    nextSite = sc,
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

  const updateSiteField = <K extends keyof typeof sc>(field: K, value: (typeof sc)[K]) => {
    onUpdateState({
      ...state,
      siteConfig: { ...sc, [field]: value },
    });
  };

  const toggleSection = async (key: keyof SectionVisibility, label: string) => {
    const nextSections: SectionVisibility = {
      ...sc.sections!,
      [key]: !sc.sections![key],
    };
    const nextSite = { ...sc, sections: nextSections };
    onUpdateState({ ...state, siteConfig: nextSite });
    await persistSettings(
      state.profile,
      hc,
      nextSite,
      `${label} ${nextSections[key] ? 'shown' : 'hidden'} on portal.`
    );
  };

  /* Orders Management */
  const handleAddManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderName.trim() || !newOrderRoll.trim() || !newOrderContact.trim()) {
      onToast('Customer name, roll, and contact are required.', 'error');
      return;
    }
    const order: HoodieOrder = {
      id: `RCS-${Date.now().toString().slice(-5)}`,
      customerName: newOrderName.trim(),
      roll: newOrderRoll.trim(),
      size: newOrderSize,
      quantity: newOrderQty,
      contact: newOrderContact.trim(),
      notes: newOrderNotes.trim() || undefined,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
    };
    try {
      await createOrderInDb(order);
      void addActivityLogInDb('Manual Order Added', `${order.id}: ${order.customerName} (${order.size} × ${order.quantity})`);
      await onRefreshData();
      setNewOrderName('');
      setNewOrderRoll('');
      setNewOrderContact('');
      setNewOrderNotes('');
      setNewOrderQty(1);
      setShowAddOrder(false);
      onToast(`Order ${order.id} added.`, 'success');
    } catch {
      onToast('Could not add order.', 'error');
    }
  };

  const handleOrderStatus = async (orderId: string, status: OrderStatus, notes?: string) => {
    try {
      await updateOrderStatusInDb(orderId, status, notes);
      void addActivityLogInDb('Order Updated', `Order ${orderId} updated (${status})`);
      await onRefreshData();
      onToast(`Order ${orderId} updated.`, 'success');
    } catch {
      onToast('Could not update order.', 'error');
    }
  };

  const handleSaveEditedOrder = async () => {
    if (!orderDraft) return;
    if (!orderDraft.customerName.trim() || !orderDraft.roll.trim() || !orderDraft.contact.trim()) {
      onToast('Name, roll, and contact are required.', 'error');
      return;
    }
    try {
      await updateOrderStatusInDb(orderDraft.id, orderDraft.status, orderDraft.notes || '', {
        customerName: orderDraft.customerName.trim(),
        roll: orderDraft.roll.trim(),
        size: orderDraft.size,
        quantity: orderDraft.quantity,
        contact: orderDraft.contact.trim(),
      });
      void addActivityLogInDb('Order Edited', `${orderDraft.id}: ${orderDraft.customerName} (${orderDraft.size})`);
      await onRefreshData();
      setEditingOrderId(null);
      setOrderDraft(null);
      onToast(`Order ${orderDraft.id} saved.`, 'success');
    } catch {
      onToast('Could not save order edits.', 'error');
    }
  };

  const handleBulkOrderStatus = async (status: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    setIsSyncing(true);
    try {
      await Promise.all(selectedOrderIds.map((id) => updateOrderStatusInDb(id, status)));
      void addActivityLogInDb(
        'Bulk Order Update',
        `${selectedOrderIds.length} order(s) marked as ${status}`
      );
      await onRefreshData();
      setSelectedOrderIds([]);
      onToast(`${selectedOrderIds.length} order(s) marked as ${status}.`, 'success');
    } catch {
      onToast('Bulk order update failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkDeleteOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsSyncing(true);
    try {
      await Promise.all(selectedOrderIds.map((id) => deleteOrderInDb(id)));
      void addActivityLogInDb('Bulk Order Delete', `${selectedOrderIds.length} order(s) removed`);
      await onRefreshData();
      setSelectedOrderIds([]);
      onToast('Selected orders removed.', 'info');
    } catch {
      onToast('Bulk order deletion failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrderInDb(orderId);
      void addActivityLogInDb('Order Removed', `Order ${orderId} deleted by admin`);
      await onRefreshData();
      setConfirmDeleteOrderId(null);
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
      onToast('Order removed.', 'info');
    } catch {
      onToast('Could not delete order.', 'error');
    }
  };

  const handleExportOrdersCsv = (onlySelected = false) => {
    const targetOrders =
      onlySelected && selectedOrderIds.length > 0
        ? state.orders.filter((o) => selectedOrderIds.includes(o.id))
        : state.orders;
    downloadCsv(
      `orthohin27_rcs_orders_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order ID', 'Name', 'Roll', 'Size', 'Quantity', 'Contact', 'Notes', 'Status', 'Created At'],
      targetOrders.map((o) => [
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
    onToast(`Exported ${targetOrders.length} order(s) to CSV.`, 'success');
  };

  /* Batchmates Management */
  const handleAddBatchmateInsideAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBmName.trim() || !newBmRoll.trim()) {
      onToast('Name and roll number are required.', 'error');
      return;
    }
    const member: Batchmate = {
      id: `bm-${Date.now()}`,
      name: newBmName.trim(),
      roll: newBmRoll.trim(),
      group: newBmGroup.trim() || 'Science',
      social: newBmSocial.trim() || undefined,
      quote: newBmQuote.trim() || undefined,
      photo: newBmPhoto || undefined,
      registeredAt: new Date().toISOString().slice(0, 10),
    };
    try {
      await createBatchmateInDb(member);
      void addActivityLogInDb('Batchmate Added', `${member.name} (Roll ${member.roll}) added by admin`);
      await onRefreshData();
      setNewBmName('');
      setNewBmRoll('');
      setNewBmSocial('');
      setNewBmQuote('');
      setNewBmPhoto('');
      setShowAddBm(false);
      onToast(`${member.name} added to directory.`, 'success');
    } catch {
      onToast('Could not add batchmate.', 'error');
    }
  };

  const handleNewBmPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 600);
      setNewBmPhoto(src);
    } catch {
      onToast('Could not process photo.', 'error');
    }
    e.target.value = '';
  };

  const handleBmPhotoReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bmPhotoTargetId) return;
    try {
      const src = await compressImage(file, 600);
      const target = state.batchmates.find((b) => b.id === bmPhotoTargetId);
      if (target) {
        const updated = { ...target, photo: src };
        await updateBatchmateInDb(updated);
        await onRefreshData();
        onToast(`${target.name}'s portrait updated.`, 'success');
      }
    } catch {
      onToast('Could not update batchmate portrait.', 'error');
    } finally {
      setBmPhotoTargetId(null);
      e.target.value = '';
    }
  };

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

  /* Hoodie Config Management */
  const handleHoodiePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 900);
      const nextHoodie = { ...hc, [hoodieSideTarget]: src };
      onUpdateState({ ...state, hoodieConfig: nextHoodie });
      await saveSettingsInDb(state.profile, nextHoodie, sc);
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

  /* Hero & Profile Uploads */
  const handleHeroPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 950);
      const nextSite = { ...sc, heroImage: src };
      onUpdateState({ ...state, siteConfig: nextSite });
      await saveSettingsInDb(state.profile, hc, nextSite);
      void addActivityLogInDb('Hero Image Updated', 'Homepage hero showcase image updated');
      await onRefreshData();
      onToast('Hero showcase image saved.', 'success');
    } catch {
      onToast('Failed to upload hero image.', 'error');
    }
    e.target.value = '';
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 600);
      onUpdateState({ ...state, profile: src });
      await saveSettingsInDb(src, hc, sc);
      void addActivityLogInDb('Profile Updated', 'Leadership profile photo uploaded');
      await onRefreshData();
      onToast('Leadership profile photo saved.', 'success');
    } catch {
      onToast('Failed to upload profile photo.', 'error');
    }
    e.target.value = '';
  };

  /* Timeline Helpers */
  const handleMoveTimeline = (index: number, dir: -1 | 1) => {
    const list = [...(sc.timeline || [])];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);
    updateSiteField('timeline', list);
  };

  const handleAddTimeline = () => {
    const nextItem: TimelineMilestone = {
      id: `tl-${Date.now()}`,
      tag: 'Milestone',
      title: 'New Batch Milestone',
      description: 'Describe this highlight in our Orthohin 27 journey.',
    };
    updateSiteField('timeline', [...(sc.timeline || []), nextItem]);
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

  const handleSaveEditedNotice = async () => {
    if (!noticeDraft || !noticeDraft.title.trim() || !noticeDraft.message.trim()) {
      onToast('Notice title and message cannot be empty.', 'error');
      return;
    }
    try {
      await updateNoticeInDb({
        ...noticeDraft,
        title: noticeDraft.title.trim(),
        message: noticeDraft.message.trim(),
      });
      void addActivityLogInDb('Notice Updated', `${noticeDraft.category}: ${noticeDraft.title}`);
      await onRefreshData();
      setEditingNoticeId(null);
      setNoticeDraft(null);
      onToast('Notice updated.', 'success');
    } catch {
      onToast('Could not save notice changes.', 'error');
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

  const navItems: { key: AdminTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Smart Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'notices', label: 'Notices Board', count: (state.notices || []).length, icon: <Megaphone className="w-4 h-4" /> },
    { key: 'orders', label: 'Hoodie Orders', count: state.orders.length, icon: <Shirt className="w-4 h-4" /> },
    { key: 'batchmates', label: 'Batchmates', count: state.batchmates.length, icon: <Users className="w-4 h-4" /> },
    { key: 'gallery', label: 'Memory Vault', count: state.gallery.length, icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'hoodie', label: 'Hoodie Page', icon: <Sliders className="w-4 h-4" /> },
    { key: 'site', label: 'Full Site Studio', icon: <Globe className="w-4 h-4" /> },
    { key: 'security', label: 'Backup & Security', icon: <Shield className="w-4 h-4" /> },
  ];

  const selectTab = (key: AdminTab) => {
    setActiveTab(key);
    setMobileNavOpen(false);
  };

  return (
    <div
      className={`${
        isRouteAdmin ? 'h-screen' : 'fixed inset-0 z-50'
      } bg-[#070709] text-zinc-100 flex flex-col overflow-hidden`}
      role={isRouteAdmin ? 'main' : 'dialog'}
      aria-modal={isRouteAdmin ? undefined : true}
      aria-label="ORTHOHIN '27 Smart Admin Panel"
    >
      {/* Dedicated Top Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-zinc-800/90 bg-[#0c0c10] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {unlocked && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              aria-label="Toggle admin navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-lg bg-rose-600/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-rose-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              ORTHOHIN '27 · Smart Admin Control
            </h2>
            <p className="text-[11px] text-zinc-400 truncate">
              {unlocked ? `Authorized: ${authorizedAdmin}` : `Protected /admin Page · ${AUTHORIZED_ADMIN_EMAIL}`}
            </p>
          </div>
        </div>

        {unlocked && (
          <div className="hidden md:block relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Quick find order, batchmate, or notice..."
              className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
            />
            {globalQuery && (
              <button
                type="button"
                onClick={() => setGlobalQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                aria-label="Clear quick search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {quickSearchResults && (
              <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-[#111116] border border-zinc-800 shadow-2xl p-2 z-50 space-y-2">
                {quickSearchResults.matchedOrders.length === 0 &&
                quickSearchResults.matchedMembers.length === 0 &&
                quickSearchResults.matchedNotices.length === 0 ? (
                  <p className="text-xs text-zinc-500 px-2 py-2">No matching records across portal.</p>
                ) : (
                  <>
                    {quickSearchResults.matchedOrders.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1">
                          Orders
                        </p>
                        {quickSearchResults.matchedOrders.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setOrderSearch(o.id);
                              setActiveTab('orders');
                              setGlobalQuery('');
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-800/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-zinc-200 truncate">
                              <span className="font-mono text-rose-400">{o.id}</span> · {o.customerName}
                            </span>
                            <span className="font-mono text-zinc-400 shrink-0">{o.size}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {quickSearchResults.matchedMembers.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1">
                          Batchmates
                        </p>
                        {quickSearchResults.matchedMembers.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setBmSearch(b.roll || b.name);
                              setActiveTab('batchmates');
                              setGlobalQuery('');
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-800/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-zinc-200 truncate">{b.name}</span>
                            <span className="font-mono text-zinc-400 shrink-0">Roll {b.roll}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {quickSearchResults.matchedNotices.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1">
                          Notices
                        </p>
                        {quickSearchResults.matchedNotices.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setActiveTab('notices');
                              setGlobalQuery('');
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-800/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-zinc-200 truncate">{n.title}</span>
                            <span className="text-zinc-400 shrink-0">{n.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {unlocked && (
            <>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void handleManualRefresh()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh portal data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnlocked(false);
                  setAuthorizedAdmin('');
                  void signOut(auth);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Exit admin panel"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">View Portal</span>
          </button>
        </div>
      </header>

      {!unlocked ? (
        /* Dedicated /admin-login Auth View */
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-4 sm:p-8 bg-[#070709]">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md rounded-2xl bg-[#0e0e12] border border-zinc-800/90 p-7 sm:p-8 space-y-5 shadow-2xl"
          >
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-rose-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Restricted Admin Gateway</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-white">Sign in to Admin Control</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Access is strictly restricted to <span className="font-mono text-zinc-200">{AUTHORIZED_ADMIN_EMAIL}</span>{' '}
                with verified account credentials and admin passcode.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">Account Verification</span>
                {isFirebaseAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400 font-medium">Required on sign in</span>
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
                  {isAuthenticating ? 'Verifying Google account...' : `Sign in with Google (${AUTHORIZED_ADMIN_EMAIL})`}
                </button>
              )}
            </div>

            <div className="space-y-3.5">
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
                <div className="relative">
                  <input
                    id="admin-pass-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter admin passcode"
                    autoComplete="current-password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {loginError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating || lockSecondsLeft > 0}
              className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {lockSecondsLeft > 0
                ? `Locked (${lockSecondsLeft}s)`
                : isAuthenticating
                  ? 'Verifying & Unlocking...'
                  : 'Unlock Smart Admin Panel'}
            </button>
          </form>
        </div>
      ) : (
        /* Full-Control Smart Admin Workspace */
        <div className="flex-1 flex overflow-hidden relative">
          {/* Desktop Sidebar & Mobile Drawer */}
          <aside
            className={`${
              mobileNavOpen ? 'fixed inset-y-16 left-0 z-40 flex' : 'hidden lg:flex'
            } w-64 flex-col border-r border-zinc-800/80 bg-[#0b0b0f] p-4 justify-between shrink-0 overflow-y-auto`}
          >
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectTab(item.key)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === item.key
                      ? 'bg-rose-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        activeTab === item.key ? 'text-rose-100' : 'text-zinc-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="pt-4 mt-4 border-t border-zinc-800/80 space-y-2.5">
              <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-200">Live Portal Switches</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Hoodie Orders</span>
                    <span className={hc.directOrderOpen ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                      {hc.directOrderOpen ? 'Open' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Registration</span>
                    <span className={sc.registrationOpen !== false ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                      {sc.registrationOpen !== false ? 'Open' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Maintenance</span>
                    <span className={sc.maintenanceMode ? 'text-amber-400 font-medium' : 'text-zinc-500'}>
                      {sc.maintenanceMode ? 'Active' : 'Off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Workspace Canvas */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* TAB 1: SMART OVERVIEW & INSTANT SWITCHES */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Instant Live Switches */}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => {
                        const nextHoodie = { ...hc, directOrderOpen: !hc.directOrderOpen };
                        onUpdateState({ ...state, hoodieConfig: nextHoodie });
                        void persistSettings(
                          state.profile,
                          nextHoodie,
                          sc,
                          nextHoodie.directOrderOpen ? 'Direct hoodie orders opened.' : 'Direct hoodie orders paused.'
                        );
                      }}
                      className="p-4 rounded-xl bg-[#111116] border border-zinc-800 hover:border-zinc-700 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">Hoodie Direct Orders</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {hc.directOrderOpen ? 'Accepting new orders' : 'Temporarily paused'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          hc.directOrderOpen ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {hc.directOrderOpen ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => {
                        const nextSite = { ...sc, registrationOpen: sc.registrationOpen === false };
                        onUpdateState({ ...state, siteConfig: nextSite });
                        void persistSettings(
                          state.profile,
                          hc,
                          nextSite,
                          nextSite.registrationOpen ? 'Public registration opened.' : 'Public registration paused.'
                        );
                      }}
                      className="p-4 rounded-xl bg-[#111116] border border-zinc-800 hover:border-zinc-700 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">Member Registration</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {sc.registrationOpen !== false ? 'Visitors can register' : 'Self-registration paused'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          sc.registrationOpen !== false
                            ? 'bg-emerald-600/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {sc.registrationOpen !== false ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => {
                        const nextSite = { ...sc, maintenanceMode: !sc.maintenanceMode };
                        onUpdateState({ ...state, siteConfig: nextSite });
                        void persistSettings(
                          state.profile,
                          hc,
                          nextSite,
                          nextSite.maintenanceMode ? 'Maintenance mode enabled for visitors.' : 'Portal is live for visitors.'
                        );
                      }}
                      className="p-4 rounded-xl bg-[#111116] border border-zinc-800 hover:border-zinc-700 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">Maintenance Lock</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {sc.maintenanceMode ? 'Public visitors paused' : 'Public site live'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          sc.maintenanceMode ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {sc.maintenanceMode ? 'LOCKED' : 'LIVE'}
                      </span>
                    </button>
                  </div>

                  {/* Top Action Queue Banner */}
                  <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Megaphone className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">Smart Action Summary</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {analytics.pendingOrders > 0
                            ? `${analytics.pendingOrders} pending hoodie order(s) awaiting confirmation · `
                            : 'All hoodie orders processed · '}
                          {analytics.activeNotices} active notice(s) · {analytics.totalGallery} Memory Vault item(s).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {analytics.pendingOrders > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderStatusFilter('Pending');
                            selectTab('orders');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Review Pending ({analytics.pendingOrders})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => selectTab('site')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                      >
                        Edit Website Sections
                      </button>
                    </div>
                  </div>

                  {analytics.duplicateRolls.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          Duplicate roll number(s) detected in Batchmates:{' '}
                          <span className="font-mono font-semibold">{analytics.duplicateRolls.join(', ')}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBmSearch(analytics.duplicateRolls[0]);
                          selectTab('batchmates');
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium cursor-pointer shrink-0"
                      >
                        Inspect
                      </button>
                    </div>
                  )}

                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-white">{analytics.totalBatchmates}</p>
                      <p className="text-xs text-zinc-400 mt-1">Registered Batchmates</p>
                    </div>
                    <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-rose-400">{analytics.totalOrders}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Direct Orders ({analytics.totalHoodiesOrdered} hoodies)
                      </p>
                    </div>
                    <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">
                        {analytics.pendingOrders}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">Pending Fulfillment</p>
                    </div>
                    <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800">
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                        {analytics.confirmedOrders + analytics.deliveredOrders}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">Confirmed & Delivered</p>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* RCS Hoodie Size Matrix */}
                    <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white">Hoodie Size Breakdown (S–XXXL)</h3>
                          <p className="text-[11px] text-zinc-400">Total pieces requested per size</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopySizeSummary()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Summary
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {HOODIE_SIZES.map((sz) => {
                          const qty = analytics.sizeBreakdown[sz];
                          const pct = Math.round((qty / Math.max(1, analytics.totalHoodiesOrdered)) * 100);
                          return (
                            <div key={sz} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-mono font-semibold text-zinc-200">{sz}</span>
                                <span className="font-mono tabular-nums text-zinc-400">
                                  {qty} pcs ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group Distribution + Quick Actions */}
                    <div className="space-y-6">
                      <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800 space-y-4">
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

                      <div className="p-5 rounded-xl bg-[#111116] border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-white">Quick Admin Actions</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleExportOrdersCsv(false)}
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
                            <Download className="w-3.5 h-3.5" /> Backup JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              selectTab('batchmates');
                              setShowAddBm(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Batchmate
                          </button>
                        </div>
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
                    className="p-5 rounded-xl bg-[#111116] border border-zinc-800 space-y-4"
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

                  <div className="space-y-3">
                    {(state.notices || []).length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-[#111116] border border-zinc-800 text-xs text-zinc-400">
                        No batch notices published yet.
                      </div>
                    ) : (
                      (state.notices || []).map((notice) => {
                        const isEditing = editingNoticeId === notice.id && noticeDraft;
                        return (
                          <div
                            key={notice.id}
                            className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="grid sm:grid-cols-3 gap-2.5">
                                  <input
                                    type="text"
                                    value={noticeDraft.title}
                                    onChange={(e) =>
                                      setNoticeDraft({ ...noticeDraft, title: e.target.value })
                                    }
                                    className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                                  />
                                  <select
                                    value={noticeDraft.category}
                                    onChange={(e) =>
                                      setNoticeDraft({
                                        ...noticeDraft,
                                        category: e.target.value as NoticeCategory,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                                  >
                                    <option value="General">General</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="Event">Event</option>
                                  </select>
                                </div>
                                <textarea
                                  rows={2}
                                  value={noticeDraft.message}
                                  onChange={(e) =>
                                    setNoticeDraft({ ...noticeDraft, message: e.target.value })
                                  }
                                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNoticeId(null);
                                      setNoticeDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveEditedNotice()}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    <Save className="w-3.5 h-3.5" /> Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                    onClick={() => {
                                      setEditingNoticeId(notice.id);
                                      setNoticeDraft({ ...notice });
                                    }}
                                    title="Edit notice"
                                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
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
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FULL HOODIE ORDERS CONTROL */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
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

                      <select
                        value={orderSizeFilter}
                        onChange={(e) => setOrderSizeFilter(e.target.value as 'All' | HoodieOrder['size'])}
                        aria-label="Filter by hoodie size"
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="All">All Sizes</option>
                        {HOODIE_SIZES.map((sz) => (
                          <option key={sz} value={sz}>
                            Size {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="Search name, roll, contact..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportOrdersCsv(selectedOrderIds.length > 0)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {selectedOrderIds.length > 0 ? `CSV (${selectedOrderIds.length})` : 'CSV'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddOrder((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Manual Order
                      </button>
                    </div>
                  </div>

                  {showAddOrder && (
                    <form
                      onSubmit={handleAddManualOrder}
                      className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3"
                    >
                      <p className="text-xs font-bold text-white">Add Offline / Direct Order</p>
                      <div className="grid sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          required
                          value={newOrderName}
                          onChange={(e) => setNewOrderName(e.target.value)}
                          placeholder="Student Name *"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                        <input
                          type="text"
                          required
                          value={newOrderRoll}
                          onChange={(e) => setNewOrderRoll(e.target.value)}
                          placeholder="Roll / Batch ID *"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                        />
                        <input
                          type="text"
                          required
                          value={newOrderContact}
                          onChange={(e) => setNewOrderContact(e.target.value)}
                          placeholder="Phone or @instagram *"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2.5">
                        <select
                          value={newOrderSize}
                          onChange={(e) => setNewOrderSize(e.target.value as HoodieOrder['size'])}
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                        >
                          {HOODIE_SIZES.map((sz) => (
                            <option key={sz} value={sz}>
                              Size {sz}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newOrderQty}
                          onChange={(e) => setNewOrderQty(Number(e.target.value))}
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                        >
                          {[1, 2, 3, 4, 5].map((q) => (
                            <option key={q} value={q}>
                              Qty: {q}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newOrderNotes}
                          onChange={(e) => setNewOrderNotes(e.target.value)}
                          placeholder="Section / note (optional)"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddOrder(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Create Confirmed Order
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Bulk Toolbar */}
                  {filteredOrders.length > 0 && (
                    <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allVisibleIds = filteredOrders.map((o) => o.id);
                          const allSelected = allVisibleIds.every((id) => selectedOrderIds.includes(id));
                          setSelectedOrderIds(allSelected ? [] : allVisibleIds);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-rose-400" />
                        <span>
                          {selectedOrderIds.length > 0
                            ? `${selectedOrderIds.length} selected`
                            : 'Select all visible'}
                        </span>
                      </button>

                      {selectedOrderIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkOrderStatus('Confirmed')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
                          >
                            Confirm Selected
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkOrderStatus('Delivered')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkDeleteOrders()}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
                          >
                            Delete Selected
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedOrderIds([])}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {filteredOrders.length === 0 ? (
                    <div className="p-10 text-center rounded-xl bg-[#111116] border border-zinc-800 text-sm text-zinc-400">
                      No direct hoodie orders match this filter yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredOrders.map((order) => {
                        const isSelected = selectedOrderIds.includes(order.id);
                        const isEditing = editingOrderId === order.id && orderDraft;
                        return (
                          <div
                            key={order.id}
                            className={`p-4 rounded-xl bg-[#111116] border transition-colors space-y-3 ${
                              isSelected ? 'border-rose-500/50' : 'border-zinc-800'
                            }`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleOrderSelection(order.id)}
                                  aria-label={`Select order ${order.id}`}
                                  className="mt-1 accent-rose-600 cursor-pointer"
                                />
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
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => void downloadOrderInvoicePng(order, hc)}
                                  title="Download official order invoice"
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  Invoice
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isEditing) {
                                      setEditingOrderId(null);
                                      setOrderDraft(null);
                                    } else {
                                      setEditingOrderId(order.id);
                                      setOrderDraft({ ...order });
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
                                >
                                  {isEditing ? 'Close' : 'Edit'}
                                </button>

                                <select
                                  value={order.status}
                                  onChange={(e) =>
                                    void handleOrderStatus(order.id, e.target.value as OrderStatus)
                                  }
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

                            {isEditing && (
                              <div className="grid sm:grid-cols-3 gap-2.5 pt-3 border-t border-zinc-800">
                                <input
                                  type="text"
                                  value={orderDraft.customerName}
                                  onChange={(e) =>
                                    setOrderDraft({ ...orderDraft, customerName: e.target.value })
                                  }
                                  placeholder="Customer Name"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                                />
                                <input
                                  type="text"
                                  value={orderDraft.roll}
                                  onChange={(e) => setOrderDraft({ ...orderDraft, roll: e.target.value })}
                                  placeholder="Roll"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                                />
                                <input
                                  type="text"
                                  value={orderDraft.contact}
                                  onChange={(e) =>
                                    setOrderDraft({ ...orderDraft, contact: e.target.value })
                                  }
                                  placeholder="Contact"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                                />
                                <select
                                  value={orderDraft.size}
                                  onChange={(e) =>
                                    setOrderDraft({
                                      ...orderDraft,
                                      size: e.target.value as HoodieOrder['size'],
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                                >
                                  {HOODIE_SIZES.map((sz) => (
                                    <option key={sz} value={sz}>
                                      Size {sz}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={orderDraft.quantity}
                                  onChange={(e) =>
                                    setOrderDraft({ ...orderDraft, quantity: Number(e.target.value) })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                                >
                                  {[1, 2, 3, 4, 5].map((q) => (
                                    <option key={q} value={q}>
                                      Qty: {q}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={orderDraft.notes || ''}
                                  onChange={(e) => setOrderDraft({ ...orderDraft, notes: e.target.value })}
                                  placeholder="Internal / Delivery Note"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                                />
                                <div className="sm:col-span-3 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingOrderId(null);
                                      setOrderDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveEditedOrder()}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    <Save className="w-3.5 h-3.5" /> Save Order Changes
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: FULL BATCHMATES CONTROL */}
              {activeTab === 'batchmates' && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bmSearch}
                          onChange={(e) => setBmSearch(e.target.value)}
                          placeholder="Search name, roll, or group..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <select
                        value={bmGroupFilter}
                        onChange={(e) => setBmGroupFilter(e.target.value)}
                        aria-label="Filter by group"
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="All">All Groups</option>
                        {analytics.groupNames.map((grp) => (
                          <option key={grp} value={grp}>
                            {grp}
                          </option>
                        ))}
                      </select>
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
                        onClick={() => setShowAddBm((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Batchmate
                      </button>
                    </div>
                  </div>

                  {showAddBm && (
                    <form
                      onSubmit={handleAddBatchmateInsideAdmin}
                      className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white">Add New Batchmate Directly</p>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenRegister();
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Or open public form
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <input
                          type="text"
                          required
                          value={newBmName}
                          onChange={(e) => setNewBmName(e.target.value)}
                          placeholder="Full Name *"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                        <input
                          type="text"
                          required
                          value={newBmRoll}
                          onChange={(e) => setNewBmRoll(e.target.value)}
                          placeholder="Roll Number *"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-white"
                        />
                        <input
                          type="text"
                          value={newBmGroup}
                          onChange={(e) => setNewBmGroup(e.target.value)}
                          placeholder="Group (e.g. Science)"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={newBmSocial}
                          onChange={(e) => setNewBmSocial(e.target.value)}
                          placeholder="@instagram (optional)"
                          className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5 items-center">
                        <input
                          type="text"
                          value={newBmQuote}
                          onChange={(e) => setNewBmQuote(e.target.value)}
                          placeholder="Batch note or quote (optional)"
                          className="flex-1 w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => newBmPhotoInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer shrink-0"
                        >
                          <Camera className="w-3.5 h-3.5 text-rose-400" />
                          {newBmPhoto ? 'Photo Ready' : 'Upload Portrait'}
                        </button>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddBm(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Save Member
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2.5">
                    {filteredBatchmates.map((bm) => {
                      const isDupRoll = analytics.duplicateRolls.includes(bm.roll.trim());
                      return (
                        <div
                          key={bm.id}
                          className="p-3.5 rounded-xl bg-[#111116] border border-zinc-800 space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setBmPhotoTargetId(bm.id);
                                bmPhotoInputRef.current?.click();
                              }}
                              title="Click to upload or replace portrait"
                              className="w-11 h-11 rounded-full overflow-hidden bg-zinc-950 border border-zinc-700 hover:border-rose-500 shrink-0 flex items-center justify-center cursor-pointer"
                            >
                              {bm.photo ? (
                                <img src={bm.photo} alt={bm.name} className="w-full h-full object-cover object-top" />
                              ) : (
                                <span className="text-xs font-bold text-zinc-400">{getInitials(bm.name)}</span>
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{bm.name}</p>
                              <p className="text-xs text-zinc-400">
                                <span className={`font-mono tabular-nums ${isDupRoll ? 'text-amber-400' : ''}`}>
                                  Roll {bm.roll || 'N/A'}
                                </span>{' '}
                                · {bm.group}
                                {bm.social ? ` · ${bm.social}` : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setBmPhotoTargetId(bm.id);
                                  bmPhotoInputRef.current?.click();
                                }}
                                title="Upload / change portrait"
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
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
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: GALLERY */}
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
                      className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3"
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
                        className="p-3 rounded-xl bg-[#111116] border border-zinc-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
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
                            title="Save changes"
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

              {/* TAB 6: HOODIE PAGE FULL CONTROL */}
              {activeTab === 'hoodie' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#111116] border border-zinc-800">
                    <div>
                      <p className="text-sm font-bold text-white">Direct Ordering Status</p>
                      <p className="text-xs text-zinc-400">
                        Control whether batchmates can submit direct orders on the Hoodie page.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextHoodie = { ...hc, directOrderOpen: !hc.directOrderOpen };
                        onUpdateState({ ...state, hoodieConfig: nextHoodie });
                        void persistSettings(
                          state.profile,
                          nextHoodie,
                          sc,
                          nextHoodie.directOrderOpen ? 'Direct orders opened.' : 'Direct orders paused.'
                        );
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                        hc.directOrderOpen ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {hc.directOrderOpen ? 'Direct Orders Open' : 'Direct Orders Paused'}
                    </button>
                  </div>

                  {/* Front & Back RCS Hoodie Image Controls */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                      <p className="text-xs font-bold text-white">RCS Hoodie — Front Pic</p>
                      <img
                        src={hc.frontImage}
                        alt="Hoodie front"
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-zinc-800"
                      />
                      <input
                        type="text"
                        value={hc.frontLabel || ''}
                        onChange={(e) =>
                          onUpdateState({ ...state, hoodieConfig: { ...hc, frontLabel: e.target.value } })
                        }
                        placeholder="Front view subtitle (e.g. RCS chest crest)"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
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

                    <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                      <p className="text-xs font-bold text-white">RCS Hoodie — Back Pic</p>
                      <img
                        src={hc.backImage}
                        alt="Hoodie back"
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-zinc-800"
                      />
                      <input
                        type="text"
                        value={hc.backLabel || ''}
                        onChange={(e) =>
                          onUpdateState({ ...state, hoodieConfig: { ...hc, backLabel: e.target.value } })
                        }
                        placeholder="Back view subtitle (e.g. Orthohin '27 print)"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
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

                  <div className="space-y-3 p-4 rounded-xl bg-[#111116] border border-zinc-800">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Merchandise Kicker</label>
                      <input
                        type="text"
                        value={hc.kicker || ''}
                        onChange={(e) =>
                          onUpdateState({ ...state, hoodieConfig: { ...hc, kicker: e.target.value } })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Hoodie Page Title</label>
                      <input
                        type="text"
                        value={hc.title}
                        onChange={(e) =>
                          onUpdateState({ ...state, hoodieConfig: { ...hc, title: e.target.value } })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Hoodie Subtitle</label>
                      <textarea
                        rows={2}
                        value={hc.subtitle}
                        onChange={(e) =>
                          onUpdateState({ ...state, hoodieConfig: { ...hc, subtitle: e.target.value } })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-zinc-400">
                          Specifications ({hc.specs.length} lines)
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateState({
                              ...state,
                              hoodieConfig: { ...hc, specs: [...hc.specs, 'New Hoodie Specification'] },
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Line
                        </button>
                      </div>
                      {hc.specs.map((sp, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={sp}
                            onChange={(e) => {
                              const nextSpecs = [...hc.specs];
                              nextSpecs[i] = e.target.value;
                              onUpdateState({
                                ...state,
                                hoodieConfig: { ...hc, specs: nextSpecs },
                              });
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          {hc.specs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextSpecs = hc.specs.filter((_, idx) => idx !== i);
                                onUpdateState({
                                  ...state,
                                  hoodieConfig: { ...hc, specs: nextSpecs },
                                });
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-400 hover:text-white cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() =>
                          void persistSettings(state.profile, hc, sc, 'Hoodie page changes saved.')
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
                            sc,
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

              {/* TAB 7: FULL SITE STUDIO (EVERY PART OF THE WEB) */}
              {activeTab === 'site' && (
                <div className="space-y-6">
                  {/* Sub-Navigation Pills */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                      {(
                        [
                          { id: 'global', label: 'Global & Visibility' },
                          { id: 'hero', label: 'Hero & KPIs' },
                          { id: 'about', label: 'About & Social' },
                          { id: 'leadership', label: 'Directory Lead' },
                          { id: 'timeline', label: 'Journey Timeline' },
                        ] as const
                      ).map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSiteSubTab(sub.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            siteSubTab === sub.id
                              ? 'bg-rose-600 text-white'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() =>
                        void persistSettings(state.profile, hc, sc, 'All website changes published live.')
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> Publish All Site Changes
                    </button>
                  </div>

                  {/* SUB 1: GLOBAL, BRANDING, SECTION VISIBILITY & MAINTENANCE */}
                  {siteSubTab === 'global' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-white">Section Visibility & Page Access</h3>
                        <p className="text-xs text-zinc-400">
                          Show or hide any section or navigation link across the entire website instantly.
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {(
                            [
                              { key: 'notices', label: 'Notice Board Section' },
                              { key: 'about', label: 'About & Instagram Hub' },
                              { key: 'gallery', label: 'Memory Vault Gallery' },
                              { key: 'directory', label: 'Leadership Profile' },
                              { key: 'timeline', label: 'Our Journey Timeline' },
                              { key: 'hoodieNav', label: "Hoodie '26-'27 Page Link" },
                            ] as const
                          ).map((item) => {
                            const enabled = sc.sections?.[item.key] ?? true;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                disabled={isSyncing}
                                onClick={() => void toggleSection(item.key, item.label)}
                                className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-2 text-xs cursor-pointer"
                              >
                                <span className="text-zinc-200 font-medium">{item.label}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    enabled ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                                  }`}
                                >
                                  {enabled ? 'Shown' : 'Hidden'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">Portal Header Branding & Banner</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1">Brand Wordmark</label>
                            <input
                              type="text"
                              value={sc.brandName || ''}
                              onChange={(e) => updateSiteField('brandName', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1">Brand Accent (Year)</label>
                            <input
                              type="text"
                              value={sc.brandAccent || ''}
                              onChange={(e) => updateSiteField('brandAccent', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Site-Wide Announcement Banner</label>
                          <input
                            type="text"
                            value={sc.announcement}
                            onChange={(e) => updateSiteField('announcement', e.target.value)}
                            placeholder="Optional top banner text (leave blank to hide)"
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Footer Copyright Text</label>
                          <input
                            type="text"
                            value={sc.footerText || ''}
                            onChange={(e) => updateSiteField('footerText', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-white">Maintenance Lock Screen</h3>
                            <p className="text-xs text-zinc-400">
                              Pause public portal access during major updates (/admin-login always stays open).
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateSiteField('maintenanceMode', !sc.maintenanceMode)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              sc.maintenanceMode ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {sc.maintenanceMode ? 'Maintenance ON' : 'Maintenance OFF'}
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={sc.maintenanceMessage || ''}
                          onChange={(e) => updateSiteField('maintenanceMessage', e.target.value)}
                          placeholder="Message displayed to visitors during maintenance"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB 2: HERO SECTION, HERO IMAGE & 4 KPI CARDS */}
                  {siteSubTab === 'hero' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">Hero Text & Copy</h3>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={sc.heroKicker}
                            onChange={(e) => updateSiteField('heroKicker', e.target.value)}
                            placeholder="Hero kicker"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={sc.heroTitle}
                            onChange={(e) => updateSiteField('heroTitle', e.target.value)}
                            placeholder="Hero title"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={sc.heroHighlight}
                            onChange={(e) => updateSiteField('heroHighlight', e.target.value)}
                            placeholder="Highlighted phrase"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={sc.heroDescription}
                          onChange={(e) => updateSiteField('heroDescription', e.target.value)}
                          placeholder="Hero description"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                        />
                      </div>

                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-white">Hero Showcase Image</h3>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <img
                            src={sc.heroImage || DEFAULT_HERO_IMAGE}
                            alt="Hero showcase preview"
                            referrerPolicy="no-referrer"
                            className="w-36 h-24 rounded-xl object-cover border border-zinc-800 bg-white shrink-0"
                          />
                          <div className="flex-1 w-full space-y-2.5">
                            <input
                              type="text"
                              value={sc.heroImage || ''}
                              onChange={(e) => updateSiteField('heroImage', e.target.value)}
                              placeholder="Image URL or upload below"
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => heroPhotoInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                              >
                                <Upload className="w-3.5 h-3.5" /> Upload Hero Image
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSiteField('heroImage', DEFAULT_HERO_IMAGE)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs cursor-pointer"
                              >
                                Reset Default Sketch
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">4 Homepage Stat KPI Cards</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {(sc.kpis || []).map((kpi, idx) => (
                            <div
                              key={kpi.id || idx}
                              className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2"
                            >
                              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                <span>KPI Card #{idx + 1}</span>
                                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(kpi.autoBatchmateCount)}
                                    onChange={(e) => {
                                      const next = [...(sc.kpis || [])];
                                      next[idx] = { ...kpi, autoBatchmateCount: e.target.checked };
                                      updateSiteField('kpis', next);
                                    }}
                                    className="accent-rose-600"
                                  />
                                  Auto batchmate count
                                </label>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  disabled={Boolean(kpi.autoBatchmateCount)}
                                  value={kpi.autoBatchmateCount ? String(state.batchmates.length) : kpi.value}
                                  onChange={(e) => {
                                    const next = [...(sc.kpis || [])];
                                    next[idx] = { ...kpi, value: e.target.value };
                                    updateSiteField('kpis', next);
                                  }}
                                  placeholder="Value"
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-white disabled:opacity-50"
                                />
                                <input
                                  type="text"
                                  value={kpi.label}
                                  onChange={(e) => {
                                    const next = [...(sc.kpis || [])];
                                    next[idx] = { ...kpi, label: e.target.value };
                                    updateSiteField('kpis', next);
                                  }}
                                  placeholder="Label"
                                  className="col-span-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB 3: ABOUT SECTION & INSTAGRAM HUB */}
                  {siteSubTab === 'about' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">About Section & Pillar Cards</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={sc.aboutKicker || ''}
                            onChange={(e) => updateSiteField('aboutKicker', e.target.value)}
                            placeholder="Section kicker"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={sc.aboutTitle || ''}
                            onChange={(e) => updateSiteField('aboutTitle', e.target.value)}
                            placeholder="Section heading"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <textarea
                          rows={3}
                          value={sc.aboutDescription || ''}
                          onChange={(e) => updateSiteField('aboutDescription', e.target.value)}
                          placeholder="About body description"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                        />
                        <div className="grid sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                            <input
                              type="text"
                              value={sc.visionTitle || ''}
                              onChange={(e) => updateSiteField('visionTitle', e.target.value)}
                              placeholder="Card 1 Title"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white font-semibold"
                            />
                            <textarea
                              rows={2}
                              value={sc.visionText || ''}
                              onChange={(e) => updateSiteField('visionText', e.target.value)}
                              placeholder="Card 1 Description"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white resize-none"
                            />
                          </div>
                          <div className="space-y-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                            <input
                              type="text"
                              value={sc.unityTitle || ''}
                              onChange={(e) => updateSiteField('unityTitle', e.target.value)}
                              placeholder="Card 2 Title"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white font-semibold"
                            />
                            <textarea
                              rows={2}
                              value={sc.unityText || ''}
                              onChange={(e) => updateSiteField('unityText', e.target.value)}
                              placeholder="Card 2 Description"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">Instagram Showcase Card</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={sc.instagramHandle || ''}
                            onChange={(e) => updateSiteField('instagramHandle', e.target.value)}
                            placeholder="@orthohin_27"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="url"
                            value={sc.instagramUrl}
                            onChange={(e) => updateSiteField('instagramUrl', e.target.value)}
                            placeholder="https://www.instagram.com/..."
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={sc.instagramBio || ''}
                          onChange={(e) => updateSiteField('instagramBio', e.target.value)}
                          placeholder="Instagram card description"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB 4: LEADERSHIP DIRECTORY & PROFILE */}
                  {siteSubTab === 'leadership' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">Leadership Card & Copy</h3>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={sc.leadSectionKicker || ''}
                            onChange={(e) => updateSiteField('leadSectionKicker', e.target.value)}
                            placeholder="Section kicker"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={sc.leadSectionTitle || ''}
                            onChange={(e) => updateSiteField('leadSectionTitle', e.target.value)}
                            placeholder="Section title"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={sc.leadSectionSubtitle || ''}
                            onChange={(e) => updateSiteField('leadSectionSubtitle', e.target.value)}
                            placeholder="Section subtitle"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={sc.leadRole || ''}
                            onChange={(e) => updateSiteField('leadRole', e.target.value)}
                            placeholder="Role badge"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={sc.leadName || ''}
                            onChange={(e) => updateSiteField('leadName', e.target.value)}
                            placeholder="Lead full name"
                            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={sc.devNote}
                          onChange={(e) => updateSiteField('devNote', e.target.value)}
                          placeholder="Developer note"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
                        />
                      </div>

                      <div className="space-y-4 p-4 rounded-xl bg-[#111116] border border-zinc-800">
                        <h3 className="text-sm font-bold text-white">Leadership Profile Photo</h3>
                        <div className="flex items-center gap-4">
                          <img
                            src={state.profile || DEFAULT_PROFILE_IMAGE}
                            alt="Lead profile preview"
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-xl object-cover object-[center_22%] border border-zinc-800 bg-zinc-950"
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
                              void persistSettings(nextProf, hc, sc, 'Profile URL applied.');
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
                              void persistSettings(DEFAULT_PROFILE_IMAGE, hc, sc, 'Profile photo reset.');
                            }}
                            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                          >
                            Reset Default
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB 5: JOURNEY TIMELINE MILESTONES */}
                  {siteSubTab === 'timeline' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-400">
                          Add, edit, reorder, or remove milestones in the "Our Journey" timeline.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddTimeline}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Milestone
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(sc.timeline || []).map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-4 rounded-xl bg-[#111116] border border-zinc-800 space-y-2.5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                              <input
                                type="text"
                                value={item.tag}
                                onChange={(e) => {
                                  const next = [...(sc.timeline || [])];
                                  next[idx] = { ...item, tag: e.target.value };
                                  updateSiteField('timeline', next);
                                }}
                                placeholder="Tag / Year"
                                className="sm:w-36 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-rose-400"
                              />
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => {
                                  const next = [...(sc.timeline || [])];
                                  next[idx] = { ...item, title: e.target.value };
                                  updateSiteField('timeline', next);
                                }}
                                placeholder="Milestone Title"
                                className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-semibold"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveTimeline(idx, -1)}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === (sc.timeline || []).length - 1}
                                  onClick={() => handleMoveTimeline(idx, 1)}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                {(sc.timeline || []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (sc.timeline || []).filter((_, i) => i !== idx);
                                      updateSiteField('timeline', next);
                                    }}
                                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <textarea
                              rows={2}
                              value={item.description}
                              onChange={(e) => {
                                const next = [...(sc.timeline || [])];
                                next[idx] = { ...item, description: e.target.value };
                                updateSiteField('timeline', next);
                              }}
                              placeholder="Milestone description"
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 resize-none"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateSiteField(
                              'timeline',
                              DEFAULT_SITE_CONFIG.timeline!.map((t) => ({ ...t }))
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset Default Timeline
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: BACKUP, ACTIVITY LOG & SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div className="space-y-2 p-4 rounded-xl bg-[#111116] border border-zinc-800">
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
                  <div className="space-y-3 p-4 rounded-xl bg-[#111116] border border-zinc-800">
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
                      <button
                        type="button"
                        onClick={() => {
                          resetAdminPassword();
                          onToast('Admin passcode reset to default.', 'info');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                      >
                        Restore Default
                      </button>
                    </div>
                  </div>

                  {/* Activity Log */}
                  <div className="space-y-3 p-4 rounded-xl bg-[#111116] border border-zinc-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">Recent Activity Log</h3>
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="Filter activity..."
                        className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {filteredLogs.map((entry) => (
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
                </div>
              )}
            </div>
          </main>
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
        ref={heroPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleHeroPhotoUpload}
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
        ref={bmPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleBmPhotoReplace}
        className="hidden"
      />
      <input
        ref={newBmPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleNewBmPhotoUpload}
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
  );
}
