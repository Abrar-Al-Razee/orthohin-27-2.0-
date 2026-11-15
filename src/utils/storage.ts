import type {
  ActivityLogEntry,
  Batchmate,
  BatchNotice,
  GalleryItem,
  HoodieConfig,
  HoodieOrder,
  PortalState,
  SiteConfig,
} from '../types';

export const STORAGE_KEY = 'orthohin27_site_v2';
export const PASS_KEY = 'orthohin27_admin_pass_v2';
export const AUTHORIZED_ADMIN_EMAIL = 'abraralraze@gmail.com';
export const DEFAULT_ADMIN_PASS = 'axxro.jorji7';

export const RCS_HOODIE_FRONT = '/src/assets/images/rcs_hoodie_front_1794767005760.jpg';
export const RCS_HOODIE_BACK = '/src/assets/images/rcs_hoodie_back_1794767006362.jpg';
export const DEFAULT_PROFILE_IMAGE = '/assets/aistudio/WhatsApp_Image_2026-03-17_at_12.59.53_PM_a803b14f.jpeg';

export const SAMPLE_BATCHMATES: Batchmate[] = [
  {
    id: 'bm-1',
    name: 'Abrar Al Razee Oytizzoh',
    roll: '2701',
    group: 'Science',
    social: '@oytizzoh',
    quote: 'Building the digital archive for Class of 2027 so every memory outlives graduation.',
    photo: DEFAULT_PROFILE_IMAGE,
    registeredAt: '2026-01-12',
  },
  {
    id: 'bm-2',
    name: 'Tasnim Ahmed',
    roll: '2702',
    group: 'Science',
    social: '@tasnim.27',
    quote: 'Late-night physics prep, courtyard coffee runs, and the best cohort we could ask for.',
    registeredAt: '2026-01-15',
  },
  {
    id: 'bm-3',
    name: 'Raihan Islam',
    roll: '2703',
    group: 'Commerce',
    social: '@raihan_is',
    quote: 'From inter-batch football finals to organizing cultural night.',
    registeredAt: '2026-01-18',
  },
  {
    id: 'bm-4',
    name: 'Nafisa Chowdhury',
    roll: '2704',
    group: 'Humanities',
    social: '@nafisa.ch',
    quote: 'Debate club afternoons and photography walks across campus.',
    registeredAt: '2026-01-21',
  },
  {
    id: 'bm-5',
    name: 'Farhan Sadik',
    roll: '2705',
    group: 'Science',
    social: '@farhan27',
    quote: 'Every milestone feels lighter when the whole batch shows up.',
    registeredAt: '2026-01-24',
  },
  {
    id: 'bm-6',
    name: 'Meherab Hossain',
    roll: '2706',
    group: 'Commerce',
    social: '@meherab.h',
    quote: 'Ready for the hoodie drop and the final stretch toward 2027.',
    registeredAt: '2026-02-02',
  },
];

export const DEFAULT_GALLERY: GalleryItem[] = [
  {
    id: 'gal-1',
    src: '',
    title: 'Annual Cultural Night & Acoustic Evening',
    caption: 'Courtyard performances under string lights with the entire 2027 cohort.',
    date: 'October 2026',
    isVideo: true,
    videoUrl: 'https://www.facebook.com/share/v/1EQKpXcSqm/',
  },
  {
    id: 'gal-2',
    src: '',
    title: 'Inter-Batch Floodlit Championship',
    caption: 'Final whistle celebration on the main turf after clinching the trophy.',
    date: 'September 2026',
    isVideo: true,
    videoUrl: 'https://www.facebook.com/share/v/1EQKpXcSqm/',
  },
  {
    id: 'gal-3',
    src: '',
    title: 'Upcoming Campus Memories',
    caption: 'Add real batch photography anytime from the Admin Panel.',
    date: 'November 2026',
    isVideo: false,
  },
];

export const DEFAULT_HOODIE_CONFIG: HoodieConfig = {
  title: "RCS HOODIE '26-'27",
  subtitle:
    "The official Orthohin '27 RCS batch hoodie is here! Premium heavyweight fleece fabric, custom embroidery, and sleek winter styling.",
  frontImage: RCS_HOODIE_FRONT,
  backImage: RCS_HOODIE_BACK,
  specs: [
    '350 GSM Heavyweight Cotton Fleece',
    'High-Density Batch Embroidery on Chest (Front)',
    "Signature RCS Orthohin '27 Print on Back",
    'Available Sizes: S, M, L, XL, XXL, XXXL',
  ],
  directOrderOpen: true,
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  heroKicker: 'Official Batch Archive · Class of 2027',
  heroTitle: 'The Unstoppable',
  heroHighlight: "Orthohin '27",
  heroDescription:
    'Resilient, united, and timeless. Welcome to the official digital hub of Batch 2027 — preserving our memories, celebrating our cohort, and stepping into the future together.',
  announcement: '',
  instagramUrl: 'https://www.instagram.com/orthohin_27/',
  devNote:
    'Designed and built this official portal as Head Orthohin-27 to preserve our batch memories and milestones. Forever united as one batch.',
};

