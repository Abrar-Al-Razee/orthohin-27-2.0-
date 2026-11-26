import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Cake,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  Copy,
  Download,
  Droplets,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Moon,
  Phone,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Shield,
  Shirt,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  UserPlus,
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
  deleteAdminTeamMemberInDb,
  deleteBatchmateInDb,
  deleteGalleryItemInDb,
  deleteNoticeInDb,
  deleteOrderInDb,
  reorderAdminTeamInDb,
  reorderGalleryInDb,
  saveAdminTeamMemberInDb,
  saveGalleryItemInDb,
  saveSettingsInDb,
  seedDefaultsIfEmptyInDb,
  syncPortalStateInDb,
  updateBatchmateInDb,
  updateNoticeInDb,
  updateOrderStatusInDb,
} from '../services/apiService';
import type {
  AdminTeamMember,
  Batchmate,
  BatchNotice,
  GalleryItem,
  HoodieConfig,
  HoodieOrder,
  NoticeCategory,
  OrderStatus,
  PaymentStatus,
  PortalState,
  SectionVisibility,
  SiteConfig,
  TimelineMilestone,
} from '../types';
import {
  AUTHORIZED_ADMIN_EMAIL,
  AUTHORIZED_ADMIN_EMAILS,
  compressImage,
  createDefaultState,
  DEFAULT_HERO_IMAGE,
  DEFAULT_HOODIE_CONFIG,
  DEFAULT_PROFILE_IMAGE,
  DEFAULT_SITE_CONFIG,
  downloadCsv,
  getInitials,
  HOODIE_UNIT_PRICE,
  isAuthorizedAdminEmail,
  mergeHoodieConfig,
  mergeSiteConfig,
  resetAdminPassword,
  setAdminPassword,
  SITE_LOGO_SRC,
  verifyAdminPasscode,
} from '../utils/storage';
import {
  downloadOrderInvoiceHtml,
  downloadOrderInvoicePng,
  getOrderFinancials,
} from '../utils/invoice';
import type { ThemeMode } from '../utils/theme';

interface AdminModalProps {
  isOpen: boolean;
  isRouteAdmin: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  state: PortalState;
  authUser: User | null;
  isFirebaseAdmin: boolean;
  onClose: () => void;
  onUpdateState: (next: PortalState) => void;
  onRefreshData: () => Promise<void>;
  onOpenRegister: () => void;
  onToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'overview' | 'notices' | 'orders' | 'batchmates' | 'gallery' | 'hoodie' | 'team' | 'site' | 'security';
type SiteSubTab = 'global' | 'hero' | 'about' | 'leadership' | 'timeline';

const HOODIE_SIZES: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const LIVE_SYNC_CHANNEL = 'orthohin27_live_sync';
const LIVE_SYNC_STORAGE_KEY = 'orthohin27_live_sync_ping';

interface AdminMailTemplate {
  id: string;
  label: string;
  tag: string;
  subject: string;
  body: string;
}

const ADMIN_MAIL_TEMPLATES: AdminMailTemplate[] = [
  {
    id: 'welcome',
    label: 'Welcome to Batch Portal',
    tag: 'Onboarding',
    subject: "Welcome to ORTHOHIN '27 · Official RCS Batch Portal",
    body: `Assalamu Alaikum {name},

Welcome to the official ORTHOHIN '27 (Rajshahi Collegiate School · Class of 2027) batch portal! Your profile card (Roll {roll}, {group}) is now live in the Batchmates directory.

Visit the portal anytime to flip and download your collectible Class of '27 card, browse memories, and stay updated with official batch notices.

Warm regards,
Orthohin '27 Core Admin Team
Rajshahi Collegiate School`,
  },
  {
    id: 'hoodie',
    label: "Hoodie '26-'27 Update",
    tag: 'Merch',
    subject: "RCS Hoodie '26-'27 · Sizing, Confirmation & Dispatch Update",
    body: `Hello {name},

This is an official update regarding the ORTHOHIN '27 Winter Hoodie ('26-'27 Edition).

Please double-check your size confirmation and order status on the Hoodie portal page. If you need any size adjustments or pickup coordination, reply directly to this email with your Roll ({roll}).

Best regards,
Orthohin '27 Hoodie & Merch Team`,
  },
  {
    id: 'reunion',
    label: 'Batch Meetup / Reunion',
    tag: 'Event',
    subject: "Invitation · ORTHOHIN '27 Batch Meetup & Adda Session",
    body: `Dear {name},

We are planning an upcoming ORTHOHIN '27 batch meetup for everyone from Rajshahi Collegiate School (Class of 2027)!

• Event: Orthohin '27 Batch Meetup & Photo Session
• Date & Time: [Insert Date & Time]
• Venue: [Insert Venue / RCS Campus]

Let us know your availability by replying to this email so we can finalize the headcount. Hope to see Roll {roll} ({group}) there!

Cheers,
Orthohin '27 Admin Panel`,
  },
  {
    id: 'notice',
    label: 'Official Batch Notice',
    tag: 'Urgent',
    subject: "Important Notice · ORTHOHIN '27 (Class of 2027)",
    body: `Dear {name},

An important announcement has been posted on the ORTHOHIN '27 official notice board:

[Write your key announcement details here]

Please review it on the portal and share with fellow {group} classmates so nobody misses out.

Regards,
Orthohin '27 Administration`,
  },
  {
    id: 'yearbook',
    label: 'Yearbook & Photo Drive',
    tag: 'Archive',
    subject: "Share Your RCS Memories · ORTHOHIN '27 Archive Drive",
    body: `Hey {name},

We are curating photos, short clips, and memorable campus stories for the ORTHOHIN '27 digital memory vault and yearbook archive.

If you have candid photos from RCS classrooms, sports days, or field addas, reply to this email or submit your updated profile quote and favorite memory.

With nostalgia,
Orthohin '27 Archive Team`,
  },
  {
    id: 'birthday',
    label: 'Birthday Warm Wishes',
    tag: 'Celebration',
    subject: "Happy Birthday {name}! · Wishes from ORTHOHIN '27",
    body: `Happy Birthday {name}!

Wishing you health, joy, and big milestones ahead from your entire ORTHOHIN '27 family at Rajshahi Collegiate School. May your year ahead be unforgettable!

Celebrate well!
Orthohin '27 Batchmates`,
  },
  {
    id: 'custom',
    label: 'Custom Email',
    tag: 'Blank',
    subject: "Message from ORTHOHIN '27 Admin Panel",
    body: `Hello {name},

[Write your message here]

Best regards,
Orthohin '27 Admin Team`,
  },
];

const ORDER_MAIL_TEMPLATES: AdminMailTemplate[] = [
  {
    id: 'due_700',
    label: 'Payment Due · 700 Taka Invoice',
    tag: 'Due Invoice',
    subject: "RCS Hoodie '26-'27 Invoice ({orderId}) · Payment Due {dueAmount} Taka",
    body: `Assalamu Alaikum {name},

Thank you for registering your ORTHOHIN '27 RCS Hoodie order!

• Order ID: {orderId}
• Batchmate: {name} (Roll {roll})
• Hoodie Size & Qty: {size} × {qty}
• Total Payable: {amount} Taka (700 Taka per hoodie)
• Payment Status: {paymentStatus} ({dueAmount} Taka Due)

Your payment has not been received yet. Please clear {dueAmount} Taka and verify with the batch admin team so we can lock your order for production.

You can download your official Due Invoice ({orderId}) directly from the Hoodie Order Roster:
{portalUrl}/hoodie

Best regards,
Orthohin '27 Hoodie & Finance Team`,
  },
  {
    id: 'paid_confirmed',
    label: 'Payment Confirmed · Paid Invoice',
    tag: 'Paid Receipt',
    subject: "Payment Received · RCS Hoodie Order {orderId} (PAID)",
    body: `Assalamu Alaikum {name},

Great news! Your payment of {amount} Taka for the ORTHOHIN '27 RCS Hoodie ('26-'27 Edition) has been confirmed.

• Order ID: {orderId}
• Batchmate: {name} (Roll {roll})
• Hoodie Size & Qty: {size} × {qty}
• Amount Paid: {amount} Taka
• Payment Status: PAID IN FULL (0 Taka Due)

Your official Paid Invoice ({orderId}) is now live! Download or print your updated PAID receipt anytime from:
{portalUrl}/hoodie

Thank you,
Orthohin '27 Hoodie & Finance Team`,
  },
  {
    id: 'pickup_ready',
    label: 'Hoodie Ready / Pickup Notice',
    tag: 'Distribution',
    subject: "Your RCS Hoodie is Ready · Order {orderId} ({name})",
    body: `Hello {name},

Your ORTHOHIN '27 RCS Hoodie (Order ID: {orderId}, Size {size} × {qty}) is ready for collection!

• Current Payment Status: {paymentStatus} ({dueAmount} Taka Due)
• Pickup Location & Time: [Insert Campus Spot / Date & Time]

Please bring or show your downloaded invoice ({orderId}) from {portalUrl}/hoodie at the pickup desk.

Cheers,
Orthohin '27 Admin Team`,
  },
  {
    id: 'final_reminder',
    label: 'Final Payment Reminder (700 Taka)',
    tag: 'Urgent',
    subject: "Final Reminder: Payment Due {dueAmount} Taka for Order {orderId}",
    body: `Dear {name},

This is a gentle final reminder regarding your pending hoodie payment before we close the print batch:

• Order ID: {orderId}
• Size × Qty: {size} × {qty} (Roll {roll})
• Balance Due: {dueAmount} Taka

Please submit your payment today so your hoodie can be included in this batch. Download your invoice ({orderId}) anytime at {portalUrl}/hoodie.

Regards,
Orthohin '27 Hoodie Team`,
  },
  {
    id: 'order_custom',
    label: 'Custom Order Email',
    tag: 'Custom',
    subject: "Regarding Your RCS Hoodie Order {orderId} · ORTHOHIN '27",
    body: `Hello {name},

Order ID: {orderId} (Size {size} × {qty} · {paymentStatus})

[Write your message here]

Best regards,
Orthohin '27 Admin Panel`,
  },
];

function broadcastLiveSync() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(LIVE_SYNC_CHANNEL);
      ch.postMessage('sync');
      ch.close();
    }
    window.localStorage.setItem(LIVE_SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore storage/channel failures
  }
}

