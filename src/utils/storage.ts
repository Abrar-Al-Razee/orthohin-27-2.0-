import type {
  ActivityLogEntry,
  AdminTeamMember,
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
export const AUTHORIZED_ADMIN_EMAILS = [
  'abraralraze@gmail.com',
  'hisamulhisam208@gmail.com',
] as const;
export const DEFAULT_ADMIN_PASS = 'axxro.jorji7';
export const ADMIN_PASS_BY_EMAIL: Record<string, string> = {
  'abraralraze@gmail.com': DEFAULT_ADMIN_PASS,
  'hisamulhisam208@gmail.com': 'hisamsexvideo',
};

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  return (AUTHORIZED_ADMIN_EMAILS as readonly string[]).includes(normalized);
}
export const HOODIE_UNIT_PRICE = 700;

export const RCS_HOODIE_FRONT = '/src/assets/images/rcs_hoodie_front_1794767005760.jpg';
export const RCS_HOODIE_BACK = '/src/assets/images/rcs_hoodie_back_1794767006362.jpg';
export const DEFAULT_PROFILE_IMAGE = '/assets/aistudio/WhatsApp_Image_2026-03-17_at_12.59.53_PM_a803b14f.jpeg';

export const SAMPLE_BATCHMATES: Batchmate[] = [
  {
    id: 'bm-1',
    name: 'Abrar Al Razee Oytizzoh',
    nickname: 'Oytizzoh',
    roll: '2701',
    group: 'Science',
    social: '@oytizzoh',
    quote: 'Building the digital archive for Class of 2027 so every memory outlives graduation.',
    hobbies: 'Web Development, Photography, Football',
    bloodGroup: 'O+',
    dreamGoal: 'Software Architect & Founder',
    favoriteMemory: 'Launching the official Orthohin 27 portal and floodlit turf nights.',
    hangoutSpot: 'School Main Field & Canteen',
    birthday: '12 Jan',
    superpower: 'Turning late-night ideas into live apps',
    photo: DEFAULT_PROFILE_IMAGE,
    registeredAt: '2026-01-12',
  },
  {
    id: 'bm-2',
    name: 'Tasnim Ahmed',
    nickname: 'Tasnim',
    roll: '2702',
    group: 'Science',
    social: '@tasnim.27',
    quote: 'Late-night physics prep, courtyard coffee runs, and the best cohort we could ask for.',
    hobbies: 'Sketching, Astronomy, Acoustic Guitar',
    bloodGroup: 'A+',
    dreamGoal: 'Aerospace & Robotics Engineer',
    favoriteMemory: 'Rainy afternoon adda after the science exhibition.',
    hangoutSpot: 'RCS Library Corner',
    birthday: '24 Mar',
    superpower: 'Explaining tough physics five minutes before exams',
    registeredAt: '2026-01-15',
  },
  {
    id: 'bm-3',
    name: 'Raihan Islam',
    nickname: 'Raihan',
    roll: '2703',
    group: 'Commerce',
    social: '@raihan_is',
    quote: 'From inter-batch football finals to organizing cultural night.',
    hobbies: 'Football, Event Management, Cricket',
    bloodGroup: 'B+',
    dreamGoal: 'Investment Banker & Sports Organizer',
    favoriteMemory: 'Penalty shootout win under the floodlights.',
    hangoutSpot: 'Shaheed Minar Steps',
    birthday: '08 Jul',
    superpower: 'Rallying the entire section in 30 seconds',
    registeredAt: '2026-01-18',
  },
  {
    id: 'bm-4',
    name: 'Nafisa Chowdhury',
    nickname: 'Nafisa',
    roll: '2704',
    group: 'Humanities',
    social: '@nafisa.ch',
    quote: 'Debate club afternoons and photography walks across campus.',
    hobbies: 'Parliamentary Debate, Film Photography, Reading',
    bloodGroup: 'AB+',
    dreamGoal: 'Journalist & Documentary Filmmaker',
    favoriteMemory: 'Winning the inter-school debate finals with the squad.',
    hangoutSpot: 'Auditorium Courtyard',
    birthday: '19 Sep',
    superpower: 'Unbeatable rebuttal in under 60 seconds',
    registeredAt: '2026-01-21',
  },
  {
    id: 'bm-5',
    name: 'Farhan Sadik',
    nickname: 'Farhan',
    roll: '2705',
    group: 'Science',
    social: '@farhan27',
    quote: 'Every milestone feels lighter when the whole batch shows up.',
    hobbies: 'Gaming, Cycling, Tech Hardware',
    bloodGroup: 'O+',
    dreamGoal: 'Cybersecurity Specialist',
    favoriteMemory: 'Morning cycle rides across Rajshahi Padma riverbank.',
    hangoutSpot: 'North Gate Tea Stall',
    birthday: '05 Nov',
    superpower: 'Fixing anyone’s laptop in record time',
    registeredAt: '2026-01-24',
  },
  {
    id: 'bm-6',
    name: 'Meherab Hossain',
    nickname: 'Meherab',
    roll: '2706',
    group: 'Commerce',
    social: '@meherab.h',
    quote: 'Ready for the hoodie drop and the final stretch toward 2027.',
    hobbies: 'Graphic Design, Streetwear, Music',
    bloodGroup: 'B-',
    dreamGoal: 'Creative Director & Brand Strategist',
    favoriteMemory: 'First mockup reveal of the RCS Hoodie 26-27.',
    hangoutSpot: 'Rooftop & Art Room',
    birthday: '14 Dec',
    superpower: 'Spotting clean typography from a mile away',
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

export const SITE_LOGO_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-09-19_at_12.58.48_AM_861c7295.jpeg';

export const DEFAULT_HERO_IMAGE =
  '/assets/aistudio/Transform_my_image_into_a_black_and_white_sketch_style_01cc67d0.png';

export const DEFAULT_HOODIE_CONFIG: HoodieConfig = {
  kicker: 'Official Merchandise · Rajshahi Collegiate School',
  title: "RCS HOODIE '26-'27",
  subtitle:
    "The official Orthohin '27 RCS batch hoodie is here! Premium heavyweight fleece fabric, custom embroidery, and sleek winter styling.",
  frontImage: RCS_HOODIE_FRONT,
  backImage: RCS_HOODIE_BACK,
  frontLabel: 'RCS chest crest',
  backLabel: "Orthohin '27 print",
  specs: [
    '350 GSM Heavyweight Cotton Fleece',
    'High-Density Batch Embroidery on Chest (Front)',
    "Signature RCS Orthohin '27 Print on Back",
    'Available Sizes: S, M, L, XL, XXL, XXXL',
  ],
  directOrderOpen: true,
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  brandName: 'ORTHOHIN',
  brandAccent: "'27",
  heroKicker: 'Official Batch Archive · Class of 2027',
  heroTitle: 'The Unstoppable',
  heroHighlight: "Orthohin '27",
  heroDescription:
    'Resilient, united, and timeless. Welcome to the official digital hub of Batch 2027 — preserving our memories, celebrating our cohort, and stepping into the future together.',
  heroImage: DEFAULT_HERO_IMAGE,
  announcement: '',
  instagramUrl: 'https://www.instagram.com/orthohin_27/',
  instagramHandle: '@orthohin_27',
  instagramBio: 'Follow our official Instagram page for real-time photo uploads, reels, and batch announcements.',
  devNote:
    'Designed and built this official portal as Head Orthohin-27 to preserve our batch memories and milestones. Forever united as one batch.',
  aboutKicker: 'Who We Are',
  aboutTitle: 'Bound by Passion, Driven by Excellence',
  aboutDescription:
    'The name Orthohin signifies unmatched spirit and endless dedication. As the Class of 2027, our journey has been defined by late-night study sessions, inter-batch sports triumphs, cultural celebrations, and lasting friendships.',
  visionTitle: 'Vision & Spirit',
  visionText: 'Pursuing excellence across our disciplines while staying deeply connected as one cohort.',
  unityTitle: 'Unbreakable Unity',
  unityText: 'Supporting every member through every milestone, challenge, and victory along the way.',
  leadSectionKicker: "Core Organizers · Orthohin '27",
  leadSectionTitle: 'Admin Panel',
  leadSectionSubtitle: "The core team and organizers running Orthohin '27.",
  leadRole: 'Lead Developer · Head Orthohin-27',
  leadName: 'Abrar Al Razee Oytizzoh',
  footerText: "© 2026 ORTHOHIN '27 — Official Batch Web Portal. Developed by Abrar Al Razee Oytizzoh.",
  registrationOpen: true,
  maintenanceMode: false,
  maintenanceMessage: "Orthohin '27 portal is temporarily undergoing scheduled updates. Please check back shortly.",
  sections: {
    notices: true,
    about: true,
    gallery: true,
    directory: true,
    timeline: true,
    hoodieNav: true,
  },
  kpis: [
    { id: 'kpi-1', value: '6', label: 'Registered Batchmates', autoBatchmateCount: true },
    { id: 'kpi-2', value: '500+', label: 'Memories Captured', autoBatchmateCount: false },
    { id: 'kpi-3', value: '15+', label: 'Events & Outings', autoBatchmateCount: false },
    { id: 'kpi-4', value: '2027', label: 'Graduation Year', autoBatchmateCount: false },
  ],
  timeline: [
    {
      id: 'tl-1',
      tag: 'Day One',
      title: 'Batch 2027 Comes Together',
      description: "Orientation, first lectures, and forming the core friendships that shaped Orthohin '27.",
    },
    {
      id: 'tl-2',
      tag: 'Along the Way',
      title: 'Events, Outings & Sports',
      description: "Cultural evenings, inter-batch championships, and the signature '26–'27 hoodie drop.",
    },
    {
      id: 'tl-3',
      tag: '2027',
      title: 'Graduation & Next Chapter',
      description: 'Stepping forward into university, careers, and lifelong alumni reunions.',
    },
  ],
};

export function mergeHoodieConfig(partial?: Partial<HoodieConfig> | null): HoodieConfig {
  const base = DEFAULT_HOODIE_CONFIG;
  if (!partial) return { ...base, specs: [...base.specs] };
  return {
    ...base,
    ...partial,
    specs: Array.isArray(partial.specs) && partial.specs.length > 0 ? partial.specs : [...base.specs],
  };
}

export function mergeSiteConfig(partial?: Partial<SiteConfig> | null): SiteConfig {
  const base = DEFAULT_SITE_CONFIG;
  if (!partial) {
    return {
      ...base,
      sections: { ...base.sections! },
      kpis: base.kpis!.map((k) => ({ ...k })),
      timeline: base.timeline!.map((t) => ({ ...t })),
    };
  }
  return {
    ...base,
    ...partial,
    sections: {
      ...base.sections!,
      ...(partial.sections || {}),
    },
    kpis:
      Array.isArray(partial.kpis) && partial.kpis.length > 0
        ? partial.kpis
        : base.kpis!.map((k) => ({ ...k })),
    timeline:
      Array.isArray(partial.timeline) && partial.timeline.length > 0
        ? partial.timeline
        : base.timeline!.map((t) => ({ ...t })),
  };
}

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

export const DEFAULT_ADMIN_TEAM: AdminTeamMember[] = [
  {
    id: 'admin-1',
    name: 'Abrar Al Razee Oytizzoh',
    role: 'Lead Developer · Head Orthohin-27',
    bio: 'Designed and built this official portal as Head Orthohin-27 to preserve our batch memories and milestones. Forever united as one batch.',
    photo: DEFAULT_PROFILE_IMAGE,
    social: 'https://www.instagram.com/orthohin_27/',
    sortOrder: 0,
  },
];

export function createDefaultState(): PortalState {
  return {
    gallery: DEFAULT_GALLERY.map((item) => ({ ...item })),
    profile: DEFAULT_PROFILE_IMAGE,
    batchmates: SAMPLE_BATCHMATES.map((item) => ({ ...item })),
    orders: [],
    publicOrders: [],
    notices: DEFAULT_NOTICES.map((item) => ({ ...item })),
    hoodieConfig: mergeHoodieConfig(),
    siteConfig: mergeSiteConfig(),
    adminTeam: DEFAULT_ADMIN_TEAM.map((item) => ({ ...item })),
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
      publicOrders: Array.isArray(parsed.publicOrders) ? parsed.publicOrders : defaults.publicOrders,
      notices: Array.isArray(parsed.notices) ? parsed.notices : defaults.notices,
      hoodieConfig: mergeHoodieConfig(parsed.hoodieConfig),
      siteConfig: mergeSiteConfig(parsed.siteConfig),
      adminTeam:
        Array.isArray(parsed.adminTeam) && parsed.adminTeam.length > 0
          ? parsed.adminTeam
          : defaults.adminTeam,
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

function getPassStorageKey(email?: string): string {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || normalized === AUTHORIZED_ADMIN_EMAIL) {
    return PASS_KEY;
  }
  return `${PASS_KEY}_${normalized}`;
}

export function getAdminPassword(email?: string): string {
  const normalized = (email || '').trim().toLowerCase();
  const fallback = ADMIN_PASS_BY_EMAIL[normalized] || DEFAULT_ADMIN_PASS;
  try {
    return localStorage.getItem(getPassStorageKey(normalized)) || fallback;
  } catch {
    return fallback;
  }
}

export function verifyAdminPasscode(email: string, passcode: string): boolean {
  const normalized = (email || '').trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalized)) return false;
  return passcode === getAdminPassword(normalized);
}

export function setAdminPassword(newPass: string, email?: string): void {
  try {
    localStorage.setItem(getPassStorageKey(email), newPass);
  } catch {
    // Ignore storage error
  }
}

export function resetAdminPassword(email?: string): void {
  try {
    localStorage.removeItem(getPassStorageKey(email));
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

export const MAX_IMAGE_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_DATA_URL_LENGTH = 4_250_000;

export function compressImage(
  file: File,
  maxDimension = 1920,
  maxLength = MAX_IMAGE_DATA_URL_LENGTH
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        // Keep original high-res photo untouched if it already fits within the 3 MB limit
        if (file.size <= MAX_IMAGE_FILE_BYTES && rawDataUrl.length <= maxLength) {
          resolve(rawDataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }

        let currentMaxDim = maxDimension;
        let quality = 0.92;
        let dataUrl = '';

        for (let attempt = 0; attempt < 16; attempt++) {
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

          if (quality > 0.45) {
            quality = Number(Math.max(0.4, quality - 0.1).toFixed(2));
          } else {
            currentMaxDim = Math.max(320, Math.round(currentMaxDim * 0.78));
          }
        }

        resolve(dataUrl);
      };
      img.src = rawDataUrl;
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