export const SAMPLE_ORDERS: HoodieOrder[] = [];

export const DEFAULT_NOTICES: BatchNotice[] = [
  {
    id: 'notice-1',
    title: "RCS Hoodie '26–'27 Direct Orders Open",
    message:
      'Direct orders for the official RCS Orthohin 27 hoodie (sizes S through XXXL) are now live on the Hoodie page.',
    category: 'General',
    pinned: true,
    active: true,
    createdAt: '2026-11-15',
  },
];

export const INITIAL_ACTIVITY_LOG: ActivityLogEntry[] = [
  {
    id: 'log-init',
    action: 'Portal Initialized',
    detail: "Orthohin '27 portal configured for Rajshahi Collegiate School.",
    timestamp: new Date().toISOString(),
  },
];

export function createDefaultState(): PortalState {
  return {
    gallery: DEFAULT_GALLERY.map((item) => ({ ...item })),
    profile: DEFAULT_PROFILE_IMAGE,
    batchmates: SAMPLE_BATCHMATES.map((item) => ({ ...item })),
    orders: [],
    notices: DEFAULT_NOTICES.map((item) => ({ ...item })),
    hoodieConfig: {
      ...DEFAULT_HOODIE_CONFIG,
      specs: [...DEFAULT_HOODIE_CONFIG.specs],
    },
    siteConfig: { ...DEFAULT_SITE_CONFIG },
    activityLog: [...INITIAL_ACTIVITY_LOG],
  };
}

const REMOVED_STOCK_PREFIXES = [
  '/src/assets/images/gallery_cultural_night_',
  '/src/assets/images/gallery_sports_victory_',
  '/src/assets/images/hero_batch_moment_',
];

export function loadPortalState(): PortalState {
  const defaults = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PortalState>;
    const rawGallery = Array.isArray(parsed.gallery) ? parsed.gallery : defaults.gallery;
    const sanitizedGallery = rawGallery.map((item) => {
      if (item.src && REMOVED_STOCK_PREFIXES.some((prefix) => item.src.startsWith(prefix))) {
        return { ...item, src: '' };
      }
      return item;
    });
    return {
      gallery: sanitizedGallery,
      profile: typeof parsed.profile === 'string' && parsed.profile.trim() ? parsed.profile : defaults.profile,
      batchmates:
        Array.isArray(parsed.batchmates) && parsed.batchmates.length > 0 ? parsed.batchmates : defaults.batchmates,
      orders: Array.isArray(parsed.orders) ? parsed.orders : defaults.orders,
      notices: Array.isArray(parsed.notices) ? parsed.notices : defaults.notices,
      hoodieConfig: parsed.hoodieConfig
        ? {
            ...defaults.hoodieConfig,
            ...parsed.hoodieConfig,
            specs: Array.isArray(parsed.hoodieConfig.specs)
              ? parsed.hoodieConfig.specs
              : defaults.hoodieConfig.specs,
          }
        : defaults.hoodieConfig,
      siteConfig: parsed.siteConfig ? { ...defaults.siteConfig, ...parsed.siteConfig } : defaults.siteConfig,
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : defaults.activityLog,
    };
  } catch {
    return defaults;
  }
}

export function savePortalState(state: PortalState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getAdminPassword(): string {
  try {
    return localStorage.getItem(PASS_KEY) || DEFAULT_ADMIN_PASS;
  } catch {
    return DEFAULT_ADMIN_PASS;
  }
}

export function setAdminPassword(newPass: string): void {
  try {
    localStorage.setItem(PASS_KEY, newPass);
  } catch {
    // Ignore storage error
  }
}

export function resetAdminPassword(): void {
  try {
    localStorage.removeItem(PASS_KEY);
  } catch {
    // Ignore
  }
}

export function appendLog(state: PortalState, action: string, detail: string): ActivityLogEntry[] {
  const entry: ActivityLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    action,
    detail,
    timestamp: new Date().toISOString(),
  };
  return [entry, ...(state.activityLog || [])].slice(0, 50);
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | undefined)[][]): void {
  const escapeCell = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function compressImage(file: File, maxDimension = 900, maxLength = 270000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }

        let currentMaxDim = maxDimension;
        let quality = 0.82;
        let dataUrl = '';

        for (let attempt = 0; attempt < 8; attempt++) {
          const scale = Math.min(1, currentMaxDim / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length <= maxLength) {
            resolve(dataUrl);
            return;
          }

          if (quality > 0.52) {
            quality = Number((quality - 0.14).toFixed(2));
          } else {
            currentMaxDim = Math.max(320, Math.round(currentMaxDim * 0.75));
          }
        }

        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'O27';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