export function AdminModal({
  isOpen,
  isRouteAdmin,
  theme,
  onToggleTheme,
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
  const [emailInput, setEmailInput] = useState(() =>
    authUser?.email && isAuthorizedAdminEmail(authUser.email) ? authUser.email.toLowerCase() : ''
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveSyncStatus, setLiveSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [siteSubTab, setSiteSubTab] = useState<SiteSubTab>('global');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  // Orders filters, add, full edit, payment & mail studio
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<'All' | PaymentStatus>('All');
  const [orderSizeFilter, setOrderSizeFilter] = useState<'All' | HoodieOrder['size']>('All');
  const [orderEmailFilter, setOrderEmailFilter] = useState<'all' | 'has_email' | 'missing_email'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [copiedOrderEmailId, setCopiedOrderEmailId] = useState<string | null>(null);
  const [copiedOrderBulkMode, setCopiedOrderBulkMode] = useState<string | null>(null);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [newOrderName, setNewOrderName] = useState('');
  const [newOrderRoll, setNewOrderRoll] = useState('');
  const [newOrderSize, setNewOrderSize] = useState<HoodieOrder['size']>('L');
  const [newOrderQty, setNewOrderQty] = useState(1);
  const [newOrderContact, setNewOrderContact] = useState('');
  const [newOrderEmail, setNewOrderEmail] = useState('');
  const [newOrderPaymentStatus, setNewOrderPaymentStatus] = useState<PaymentStatus>('Due');
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState<HoodieOrder | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);

  // Order Send Mail & Invoice Studio
  const [orderMailRecipientMode, setOrderMailRecipientMode] = useState<
    'due' | 'paid' | 'filtered' | 'selected' | 'custom'
  >('due');
  const [customOrderMailIds, setCustomOrderMailIds] = useState<string[]>([]);
  const [orderMailAddressField, setOrderMailAddressField] = useState<'bcc' | 'to'>('bcc');
  const [selectedOrderMailTemplateId, setSelectedOrderMailTemplateId] = useState<string>('due_700');
  const [orderMailSubject, setOrderMailSubject] = useState<string>(ORDER_MAIL_TEMPLATES[0].subject);
  const [orderMailBody, setOrderMailBody] = useState<string>(ORDER_MAIL_TEMPLATES[0].body);

  // Batchmates filters, add, copy & mail studio
  const [bmSearch, setBmSearch] = useState('');
  const [bmGroupFilter, setBmGroupFilter] = useState('All');
  const [bmBloodFilter, setBmBloodFilter] = useState('All');
  const [bmEmailFilter, setBmEmailFilter] = useState<'all' | 'has_email' | 'missing_email'>('all');
  const [selectedBmIds, setSelectedBmIds] = useState<string[]>([]);
  const [copiedBmEmailId, setCopiedBmEmailId] = useState<string | null>(null);
  const [copiedBulkEmailsMode, setCopiedBulkEmailsMode] = useState<string | null>(null);
  const [showAddBm, setShowAddBm] = useState(false);
  const [newBmName, setNewBmName] = useState('');
  const [newBmNickname, setNewBmNickname] = useState('');
  const [newBmRoll, setNewBmRoll] = useState('');
  const [newBmGroup, setNewBmGroup] = useState('Science');
  const [newBmEmail, setNewBmEmail] = useState('');
  const [newBmPhone, setNewBmPhone] = useState('');
  const [newBmSocial, setNewBmSocial] = useState('');
  const [newBmHobbies, setNewBmHobbies] = useState('');
  const [newBmBloodGroup, setNewBmBloodGroup] = useState('');
  const [newBmBirthday, setNewBmBirthday] = useState('');
  const [newBmDreamGoal, setNewBmDreamGoal] = useState('');
  const [newBmHangoutSpot, setNewBmHangoutSpot] = useState('');
  const [newBmSuperpower, setNewBmSuperpower] = useState('');
  const [newBmFavoriteMemory, setNewBmFavoriteMemory] = useState('');
  const [newBmQuote, setNewBmQuote] = useState('');
  const [newBmPhoto, setNewBmPhoto] = useState('');
  const [editingBmId, setEditingBmId] = useState<string | null>(null);
  const [bmPhotoTargetId, setBmPhotoTargetId] = useState<string | null>(null);
  const [confirmDeleteBmId, setConfirmDeleteBmId] = useState<string | null>(null);

  // Admin Send Mail Studio
  const [mailRecipientMode, setMailRecipientMode] = useState<'filtered' | 'selected' | 'custom'>('filtered');
  const [customMailIds, setCustomMailIds] = useState<string[]>([]);
  const [mailAddressField, setMailAddressField] = useState<'bcc' | 'to'>('bcc');
  const [selectedMailTemplateId, setSelectedMailTemplateId] = useState<string>('welcome');
  const [mailSubject, setMailSubject] = useState<string>(ADMIN_MAIL_TEMPLATES[0].subject);
  const [mailBody, setMailBody] = useState<string>(ADMIN_MAIL_TEMPLATES[0].body);

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

  // Admin Team states (Public Admin Panel Organizers)
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamRole, setNewTeamRole] = useState('');
  const [newTeamBio, setNewTeamBio] = useState('');
  const [newTeamSocial, setNewTeamSocial] = useState('');
  const [newTeamPhoto, setNewTeamPhoto] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState<AdminTeamMember | null>(null);
  const [teamPhotoTargetId, setTeamPhotoTargetId] = useState<string | null>(null);
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState<string | null>(null);

  const addPhotosInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const heroPhotoInputRef = useRef<HTMLInputElement>(null);
  const hoodiePhotoInputRef = useRef<HTMLInputElement>(null);
  const bmPhotoInputRef = useRef<HTMLInputElement>(null);
  const newBmPhotoInputRef = useRef<HTMLInputElement>(null);
  const newTeamPhotoInputRef = useRef<HTMLInputElement>(null);
  const editTeamPhotoInputRef = useRef<HTMLInputElement>(null);
  const importBackupInputRef = useRef<HTMLInputElement>(null);

  // Live auto-save timers & pending buffers
  const settingsTimerRef = useRef<number | null>(null);
  const pendingSettingsRef = useRef<{ profile: string; hoodie: HoodieConfig; site: SiteConfig } | null>(null);
  const bmTimersRef = useRef<Record<string, number>>({});
  const pendingBatchmatesRef = useRef<Record<string, Batchmate>>({});
  const galleryTimersRef = useRef<Record<string, number>>({});
  const pendingGalleryRef = useRef<Record<string, { item: GalleryItem; idx: number }>>({});
  const noticeTimersRef = useRef<Record<string, number>>({});
  const pendingNoticesRef = useRef<Record<string, BatchNotice>>({});
  const orderTimersRef = useRef<Record<string, number>>({});
  const pendingOrdersRef = useRef<Record<string, HoodieOrder>>({});

  const sc = useMemo(() => mergeSiteConfig(state.siteConfig), [state.siteConfig]);
  const hc = useMemo(() => mergeHoodieConfig(state.hoodieConfig), [state.hoodieConfig]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement?.id === 'lead-profile-url-input') {
      return;
    }
    setProfileUrlInput(state.profile);
  }, [state.profile]);

  const flushSettings = useCallback(async () => {
    if (settingsTimerRef.current) {
      window.clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = null;
    }
    const payload = pendingSettingsRef.current;
    if (!payload) return;
    pendingSettingsRef.current = null;
    setLiveSyncStatus('saving');
    try {
      await saveSettingsInDb(payload.profile, payload.hoodie, payload.site);
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      setLiveSyncStatus('error');
    }
  }, []);

  const scheduleSettingsAutoSave = useCallback(
    (nextProfile: string, nextHoodie: HoodieConfig, nextSite: SiteConfig) => {
      pendingSettingsRef.current = { profile: nextProfile, hoodie: nextHoodie, site: nextSite };
      setLiveSyncStatus('saving');
      if (settingsTimerRef.current) {
        window.clearTimeout(settingsTimerRef.current);
      }
      settingsTimerRef.current = window.setTimeout(() => {
        void flushSettings();
      }, 450);
    },
    [flushSettings]
  );

  const flushBatchmate = useCallback(async (id: string) => {
    if (bmTimersRef.current[id]) {
      window.clearTimeout(bmTimersRef.current[id]);
      delete bmTimersRef.current[id];
    }
    const bm = pendingBatchmatesRef.current[id];
    if (!bm) return;
    delete pendingBatchmatesRef.current[id];
    if (!bm.name.trim() || !bm.roll.trim() || !bm.group.trim()) return;
    setLiveSyncStatus('saving');
    try {
      await updateBatchmateInDb(bm);
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      setLiveSyncStatus('error');
    }
  }, []);

  const scheduleBatchmateAutoSave = useCallback(
    (bm: Batchmate) => {
      pendingBatchmatesRef.current[bm.id] = bm;
      setLiveSyncStatus('saving');
      if (bmTimersRef.current[bm.id]) {
        window.clearTimeout(bmTimersRef.current[bm.id]);
      }
      bmTimersRef.current[bm.id] = window.setTimeout(() => {
        void flushBatchmate(bm.id);
      }, 450);
    },
    [flushBatchmate]
  );

  const flushGalleryItem = useCallback(async (id: string) => {
    if (galleryTimersRef.current[id]) {
      window.clearTimeout(galleryTimersRef.current[id]);
      delete galleryTimersRef.current[id];
    }
    const entry = pendingGalleryRef.current[id];
    if (!entry) return;
    delete pendingGalleryRef.current[id];
    setLiveSyncStatus('saving');
    try {
      await saveGalleryItemInDb(
        { ...entry.item, title: entry.item.title.trim() || 'Untitled Memory' },
        entry.idx
      );
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      setLiveSyncStatus('error');
    }
  }, []);

  const scheduleGalleryAutoSave = useCallback(
    (item: GalleryItem, idx: number) => {
      pendingGalleryRef.current[item.id] = { item, idx };
      setLiveSyncStatus('saving');
      if (galleryTimersRef.current[item.id]) {
        window.clearTimeout(galleryTimersRef.current[item.id]);
      }
      galleryTimersRef.current[item.id] = window.setTimeout(() => {
        void flushGalleryItem(item.id);
      }, 450);
    },
    [flushGalleryItem]
  );

  const flushNotice = useCallback(async (id: string) => {
    if (noticeTimersRef.current[id]) {
      window.clearTimeout(noticeTimersRef.current[id]);
      delete noticeTimersRef.current[id];
    }
    const notice = pendingNoticesRef.current[id];
    if (!notice) return;
    delete pendingNoticesRef.current[id];
    if (!notice.title.trim() || !notice.message.trim()) return;
    setLiveSyncStatus('saving');
    try {
      await updateNoticeInDb({
        ...notice,
        title: notice.title.trim(),
        message: notice.message.trim(),
      });
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      setLiveSyncStatus('error');
    }
  }, []);

  const scheduleNoticeAutoSave = useCallback(
    (notice: BatchNotice) => {
      pendingNoticesRef.current[notice.id] = notice;
      setLiveSyncStatus('saving');
      if (noticeTimersRef.current[notice.id]) {
        window.clearTimeout(noticeTimersRef.current[notice.id]);
      }
      noticeTimersRef.current[notice.id] = window.setTimeout(() => {
        void flushNotice(notice.id);
      }, 450);
    },
    [flushNotice]
  );

  const flushOrder = useCallback(async (id: string) => {
    if (orderTimersRef.current[id]) {
      window.clearTimeout(orderTimersRef.current[id]);
      delete orderTimersRef.current[id];
    }
    const order = pendingOrdersRef.current[id];
    if (!order) return;
    delete pendingOrdersRef.current[id];
    if (!order.customerName.trim() || !order.roll.trim() || !order.contact.trim()) return;
    setLiveSyncStatus('saving');
    try {
      await updateOrderStatusInDb(order.id, order.status, order.notes || '', {
        customerName: order.customerName.trim(),
        roll: order.roll.trim(),
        size: order.size,
        quantity: order.quantity,
        contact: order.contact.trim(),
        email: (order.email || '').trim(),
        paymentStatus: order.paymentStatus === 'Paid' ? 'Paid' : 'Due',
      });
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      setLiveSyncStatus('error');
    }
  }, []);

  const scheduleOrderAutoSave = useCallback(
    (order: HoodieOrder) => {
      pendingOrdersRef.current[order.id] = order;
      setLiveSyncStatus('saving');
      if (orderTimersRef.current[order.id]) {
        window.clearTimeout(orderTimersRef.current[order.id]);
      }
      orderTimersRef.current[order.id] = window.setTimeout(() => {
        void flushOrder(order.id);
      }, 450);
    },
    [flushOrder]
  );

  const flushAllPendingAutoSaves = useCallback(async () => {
    const tasks: Promise<void>[] = [flushSettings()];
    for (const id of Object.keys(pendingBatchmatesRef.current)) {
      tasks.push(flushBatchmate(id));
    }
    for (const id of Object.keys(pendingGalleryRef.current)) {
      tasks.push(flushGalleryItem(id));
    }
    for (const id of Object.keys(pendingNoticesRef.current)) {
      tasks.push(flushNotice(id));
    }
    for (const id of Object.keys(pendingOrdersRef.current)) {
      tasks.push(flushOrder(id));
    }
    await Promise.all(tasks);
  }, [flushSettings, flushBatchmate, flushGalleryItem, flushNotice, flushOrder]);

  useEffect(() => {
    return () => {
      void flushAllPendingAutoSaves();
    };
  }, [flushAllPendingAutoSaves]);

  useEffect(() => {
    if (!isFirebaseAdmin && unlocked) {
      setUnlocked(false);
      setAuthorizedAdmin('');
    }
    if (isFirebaseAdmin && authUser?.email) {
      setEmailInput((prev) => prev || authUser.email!.toLowerCase());
    }
  }, [isFirebaseAdmin, authUser, unlocked]);

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
      setSelectedBmIds([]);
      setCustomMailIds([]);
      setCustomOrderMailIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRouteAdmin) {
        void flushAllPendingAutoSaves().finally(onClose);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isRouteAdmin, onClose, flushAllPendingAutoSaves]);

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

  const batchmateEmailByRoll = useMemo(() => {
    const map = new Map<string, string>();
    for (const bm of state.batchmates) {
      const email = (bm.email || '').trim();
      const r = bm.roll.trim().toLowerCase();
      if (email && r && !map.has(r)) {
        map.set(r, email);
      }
    }
    return map;
  }, [state.batchmates]);

  const resolveOrderEmail = useCallback(
    (order: HoodieOrder): string => {
      const direct = (order.email || '').trim();
      if (direct) return direct;
      return batchmateEmailByRoll.get(order.roll.trim().toLowerCase()) || '';
    },
    [batchmateEmailByRoll]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return (state.orders || []).filter((o) => {
      const payment: PaymentStatus = o.paymentStatus === 'Paid' ? 'Paid' : 'Due';
      const resolvedEmail = resolveOrderEmail(o);
      const matchesStatus = orderStatusFilter === 'All' || o.status === orderStatusFilter;
      const matchesPayment = orderPaymentFilter === 'All' || payment === orderPaymentFilter;
      const matchesSize = orderSizeFilter === 'All' || o.size === orderSizeFilter;
      const matchesEmail =
        orderEmailFilter === 'all' ||
        (orderEmailFilter === 'has_email' && Boolean(resolvedEmail)) ||
        (orderEmailFilter === 'missing_email' && !resolvedEmail);
      const matchesQuery =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.roll.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.contact.toLowerCase().includes(q) ||
        resolvedEmail.toLowerCase().includes(q) ||
        (o.notes && o.notes.toLowerCase().includes(q));
      return matchesStatus && matchesPayment && matchesSize && matchesEmail && matchesQuery;
    });
  }, [
    state.orders,
    orderStatusFilter,
    orderPaymentFilter,
    orderSizeFilter,
    orderEmailFilter,
    orderSearch,
    resolveOrderEmail,
  ]);

  const orderEmailStats = useMemo(() => {
    const allOrders = state.orders || [];
    const dueOrdersWithEmail = allOrders.filter(
      (o) => o.paymentStatus !== 'Paid' && Boolean(resolveOrderEmail(o))
    );
    const paidOrdersWithEmail = allOrders.filter(
      (o) => o.paymentStatus === 'Paid' && Boolean(resolveOrderEmail(o))
    );
    const allOrdersWithEmail = allOrders.filter((o) => Boolean(resolveOrderEmail(o)));

    const dedupeEmails = (list: HoodieOrder[]) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const o of list) {
        const em = resolveOrderEmail(o);
        if (em && !seen.has(em.toLowerCase())) {
          seen.add(em.toLowerCase());
          out.push(em);
        }
      }
      return out;
    };

    const filteredEmails = dedupeEmails(filteredOrders);
    const dueEmails = dedupeEmails(dueOrdersWithEmail);
    const paidEmails = dedupeEmails(paidOrdersWithEmail);
    const selectedEmails = dedupeEmails(allOrders.filter((o) => selectedOrderIds.includes(o.id)));

    const totalDueOrdersCount = allOrders.filter((o) => o.paymentStatus !== 'Paid').length;
    const totalPaidOrdersCount = allOrders.filter((o) => o.paymentStatus === 'Paid').length;

    return {
      allOrdersWithEmail,
      filteredEmails,
      dueEmails,
      paidEmails,
      selectedEmails,
      totalDueOrdersCount,
      totalPaidOrdersCount,
    };
  }, [state.orders, filteredOrders, selectedOrderIds, resolveOrderEmail]);

  const orderMailRecipients = useMemo(() => {
    const allOrders = state.orders || [];
    const source =
      orderMailRecipientMode === 'due'
        ? allOrders.filter((o) => o.paymentStatus !== 'Paid')
        : orderMailRecipientMode === 'paid'
          ? allOrders.filter((o) => o.paymentStatus === 'Paid')
          : orderMailRecipientMode === 'selected'
            ? allOrders.filter((o) => selectedOrderIds.includes(o.id))
            : orderMailRecipientMode === 'custom'
              ? allOrders.filter((o) => customOrderMailIds.includes(o.id))
              : filteredOrders;

    return source
      .map((o) => ({ order: o, email: resolveOrderEmail(o) }))
      .filter((entry) => Boolean(entry.email));
  }, [
    orderMailRecipientMode,
    state.orders,
    selectedOrderIds,
    customOrderMailIds,
    filteredOrders,
    resolveOrderEmail,
  ]);

  const substituteOrderMailVars = useCallback(
    (text: string, order: HoodieOrder | null): string => {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://orthohin-27.vercel.app';
      if (!order) {
        return text
          .replace(/\{orderId\}/gi, 'RCS-ORDER')
          .replace(/\{name\}/gi, "Orthohin '27 Batchmate")
          .replace(/\{roll\}/gi, "Batch '27")
          .replace(/\{size\}/gi, 'Your Size')
          .replace(/\{qty\}/gi, '1')
          .replace(/\{amount\}/gi, String(HOODIE_UNIT_PRICE))
          .replace(/\{dueAmount\}/gi, String(HOODIE_UNIT_PRICE))
          .replace(/\{paymentStatus\}/gi, 'Due / Paid')
          .replace(/\{portalUrl\}/gi, origin);
      }
      const fin = getOrderFinancials(order);
      return text
        .replace(/\{orderId\}/gi, order.id)
        .replace(/\{name\}/gi, order.customerName)
        .replace(/\{roll\}/gi, order.roll || 'N/A')
        .replace(/\{size\}/gi, order.size)
        .replace(/\{qty\}/gi, String(fin.qty))
        .replace(/\{amount\}/gi, String(fin.totalAmount))
        .replace(/\{dueAmount\}/gi, String(fin.dueAmount))
        .replace(/\{paymentStatus\}/gi, fin.isPaid ? 'PAID' : 'DUE')
        .replace(/\{portalUrl\}/gi, origin);
    },
    []
  );

  const buildOrderEmailLinks = useCallback(
    (emails: string[], subject: string, body: string, field: 'bcc' | 'to') => {
      const joined = emails.join(',');
      let mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (emails.length > 0) {
        if (field === 'to' || emails.length === 1) {
          mailtoHref = `mailto:${joined}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        } else {
          mailtoHref = `mailto:?bcc=${encodeURIComponent(joined)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      }
      const gmailParams = new URLSearchParams({
        view: 'cm',
        fs: '1',
        su: subject,
        body,
      });
      if (emails.length > 0) {
        if (field === 'to' || emails.length === 1) {
          gmailParams.set('to', joined);
        } else {
          gmailParams.set('bcc', joined);
        }
      }
      const gmailHref = `https://mail.google.com/mail/?${gmailParams.toString()}`;
      return { mailtoHref, gmailHref };
    },
    []
  );

  const resolvedOrderMailDraft = useMemo(() => {
    const single = orderMailRecipients.length === 1 ? orderMailRecipients[0].order : null;
    const subject = substituteOrderMailVars(
      orderMailSubject.trim() || "RCS Hoodie '26-'27 Invoice Update",
      single
    );
    const body = substituteOrderMailVars(orderMailBody.trim(), single);
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const entry of orderMailRecipients) {
      if (!seen.has(entry.email.toLowerCase())) {
        seen.add(entry.email.toLowerCase());
        emails.push(entry.email);
      }
    }
    const joined = emails.join(',');
    const { mailtoHref, gmailHref } = buildOrderEmailLinks(
      emails,
      subject,
      body,
      orderMailAddressField
    );

    const individualLinks = orderMailRecipients.map(({ order, email }) => {
      const indSubject = substituteOrderMailVars(
        orderMailSubject.trim() || `RCS Hoodie Invoice ${order.id}`,
        order
      );
      const indBody = substituteOrderMailVars(orderMailBody.trim(), order);
      const links = buildOrderEmailLinks([email], indSubject, indBody, 'to');
      return {
        order,
        email,
        subject: indSubject,
        body: indBody,
        mailtoHref: links.mailtoHref,
        gmailHref: links.gmailHref,
      };
    });

    return {
      singleOrder: single,
      subject,
      body,
      emails,
      joined,
      mailtoHref,
      gmailHref,
      individualLinks,
    };
  }, [
    orderMailRecipients,
    orderMailSubject,
    orderMailBody,
    orderMailAddressField,
    substituteOrderMailVars,
    buildOrderEmailLinks,
  ]);

  const filteredBatchmates = useMemo(() => {
    const q = bmSearch.trim().toLowerCase();
    return state.batchmates.filter((b) => {
      const matchesGroup = bmGroupFilter === 'All' || (b.group || 'Other') === bmGroupFilter;
      const matchesBlood = bmBloodFilter === 'All' || (b.bloodGroup || '').toUpperCase() === bmBloodFilter;
      const hasEmail = Boolean((b.email || '').trim());
      const matchesEmail =
        bmEmailFilter === 'all' ||
        (bmEmailFilter === 'has_email' && hasEmail) ||
        (bmEmailFilter === 'missing_email' && !hasEmail);
      const matchesQuery =
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.nickname && b.nickname.toLowerCase().includes(q)) ||
        b.roll.toLowerCase().includes(q) ||
        (b.group && b.group.toLowerCase().includes(q)) ||
        (b.email && b.email.toLowerCase().includes(q)) ||
        (b.phone && b.phone.toLowerCase().includes(q)) ||
        (b.social && b.social.toLowerCase().includes(q)) ||
        (b.hobbies && b.hobbies.toLowerCase().includes(q)) ||
        (b.bloodGroup && b.bloodGroup.toLowerCase().includes(q)) ||
        (b.dreamGoal && b.dreamGoal.toLowerCase().includes(q)) ||
        (b.hangoutSpot && b.hangoutSpot.toLowerCase().includes(q)) ||
        (b.superpower && b.superpower.toLowerCase().includes(q)) ||
        (b.favoriteMemory && b.favoriteMemory.toLowerCase().includes(q)) ||
        (b.quote && b.quote.toLowerCase().includes(q));
      return matchesGroup && matchesBlood && matchesEmail && matchesQuery;
    });
  }, [state.batchmates, bmSearch, bmGroupFilter, bmBloodFilter, bmEmailFilter]);

  const membersWithEmail = useMemo(
    () => state.batchmates.filter((b) => Boolean((b.email || '').trim())),
    [state.batchmates]
  );

  const filteredBatchmateEmails = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const b of filteredBatchmates) {
      const email = (b.email || '').trim();
      if (email && !seen.has(email.toLowerCase())) {
        seen.add(email.toLowerCase());
        list.push(email);
      }
    }
    return list;
  }, [filteredBatchmates]);

  const selectedBatchmateEmails = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const b of state.batchmates) {
      if (!selectedBmIds.includes(b.id)) continue;
      const email = (b.email || '').trim();
      if (email && !seen.has(email.toLowerCase())) {
        seen.add(email.toLowerCase());
        list.push(email);
      }
    }
    return list;
  }, [state.batchmates, selectedBmIds]);

  const mailRecipients = useMemo(() => {
    const source =
      mailRecipientMode === 'selected'
        ? state.batchmates.filter((b) => selectedBmIds.includes(b.id))
        : mailRecipientMode === 'custom'
          ? state.batchmates.filter((b) => customMailIds.includes(b.id))
          : filteredBatchmates;
    const seen = new Set<string>();
    const recipients: Batchmate[] = [];
    for (const b of source) {
      const email = (b.email || '').trim();
      if (email && !seen.has(email.toLowerCase())) {
        seen.add(email.toLowerCase());
        recipients.push(b);
      }
    }
    return recipients;
  }, [mailRecipientMode, state.batchmates, selectedBmIds, customMailIds, filteredBatchmates]);

  const resolvedMailDraft = useMemo(() => {
    const single = mailRecipients.length === 1 ? mailRecipients[0] : null;
    const subVars = (text: string) =>
      text
        .replace(/\{name\}/gi, single ? single.name : "Orthohin '27 Batchmate")
        .replace(/\{roll\}/gi, single ? single.roll || 'N/A' : "Batch '27")
        .replace(/\{group\}/gi, single ? single.group || 'Class of 2027' : 'Class of 2027');

    const subject = subVars(mailSubject.trim() || "Message from ORTHOHIN '27");
    const body = subVars(mailBody.trim());
    const emails = mailRecipients.map((r) => (r.email || '').trim()).filter(Boolean);
    const joined = emails.join(',');

    let mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (emails.length > 0) {
      if (mailAddressField === 'to' || emails.length === 1) {
        mailtoHref = `mailto:${joined}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      } else {
        mailtoHref = `mailto:?bcc=${encodeURIComponent(joined)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
    }

    const gmailParams = new URLSearchParams({
      view: 'cm',
      fs: '1',
      su: subject,
      body,
    });
    if (emails.length > 0) {
      if (mailAddressField === 'to' || emails.length === 1) {
        gmailParams.set('to', joined);
      } else {
        gmailParams.set('bcc', joined);
      }
    }
    const gmailHref = `https://mail.google.com/mail/?${gmailParams.toString()}`;

    return { subject, body, emails, joined, mailtoHref, gmailHref };
  }, [mailRecipients, mailSubject, mailBody, mailAddressField]);

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
    if (isAuthenticating) return null;
    setLoginError('');
    setIsAuthenticating(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const signedEmail = cred.user.email?.toLowerCase() || '';
      if (!isAuthorizedAdminEmail(signedEmail) || !cred.user.emailVerified) {
        await signOut(auth);
        setLoginError(
          `Unauthorized Google account (${signedEmail || 'unknown'}). Sign in with an authorized admin account.`
        );
        return null;
      }
      setEmailInput(signedEmail);
      return cred.user;
    } catch (error) {
      const errObj = error as { code?: string; message?: string };
      const code = errObj?.code || '';
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      console.error('Admin Google Sign-In error:', code, errObj?.message || error);

      if (code === 'auth/popup-closed-by-user') {
        setLoginError('Google sign-in popup was closed before completing verification.');
      } else if (code === 'auth/cancelled-popup-request') {
        setLoginError('Another Google sign-in popup is already open. Please finish or close it and try again.');
      } else if (code === 'auth/popup-blocked') {
        setLoginError(
          'Popup blocked by browser. Allow popups for this site or open /rcs-admin in a new browser tab.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setLoginError(
          `Domain "${hostname}" is not authorized in Firebase Auth. Add "${hostname}" in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === 'auth/operation-not-allowed') {
        setLoginError(
          'Google Sign-In is currently disabled in Firebase Console. Enable Google under Authentication → Sign-in method.'
        );
      } else if (code === 'auth/network-request-failed') {
        setLoginError(
          'Network error reaching Google Auth. Check your internet connection or disable ad-blockers and retry.'
        );
      } else if (code === 'auth/web-storage-unsupported' || code === 'auth/internal-error') {
        setLoginError(
          'This embedded preview frame or browser blocked Google Sign-In storage. Open /rcs-admin in a full browser tab and try again.'
        );
      } else {
        setLoginError(
          `Google verification failed (${code || 'unknown'}). Please confirm your authorized admin Google account and try again.`
        );
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
    if (!isAuthorizedAdminEmail(normalizedEmail)) {
      setLoginError(`Unauthorized email. Access is restricted to ${AUTHORIZED_ADMIN_EMAILS.join(' or ')}.`);
      return;
    }
    if (!verifyAdminPasscode(normalizedEmail, passwordInput)) {
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

    if (isFirebaseAdmin && authUser?.email?.toLowerCase() === normalizedEmail) {
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
    if (settingsTimerRef.current) {
      window.clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = null;
    }
    pendingSettingsRef.current = null;
    setIsSyncing(true);
    setLiveSyncStatus('saving');
    try {
      await saveSettingsInDb(nextProfile, nextHoodie, nextSite);
      broadcastLiveSync();
      setLiveSyncStatus('saved');
      if (successMsg) onToast(successMsg, 'success');
    } catch {
      setLiveSyncStatus('error');
      onToast('Could not save settings.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const updateSiteField = <K extends keyof typeof sc>(field: K, value: (typeof sc)[K]) => {
    const nextSite = { ...sc, [field]: value };
    onUpdateState({
      ...state,
      siteConfig: nextSite,
    });
    scheduleSettingsAutoSave(state.profile, hc, nextSite);
  };

  const updateHoodieField = <K extends keyof typeof hc>(field: K, value: (typeof hc)[K]) => {
    const nextHoodie = { ...hc, [field]: value };
    onUpdateState({
      ...state,
      hoodieConfig: nextHoodie,
    });
    scheduleSettingsAutoSave(state.profile, nextHoodie, sc);
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
      id: `RCS-${Date.now().toString().slice(-6)}`,
      customerName: newOrderName.trim(),
      roll: newOrderRoll.trim(),
      size: newOrderSize,
      quantity: newOrderQty,
      contact: newOrderContact.trim(),
      email: newOrderEmail.trim() || undefined,
      notes: newOrderNotes.trim() || undefined,
      status: 'Confirmed',
      paymentStatus: newOrderPaymentStatus,
      createdAt: new Date().toISOString(),
    };
    try {
      await createOrderInDb(order);
      broadcastLiveSync();
      void addActivityLogInDb(
        'Manual Order Added',
        `${order.id}: ${order.customerName} (${order.size} × ${order.quantity} · ${order.paymentStatus})`
      );
      await onRefreshData();
      setNewOrderName('');
      setNewOrderRoll('');
      setNewOrderContact('');
      setNewOrderEmail('');
      setNewOrderPaymentStatus('Due');
      setNewOrderNotes('');
      setNewOrderQty(1);
      setShowAddOrder(false);
      onToast(`Order ${order.id} added (${order.paymentStatus}).`, 'success');
    } catch {
      onToast('Could not add order.', 'error');
    }
  };

  const handleOrderStatus = async (orderId: string, status: OrderStatus, notes?: string) => {
    onUpdateState({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
      publicOrders: (state.publicOrders || []).map((o) =>
        o.id === orderId ? { ...o, status } : o
      ),
    });
    try {
      await updateOrderStatusInDb(orderId, status, notes);
      broadcastLiveSync();
      void addActivityLogInDb('Order Updated', `Order ${orderId} updated (${status})`);
      setLiveSyncStatus('saved');
      onToast(`Order ${orderId} updated.`, 'success');
    } catch {
      onToast('Could not update order.', 'error');
    }
  };

  const handleOrderPaymentStatus = async (order: HoodieOrder, paymentStatus: PaymentStatus) => {
    onUpdateState({
      ...state,
      orders: state.orders.map((o) => (o.id === order.id ? { ...o, paymentStatus } : o)),
      publicOrders: (state.publicOrders || []).map((o) =>
        o.id === order.id ? { ...o, paymentStatus } : o
      ),
    });
    try {
      await updateOrderStatusInDb(order.id, order.status, order.notes, { paymentStatus });
      broadcastLiveSync();
      void addActivityLogInDb(
        'Order Payment Updated',
        `Order ${order.id} (${order.customerName}) marked ${paymentStatus}`
      );
      setLiveSyncStatus('saved');
      onToast(`Order ${order.id} marked as ${paymentStatus}.`, 'success');
    } catch {
      onToast('Could not update payment status.', 'error');
    }
  };

  const handleUpdateOrderDraft = (nextDraft: HoodieOrder) => {
    setOrderDraft(nextDraft);
    onUpdateState({
      ...state,
      orders: state.orders.map((o) => (o.id === nextDraft.id ? nextDraft : o)),
      publicOrders: (state.publicOrders || []).map((o) =>
        o.id === nextDraft.id ? { ...o, ...nextDraft, contact: '', email: undefined } : o
      ),
    });
    scheduleOrderAutoSave(nextDraft);
  };

  const handleSaveEditedOrder = async () => {
    if (!orderDraft) return;
    if (!orderDraft.customerName.trim() || !orderDraft.roll.trim() || !orderDraft.contact.trim()) {
      onToast('Name, roll, and contact are required.', 'error');
      return;
    }
    try {
      pendingOrdersRef.current[orderDraft.id] = orderDraft;
      await flushOrder(orderDraft.id);
      void addActivityLogInDb(
        'Order Edited',
        `${orderDraft.id}: ${orderDraft.customerName} (${orderDraft.size} · ${orderDraft.paymentStatus || 'Due'})`
      );
      setEditingOrderId(null);
      setOrderDraft(null);
      onToast(`Order ${orderDraft.id} synced live.`, 'success');
    } catch {
      onToast('Could not save order edits.', 'error');
    }
  };

  const handleBulkOrderStatus = async (status: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    setIsSyncing(true);
    try {
      await Promise.all(selectedOrderIds.map((id) => updateOrderStatusInDb(id, status)));
      broadcastLiveSync();
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

  const handleBulkOrderPayment = async (paymentStatus: PaymentStatus) => {
    if (selectedOrderIds.length === 0) return;
    setIsSyncing(true);
    try {
      await Promise.all(
        selectedOrderIds.map((id) => {
          const ord = state.orders.find((o) => o.id === id);
          return updateOrderStatusInDb(id, ord?.status || 'Pending', ord?.notes, { paymentStatus });
        })
      );
      broadcastLiveSync();
      void addActivityLogInDb(
        'Bulk Payment Update',
        `${selectedOrderIds.length} order(s) marked as ${paymentStatus}`
      );
      await onRefreshData();
      setSelectedOrderIds([]);
      onToast(`${selectedOrderIds.length} order(s) marked as ${paymentStatus}.`, 'success');
    } catch {
      onToast('Bulk payment update failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkDeleteOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsSyncing(true);
    try {
      await Promise.all(selectedOrderIds.map((id) => deleteOrderInDb(id)));
      broadcastLiveSync();
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

  const handleCopyOrderEmailList = async (emails: string[], label: string, flashKey: string) => {
    if (emails.length === 0) {
      onToast(`No email addresses found in ${label}.`, 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setCopiedOrderBulkMode(flashKey);
      window.setTimeout(() => {
        setCopiedOrderBulkMode((prev) => (prev === flashKey ? null : prev));
      }, 2200);
      onToast(`Copied ${emails.length} order email${emails.length > 1 ? 's' : ''} (${label}).`, 'success');
    } catch {
      onToast('Could not copy email list to clipboard.', 'error');
    }
  };

  const handleCopySingleOrderEmail = async (orderId: string, email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedOrderEmailId(orderId);
      window.setTimeout(() => {
        setCopiedOrderEmailId((prev) => (prev === orderId ? null : prev));
      }, 1800);
      onToast(`Copied ${email}`, 'success');
    } catch {
      onToast('Could not copy email.', 'error');
    }
  };

  const handleSelectOrderMailTemplate = (templateId: string) => {
    const tpl = ORDER_MAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedOrderMailTemplateId(tpl.id);
    setOrderMailSubject(tpl.subject);
    setOrderMailBody(tpl.body);
  };

  const toggleCustomOrderMailRecipient = (orderId: string) => {
    setCustomOrderMailIds((prev) =>
      prev.includes(orderId) ? prev.filter((item) => item !== orderId) : [...prev, orderId]
    );
  };

  const handleOpenMailForSingleOrder = (order: HoodieOrder) => {
    const tplId = order.paymentStatus === 'Paid' ? 'paid_confirmed' : 'due_700';
    handleSelectOrderMailTemplate(tplId);
    setCustomOrderMailIds([order.id]);
    setOrderMailRecipientMode('custom');
    document.getElementById('admin-orders-mail')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopyOrderMailDraft = async () => {
    const lines = [
      `To / BCC (${resolvedOrderMailDraft.emails.length}): ${resolvedOrderMailDraft.joined || 'None selected'}`,
      `Subject: ${resolvedOrderMailDraft.subject}`,
      '',
      resolvedOrderMailDraft.body,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      onToast('Order invoice email draft copied to clipboard.', 'success');
    } catch {
      onToast('Could not copy email draft.', 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrderInDb(orderId);
      broadcastLiveSync();
      void addActivityLogInDb('Order Removed', `Order ${orderId} deleted by admin`);
      await onRefreshData();
      setConfirmDeleteOrderId(null);
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
      setCustomOrderMailIds((prev) => prev.filter((id) => id !== orderId));
      onToast('Order removed.', 'info');
    } catch {
      onToast('Could not delete order.', 'error');
    }
  };

  const handleExportOrdersCsv = (onlySelected = false) => {
    const targetOrders =
      onlySelected && selectedOrderIds.length > 0
        ? state.orders.filter((o) => selectedOrderIds.includes(o.id))
        : filteredOrders;
    downloadCsv(
      `orthohin27_rcs_orders_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Order ID',
        'Name',
        'Roll',
        'Size',
        'Quantity',
        'Total (BDT)',
        'Payment Status',
        'Contact',
        'Email',
        'Notes',
        'Status',
        'Created At',
      ],
      targetOrders.map((o) => {
        const fin = getOrderFinancials(o);
        return [
          o.id,
          o.customerName,
          o.roll,
          o.size,
          o.quantity,
          fin.totalAmount,
          fin.isPaid ? 'Paid' : 'Due',
          o.contact,
          resolveOrderEmail(o),
          o.notes || '',
          o.status,
          o.createdAt,
        ];
      })
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
      nickname: newBmNickname.trim() || undefined,
      roll: newBmRoll.trim(),
      group: newBmGroup.trim() || 'Science',
      email: newBmEmail.trim() || undefined,
      phone: newBmPhone.trim() || undefined,
      social: newBmSocial.trim() || undefined,
      hobbies: newBmHobbies.trim() || undefined,
      bloodGroup: newBmBloodGroup.trim() || undefined,
      birthday: newBmBirthday.trim() || undefined,
      dreamGoal: newBmDreamGoal.trim() || undefined,
      hangoutSpot: newBmHangoutSpot.trim() || undefined,
      superpower: newBmSuperpower.trim() || undefined,
      favoriteMemory: newBmFavoriteMemory.trim() || undefined,
      quote: newBmQuote.trim() || undefined,
      photo: newBmPhoto || undefined,
      registeredAt: new Date().toISOString().slice(0, 10),
    };
    try {
      await createBatchmateInDb(member);
      broadcastLiveSync();
      void addActivityLogInDb('Batchmate Added', `${member.name} (Roll ${member.roll}) added by admin`);
      await onRefreshData();
      setNewBmName('');
      setNewBmNickname('');
      setNewBmRoll('');
      setNewBmEmail('');
      setNewBmPhone('');
      setNewBmSocial('');
      setNewBmHobbies('');
      setNewBmBloodGroup('');
      setNewBmBirthday('');
      setNewBmDreamGoal('');
      setNewBmHangoutSpot('');
      setNewBmSuperpower('');
      setNewBmFavoriteMemory('');
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
        onUpdateState({
          ...state,
          batchmates: state.batchmates.map((b) => (b.id === updated.id ? updated : b)),
        });
        await updateBatchmateInDb(updated);
        broadcastLiveSync();
        setLiveSyncStatus('saved');
        onToast(`${target.name}'s portrait updated live.`, 'success');
      }
    } catch {
      onToast('Could not update batchmate portrait.', 'error');
    } finally {
      setBmPhotoTargetId(null);
      e.target.value = '';
    }
  };

  const handleUpdateBatchmateField = (id: string, field: keyof Batchmate, value: string) => {
    let updatedBm: Batchmate | null = null;
    const nextBatchmates = state.batchmates.map((b) => {
      if (b.id === id) {
        updatedBm = { ...b, [field]: value };
        return updatedBm;
      }
      return b;
    });
    onUpdateState({
      ...state,
      batchmates: nextBatchmates,
    });
    if (updatedBm) {
      scheduleBatchmateAutoSave(updatedBm);
    }
  };

  const handleSaveBatchmate = async (bm: Batchmate) => {
    if (!bm.name.trim() || !bm.roll.trim() || !bm.group.trim()) {
      onToast('Name, roll, and group cannot be empty.', 'error');
      return;
    }
    try {
      pendingBatchmatesRef.current[bm.id] = bm;
      await flushBatchmate(bm.id);
      void addActivityLogInDb('Batchmate Updated', `${bm.name} (Roll ${bm.roll}) updated`);
      setEditingBmId(null);
      onToast(`${bm.name} synced live.`, 'success');
    } catch {
      onToast('Could not save batchmate changes.', 'error');
    }
  };

  const handleDeleteBatchmate = async (id: string) => {
    const target = state.batchmates.find((b) => b.id === id);
    try {
      await deleteBatchmateInDb(id);
      broadcastLiveSync();
      void addActivityLogInDb('Batchmate Removed', `${target?.name || id} removed from directory`);
      await onRefreshData();
      setConfirmDeleteBmId(null);
      setSelectedBmIds((prev) => prev.filter((item) => item !== id));
      setCustomMailIds((prev) => prev.filter((item) => item !== id));
      onToast('Batchmate removed from directory.', 'info');
    } catch {
      onToast('Could not remove batchmate.', 'error');
    }
  };

  const toggleBmSelection = (id: string) => {
    setSelectedBmIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredBms = () => {
    const filteredIds = filteredBatchmates.map((b) => b.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedBmIds.includes(id));
    if (allSelected) {
      setSelectedBmIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedBmIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleCopyEmailList = async (emails: string[], label: string, flashKey: string) => {
    if (emails.length === 0) {
      onToast(`No email addresses found in ${label}.`, 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setCopiedBulkEmailsMode(flashKey);
      window.setTimeout(() => {
        setCopiedBulkEmailsMode((prev) => (prev === flashKey ? null : prev));
      }, 2200);
      onToast(`Copied ${emails.length} email address${emails.length > 1 ? 'es' : ''} (${label}).`, 'success');
    } catch {
      onToast('Could not copy email list to clipboard.', 'error');
    }
  };

  const handleCopySingleBmEmail = async (id: string, email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedBmEmailId(id);
      window.setTimeout(() => {
        setCopiedBmEmailId((prev) => (prev === id ? null : prev));
      }, 1800);
      onToast(`Copied ${email}`, 'success');
    } catch {
      onToast('Could not copy email.', 'error');
    }
  };

  const handleSelectMailTemplate = (templateId: string) => {
    const tpl = ADMIN_MAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedMailTemplateId(tpl.id);
    setMailSubject(tpl.subject);
    setMailBody(tpl.body);
  };

  const toggleCustomMailRecipient = (id: string) => {
    setCustomMailIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyMailDraft = async () => {
    const lines = [
      `To / BCC (${resolvedMailDraft.emails.length}): ${resolvedMailDraft.joined || 'None selected'}`,
      `Subject: ${resolvedMailDraft.subject}`,
      '',
      resolvedMailDraft.body,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      onToast('Full email draft copied to clipboard.', 'success');
    } catch {
      onToast('Could not copy email draft.', 'error');
    }
  };

  const handleExportBatchmatesCsv = () => {
    downloadCsv(
      `orthohin27_batchmates_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Name',
        'Nickname',
        'Roll',
        'Group',
        'Email',
        'Phone',
        'Blood Group',
        'Birthday',
        'Hobbies',
        'Dream Goal',
        'Hangout Spot',
        'Superpower',
        'Favorite Memory',
        'Social',
        'Quote',
        'Registered At',
      ],
      filteredBatchmates.map((b) => [
        b.name,
        b.nickname || '',
        b.roll,
        b.group,
        b.email || '',
        b.phone || '',
        b.bloodGroup || '',
        b.birthday || '',
        b.hobbies || '',
        b.dreamGoal || '',
        b.hangoutSpot || '',
        b.superpower || '',
        b.favoriteMemory || '',
        b.social || '',
        b.quote || '',
        b.registeredAt || '',
      ])
    );
    onToast(`Exported ${filteredBatchmates.length} batchmate(s) to CSV.`, 'success');
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
        broadcastLiveSync();
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
      broadcastLiveSync();
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
        broadcastLiveSync();
        await onRefreshData();
        onToast('Gallery photo replaced live.', 'success');
      }
    } catch {
      onToast('Failed to load or save replacement image.', 'error');
    } finally {
      setReplaceTargetId(null);
      e.target.value = '';
    }
  };

  const handleUpdateGalleryField = (
    id: string,
    field: keyof GalleryItem,
    value: string,
    idx: number
  ) => {
    let updatedItem: GalleryItem | null = null;
    const nextGallery = state.gallery.map((g) => {
      if (g.id === id) {
        updatedItem = { ...g, [field]: value };
        return updatedItem;
      }
      return g;
    });
    onUpdateState({
      ...state,
      gallery: nextGallery,
    });
    if (updatedItem) {
      scheduleGalleryAutoSave(updatedItem, idx);
    }
  };

  const handleSaveGalleryItem = async (item: GalleryItem, idx: number) => {
    try {
      pendingGalleryRef.current[item.id] = { item, idx };
      await flushGalleryItem(item.id);
      onToast('Gallery item synced live.', 'success');
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
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      onToast('Could not reorder gallery.', 'error');
    }
  };

  const handleDeleteGallery = async (id: string) => {
    try {
      await deleteGalleryItemInDb(id);
      broadcastLiveSync();
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
      const src = await compressImage(file, 850, 140000);
      const nextHoodie = { ...hc, [hoodieSideTarget]: src };
      onUpdateState({ ...state, hoodieConfig: nextHoodie });
      await persistSettings(
        state.profile,
        nextHoodie,
        sc,
        `RCS Hoodie ${hoodieSideTarget === 'frontImage' ? 'Front' : 'Back'} image saved live.`
      );
      void addActivityLogInDb(
        'Hoodie Photo Updated',
        `Updated RCS Hoodie ${hoodieSideTarget === 'frontImage' ? 'Front' : 'Back'} photo`
      );
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
      const src = await compressImage(file, 900, 140000);
      const nextSite = { ...sc, heroImage: src };
      onUpdateState({ ...state, siteConfig: nextSite });
      await persistSettings(state.profile, hc, nextSite, 'Hero showcase image saved live.');
      void addActivityLogInDb('Hero Image Updated', 'Homepage hero showcase image updated');
    } catch {
      onToast('Failed to upload hero image.', 'error');
    }
    e.target.value = '';
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 600, 120000);
      onUpdateState({ ...state, profile: src });
      setProfileUrlInput(src);
      await persistSettings(src, hc, sc, 'Leadership profile photo saved live.');
      void addActivityLogInDb('Profile Updated', 'Leadership profile photo uploaded');
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
          const defaults = createDefaultState();
          const restored: PortalState = {
            ...defaults,
            ...parsed,
            adminTeam: Array.isArray(parsed.adminTeam) ? parsed.adminTeam : defaults.adminTeam,
          };
          setIsSyncing(true);
          await syncPortalStateInDb(restored, true);
          broadcastLiveSync();
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
    setAdminPassword(newPassword, authorizedAdmin || AUTHORIZED_ADMIN_EMAIL);
    setNewPassword('');
    void addActivityLogInDb('Password Changed', `Admin passcode updated for ${authorizedAdmin || AUTHORIZED_ADMIN_EMAIL}`);
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
      broadcastLiveSync();
      void addActivityLogInDb('Notice Published', `${newNotice.category}: ${newNotice.title}`);
      await onRefreshData();
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeCategory('General');
      setNoticePinned(true);
      onToast('Batch notice published live.', 'success');
    } catch {
      onToast('Could not publish notice.', 'error');
    }
  };

  const handleUpdateNoticeDraft = (nextDraft: BatchNotice) => {
    setNoticeDraft(nextDraft);
    onUpdateState({
      ...state,
      notices: (state.notices || []).map((n) => (n.id === nextDraft.id ? nextDraft : n)),
    });
    scheduleNoticeAutoSave(nextDraft);
  };

  const handleSaveEditedNotice = async () => {
    if (!noticeDraft || !noticeDraft.title.trim() || !noticeDraft.message.trim()) {
      onToast('Notice title and message cannot be empty.', 'error');
      return;
    }
    try {
      pendingNoticesRef.current[noticeDraft.id] = noticeDraft;
      await flushNotice(noticeDraft.id);
      void addActivityLogInDb('Notice Updated', `${noticeDraft.category}: ${noticeDraft.title}`);
      setEditingNoticeId(null);
      setNoticeDraft(null);
      onToast('Notice synced live.', 'success');
    } catch {
      onToast('Could not save notice changes.', 'error');
    }
  };

  const handleToggleNoticePin = async (notice: BatchNotice) => {
    const updated = { ...notice, pinned: !notice.pinned };
    onUpdateState({
      ...state,
      notices: (state.notices || []).map((n) => (n.id === notice.id ? updated : n)),
    });
    try {
      await updateNoticeInDb(updated);
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      onToast('Could not update notice pin state.', 'error');
    }
  };

  const handleToggleNoticeActive = async (notice: BatchNotice) => {
    const updated = { ...notice, active: !notice.active };
    onUpdateState({
      ...state,
      notices: (state.notices || []).map((n) => (n.id === notice.id ? updated : n)),
    });
    try {
      await updateNoticeInDb(updated);
      broadcastLiveSync();
      setLiveSyncStatus('saved');
    } catch {
      onToast('Could not toggle notice visibility.', 'error');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteNoticeInDb(id);
      broadcastLiveSync();
      void addActivityLogInDb('Notice Removed', `Notice ${id} deleted`);
      await onRefreshData();
      setConfirmDeleteNoticeId(null);
      onToast('Notice deleted.', 'info');
    } catch {
      onToast('Could not delete notice.', 'error');
    }
  };

  /* Public Admin Panel Team Management */
  const currentTeamList = state.adminTeam || [];

  const handleNewTeamPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await compressImage(file, 650, 180000);
      setNewTeamPhoto(src);
      onToast('Organizer photo ready.', 'success');
    } catch {
      onToast('Could not process organizer photo.', 'error');
    }
    e.target.value = '';
  };

  const handleEditTeamPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamPhotoTargetId) return;
    try {
      const src = await compressImage(file, 650, 180000);
      if (editingTeamId === teamPhotoTargetId && teamDraft) {
        setTeamDraft({ ...teamDraft, photo: src });
      }
      const idx = currentTeamList.findIndex((m) => m.id === teamPhotoTargetId);
      const target = idx >= 0 ? currentTeamList[idx] : null;
      if (target) {
        const updated = { ...target, photo: src };
        const nextList = currentTeamList.map((m) => (m.id === target.id ? updated : m));
        onUpdateState({ ...state, adminTeam: nextList });
        await saveAdminTeamMemberInDb(updated, idx);
        broadcastLiveSync();
        void addActivityLogInDb('Admin Team Photo', `Updated photo for ${updated.name}`);
        await onRefreshData();
      }
      onToast('Organizer photo updated live.', 'success');
    } catch {
      onToast('Could not update organizer photo.', 'error');
    }
    setTeamPhotoTargetId(null);
    e.target.value = '';
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamRole.trim()) {
      onToast('Organizer name and role are required.', 'error');
      return;
    }
    const member: AdminTeamMember = {
      id: `admin-${Date.now()}`,
      name: newTeamName.trim(),
      role: newTeamRole.trim(),
      bio: newTeamBio.trim(),
      photo: newTeamPhoto || undefined,
      social: newTeamSocial.trim() || undefined,
      sortOrder: currentTeamList.length,
    };
    try {
      setIsSyncing(true);
      setLiveSyncStatus('saving');
      const nextList = [...currentTeamList, member];
      onUpdateState({ ...state, adminTeam: nextList });
      await saveAdminTeamMemberInDb(member, nextList.length - 1);
      broadcastLiveSync();
      void addActivityLogInDb('Organizer Added', `${member.name} (${member.role})`);
      await onRefreshData();
      setNewTeamName('');
      setNewTeamRole('');
      setNewTeamBio('');
      setNewTeamSocial('');
      setNewTeamPhoto('');
      setLiveSyncStatus('saved');
      onToast(`${member.name} added to Admin Panel page.`, 'success');
    } catch {
      setLiveSyncStatus('error');
      onToast('Could not add organizer.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTeamDraft = async () => {
    if (!teamDraft || !teamDraft.name.trim() || !teamDraft.role.trim()) {
      onToast('Organizer name and role are required.', 'error');
      return;
    }
    const idx = Math.max(
      0,
      currentTeamList.findIndex((m) => m.id === teamDraft.id)
    );
    const cleaned: AdminTeamMember = {
      ...teamDraft,
      name: teamDraft.name.trim(),
      role: teamDraft.role.trim(),
      bio: teamDraft.bio.trim(),
      social: teamDraft.social?.trim() || undefined,
      sortOrder: idx,
    };
    try {
      setIsSyncing(true);
      setLiveSyncStatus('saving');
      onUpdateState({
        ...state,
        adminTeam: currentTeamList.map((m) => (m.id === cleaned.id ? cleaned : m)),
      });
      await saveAdminTeamMemberInDb(cleaned, idx);
      broadcastLiveSync();
      void addActivityLogInDb('Organizer Updated', `${cleaned.name} updated`);
      await onRefreshData();
      setEditingTeamId(null);
      setTeamDraft(null);
      setLiveSyncStatus('saved');
      onToast('Organizer info updated live.', 'success');
    } catch {
      setLiveSyncStatus('error');
      onToast('Could not save organizer changes.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMoveTeamMember = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= currentTeamList.length) return;
    const next = [...currentTeamList];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    const reindexed = next.map((m, i) => ({ ...m, sortOrder: i }));
    onUpdateState({ ...state, adminTeam: reindexed });
    try {
      setLiveSyncStatus('saving');
      await reorderAdminTeamInDb(reindexed);
      broadcastLiveSync();
      setLiveSyncStatus('saved');
      onToast('Admin Panel team order updated.', 'info');
    } catch {
      setLiveSyncStatus('error');
      onToast('Could not reorder organizers.', 'error');
    }
  };

  const handleDeleteTeamMember = async (id: string) => {
    const target = currentTeamList.find((m) => m.id === id);
    try {
      setIsSyncing(true);
      setLiveSyncStatus('saving');
      onUpdateState({ ...state, adminTeam: currentTeamList.filter((m) => m.id !== id) });
      await deleteAdminTeamMemberInDb(id);
      broadcastLiveSync();
      void addActivityLogInDb('Organizer Removed', `${target?.name || id} removed`);
      await onRefreshData();
      setConfirmDeleteTeamId(null);
      setLiveSyncStatus('saved');
      onToast('Organizer removed from Admin Panel page.', 'info');
    } catch {
      setLiveSyncStatus('error');
      onToast('Could not remove organizer.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const navItems: { key: AdminTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Smart Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'notices', label: 'Notices Board', count: (state.notices || []).length, icon: <Megaphone className="w-4 h-4" /> },
    { key: 'orders', label: 'Hoodie Orders', count: state.orders.length, icon: <Shirt className="w-4 h-4" /> },
    { key: 'batchmates', label: 'Batchmates', count: state.batchmates.length, icon: <Users className="w-4 h-4" /> },
    { key: 'gallery', label: 'Memory Vault', count: state.gallery.length, icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'hoodie', label: 'Hoodie Page', icon: <Sliders className="w-4 h-4" /> },
    { key: 'team', label: 'Admin Team', count: currentTeamList.length, icon: <UserPlus className="w-4 h-4" /> },
    { key: 'site', label: 'Full Site Studio', icon: <Globe className="w-4 h-4" /> },
    { key: 'security', label: 'Backup & Security', icon: <Shield className="w-4 h-4" /> },
  ];

  const selectTab = (key: AdminTab) => {
    setActiveTab(key);
    setMobileNavOpen(false);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`${
        isRouteAdmin ? 'h-screen' : 'fixed inset-0 z-50'
      } bg-zinc-50 dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 flex flex-col overflow-hidden`}
      role={isRouteAdmin ? 'main' : 'dialog'}
      aria-modal={isRouteAdmin ? undefined : true}
      aria-label="ORTHOHIN '27 Smart Admin Panel"
    >
      {/* Dedicated Top Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-zinc-300 dark:border-zinc-800/90 bg-white dark:bg-[#0c0c10] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {unlocked && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              aria-label="Toggle admin navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <img
            src={SITE_LOGO_SRC}
            alt="ORTHOHIN '27 logo"
            className="w-9 h-9 rounded-lg object-cover border border-zinc-300 dark:border-zinc-700/80 shadow-xs shrink-0 bg-black"
          />
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-zinc-950 dark:text-white truncate">
              ORTHOHIN '27 · Smart Admin Control
            </h2>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
              {unlocked ? `Authorized: ${authorizedAdmin}` : 'Protected /rcs-admin Page · Authorized Admins Only'}
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
              className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
            />
            {globalQuery && (
              <button
                type="button"
                onClick={() => setGlobalQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                aria-label="Clear quick search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {quickSearchResults && (
              <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-2xl p-2 z-50 space-y-2">
                {quickSearchResults.matchedOrders.length === 0 &&
                quickSearchResults.matchedMembers.length === 0 &&
                quickSearchResults.matchedNotices.length === 0 ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-500 px-2 py-2">No matching records across portal.</p>
                ) : (
                  <>
                    {quickSearchResults.matchedOrders.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-500 px-2 py-1">
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
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-zinc-900 dark:text-zinc-200 truncate">
                              <span className="font-mono text-rose-700 dark:text-rose-400">{o.id}</span> · {o.customerName}
                            </span>
                            <span className="font-mono text-zinc-600 dark:text-zinc-400 shrink-0">{o.size}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {quickSearchResults.matchedMembers.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-500 px-2 py-1">
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
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-zinc-900 dark:text-zinc-200 truncate">{b.name}</span>
                            <span className="font-mono text-zinc-600 dark:text-zinc-400 shrink-0">Roll {b.roll}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {quickSearchResults.matchedNotices.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-500 px-2 py-1">
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
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-zinc-900 dark:text-zinc-200 truncate">{n.title}</span>
                            <span className="text-zinc-600 dark:text-zinc-400 shrink-0">{n.category}</span>
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
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                liveSyncStatus === 'saving'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                  : liveSyncStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              }`}
              title="All edits automatically sync live to the website"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  liveSyncStatus === 'saving'
                    ? 'bg-amber-500 animate-pulse'
                    : liveSyncStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                }`}
              />
              <span>
                {liveSyncStatus === 'saving'
                  ? 'Syncing live...'
                  : liveSyncStatus === 'error'
                    ? 'Sync retrying'
                    : liveSyncStatus === 'saved'
                      ? 'Live synced'
                      : 'Live edit ON'}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to high-contrast light mode' : 'Switch to dark mode'}
            aria-pressed={!isDark}
            title={isDark ? 'Switch to High-Contrast Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-200 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-900" />}
            <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
          </button>
          {unlocked && (
            <>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void handleManualRefresh()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh portal data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void flushAllPendingAutoSaves().finally(() => {
                    setUnlocked(false);
                    setAuthorizedAdmin('');
                    void signOut(auth);
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              void flushAllPendingAutoSaves().finally(onClose);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Exit admin panel"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">View Portal</span>
          </button>
        </div>
      </header>

      {!unlocked ? (
        /* Dedicated /rcs-admin Auth View */
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-4 sm:p-8 bg-zinc-100 dark:bg-[#070709]">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0e0e12] border border-zinc-300 dark:border-zinc-800/90 p-7 sm:p-8 space-y-5 shadow-xl dark:shadow-2xl"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <img
                  src={SITE_LOGO_SRC}
                  alt="ORTHOHIN '27 logo"
                  className="w-11 h-11 rounded-xl object-cover border border-zinc-300 dark:border-zinc-700/80 shadow-xs shrink-0 bg-black"
                />
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Restricted Admin Gateway</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Sign in to Admin Control</h3>
              <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">
                Access is restricted to authorized <span className="font-mono text-zinc-950 dark:text-zinc-200">Orthohin '27</span>{' '}
                admins with verified Google credentials and admin passcode.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-300">Account Verification</span>
                {isFirebaseAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">Required on sign in</span>
                )}
              </div>

              {isFirebaseAdmin ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-zinc-950 dark:text-zinc-200 truncate">{authUser?.email}</span>
                  <button
                    type="button"
                    onClick={() => void signOut(auth)}
                    className="text-[11px] text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer shrink-0"
                  >
                    Switch account
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={() => void handleGoogleSignIn()}
                    className="w-full py-2 px-3 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isAuthenticating ? 'Verifying Google account...' : 'Sign in with Authorized Google Account'}
                  </button>
                  {typeof window !== 'undefined' && window.self !== window.top && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700/80 text-[11px] font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open /rcs-admin in a New Tab (if popup is blocked)
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3.5">
              <div>
                <label htmlFor="admin-email-input" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                  Authorized Email
                </label>
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter authorized admin email"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                />
              </div>

              <div>
                <label htmlFor="admin-pass-input" className="block text-xs font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
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
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {loginError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs font-medium text-rose-800 dark:text-rose-300 space-y-2">
                <p>{loginError}</p>
                {typeof window !== 'undefined' && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 underline font-semibold text-rose-900 dark:text-rose-200 hover:opacity-80"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open /rcs-admin directly in new tab
                  </a>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating || lockSecondsLeft > 0}
              className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
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
            } w-64 flex-col border-r border-zinc-300 dark:border-zinc-800/80 bg-white dark:bg-[#0b0b0f] p-4 justify-between shrink-0 overflow-y-auto`}
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
                      : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        activeTab === item.key ? 'text-rose-100' : 'text-zinc-600 dark:text-zinc-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800/80 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200">Live Portal Switches</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-400">
                    <span>Hoodie Orders</span>
                    <span className={hc.directOrderOpen ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-zinc-600 dark:text-zinc-500'}>
                      {hc.directOrderOpen ? 'Open' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-400">
                    <span>Registration</span>
                    <span className={sc.registrationOpen !== false ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-zinc-600 dark:text-zinc-500'}>
                      {sc.registrationOpen !== false ? 'Open' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-400">
                    <span>Maintenance</span>
                    <span className={sc.maintenanceMode ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-600 dark:text-zinc-500'}>
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
                      className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">Hoodie Direct Orders</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {hc.directOrderOpen ? 'Accepting new orders' : 'Temporarily paused'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          hc.directOrderOpen
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-400'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
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
                      className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">Member Registration</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {sc.registrationOpen !== false ? 'Visitors can register' : 'Self-registration paused'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          sc.registrationOpen !== false
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-400'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
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
                      className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-700 shadow-xs dark:shadow-none text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">Maintenance Lock</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {sc.maintenanceMode ? 'Public visitors paused' : 'Public site live'}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          sc.maintenanceMode
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {sc.maintenanceMode ? 'LOCKED' : 'LIVE'}
                      </span>
                    </button>
                  </div>

                  {/* Top Action Queue Banner */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Megaphone className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">Smart Action Summary</p>
                        <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">
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
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Review Pending ({analytics.pendingOrders})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => selectTab('site')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs font-medium cursor-pointer"
                      >
                        Edit Website Sections
                      </button>
                    </div>
                  </div>

                  {analytics.duplicateRolls.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
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
                        className="px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 text-xs font-medium cursor-pointer shrink-0"
                      >
                        Inspect
                      </button>
                    </div>
                  )}

                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                      <p className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-white">{analytics.totalBatchmates}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Registered Batchmates</p>
                    </div>
                    <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                      <p className="text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400">{analytics.totalOrders}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        Direct Orders ({analytics.totalHoodiesOrdered} hoodies)
                      </p>
                    </div>
                    <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                      <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
                        {analytics.pendingOrders}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Pending Fulfillment</p>
                    </div>
                    <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {analytics.confirmedOrders + analytics.deliveredOrders}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Confirmed & Delivered</p>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* RCS Hoodie Size Matrix */}
                    <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Hoodie Size Breakdown (S–XXXL)</h3>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Total pieces requested per size</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopySizeSummary()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-zinc-200 cursor-pointer"
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
                                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">{sz}</span>
                                <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                                  {qty} pcs ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-rose-600 dark:bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group Distribution + Quick Actions */}
                    <div className="space-y-6">
                      <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Batchmates by Group</h3>
                        <div className="space-y-3">
                          {analytics.groupCounts.map(([grp, count]) => {
                            const pct = Math.round((count / Math.max(1, analytics.totalBatchmates)) * 100);
                            return (
                              <div key={grp} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-800 dark:text-zinc-300">{grp}</span>
                                  <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                                    {count} ({pct}%)
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                  <div className="h-full bg-rose-600 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Quick Admin Actions</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleExportOrdersCsv(false)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Orders CSV
                          </button>
                          <button
                            type="button"
                            onClick={handleExportBatchmatesCsv}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> Batchmates CSV
                          </button>
                          <button
                            type="button"
                            onClick={handleExportJson}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> Backup JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              selectTab('batchmates');
                              setShowAddBm(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
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
                    className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-rose-600 dark:text-rose-500" />
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
                        className="sm:col-span-2 px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                      />
                      <select
                        value={noticeCategory}
                        onChange={(e) => setNoticeCategory(e.target.value as NoticeCategory)}
                        aria-label="Notice category"
                        className="px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
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
                      className="w-full px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 resize-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-300 cursor-pointer select-none">
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
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Publish Notice
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {(state.notices || []).length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                        No batch notices published yet.
                      </div>
                    ) : (
                      (state.notices || []).map((notice) => {
                        const isEditing = editingNoticeId === notice.id && noticeDraft;
                        return (
                          <div
                            key={notice.id}
                            className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="grid sm:grid-cols-3 gap-2.5">
                                  <input
                                    type="text"
                                    value={noticeDraft.title}
                                    onChange={(e) =>
                                      handleUpdateNoticeDraft({ ...noticeDraft, title: e.target.value })
                                    }
                                    className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                  />
                                  <select
                                    value={noticeDraft.category}
                                    onChange={(e) =>
                                      handleUpdateNoticeDraft({
                                        ...noticeDraft,
                                        category: e.target.value as NoticeCategory,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
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
                                    handleUpdateNoticeDraft({ ...noticeDraft, message: e.target.value })
                                  }
                                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNoticeId(null);
                                      setNoticeDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveEditedNotice()}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
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
                                          ? 'text-rose-700 dark:text-rose-400'
                                          : notice.category === 'Event'
                                            ? 'text-amber-700 dark:text-amber-400'
                                            : 'text-emerald-700 dark:text-emerald-400'
                                      }`}
                                    >
                                      {notice.category}
                                    </span>
                                    <span className="text-zinc-400 dark:text-zinc-600">·</span>
                                    <span className="font-mono text-zinc-600 dark:text-zinc-400">{notice.createdAt}</span>
                                    {notice.pinned && (
                                      <>
                                        <span className="text-zinc-400 dark:text-zinc-600">·</span>
                                        <span className="text-rose-700 dark:text-rose-400 font-medium">Pinned</span>
                                      </>
                                    )}
                                    {!notice.active && (
                                      <>
                                        <span className="text-zinc-400 dark:text-zinc-600">·</span>
                                        <span className="text-zinc-600 dark:text-zinc-500">Hidden</span>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-sm font-bold text-zinc-950 dark:text-white">{notice.title}</p>
                                  <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">{notice.message}</p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNoticeId(notice.id);
                                      setNoticeDraft({ ...notice });
                                    }}
                                    title="Edit notice"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleNoticePin(notice)}
                                    title={notice.pinned ? 'Unpin notice' : 'Pin notice'}
                                    className={`p-2 rounded-lg text-xs cursor-pointer ${
                                      notice.pinned
                                        ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-600/20 dark:text-rose-400 dark:border-rose-500/40'
                                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300'
                                    }`}
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleNoticeActive(notice)}
                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-200 cursor-pointer"
                                  >
                                    {notice.active ? 'Hide' : 'Show'}
                                  </button>

                                  {confirmDeleteNoticeId === notice.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteNotice(notice.id)}
                                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteNoticeId(null)}
                                        className="px-2 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteNoticeId(notice.id)}
                                      title="Delete notice"
                                      className="p-2 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 hover:text-white hover:border-rose-600 cursor-pointer"
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

              {/* TAB 3: FULL HOODIE ORDERS CONTROL, PAYMENTS & MAIL STUDIO */}
              {activeTab === 'orders' && (
                <div className="space-y-5">
                  {/* Search, Filters & Actions Bar */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={orderSearch}
                            onChange={(e) => setOrderSearch(e.target.value)}
                            placeholder="Search name, roll, Order ID, email..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                          />
                        </div>

                        {/* Payment Status Filter */}
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800">
                          {(['All', 'Due', 'Paid'] as const).map((pay) => (
                            <button
                              key={pay}
                              type="button"
                              onClick={() => setOrderPaymentFilter(pay)}
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                                orderPaymentFilter === pay
                                  ? pay === 'Due'
                                    ? 'bg-amber-600 text-white'
                                    : pay === 'Paid'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-zinc-900 text-white dark:bg-zinc-800'
                                  : 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                              }`}
                            >
                              {pay === 'Due'
                                ? `Due (${orderEmailStats.totalDueOrdersCount})`
                                : pay === 'Paid'
                                  ? `Paid (${orderEmailStats.totalPaidOrdersCount})`
                                  : 'All Pay'}
                            </button>
                          ))}
                        </div>

                        <select
                          value={orderStatusFilter}
                          onChange={(e) => setOrderStatusFilter(e.target.value as 'All' | OrderStatus)}
                          aria-label="Filter by order status"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
                        >
                          <option value="All">All Statuses</option>
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Delivered">Delivered</option>
                        </select>

                        <select
                          value={orderSizeFilter}
                          onChange={(e) => setOrderSizeFilter(e.target.value as 'All' | HoodieOrder['size'])}
                          aria-label="Filter by hoodie size"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
                        >
                          <option value="All">All Sizes</option>
                          {HOODIE_SIZES.map((sz) => (
                            <option key={sz} value={sz}>
                              Size {sz}
                            </option>
                          ))}
                        </select>

                        <select
                          value={orderEmailFilter}
                          onChange={(e) =>
                            setOrderEmailFilter(e.target.value as 'all' | 'has_email' | 'missing_email')
                          }
                          aria-label="Filter by email status"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
                        >
                          <option value="all">All Emails</option>
                          <option value="has_email">Has Email Only</option>
                          <option value="missing_email">No Email Listed</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExportOrdersCsv(selectedOrderIds.length > 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {selectedOrderIds.length > 0 ? `CSV (${selectedOrderIds.length})` : `CSV (${filteredOrders.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddOrder((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Manual Order
                        </button>
                      </div>
                    </div>

                    {/* One-Click Email Copy & Invoice Mail Studio Jump Bar */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-700 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-950 dark:text-zinc-200">
                          <Filter className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          Showing <span className="font-mono font-bold tabular-nums">{filteredOrders.length}</span> of{' '}
                          <span className="font-mono font-bold tabular-nums">{(state.orders || []).length}</span>
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-600">·</span>
                        <span>
                          Due Emails:{' '}
                          <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                            {orderEmailStats.dueEmails.length}
                          </span>
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-600">·</span>
                        <span>
                          Paid Emails:{' '}
                          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {orderEmailStats.paidEmails.length}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyOrderEmailList(
                              orderEmailStats.dueEmails,
                              'Due 700 Taka orders',
                              'due'
                            )
                          }
                          disabled={orderEmailStats.dueEmails.length === 0}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copiedOrderBulkMode === 'due'
                            ? 'Copied Due Emails'
                            : `Copy Due Emails (${orderEmailStats.dueEmails.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyOrderEmailList(
                              orderEmailStats.paidEmails,
                              'Paid orders',
                              'paid'
                            )
                          }
                          disabled={orderEmailStats.paidEmails.length === 0}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copiedOrderBulkMode === 'paid'
                            ? 'Copied Paid Emails'
                            : `Copy Paid Emails (${orderEmailStats.paidEmails.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedOrderIds.length > 0) {
                              setOrderMailRecipientMode('selected');
                            } else if (orderPaymentFilter === 'Paid') {
                              setOrderMailRecipientMode('paid');
                              handleSelectOrderMailTemplate('paid_confirmed');
                            } else {
                              setOrderMailRecipientMode('due');
                              handleSelectOrderMailTemplate('due_700');
                            }
                            document
                              .getElementById('admin-orders-mail')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" /> Send Mail &amp; Invoice
                        </button>
                      </div>
                    </div>
                  </div>

                  {showAddOrder && (
                    <form
                      onSubmit={handleAddManualOrder}
                      className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3"
                    >
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">Add Offline / Direct Order</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <input
                          type="text"
                          required
                          value={newOrderName}
                          onChange={(e) => setNewOrderName(e.target.value)}
                          placeholder="Student Name *"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          required
                          value={newOrderRoll}
                          onChange={(e) => setNewOrderRoll(e.target.value)}
                          placeholder="Roll / Batch ID *"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          required
                          value={newOrderContact}
                          onChange={(e) => setNewOrderContact(e.target.value)}
                          placeholder="Phone or @instagram *"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="email"
                          value={newOrderEmail}
                          onChange={(e) => setNewOrderEmail(e.target.value)}
                          placeholder="Email Address (for invoice mail)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <select
                          value={newOrderSize}
                          onChange={(e) => setNewOrderSize(e.target.value as HoodieOrder['size'])}
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
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
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
                        >
                          {[1, 2, 3, 4, 5].map((q) => (
                            <option key={q} value={q}>
                              Qty: {q} ({q * HOODIE_UNIT_PRICE} Taka)
                            </option>
                          ))}
                        </select>
                        <select
                          value={newOrderPaymentStatus}
                          onChange={(e) => setNewOrderPaymentStatus(e.target.value as PaymentStatus)}
                          aria-label="Payment status"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
                        >
                          <option value="Due">Due ({newOrderQty * HOODIE_UNIT_PRICE} Taka)</option>
                          <option value="Paid">Paid ({newOrderQty * HOODIE_UNIT_PRICE} Taka)</option>
                        </select>
                        <input
                          type="text"
                          value={newOrderNotes}
                          onChange={(e) => setNewOrderNotes(e.target.value)}
                          placeholder="Section / note (optional)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddOrder(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Create Order
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Bulk Toolbar */}
                  {filteredOrders.length > 0 && (
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allVisibleIds = filteredOrders.map((o) => o.id);
                          const allSelected = allVisibleIds.every((id) => selectedOrderIds.includes(id));
                          setSelectedOrderIds(allSelected ? [] : allVisibleIds);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-800 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
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
                            onClick={() => void handleBulkOrderPayment('Paid')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Mark Paid
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkOrderPayment('Due')}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Mark Due (৳700)
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkOrderStatus('Confirmed')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Confirm Order
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkOrderStatus('Delivered')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => void handleBulkDeleteOrders()}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedOrderIds([])}
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {filteredOrders.length === 0 ? (
                    <div className="p-10 text-center rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
                      No direct hoodie orders match this filter yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredOrders.map((order) => {
                        const isSelected = selectedOrderIds.includes(order.id);
                        const isEditing = editingOrderId === order.id && orderDraft;
                        const financials = getOrderFinancials(order);
                        const resolvedEmail = resolveOrderEmail(order);

                        return (
                          <div
                            key={order.id}
                            className={`p-4 rounded-xl bg-white dark:bg-[#111116] border shadow-xs dark:shadow-none transition-colors space-y-3 ${
                              isSelected ? 'border-rose-500/70 dark:border-rose-500/50' : 'border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleOrderSelection(order.id)}
                                  aria-label={`Select order ${order.id}`}
                                  className="mt-1 accent-rose-600 cursor-pointer"
                                />
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                                    <span className="font-mono text-rose-700 dark:text-rose-400 select-all">{order.id}</span>
                                    <span>·</span>
                                    <span>{order.customerName}</span>
                                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                                      (Roll {order.roll} · Size {order.size} × {financials.qty} · ৳{financials.totalAmount})
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                                    <span>
                                      Contact: <span className="text-zinc-900 dark:text-zinc-200">{order.contact}</span>
                                    </span>
                                    {resolvedEmail ? (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300">
                                        <Mail className="w-3 h-3 shrink-0" />
                                        <span className="font-mono text-[11px]">{resolvedEmail}</span>
                                        <button
                                          type="button"
                                          onClick={() => void handleCopySingleOrderEmail(order.id, resolvedEmail)}
                                          title="Copy email"
                                          className="text-emerald-700 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-white cursor-pointer"
                                        >
                                          {copiedOrderEmailId === order.id ? (
                                            <Check className="w-3 h-3" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      </span>
                                    ) : (
                                      <span className="text-[11px] italic text-zinc-500">
                                        No email saved (click Edit to add)
                                      </span>
                                    )}
                                    {order.notes && <span>Note: {order.notes}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {/* 1-Click Due 700 Taka / Paid Toggle */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleOrderPaymentStatus(
                                      order,
                                      financials.isPaid ? 'Due' : 'Paid'
                                    )
                                  }
                                  title="Click to toggle Paid vs Due 700 Taka"
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                    financials.isPaid
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950'
                                  }`}
                                >
                                  {financials.isPaid ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Paid (৳{financials.totalAmount})
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3.5 h-3.5" /> Due (৳{financials.dueAmount})
                                    </>
                                  )}
                                </button>

                                {resolvedEmail && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMailForSingleOrder(order)}
                                    title={`Send ${financials.isPaid ? 'Paid' : 'Due 700 Taka'} invoice mail to ${order.customerName}`}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 border border-rose-300 dark:border-rose-500/40 text-rose-700 hover:text-white dark:text-rose-300 dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                                  >
                                    <Mail className="w-3 h-3" /> Send Mail
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => void downloadOrderInvoicePng(order, hc)}
                                  title="Download official order invoice PNG"
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
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
                                      setOrderDraft({
                                        ...order,
                                        email: order.email || resolvedEmail,
                                        paymentStatus: order.paymentStatus === 'Paid' ? 'Paid' : 'Due',
                                      });
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-200 cursor-pointer"
                                >
                                  {isEditing ? 'Close' : 'Edit'}
                                </button>

                                <select
                                  value={order.status}
                                  onChange={(e) =>
                                    void handleOrderStatus(order.id, e.target.value as OrderStatus)
                                  }
                                  aria-label={`Order status for ${order.id}`}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
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
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteOrderId(null)}
                                      className="px-2 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteOrderId(order.id)}
                                    title="Delete order"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 hover:text-white hover:border-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditing && (
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  value={orderDraft.customerName}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({ ...orderDraft, customerName: e.target.value })
                                  }
                                  placeholder="Customer Name"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={orderDraft.roll}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({ ...orderDraft, roll: e.target.value })
                                  }
                                  placeholder="Roll"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={orderDraft.contact}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({ ...orderDraft, contact: e.target.value })
                                  }
                                  placeholder="Phone / Social Contact"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="email"
                                  value={orderDraft.email || ''}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({ ...orderDraft, email: e.target.value })
                                  }
                                  placeholder="Customer Email"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <select
                                  value={orderDraft.size}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({
                                      ...orderDraft,
                                      size: e.target.value as HoodieOrder['size'],
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
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
                                    handleUpdateOrderDraft({ ...orderDraft, quantity: Number(e.target.value) })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
                                >
                                  {[1, 2, 3, 4, 5].map((q) => (
                                    <option key={q} value={q}>
                                      Qty: {q} ({q * HOODIE_UNIT_PRICE} Taka)
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={orderDraft.paymentStatus === 'Paid' ? 'Paid' : 'Due'}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({
                                      ...orderDraft,
                                      paymentStatus: e.target.value as PaymentStatus,
                                    })
                                  }
                                  aria-label="Edit order payment status"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
                                >
                                  <option value="Due">Payment: Due</option>
                                  <option value="Paid">Payment: Paid</option>
                                </select>
                                <input
                                  type="text"
                                  value={orderDraft.notes || ''}
                                  onChange={(e) =>
                                    handleUpdateOrderDraft({ ...orderDraft, notes: e.target.value })
                                  }
                                  placeholder="Internal / Delivery Note"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingOrderId(null);
                                      setOrderDraft(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveEditedOrder()}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
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

                  {/* HOODIE ORDER SEND MAIL & INVOICE STUDIO */}
                  <section
                    id="admin-orders-mail"
                    className="p-5 rounded-2xl bg-white dark:bg-[#111116] border border-rose-300 dark:border-rose-500/30 shadow-xs dark:shadow-none space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                          <Mail className="w-4 h-4" />
                          Hoodie Orders · Send Mail &amp; Invoice Studio
                        </div>
                        <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                          Send Payment Due (700 Taka) &amp; Paid Invoices Directly
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          Ready-made invoice email templates with exact Order ID, Due/Paid amount, and 1-click Mail app or Gmail launcher.
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 self-start">
                        {(['bcc', 'to'] as const).map((field) => (
                          <button
                            key={field}
                            type="button"
                            onClick={() => setOrderMailAddressField(field)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase cursor-pointer ${
                              orderMailAddressField === field
                                ? 'bg-rose-600 text-white'
                                : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950'
                            }`}
                          >
                            {field}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 1: Select Order Recipients */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                          1. Select Order Recipients ({resolvedOrderMailDraft.emails.length} email
                          {resolvedOrderMailDraft.emails.length === 1 ? '' : 's'})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setOrderMailRecipientMode('due');
                              handleSelectOrderMailTemplate('due_700');
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              orderMailRecipientMode === 'due'
                                ? 'bg-amber-600 text-white font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Payment Due ({orderEmailStats.dueEmails.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOrderMailRecipientMode('paid');
                              handleSelectOrderMailTemplate('paid_confirmed');
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              orderMailRecipientMode === 'paid'
                                ? 'bg-emerald-600 text-white font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Paid Orders ({orderEmailStats.paidEmails.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderMailRecipientMode('filtered')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              orderMailRecipientMode === 'filtered'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Current Filter ({orderEmailStats.filteredEmails.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderMailRecipientMode('selected')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              orderMailRecipientMode === 'selected'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Checked ({orderEmailStats.selectedEmails.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderMailRecipientMode('custom')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              orderMailRecipientMode === 'custom'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Pick Orders
                          </button>
                        </div>
                      </div>

                      {orderMailRecipientMode === 'custom' && (
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                          {orderEmailStats.allOrdersWithEmail.length === 0 ? (
                            <p className="text-xs text-zinc-500">
                              No hoodie orders have an email address saved yet. Click Edit on an order to add one.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {orderEmailStats.allOrdersWithEmail.map((ord) => {
                                const active = customOrderMailIds.includes(ord.id);
                                const em = resolveOrderEmail(ord);
                                const fin = getOrderFinancials(ord);
                                return (
                                  <button
                                    key={ord.id}
                                    type="button"
                                    onClick={() => toggleCustomOrderMailRecipient(ord.id)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                                      active
                                        ? 'bg-rose-600 border-rose-600 text-white font-semibold'
                                        : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 hover:border-rose-500'
                                    }`}
                                  >
                                    {active ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    <span>{ord.customerName}</span>
                                    <span className="font-mono opacity-80">
                                      ({ord.id} · {fin.isPaid ? 'Paid' : `Due ৳${fin.dueAmount}`} · {em})
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                        <span className="truncate">
                          {resolvedOrderMailDraft.emails.length > 0
                            ? `${orderMailAddressField.toUpperCase()}: ${resolvedOrderMailDraft.joined}`
                            : 'No recipient emails found in this order filter yet.'}
                        </span>
                        {resolvedOrderMailDraft.emails.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyOrderEmailList(
                                resolvedOrderMailDraft.emails,
                                'order recipients',
                                'mail_recips'
                              )
                            }
                            className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 hover:underline font-sans font-semibold shrink-0 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedOrderBulkMode === 'mail_recips' ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Ready-Made Templates */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                        2. Choose Invoice / Order Email Template
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                        {ORDER_MAIL_TEMPLATES.map((tpl) => {
                          const active = selectedOrderMailTemplateId === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelectOrderMailTemplate(tpl.id)}
                              className={`text-left p-3 rounded-xl border transition-colors cursor-pointer space-y-1 ${
                                active
                                  ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-500 text-zinc-950 dark:text-white'
                                  : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              <p
                                className={`text-[10px] font-semibold uppercase tracking-wider ${
                                  tpl.id === 'due_700'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : tpl.id === 'paid_confirmed'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {tpl.tag}
                              </p>
                              <p className="text-xs font-semibold truncate">{tpl.label}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 3: Subject & Body Editor */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                          3. Customize Subject &amp; Message
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span>Insert:</span>
                          {[
                            '{orderId}',
                            '{name}',
                            '{roll}',
                            '{size}',
                            '{qty}',
                            '{amount}',
                            '{dueAmount}',
                            '{paymentStatus}',
                          ].map((token) => (
                            <button
                              key={token}
                              type="button"
                              onClick={() =>
                                setOrderMailBody((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${token}`)
                              }
                              className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-mono text-[11px] text-zinc-900 dark:text-zinc-200 cursor-pointer"
                            >
                              {token}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={orderMailSubject}
                        onChange={(e) => setOrderMailSubject(e.target.value)}
                        placeholder="Email subject..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                      />

                      <textarea
                        rows={7}
                        value={orderMailBody}
                        onChange={(e) => setOrderMailBody(e.target.value)}
                        placeholder="Write your invoice email body..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 leading-relaxed focus:outline-none focus:border-rose-500 resize-y"
                      />
                    </div>

                    {/* Step 4: Individual Exact-ID Personalized Quick Send + Bulk Launch */}
                    {resolvedOrderMailDraft.individualLinks.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                            4A. Send Personalized Email with Exact Order ID &amp; Downloadable Invoice (
                            {resolvedOrderMailDraft.individualLinks.length})
                          </p>
                          <span className="text-[11px] text-zinc-500">
                            Pre-fills exact Order ID &amp; Due/Paid invoice per student
                          </span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {resolvedOrderMailDraft.individualLinks.map((item) => {
                            const fin = getOrderFinancials(item.order);
                            return (
                              <div
                                key={item.order.id}
                                className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <p className="font-semibold text-zinc-950 dark:text-white truncate">
                                    {item.order.customerName}{' '}
                                    <span className="font-mono text-rose-700 dark:text-rose-400">
                                      ({item.order.id})
                                    </span>
                                  </p>
                                  <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                                    {item.email} · {fin.isPaid ? `Paid ৳${fin.totalAmount}` : `Due ৳${fin.dueAmount}`}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => void downloadOrderInvoicePng(item.order, hc)}
                                    title="Download exact Invoice PNG to attach"
                                    className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[11px] font-medium text-zinc-900 dark:text-zinc-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                  >
                                    <Download className="w-3 h-3" /> PNG
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadOrderInvoiceHtml(item.order, hc)}
                                    title="Download printable invoice slip"
                                    className="px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[11px] font-medium text-zinc-900 dark:text-zinc-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                  >
                                    <FileText className="w-3 h-3" /> Slip
                                  </button>
                                  <a
                                    href={item.gmailHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Gmail
                                  </a>
                                  <a
                                    href={item.mailtoHref}
                                    className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <Send className="w-3 h-3" /> Mail App
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bulk Mail App / Gmail Web Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        Opens your phone or PC default Mail app / Gmail directly with selected recipients, subject &amp; invoice message.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyOrderMailDraft()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Draft
                        </button>
                        {resolvedOrderMailDraft.singleOrder && (
                          <button
                            type="button"
                            onClick={() =>
                              void downloadOrderInvoicePng(resolvedOrderMailDraft.singleOrder!, hc)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Invoice PNG
                          </button>
                        )}
                        <a
                          href={resolvedOrderMailDraft.gmailHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open Gmail Web
                        </a>
                        <a
                          href={resolvedOrderMailDraft.mailtoHref}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {resolvedOrderMailDraft.emails.length > 0
                            ? `Open Mail App (${resolvedOrderMailDraft.emails.length})`
                            : 'Open Mail App'}
                        </a>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 4: FULL BATCHMATES CONTROL & SEND MAIL STUDIO */}
              {activeTab === 'batchmates' && (
                <div className="space-y-5">
                  {/* Top Search, Multi-Filters & Actions Bar */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="relative flex-1 min-w-[210px] max-w-sm">
                          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={bmSearch}
                            onChange={(e) => setBmSearch(e.target.value)}
                            placeholder="Search name, roll, email, phone, hobby, dream..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                          />
                        </div>
                        <select
                          value={bmGroupFilter}
                          onChange={(e) => setBmGroupFilter(e.target.value)}
                          aria-label="Filter by group"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
                        >
                          <option value="All">All Groups</option>
                          {analytics.groupNames.map((grp) => (
                            <option key={grp} value={grp}>
                              {grp}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bmBloodFilter}
                          onChange={(e) => setBmBloodFilter(e.target.value)}
                          aria-label="Filter by blood group"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
                        >
                          <option value="All">All Blood Groups</option>
                          {BLOOD_GROUP_OPTIONS.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bmEmailFilter}
                          onChange={(e) =>
                            setBmEmailFilter(e.target.value as 'all' | 'has_email' | 'missing_email')
                          }
                          aria-label="Filter by email status"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-500"
                        >
                          <option value="all">All Email Status</option>
                          <option value="has_email">Has Email Only</option>
                          <option value="missing_email">No Email Listed</option>
                        </select>
                        {(bmSearch || bmGroupFilter !== 'All' || bmBloodFilter !== 'All' || bmEmailFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setBmSearch('');
                              setBmGroupFilter('All');
                              setBmBloodFilter('All');
                              setBmEmailFilter('all');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleExportBatchmatesCsv}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> CSV ({filteredBatchmates.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddBm((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Batchmate
                        </button>
                      </div>
                    </div>

                    {/* One-Click Email Copy & Bulk Mail Jump Strip */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-700 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-950 dark:text-zinc-200">
                          <Filter className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          Showing <span className="font-mono font-bold tabular-nums">{filteredBatchmates.length}</span> of{' '}
                          <span className="font-mono font-bold tabular-nums">{state.batchmates.length}</span>
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-600">·</span>
                        <span>
                          Filtered Emails:{' '}
                          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {filteredBatchmateEmails.length}
                          </span>
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-600">·</span>
                        <span>
                          Selected:{' '}
                          <span className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                            {selectedBmIds.length}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredBms}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          {filteredBatchmates.length > 0 &&
                          filteredBatchmates.every((b) => selectedBmIds.includes(b.id))
                            ? 'Unselect Filtered'
                            : 'Select All Filtered'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyEmailList(
                              filteredBatchmateEmails,
                              'all filtered members',
                              'filtered'
                            )
                          }
                          disabled={filteredBatchmateEmails.length === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {copiedBulkEmailsMode === 'filtered' ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copied Filtered Emails
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy All Filtered Emails ({filteredBatchmateEmails.length})
                            </>
                          )}
                        </button>
                        {selectedBmIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyEmailList(
                                selectedBatchmateEmails,
                                'selected members',
                                'selected'
                              )
                            }
                            disabled={selectedBatchmateEmails.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 disabled:opacity-40 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {copiedBulkEmailsMode === 'selected' ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Copied Selected
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Copy Selected ({selectedBatchmateEmails.length})
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedBmIds.length > 0) setMailRecipientMode('selected');
                            else setMailRecipientMode('filtered');
                            document.getElementById('admin-send-mail')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" /> Send Mail
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Direct Add Member Form */}
                  {showAddBm && (
                    <form
                      onSubmit={handleAddBatchmateInsideAdmin}
                      className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">
                          Add New Batchmate Directly (Front + Flip Card + Private Contact)
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenRegister();
                          }}
                          className="text-[11px] text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-medium cursor-pointer"
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
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmNickname}
                          onChange={(e) => setNewBmNickname(e.target.value)}
                          placeholder="Nickname (optional)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          required
                          value={newBmRoll}
                          onChange={(e) => setNewBmRoll(e.target.value)}
                          placeholder="Roll Number *"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmGroup}
                          onChange={(e) => setNewBmGroup(e.target.value)}
                          placeholder="Group (e.g. Science)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="email"
                          value={newBmEmail}
                          onChange={(e) => setNewBmEmail(e.target.value)}
                          placeholder="Email (admin private)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="tel"
                          value={newBmPhone}
                          onChange={(e) => setNewBmPhone(e.target.value)}
                          placeholder="Phone (admin private)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmSocial}
                          onChange={(e) => setNewBmSocial(e.target.value)}
                          placeholder="@instagram (optional)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <select
                          value={newBmBloodGroup}
                          onChange={(e) => setNewBmBloodGroup(e.target.value)}
                          aria-label="New member blood group"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                        >
                          <option value="">Blood Group</option>
                          {BLOOD_GROUP_OPTIONS.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newBmBirthday}
                          onChange={(e) => setNewBmBirthday(e.target.value)}
                          placeholder="Birthday (e.g. 14 May)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmHobbies}
                          onChange={(e) => setNewBmHobbies(e.target.value)}
                          placeholder="Hobbies & Interests"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmDreamGoal}
                          onChange={(e) => setNewBmDreamGoal(e.target.value)}
                          placeholder="Dream / Future Goal"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmHangoutSpot}
                          onChange={(e) => setNewBmHangoutSpot(e.target.value)}
                          placeholder="Favorite Campus Spot"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmSuperpower}
                          onChange={(e) => setNewBmSuperpower(e.target.value)}
                          placeholder="Hidden Talent / Superpower"
                          className="sm:col-span-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={newBmFavoriteMemory}
                          onChange={(e) => setNewBmFavoriteMemory(e.target.value)}
                          placeholder="Favorite RCS Memory"
                          className="sm:col-span-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5 items-center">
                        <input
                          type="text"
                          value={newBmQuote}
                          onChange={(e) => setNewBmQuote(e.target.value)}
                          placeholder="Yearbook quote (front card)"
                          className="flex-1 w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={() => newBmPhotoInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-200 cursor-pointer shrink-0"
                        >
                          <Camera className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          {newBmPhoto ? 'Photo Ready' : 'Upload Portrait'}
                        </button>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddBm(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Save Member
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Registered Batchmates Directory List */}
                  {filteredBatchmates.length === 0 ? (
                    <div className="p-10 text-center rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800">
                      <Users className="w-7 h-7 text-zinc-400 mx-auto mb-2" />
                      <p className="text-xs text-zinc-700 dark:text-zinc-400">
                        No registered members match your current filters.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredBatchmates.map((bm) => {
                        const isDupRoll = analytics.duplicateRolls.includes(bm.roll.trim());
                        const isSelected = selectedBmIds.includes(bm.id);
                        return (
                          <div
                            key={bm.id}
                            className={`p-3.5 rounded-xl bg-white dark:bg-[#111116] border shadow-xs dark:shadow-none space-y-3 transition-colors ${
                              isSelected
                                ? 'border-rose-500/70 dark:border-rose-500/60'
                                : 'border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => toggleBmSelection(bm.id)}
                                aria-label={`Select ${bm.name}`}
                                className="mt-2.5 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 shrink-0 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setBmPhotoTargetId(bm.id);
                                  bmPhotoInputRef.current?.click();
                                }}
                                title="Click to upload or replace portrait"
                                className="w-11 h-11 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 hover:border-rose-500 shrink-0 flex items-center justify-center cursor-pointer mt-0.5"
                              >
                                {bm.photo ? (
                                  <img
                                    src={bm.photo}
                                    alt={bm.name}
                                    className="w-full h-full object-cover object-top"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-400">
                                    {getInitials(bm.name)}
                                  </span>
                                )}
                              </button>

                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">
                                    {bm.name}
                                  </p>
                                  {bm.nickname && (
                                    <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                                      "{bm.nickname}"
                                    </span>
                                  )}
                                  <span
                                    className={`text-xs font-mono tabular-nums ${
                                      isDupRoll
                                        ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                        : 'text-zinc-600 dark:text-zinc-400'
                                    }`}
                                  >
                                    Roll {bm.roll || 'N/A'}
                                  </span>
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">· {bm.group}</span>
                                  {bm.bloodGroup && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-rose-700 dark:text-rose-300">
                                      <Droplets className="w-3 h-3" /> {bm.bloodGroup}
                                    </span>
                                  )}
                                </div>

                                {/* Private Admin Contact & Social Strip */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  {bm.email ? (
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300">
                                      <Mail className="w-3 h-3 shrink-0" />
                                      <span className="font-mono text-[11px]">{bm.email}</span>
                                      <button
                                        type="button"
                                        onClick={() => void handleCopySingleBmEmail(bm.id, bm.email!)}
                                        title="Copy this email"
                                        className="ml-1 text-emerald-700 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-white cursor-pointer"
                                      >
                                        {copiedBmEmailId === bm.id ? (
                                          <Check className="w-3 h-3" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-500 italic">
                                      No email provided
                                    </span>
                                  )}

                                  {bm.phone && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                                      <Phone className="w-3 h-3 text-zinc-500" /> {bm.phone}
                                    </span>
                                  )}

                                  {bm.social && (
                                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                      {bm.social}
                                    </span>
                                  )}

                                  {bm.registeredAt && (
                                    <span className="text-[11px] font-mono text-zinc-500">
                                      Reg: {bm.registeredAt}
                                    </span>
                                  )}
                                </div>

                                {/* Flip Card Dossier Details */}
                                {(bm.hobbies ||
                                  bm.dreamGoal ||
                                  bm.hangoutSpot ||
                                  bm.birthday ||
                                  bm.superpower ||
                                  bm.favoriteMemory ||
                                  bm.quote) && (
                                  <div className="pt-1 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-zinc-700 dark:text-zinc-400">
                                    {bm.hobbies && (
                                      <p className="truncate">
                                        <Heart className="w-3 h-3 inline mr-1 text-rose-500" />
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">Hobbies:</span>{' '}
                                        {bm.hobbies}
                                      </p>
                                    )}
                                    {bm.dreamGoal && (
                                      <p className="truncate">
                                        <Compass className="w-3 h-3 inline mr-1 text-amber-500" />
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">Dream:</span>{' '}
                                        {bm.dreamGoal}
                                      </p>
                                    )}
                                    {bm.hangoutSpot && (
                                      <p className="truncate">
                                        <MapPin className="w-3 h-3 inline mr-1 text-emerald-500" />
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">Spot:</span>{' '}
                                        {bm.hangoutSpot}
                                      </p>
                                    )}
                                    {bm.birthday && (
                                      <p className="truncate">
                                        <Cake className="w-3 h-3 inline mr-1 text-rose-500" />
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">B&apos;day:</span>{' '}
                                        {bm.birthday}
                                      </p>
                                    )}
                                    {bm.superpower && (
                                      <p className="truncate">
                                        <Sparkles className="w-3 h-3 inline mr-1 text-amber-500" />
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">Talent:</span>{' '}
                                        {bm.superpower}
                                      </p>
                                    )}
                                    {bm.favoriteMemory && (
                                      <p className="truncate">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">Memory:</span>{' '}
                                        {bm.favoriteMemory}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {bm.email && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomMailIds([bm.id]);
                                      setMailRecipientMode('custom');
                                      document
                                        .getElementById('admin-send-mail')
                                        ?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    title="Send mail to this member"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBmPhotoTargetId(bm.id);
                                    bmPhotoInputRef.current?.click();
                                  }}
                                  title="Upload / change portrait"
                                  className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 cursor-pointer"
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
                                      ? 'bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white font-semibold'
                                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200'
                                  }`}
                                >
                                  {editingBmId === bm.id ? 'Save' : 'Edit'}
                                </button>

                                {confirmDeleteBmId === bm.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBatchmate(bm.id)}
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteBmId(null)}
                                      className="px-2 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteBmId(bm.id)}
                                    title="Remove batchmate"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 hover:text-white hover:border-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {editingBmId === bm.id && (
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2.5 border-t border-zinc-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  value={bm.name}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'name', e.target.value)}
                                  placeholder="Full Name"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.nickname || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'nickname', e.target.value)}
                                  placeholder="Nickname"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.roll}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'roll', e.target.value)}
                                  placeholder="Roll"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.group}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'group', e.target.value)}
                                  placeholder="Group"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="email"
                                  value={bm.email || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'email', e.target.value)}
                                  placeholder="Email (admin private)"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="tel"
                                  value={bm.phone || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'phone', e.target.value)}
                                  placeholder="Phone (admin private)"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.social || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'social', e.target.value)}
                                  placeholder="Social handle"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <select
                                  value={bm.bloodGroup || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'bloodGroup', e.target.value)}
                                  aria-label={`Blood group for ${bm.name}`}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                >
                                  <option value="">Blood Group</option>
                                  {BLOOD_GROUP_OPTIONS.map((bg) => (
                                    <option key={bg} value={bg}>
                                      {bg}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={bm.birthday || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'birthday', e.target.value)}
                                  placeholder="Birthday"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.hobbies || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'hobbies', e.target.value)}
                                  placeholder="Hobbies & Interests"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.dreamGoal || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'dreamGoal', e.target.value)}
                                  placeholder="Dream / Goal"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.hangoutSpot || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'hangoutSpot', e.target.value)}
                                  placeholder="Favorite Hangout Spot"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.superpower || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'superpower', e.target.value)}
                                  placeholder="Hidden Talent / Superpower"
                                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.favoriteMemory || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'favoriteMemory', e.target.value)}
                                  placeholder="Favorite RCS Memory"
                                  className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={bm.quote || ''}
                                  onChange={(e) => handleUpdateBatchmateField(bm.id, 'quote', e.target.value)}
                                  placeholder="Bio / Quote"
                                  className="sm:col-span-2 lg:col-span-3 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SEND MAIL STUDIO AT THE BOTTOM */}
                  <section
                    id="admin-send-mail"
                    className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-sm dark:shadow-none space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-700 dark:text-rose-400">
                          Batch Communication Studio
                        </p>
                        <h3 className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          Send Mail with Ready Templates
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                          Select recipients, pick a template, customize the draft, and launch your Phone or PC Mail app directly.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Address Mode:</span>
                        <div className="inline-flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => setMailAddressField('bcc')}
                            className={`px-2.5 py-1 font-semibold cursor-pointer ${
                              mailAddressField === 'bcc'
                                ? 'bg-rose-600 text-white'
                                : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            BCC
                          </button>
                          <button
                            type="button"
                            onClick={() => setMailAddressField('to')}
                            className={`px-2.5 py-1 font-semibold cursor-pointer ${
                              mailAddressField === 'to'
                                ? 'bg-rose-600 text-white'
                                : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            To
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 1: Recipient Selector */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                          1. Recipients ({resolvedMailDraft.emails.length} email{resolvedMailDraft.emails.length !== 1 ? 's' : ''} ready)
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setMailRecipientMode('filtered')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              mailRecipientMode === 'filtered'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            All Filtered ({filteredBatchmateEmails.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setMailRecipientMode('selected')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              mailRecipientMode === 'selected'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Checked Rows ({selectedBatchmateEmails.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setMailRecipientMode('custom')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              mailRecipientMode === 'custom'
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800'
                            }`}
                          >
                            Pick Members Individually
                          </button>
                        </div>
                      </div>

                      {mailRecipientMode === 'custom' && (
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                          {membersWithEmail.length === 0 ? (
                            <p className="text-xs text-zinc-500">
                              No registered members have an email address saved yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {membersWithEmail.map((m) => {
                                const active = customMailIds.includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => toggleCustomMailRecipient(m.id)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                                      active
                                        ? 'bg-rose-600 border-rose-600 text-white font-semibold'
                                        : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 hover:border-rose-500'
                                    }`}
                                  >
                                    {active ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    <span>{m.name}</span>
                                    <span className="font-mono opacity-80">({m.email})</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                        <span className="truncate">
                          {resolvedMailDraft.emails.length > 0
                            ? `${mailAddressField.toUpperCase()}: ${resolvedMailDraft.joined}`
                            : 'No recipient emails selected yet. Register members with email or switch filter.'}
                        </span>
                        {resolvedMailDraft.emails.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyEmailList(resolvedMailDraft.emails, 'mail recipients', 'mail_recips')
                            }
                            className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 hover:underline font-sans font-semibold shrink-0 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedBulkEmailsMode === 'mail_recips' ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Ready-Made Templates */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                        2. Choose a Template
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {ADMIN_MAIL_TEMPLATES.map((tpl) => {
                          const active = selectedMailTemplateId === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelectMailTemplate(tpl.id)}
                              className={`text-left p-3 rounded-xl border transition-colors cursor-pointer space-y-1 ${
                                active
                                  ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-500 text-zinc-950 dark:text-white'
                                  : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                {tpl.tag}
                              </p>
                              <p className="text-xs font-semibold truncate">{tpl.label}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 3: Subject & Body Editor */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                          3. Customize Subject &amp; Message
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span>Insert:</span>
                          {['{name}', '{roll}', '{group}'].map((token) => (
                            <button
                              key={token}
                              type="button"
                              onClick={() => setMailBody((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${token}`)}
                              className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-mono text-[11px] text-zinc-900 dark:text-zinc-200 cursor-pointer"
                            >
                              {token}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={mailSubject}
                        onChange={(e) => setMailSubject(e.target.value)}
                        placeholder="Email subject..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                      />

                      <textarea
                        rows={7}
                        value={mailBody}
                        onChange={(e) => setMailBody(e.target.value)}
                        placeholder="Write your email body..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 leading-relaxed focus:outline-none focus:border-rose-500 resize-y"
                      />
                    </div>

                    {/* Step 4: Launch Phone/PC Mail App or Gmail Web */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        Opens your phone or PC default Mail app / Gmail directly with recipients, subject &amp; message pre-filled.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyMailDraft()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Draft
                        </button>
                        <a
                          href={resolvedMailDraft.gmailHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open Gmail Web
                        </a>
                        <a
                          href={resolvedMailDraft.mailtoHref}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {resolvedMailDraft.emails.length > 0
                            ? `Open Mail App (${resolvedMailDraft.emails.length})`
                            : 'Open Mail App'}
                        </a>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 5: GALLERY */}
              {activeTab === 'gallery' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-700 dark:text-zinc-400">
                      <span className="font-mono font-semibold text-zinc-950 dark:text-white">{state.gallery.length}</span> gallery items · reorder,
                      add photos, or link videos
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddVideo((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-white text-xs font-medium cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Add Video Memory
                      </button>
                      <button
                        type="button"
                        onClick={() => addPhotosInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Upload Photos
                      </button>
                    </div>
                  </div>

                  {showAddVideo && (
                    <form
                      onSubmit={handleAddVideoMemory}
                      className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3"
                    >
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">New Facebook / External Video Memory</p>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          required
                          value={videoTitle}
                          onChange={(e) => setVideoTitle(e.target.value)}
                          placeholder="Video title *"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                        <input
                          type="text"
                          value={videoDate}
                          onChange={(e) => setVideoDate(e.target.value)}
                          placeholder="Date (e.g. November 2026)"
                          className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <input
                        type="url"
                        required
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://www.facebook.com/share/v/..."
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                      <input
                        type="text"
                        value={videoCaption}
                        onChange={(e) => setVideoCaption(e.target.value)}
                        placeholder="Caption"
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddVideo(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
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
                        className="p-3 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none flex flex-col sm:flex-row gap-3 items-start sm:items-center"
                      >
                        {item.src ? (
                          <img
                            src={item.src}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-20 h-16 rounded-lg object-cover shrink-0 bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800"
                          />
                        ) : (
                          <div className="w-20 h-16 rounded-lg shrink-0 bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center text-zinc-500">
                            {item.isVideo ? <Video className="w-5 h-5 text-rose-600 dark:text-rose-400" /> : <ImageIcon className="w-5 h-5" />}
                          </div>
                        )}

                        <div className="flex-1 w-full space-y-2">
                          <div className="grid sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                handleUpdateGalleryField(item.id, 'title', e.target.value, idx)
                              }
                              onBlur={() => void flushGalleryItem(item.id)}
                              placeholder="Title"
                              className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                            />
                            <input
                              type="text"
                              value={item.date || ''}
                              onChange={(e) =>
                                handleUpdateGalleryField(item.id, 'date', e.target.value, idx)
                              }
                              onBlur={() => void flushGalleryItem(item.id)}
                              placeholder="Date"
                              className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-300"
                            />
                          </div>
                          <input
                            type="text"
                            value={item.caption}
                            onChange={(e) =>
                              handleUpdateGalleryField(item.id, 'caption', e.target.value, idx)
                            }
                            onBlur={() => void flushGalleryItem(item.id)}
                            placeholder="Caption"
                            className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-300"
                          />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleSaveGalleryItem(item, idx)}
                            title="Save changes"
                            className="p-2 rounded-lg bg-zinc-100 hover:bg-emerald-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-200 hover:text-white hover:border-emerald-600 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveGallery(idx, -1)}
                            disabled={idx === 0}
                            title="Move up"
                            className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveGallery(idx, 1)}
                            disabled={idx === state.gallery.length - 1}
                            title="Move down"
                            className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 disabled:opacity-30 cursor-pointer"
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
                            className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-200 cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteGalleryId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteGallery(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteGalleryId(null)}
                                className="px-2 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteGalleryId(item.id)}
                              title="Delete"
                              className="p-2 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 hover:text-white hover:border-rose-600 cursor-pointer"
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
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                    <div>
                      <p className="text-sm font-bold text-zinc-950 dark:text-white">Direct Ordering Status</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
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
                        hc.directOrderOpen
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      {hc.directOrderOpen ? 'Direct Orders Open' : 'Direct Orders Paused'}
                    </button>
                  </div>

                  {/* Front & Back RCS Hoodie Image Controls */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">RCS Hoodie — Front Pic</p>
                      <img
                        src={hc.frontImage}
                        alt="Hoodie front"
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950"
                      />
                      <input
                        type="text"
                        value={hc.frontLabel || ''}
                        onChange={(e) => updateHoodieField('frontLabel', e.target.value)}
                        placeholder="Front view subtitle (e.g. RCS chest crest)"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHoodieSideTarget('frontImage');
                          hoodiePhotoInputRef.current?.click();
                        }}
                        className="w-full py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Change Front Pic
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">RCS Hoodie — Back Pic</p>
                      <img
                        src={hc.backImage}
                        alt="Hoodie back"
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950"
                      />
                      <input
                        type="text"
                        value={hc.backLabel || ''}
                        onChange={(e) => updateHoodieField('backLabel', e.target.value)}
                        placeholder="Back view subtitle (e.g. Orthohin '27 print)"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHoodieSideTarget('backImage');
                          hoodiePhotoInputRef.current?.click();
                        }}
                        className="w-full py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Change Back Pic
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Merchandise Kicker</label>
                      <input
                        type="text"
                        value={hc.kicker || ''}
                        onChange={(e) => updateHoodieField('kicker', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Hoodie Page Title</label>
                      <input
                        type="text"
                        value={hc.title}
                        onChange={(e) => updateHoodieField('title', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Hoodie Subtitle</label>
                      <textarea
                        rows={2}
                        value={hc.subtitle}
                        onChange={(e) => updateHoodieField('subtitle', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400">
                          Specifications ({hc.specs.length} lines)
                        </label>
                        <button
                          type="button"
                          onClick={() => updateHoodieField('specs', [...hc.specs, 'New Hoodie Specification'])}
                          className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-medium cursor-pointer"
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
                              updateHoodieField('specs', nextSpecs);
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          {hc.specs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextSpecs = hc.specs.filter((_, idx) => idx !== i);
                                updateHoodieField('specs', nextSpecs);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-700 dark:text-zinc-400 hover:text-white hover:border-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() =>
                          void persistSettings(state.profile, hc, sc, 'Hoodie page changes synced live.')
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Sync Now
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-zinc-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Hoodie Defaults
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6B: ADMIN PANEL ORGANIZER TEAM MANAGEMENT */}
              {activeTab === 'team' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleAddTeamMember}
                    className="p-5 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                          Add Organizer to Public "Admin Panel" Page
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                          Everyone added here appears publicly on the Admin Panel page with their photo, role, and info.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                        {newTeamPhoto ? (
                          <img src={newTeamPhoto} alt="New organizer preview" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-zinc-500">
                            {newTeamName ? getInitials(newTeamName) : 'PIC'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => newTeamPhotoInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" /> {newTeamPhoto ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        {newTeamPhoto && (
                          <button
                            type="button"
                            onClick={() => setNewTeamPhoto('')}
                            className="px-3 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Full Name *"
                        className="px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                      <input
                        type="text"
                        required
                        value={newTeamRole}
                        onChange={(e) => setNewTeamRole(e.target.value)}
                        placeholder="Role (e.g. Batch Coordinator) *"
                        className="px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                      <input
                        type="text"
                        value={newTeamSocial}
                        onChange={(e) => setNewTeamSocial(e.target.value)}
                        placeholder="Instagram / Social URL or @handle"
                        className="px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>

                    <textarea
                      rows={2}
                      value={newTeamBio}
                      onChange={(e) => setNewTeamBio(e.target.value)}
                      placeholder="Short info, responsibility, or batch message..."
                      className="w-full px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 resize-none"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to Admin Panel
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {currentTeamList.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                        No organizers added yet. Use the form above to add admins running Orthohin '27.
                      </div>
                    ) : (
                      currentTeamList.map((member, idx) => {
                        const isEditing = editingTeamId === member.id && teamDraft;
                        return (
                          <div
                            key={member.id}
                            className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="w-14 h-14 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                                    {teamDraft.photo ? (
                                      <img src={teamDraft.photo} alt={teamDraft.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-zinc-500">
                                        {getInitials(teamDraft.name)}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamPhotoTargetId(member.id);
                                      editTeamPhotoInputRef.current?.click();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
                                  >
                                    <Upload className="w-3.5 h-3.5" /> Change Photo
                                  </button>
                                  {teamDraft.photo && (
                                    <button
                                      type="button"
                                      onClick={() => setTeamDraft({ ...teamDraft, photo: undefined })}
                                      className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-rose-600 dark:text-zinc-400 cursor-pointer"
                                    >
                                      Remove Photo
                                    </button>
                                  )}
                                </div>
                                <div className="grid sm:grid-cols-3 gap-2.5">
                                  <input
                                    type="text"
                                    value={teamDraft.name}
                                    onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })}
                                    placeholder="Full Name"
                                    className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                  />
                                  <input
                                    type="text"
                                    value={teamDraft.role}
                                    onChange={(e) => setTeamDraft({ ...teamDraft, role: e.target.value })}
                                    placeholder="Role / Designation"
                                    className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                  />
                                  <input
                                    type="text"
                                    value={teamDraft.social || ''}
                                    onChange={(e) => setTeamDraft({ ...teamDraft, social: e.target.value })}
                                    placeholder="Social URL or @handle"
                                    className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                                  />
                                </div>
                                <textarea
                                  rows={2}
                                  value={teamDraft.bio}
                                  onChange={(e) => setTeamDraft({ ...teamDraft, bio: e.target.value })}
                                  placeholder="Organizer info / bio"
                                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={isSyncing}
                                    onClick={() => void handleSaveTeamDraft()}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    <Save className="w-3.5 h-3.5" /> Save Changes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTeamId(null);
                                      setTeamDraft(null);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5 min-w-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                                    {member.photo ? (
                                      <img
                                        src={member.photo}
                                        alt={member.name}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover object-[center_22%]"
                                      />
                                    ) : (
                                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                                        {getInitials(member.name)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 truncate">
                                      {member.role}
                                    </p>
                                    <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                                      {member.name}
                                    </h4>
                                    {member.bio && (
                                      <p className="text-xs text-zinc-700 dark:text-zinc-400 line-clamp-2">
                                        {member.bio}
                                      </p>
                                    )}
                                    {member.social && (
                                      <p className="text-[11px] font-mono text-zinc-500 truncate">{member.social}</p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => void handleMoveTeamMember(idx, -1)}
                                    title="Move up"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 disabled:opacity-40 cursor-pointer"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === currentTeamList.length - 1}
                                    onClick={() => void handleMoveTeamMember(idx, 1)}
                                    title="Move down"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 disabled:opacity-40 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamPhotoTargetId(member.id);
                                      editTeamPhotoInputRef.current?.click();
                                    }}
                                    title="Update photo"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 cursor-pointer"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTeamId(member.id);
                                      setTeamDraft({ ...member });
                                    }}
                                    title="Edit info"
                                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  {confirmDeleteTeamId === member.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteTeamMember(member.id)}
                                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteTeamId(null)}
                                        className="px-2 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-[11px] text-zinc-800 dark:text-zinc-300 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteTeamId(member.id)}
                                      title="Delete"
                                      className="p-2 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-white cursor-pointer"
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

              {/* TAB 7: FULL SITE STUDIO (EVERY PART OF THE WEB) */}
              {activeTab === 'site' && (
                <div className="space-y-6">
                  {/* Sub-Navigation Pills */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800">
                      {(
                        [
                          { id: 'global', label: 'Global & Visibility' },
                          { id: 'hero', label: 'Hero & KPIs' },
                          { id: 'about', label: 'About & Social' },
                          { id: 'leadership', label: 'Admin Panel Header' },
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
                              : 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
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
                        void persistSettings(state.profile, hc, sc, 'All website changes synced live.')
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> Sync Now
                    </button>
                  </div>

                  {/* SUB 1: GLOBAL, BRANDING, SECTION VISIBILITY & MAINTENANCE */}
                  {siteSubTab === 'global' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Section Visibility & Page Access</h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          Show or hide any section or navigation link across the entire website instantly.
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {(
                            [
                              { key: 'notices', label: 'Notice Board Section' },
                              { key: 'about', label: 'About & Instagram Hub' },
                              { key: 'gallery', label: 'Memory Vault Gallery' },
                              { key: 'directory', label: 'Admin Panel Page' },
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
                                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 flex items-center justify-between gap-2 text-xs cursor-pointer"
                              >
                                <span className="text-zinc-900 dark:text-zinc-200 font-medium">{item.label}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    enabled
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-400'
                                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-500'
                                  }`}
                                >
                                  {enabled ? 'Shown' : 'Hidden'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Portal Header Branding & Banner</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-zinc-700 dark:text-zinc-400 mb-1">Brand Wordmark</label>
                            <input
                              type="text"
                              value={sc.brandName || ''}
                              onChange={(e) => updateSiteField('brandName', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-zinc-700 dark:text-zinc-400 mb-1">Brand Accent (Year)</label>
                            <input
                              type="text"
                              value={sc.brandAccent || ''}
                              onChange={(e) => updateSiteField('brandAccent', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-700 dark:text-zinc-400 mb-1">Site-Wide Announcement Banner</label>
                          <input
                            type="text"
                            value={sc.announcement}
                            onChange={(e) => updateSiteField('announcement', e.target.value)}
                            placeholder="Optional top banner text (leave blank to hide)"
                            className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-700 dark:text-zinc-400 mb-1">Footer Copyright Text</label>
                          <input
                            type="text"
                            value={sc.footerText || ''}
                            onChange={(e) => updateSiteField('footerText', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Maintenance Lock Screen</h3>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              Pause public portal access during major updates (/rcs-admin always stays open).
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateSiteField('maintenanceMode', !sc.maintenanceMode)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              sc.maintenanceMode
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300'
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
                          className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB 2: HERO SECTION, HERO IMAGE & 4 KPI CARDS */}
                  {siteSubTab === 'hero' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Hero Text & Copy</h3>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={sc.heroKicker}
                            onChange={(e) => updateSiteField('heroKicker', e.target.value)}
                            placeholder="Hero kicker"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={sc.heroTitle}
                            onChange={(e) => updateSiteField('heroTitle', e.target.value)}
                            placeholder="Hero title"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={sc.heroHighlight}
                            onChange={(e) => updateSiteField('heroHighlight', e.target.value)}
                            placeholder="Highlighted phrase"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={sc.heroDescription}
                          onChange={(e) => updateSiteField('heroDescription', e.target.value)}
                          placeholder="Hero description"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                        />
                      </div>

                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-4">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Hero Showcase Image</h3>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <img
                            src={sc.heroImage || DEFAULT_HERO_IMAGE}
                            alt="Hero showcase preview"
                            referrerPolicy="no-referrer"
                            className="w-36 h-24 rounded-xl object-cover border border-zinc-300 dark:border-zinc-800 bg-white shrink-0"
                          />
                          <div className="flex-1 w-full space-y-2.5">
                            <input
                              type="text"
                              value={sc.heroImage || ''}
                              onChange={(e) => updateSiteField('heroImage', e.target.value)}
                              placeholder="Image URL or upload below"
                              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => heroPhotoInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                              >
                                <Upload className="w-3.5 h-3.5" /> Upload Hero Image
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSiteField('heroImage', DEFAULT_HERO_IMAGE)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs cursor-pointer"
                              >
                                Reset Default Sketch
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">4 Homepage Stat KPI Cards</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {(sc.kpis || []).map((kpi, idx) => (
                            <div
                              key={kpi.id || idx}
                              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 space-y-2"
                            >
                              <div className="flex items-center justify-between text-[11px] text-zinc-700 dark:text-zinc-400">
                                <span className="font-medium">KPI Card #{idx + 1}</span>
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
                                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white disabled:opacity-50"
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
                                  className="col-span-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
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
                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">About Section & Pillar Cards</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={sc.aboutKicker || ''}
                            onChange={(e) => updateSiteField('aboutKicker', e.target.value)}
                            placeholder="Section kicker"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={sc.aboutTitle || ''}
                            onChange={(e) => updateSiteField('aboutTitle', e.target.value)}
                            placeholder="Section heading"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                        <textarea
                          rows={3}
                          value={sc.aboutDescription || ''}
                          onChange={(e) => updateSiteField('aboutDescription', e.target.value)}
                          placeholder="About body description"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                        />
                        <div className="grid sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
                            <input
                              type="text"
                              value={sc.visionTitle || ''}
                              onChange={(e) => updateSiteField('visionTitle', e.target.value)}
                              placeholder="Card 1 Title"
                              className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white font-semibold"
                            />
                            <textarea
                              rows={2}
                              value={sc.visionText || ''}
                              onChange={(e) => updateSiteField('visionText', e.target.value)}
                              placeholder="Card 1 Description"
                              className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                            />
                          </div>
                          <div className="space-y-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
                            <input
                              type="text"
                              value={sc.unityTitle || ''}
                              onChange={(e) => updateSiteField('unityTitle', e.target.value)}
                              placeholder="Card 2 Title"
                              className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white font-semibold"
                            />
                            <textarea
                              rows={2}
                              value={sc.unityText || ''}
                              onChange={(e) => updateSiteField('unityText', e.target.value)}
                              placeholder="Card 2 Description"
                              className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Instagram Showcase Card</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={sc.instagramHandle || ''}
                            onChange={(e) => updateSiteField('instagramHandle', e.target.value)}
                            placeholder="@orthohin_27"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="url"
                            value={sc.instagramUrl}
                            onChange={(e) => updateSiteField('instagramUrl', e.target.value)}
                            placeholder="https://www.instagram.com/..."
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={sc.instagramBio || ''}
                          onChange={(e) => updateSiteField('instagramBio', e.target.value)}
                          placeholder="Instagram card description"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB 4: LEADERSHIP DIRECTORY & PROFILE */}
                  {siteSubTab === 'leadership' && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-3">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Leadership Card & Copy</h3>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={sc.leadSectionKicker || ''}
                            onChange={(e) => updateSiteField('leadSectionKicker', e.target.value)}
                            placeholder="Section kicker"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={sc.leadSectionTitle || ''}
                            onChange={(e) => updateSiteField('leadSectionTitle', e.target.value)}
                            placeholder="Section title"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={sc.leadSectionSubtitle || ''}
                            onChange={(e) => updateSiteField('leadSectionSubtitle', e.target.value)}
                            placeholder="Section subtitle"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={sc.leadRole || ''}
                            onChange={(e) => updateSiteField('leadRole', e.target.value)}
                            placeholder="Role badge"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={sc.leadName || ''}
                            onChange={(e) => updateSiteField('leadName', e.target.value)}
                            placeholder="Lead full name"
                            className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={sc.devNote}
                          onChange={(e) => updateSiteField('devNote', e.target.value)}
                          placeholder="Developer note"
                          className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white resize-none"
                        />
                      </div>

                      <div className="space-y-4 p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                        <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Leadership Profile Photo</h3>
                        <div className="flex items-center gap-4">
                          <img
                            src={state.profile || DEFAULT_PROFILE_IMAGE}
                            alt="Lead profile preview"
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-xl object-cover object-[center_22%] border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950"
                          />
                          <input
                            id="lead-profile-url-input"
                            type="text"
                            value={profileUrlInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProfileUrlInput(val);
                              const trimmed = val.trim();
                              if (trimmed.length > 0) {
                                onUpdateState({ ...state, profile: trimmed });
                                scheduleSettingsAutoSave(trimmed, hc, sc);
                              }
                            }}
                            className="flex-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => profilePhotoInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload New Photo
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => {
                              const nextProf = profileUrlInput.trim() || DEFAULT_PROFILE_IMAGE;
                              onUpdateState({ ...state, profile: nextProf });
                              void persistSettings(nextProf, hc, sc, 'Profile URL applied live.');
                            }}
                            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs font-medium cursor-pointer"
                          >
                            Apply URL
                          </button>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => {
                              setProfileUrlInput(DEFAULT_PROFILE_IMAGE);
                              onUpdateState({ ...state, profile: DEFAULT_PROFILE_IMAGE });
                              void persistSettings(DEFAULT_PROFILE_IMAGE, hc, sc, 'Profile photo reset.');
                            }}
                            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs font-medium cursor-pointer"
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
                        <p className="text-xs text-zinc-700 dark:text-zinc-400">
                          Add, edit, reorder, or remove milestones in the "Our Journey" timeline.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddTimeline}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Milestone
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(sc.timeline || []).map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none space-y-2.5"
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
                                className="sm:w-36 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-rose-700 dark:text-rose-400"
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
                                className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white font-semibold"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveTimeline(idx, -1)}
                                  className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === (sc.timeline || []).length - 1}
                                  onClick={() => handleMoveTimeline(idx, 1)}
                                  className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 disabled:opacity-30 cursor-pointer"
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
                                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-rose-600 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-800 dark:text-zinc-300 hover:text-white hover:border-rose-600 cursor-pointer"
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
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-300 resize-none"
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs text-zinc-900 dark:text-zinc-200 cursor-pointer"
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
                  <div className="space-y-2 p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Backup & Restore</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Export all batchmates, direct orders, gallery items, and settings as JSON, or restore from a
                      saved backup.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Export Backup JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => importBackupInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-white cursor-pointer"
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
                                broadcastLiveSync();
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
                            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Confirm Full Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmReset(false)}
                            className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-300 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-xs font-medium text-zinc-900 dark:text-zinc-300 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset All Data
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Password & Auth */}
                  <div className="space-y-3 p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Authorization & Passcode</h3>
                      <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        {authorizedAdmin || AUTHORIZED_ADMIN_EMAIL}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New passcode (min 6 characters)"
                        className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={handleSavePassword}
                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Update Passcode
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetAdminPassword(authorizedAdmin || AUTHORIZED_ADMIN_EMAIL);
                          onToast('Admin passcode reset to default.', 'info');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs font-medium cursor-pointer"
                      >
                        Restore Default
                      </button>
                    </div>
                  </div>

                  {/* Activity Log */}
                  <div className="space-y-3 p-4 rounded-xl bg-white dark:bg-[#111116] border border-zinc-300 dark:border-zinc-800 shadow-xs dark:shadow-none">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Recent Activity Log</h3>
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="Filter activity..."
                        className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {filteredLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-3 text-xs py-1.5 border-b border-zinc-200 dark:border-zinc-800/70 last:border-0"
                        >
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-200">{entry.action}</span>
                            <span className="text-zinc-600 dark:text-zinc-400"> — {entry.detail}</span>
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
        ref={newTeamPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleNewTeamPhotoUpload}
        className="hidden"
      />
      <input
        ref={editTeamPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleEditTeamPhotoUpload}
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
