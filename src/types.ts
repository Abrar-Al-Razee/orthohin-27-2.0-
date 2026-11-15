export type ViewMode = 'home' | 'batchmates' | 'hoodie';

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
  title: string;
  subtitle: string;
  frontImage: string;
  backImage: string;
  specs: string[];
  directOrderOpen: boolean;
}

export interface SiteConfig {
  heroKicker: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  announcement: string;
  instagramUrl: string;
  devNote: string;
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
