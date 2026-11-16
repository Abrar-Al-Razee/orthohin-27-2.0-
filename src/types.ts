export type ViewMode =
  | 'home'
  | 'gallery'
  | 'batchmates'
  | 'hoodie'
  | 'directory'
  | 'notices'
  | 'about'
  | 'timeline'
  | 'register'
  | 'admin';

export type OrderStatus = 'Pending' | 'Confirmed' | 'Delivered';

export interface Batchmate {
  id: string;
  name: string;
  roll: string;
  group: string;
  social?: string;
  quote?: string;
  photo?: string;
  registeredAt?: string;
}

export interface GalleryItem {
  id: string;
  src: string;
  title: string;
  caption: string;
  date?: string;
  isVideo?: boolean;
  videoUrl?: string;
}

export type NoticeCategory = 'General' | 'Urgent' | 'Event';

export interface BatchNotice {
  id: string;
  title: string;
  message: string;
  category: NoticeCategory;
  pinned: boolean;
  active: boolean;
  createdAt: string;
}

export interface HoodieOrder {
  id: string;
  customerName: string;
  roll: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
  quantity: number;
  contact: string;
  notes?: string;
  status: OrderStatus;
  createdAt: string;
}

export interface HoodieConfig {
  kicker?: string;
  title: string;
  subtitle: string;
  frontImage: string;
  backImage: string;
  frontLabel?: string;
  backLabel?: string;
  specs: string[];
  directOrderOpen: boolean;
}

export interface TimelineMilestone {
  id: string;
  tag: string;
  title: string;
  description: string;
}

export interface KpiItem {
  id: string;
  value: string;
  label: string;
  autoBatchmateCount?: boolean;
}

export interface SectionVisibility {
  notices: boolean;
  about: boolean;
  gallery: boolean;
  directory: boolean;
  timeline: boolean;
  hoodieNav: boolean;
}

export interface SiteConfig {
  brandName?: string;
  brandAccent?: string;
  heroKicker: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroImage?: string;
  announcement: string;
  instagramUrl: string;
  instagramHandle?: string;
  instagramBio?: string;
  devNote: string;
  aboutKicker?: string;
  aboutTitle?: string;
  aboutDescription?: string;
  visionTitle?: string;
  visionText?: string;
  unityTitle?: string;
  unityText?: string;
  leadSectionKicker?: string;
  leadSectionTitle?: string;
  leadSectionSubtitle?: string;
  leadRole?: string;
  leadName?: string;
  footerText?: string;
  registrationOpen?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  sections?: SectionVisibility;
  kpis?: KpiItem[];
  timeline?: TimelineMilestone[];
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface PortalState {
  gallery: GalleryItem[];
  profile: string;
  batchmates: Batchmate[];
  orders: HoodieOrder[];
  notices: BatchNotice[];
  hoodieConfig: HoodieConfig;
  siteConfig: SiteConfig;
  activityLog: ActivityLogEntry[];
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}
