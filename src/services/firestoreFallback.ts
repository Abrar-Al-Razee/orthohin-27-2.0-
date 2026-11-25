import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  ActivityLogEntry,
  Batchmate,
  BatchNotice,
  GalleryItem,
  HoodieConfig,
  HoodieOrder,
  OrderStatus,
  PortalState,
  SiteConfig,
} from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
  return cleaned || `${prefix}-${Date.now()}`;
}

function clampStr(val: string | undefined, max: number): string {
  return String(val ?? '').trim().slice(0, max);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string' && val.trim()) return val;
  return new Date().toISOString();
}

function mapBatchmateDoc(d: QueryDocumentSnapshot): Batchmate {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name || ''),
    roll: String(data.roll || ''),
    group: String(data.group || 'Batchmate'),
    social: data.social ? String(data.social) : undefined,
    quote: data.quote ? String(data.quote) : undefined,
    photo: data.photo ? String(data.photo) : undefined,
    registeredAt: data.registeredAt ? String(data.registeredAt) : undefined,
  };
}

function mapNoticeDoc(d: QueryDocumentSnapshot): BatchNotice {
  const data = d.data();
  return {
    id: d.id,
    title: String(data.title || ''),
    message: String(data.message || ''),
    category: (data.category as BatchNotice['category']) || 'General',
    pinned: Boolean(data.pinned),
    active: Boolean(data.active),
    createdAt: String(data.createdAt || ''),
  };
}

function mapGalleryDoc(d: QueryDocumentSnapshot): GalleryItem {
  const data = d.data();
  return {
    id: d.id,
    src: String(data.src || ''),
    title: String(data.title || ''),
    caption: String(data.caption || ''),
    date: data.date ? String(data.date) : undefined,
    isVideo: Boolean(data.isVideo),
    videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
  };
}

function mapOrderDoc(d: QueryDocumentSnapshot): HoodieOrder {
  const data = d.data();
  return {
    id: String(data.orderCode || d.id),
    customerName: String(data.customerName || ''),
    roll: String(data.roll || ''),
    size: (data.size as HoodieOrder['size']) || 'L',
    quantity: Number(data.quantity || 1),
    contact: String(data.contact || ''),
    notes: data.notes ? String(data.notes) : undefined,
    status: (data.status as OrderStatus) || 'Pending',
    createdAt: toIsoString(data.createdAt),
  };
}

function mapActivityLogDoc(d: QueryDocumentSnapshot): ActivityLogEntry {
  const data = d.data();
  return {
    id: d.id,
    action: String(data.action || ''),
    detail: String(data.detail || ''),
    timestamp: toIsoString(data.createdAt),
  };
}

export interface PublicFirestoreCallbacks {
  onBatchmates: (batchmates: Batchmate[]) => void;
  onNotices: (notices: BatchNotice[]) => void;
  onGallery: (gallery: GalleryItem[]) => void;
  onSettings: (
    settings: {
      profile: string;
      hoodieConfig: HoodieConfig;
      siteConfig: SiteConfig;
    } | null
  ) => void;
}

export interface AdminFirestoreCallbacks {
  onOrders: (orders: HoodieOrder[]) => void;
  onActivityLogs: (logs: ActivityLogEntry[]) => void;
}

function reportListenerError(err: unknown, operationType: OperationType, path: string): void {
  try {
    handleFirestoreError(err, operationType, path);
  } catch {
    // Error details logged by handleFirestoreError; keep listener resilient
  }
}

export function subscribePublicPortalFromFirestore(callbacks: PublicFirestoreCallbacks): () => void {
  const unsubBatchmates = onSnapshot(
    query(collection(db, 'batchmates'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onBatchmates(snap.docs.map(mapBatchmateDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'batchmates')
  );

  const unsubNotices = onSnapshot(
    query(collection(db, 'notices'), orderBy('updatedAt', 'desc')),
    (snap) => callbacks.onNotices(snap.docs.map(mapNoticeDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'notices')
  );

  const unsubGallery = onSnapshot(
    query(collection(db, 'gallery'), orderBy('sortOrder', 'asc')),
    (snap) => callbacks.onGallery(snap.docs.map(mapGalleryDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'gallery')
  );

  const unsubSettings = onSnapshot(
    doc(db, 'settings', 'main'),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      callbacks.onSettings(
        data
          ? {
              profile: String(data.profile || ''),
              hoodieConfig: data.hoodieConfig as HoodieConfig,
              siteConfig: data.siteConfig as SiteConfig,
            }
          : null
      );
    },
    (err) => reportListenerError(err, OperationType.GET, 'settings/main')
  );

  return () => {
    unsubBatchmates();
    unsubNotices();
    unsubGallery();
    unsubSettings();
  };
}

export function subscribeAdminDataFromFirestore(callbacks: AdminFirestoreCallbacks): () => void {
  const unsubOrders = onSnapshot(
    query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
    (snap) => callbacks.onOrders(snap.docs.map(mapOrderDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'orders')
  );

  const unsubLogs = onSnapshot(
    query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => callbacks.onActivityLogs(snap.docs.map(mapActivityLogDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'activityLogs')
  );

  return () => {
    unsubOrders();
    unsubLogs();
  };
}

export async function fetchPublicPortalFromFirestore() {
  const [bmSnap, noticeSnap, gallerySnap, settingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'batchmates'), orderBy('createdAt', 'desc'))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'batchmates')
    ),
    getDocs(query(collection(db, 'notices'), orderBy('updatedAt', 'desc'))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'notices')
    ),
    getDocs(query(collection(db, 'gallery'), orderBy('sortOrder', 'asc'))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'gallery')
    ),
    getDoc(doc(db, 'settings', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, 'settings/main')
    ),
  ]);

  const batchmates: Batchmate[] = bmSnap.docs.map(mapBatchmateDoc);
  const notices: BatchNotice[] = noticeSnap.docs.map(mapNoticeDoc);
  const gallery: GalleryItem[] = gallerySnap.docs.map(mapGalleryDoc);
  const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;

  return {
    batchmates,
    notices,
    gallery,
    settings: settingsData
      ? {
          profile: String(settingsData.profile || ''),
          hoodieConfig: settingsData.hoodieConfig as HoodieConfig,
          siteConfig: settingsData.siteConfig as SiteConfig,
        }
      : null,
  };
}

export async function fetchAdminDataFromFirestore() {
  const [orderSnap, logSnap] = await Promise.all([
    getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'orders')
    ),
    getDocs(query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(50))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'activityLogs')
    ),
  ]);

  const orders: HoodieOrder[] = orderSnap.docs.map(mapOrderDoc);
  const activityLog: ActivityLogEntry[] = logSnap.docs.map(mapActivityLogDoc);

  return { orders, activityLog };
}

export async function createBatchmateInFirestore(bm: Batchmate): Promise<Batchmate> {
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100) || 'Batchmate';
  const roll = clampStr(bm.roll, 32) || '2700';
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const social = clampStr(bm.social, 100);
  const quote = clampStr(bm.quote, 400);
  const photo = bm.photo?.trim() && bm.photo.length <= 350000 ? bm.photo.trim() : '';
  const registeredAt = clampStr(bm.registeredAt || new Date().toISOString().slice(0, 10), 32);

  const ref = doc(db, 'batchmates', id);
  const fields: Record<string, unknown> = {
    name,
    roll,
    group,
    ...(social ? { social } : {}),
    ...(quote ? { quote } : {}),
    ...(photo ? { photo } : {}),
    ...(registeredAt ? { registeredAt } : {}),
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, fields);
    } else {
      await setDoc(ref, { ...fields, createdAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `batchmates/${id}`);
  }

  return {
    id,
    name,
    roll,
    group,
    social: social || undefined,
    quote: quote || undefined,
    photo: photo || undefined,
    registeredAt: registeredAt || undefined,
  };
}

export async function updateBatchmateInFirestore(bm: Batchmate): Promise<void> {
  const id = sanitizeId(bm.id, 'bm');
  const payload: Record<string, unknown> = {
    name: clampStr(bm.name, 100) || 'Batchmate',
    roll: clampStr(bm.roll, 32) || '2700',
    group: clampStr(bm.group, 60) || 'Batchmate',
    social: clampStr(bm.social, 100),
    quote: clampStr(bm.quote, 400),
  };
  if (bm.photo !== undefined) {
    payload.photo = bm.photo.trim() && bm.photo.length <= 350000 ? bm.photo.trim() : '';
  }
  if (bm.registeredAt) {
    payload.registeredAt = clampStr(bm.registeredAt, 32);
  }

  try {
    await updateDoc(doc(db, 'batchmates', id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `batchmates/${id}`);
  }
}

export async function deleteBatchmateInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'bm');
  try {
    await deleteDoc(doc(db, 'batchmates', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `batchmates/${docId}`);
  }
}

export async function createOrderInFirestore(order: HoodieOrder): Promise<HoodieOrder> {
  const id = sanitizeId(order.id, 'RCS');
  const customerName = clampStr(order.customerName, 100) || 'Student';
  const roll = clampStr(order.roll, 32) || '0000';
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const size = allowedSizes.includes(order.size) ? order.size : 'L';
  const quantity = Math.min(5, Math.max(1, Math.round(Number(order.quantity) || 1)));
  const contact = clampStr(order.contact, 100) || 'N/A';
  const notes = clampStr(order.notes, 300);
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const status: OrderStatus = allowedStatuses.includes(order.status) ? order.status : 'Pending';

  try {
    await setDoc(doc(db, 'orders', id), {
      orderCode: id.slice(0, 32),
      customerName,
      roll,
      size,
      quantity,
      contact,
      ...(notes ? { notes } : {}),
      status,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `orders/${id}`);
  }

  return {
    id,
    customerName,
    roll,
    size,
    quantity,
    contact,
    notes: notes || undefined,
    status,
    createdAt: order.createdAt || new Date().toISOString(),
  };
}

export async function updateOrderStatusInFirestore(
  id: string,
  status: OrderStatus,
  notes?: string,
  extra?: Partial<Pick<HoodieOrder, 'customerName' | 'roll' | 'size' | 'quantity' | 'contact'>>
): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'Pending';
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const payload: Record<string, unknown> = { status: safeStatus };
  if (notes !== undefined) payload.notes = clampStr(notes, 300);
  if (extra?.customerName?.trim()) payload.customerName = clampStr(extra.customerName, 100);
  if (extra?.roll?.trim()) payload.roll = clampStr(extra.roll, 32);
  if (extra?.size && allowedSizes.includes(extra.size)) payload.size = extra.size;
  if (extra?.quantity !== undefined) {
    payload.quantity = Math.min(5, Math.max(1, Math.round(Number(extra.quantity) || 1)));
  }
  if (extra?.contact?.trim()) payload.contact = clampStr(extra.contact, 100);

  try {
    await updateDoc(doc(db, 'orders', docId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${docId}`);
  }
}

export async function deleteOrderInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  try {
    await deleteDoc(doc(db, 'orders', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `orders/${docId}`);
  }
}

export async function createNoticeInFirestore(notice: BatchNotice): Promise<void> {
  const id = sanitizeId(notice.id, 'notice');
  const title = clampStr(notice.title, 140) || 'Notice';
  const message = clampStr(notice.message, 1000) || 'Details updated.';
  const category = ['General', 'Urgent', 'Event'].includes(notice.category) ? notice.category : 'General';
  const pinned = Boolean(notice.pinned);
  const active = Boolean(notice.active);
  const createdAt = clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32);

  const ref = doc(db, 'notices', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { title, message, category, pinned, active, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { title, message, category, pinned, active, createdAt, updatedAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notices/${id}`);
  }
}

export async function updateNoticeInFirestore(notice: BatchNotice): Promise<void> {
  const id = sanitizeId(notice.id, 'notice');
  const title = clampStr(notice.title, 140) || 'Notice';
  const message = clampStr(notice.message, 1000) || 'Details updated.';
  const category = ['General', 'Urgent', 'Event'].includes(notice.category) ? notice.category : 'General';

  try {
    await updateDoc(doc(db, 'notices', id), {
      title,
      message,
      category,
      pinned: Boolean(notice.pinned),
      active: Boolean(notice.active),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notices/${id}`);
  }
}

export async function deleteNoticeInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'notice');
  try {
    await deleteDoc(doc(db, 'notices', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `notices/${docId}`);
  }
}

export async function saveGalleryItemInFirestore(item: GalleryItem, sortOrder: number): Promise<void> {
  const id = sanitizeId(item.id, 'gal');
  const src = item.src && item.src.length <= 350000 ? item.src : '';
  const title = clampStr(item.title, 140) || 'Untitled Memory';
  const caption = clampStr(item.caption, 400);
  const date = clampStr(item.date, 40);
  const isVideo = Boolean(item.isVideo);
  const videoUrl = clampStr(item.videoUrl, 500);
  const clampedSort = Math.max(0, Math.min(10000, Math.round(sortOrder)));

  try {
    await setDoc(doc(db, 'gallery', id), {
      src,
      title,
      caption,
      ...(date ? { date } : {}),
      isVideo,
      ...(videoUrl ? { videoUrl } : {}),
      sortOrder: clampedSort,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `gallery/${id}`);
  }
}

export async function deleteGalleryItemInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'gal');
  try {
    await deleteDoc(doc(db, 'gallery', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `gallery/${docId}`);
  }
}

export async function saveSettingsInFirestore(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  const cleanSpecs = (hoodieConfig.specs || [])
    .map((s) => clampStr(s, 140))
    .filter(Boolean)
    .slice(0, 12);

  const safeHoodie: Record<string, unknown> = {
    title: clampStr(hoodieConfig.title, 120) || "RCS HOODIE '26-'27",
    subtitle: clampStr(hoodieConfig.subtitle, 500),
    frontImage: hoodieConfig.frontImage && hoodieConfig.frontImage.length <= 350000 ? hoodieConfig.frontImage : '',
    backImage: hoodieConfig.backImage && hoodieConfig.backImage.length <= 350000 ? hoodieConfig.backImage : '',
    specs: cleanSpecs.length > 0 ? cleanSpecs : ['350 GSM Heavyweight Cotton Fleece'],
    directOrderOpen: Boolean(hoodieConfig.directOrderOpen),
  };
  if (hoodieConfig.kicker !== undefined) safeHoodie.kicker = clampStr(hoodieConfig.kicker, 140);
  if (hoodieConfig.frontLabel !== undefined) safeHoodie.frontLabel = clampStr(hoodieConfig.frontLabel, 80);
  if (hoodieConfig.backLabel !== undefined) safeHoodie.backLabel = clampStr(hoodieConfig.backLabel, 80);

  const safeSite: Record<string, unknown> = {
    heroKicker: clampStr(siteConfig.heroKicker, 120),
    heroTitle: clampStr(siteConfig.heroTitle, 120),
    heroHighlight: clampStr(siteConfig.heroHighlight, 120),
    heroDescription: clampStr(siteConfig.heroDescription, 600),
    announcement: clampStr(siteConfig.announcement, 300),
    instagramUrl: clampStr(siteConfig.instagramUrl, 300),
    devNote: clampStr(siteConfig.devNote, 600),
  };

  if (siteConfig.brandName !== undefined) safeSite.brandName = clampStr(siteConfig.brandName, 40);
  if (siteConfig.brandAccent !== undefined) safeSite.brandAccent = clampStr(siteConfig.brandAccent, 20);
  if (siteConfig.heroImage !== undefined && siteConfig.heroImage.length <= 350000) {
    safeSite.heroImage = siteConfig.heroImage;
  }
  if (siteConfig.instagramHandle !== undefined) safeSite.instagramHandle = clampStr(siteConfig.instagramHandle, 80);
  if (siteConfig.instagramBio !== undefined) safeSite.instagramBio = clampStr(siteConfig.instagramBio, 300);
  if (siteConfig.aboutKicker !== undefined) safeSite.aboutKicker = clampStr(siteConfig.aboutKicker, 80);
  if (siteConfig.aboutTitle !== undefined) safeSite.aboutTitle = clampStr(siteConfig.aboutTitle, 160);
  if (siteConfig.aboutDescription !== undefined) safeSite.aboutDescription = clampStr(siteConfig.aboutDescription, 800);
  if (siteConfig.visionTitle !== undefined) safeSite.visionTitle = clampStr(siteConfig.visionTitle, 100);
  if (siteConfig.visionText !== undefined) safeSite.visionText = clampStr(siteConfig.visionText, 300);
  if (siteConfig.unityTitle !== undefined) safeSite.unityTitle = clampStr(siteConfig.unityTitle, 100);
  if (siteConfig.unityText !== undefined) safeSite.unityText = clampStr(siteConfig.unityText, 300);
  if (siteConfig.leadSectionKicker !== undefined) safeSite.leadSectionKicker = clampStr(siteConfig.leadSectionKicker, 80);
  if (siteConfig.leadSectionTitle !== undefined) safeSite.leadSectionTitle = clampStr(siteConfig.leadSectionTitle, 120);
  if (siteConfig.leadSectionSubtitle !== undefined) {
    safeSite.leadSectionSubtitle = clampStr(siteConfig.leadSectionSubtitle, 240);
  }
  if (siteConfig.leadRole !== undefined) safeSite.leadRole = clampStr(siteConfig.leadRole, 120);
  if (siteConfig.leadName !== undefined) safeSite.leadName = clampStr(siteConfig.leadName, 120);
  if (siteConfig.footerText !== undefined) safeSite.footerText = clampStr(siteConfig.footerText, 240);
  if (siteConfig.registrationOpen !== undefined) safeSite.registrationOpen = Boolean(siteConfig.registrationOpen);
  if (siteConfig.maintenanceMode !== undefined) safeSite.maintenanceMode = Boolean(siteConfig.maintenanceMode);
  if (siteConfig.maintenanceMessage !== undefined) {
    safeSite.maintenanceMessage = clampStr(siteConfig.maintenanceMessage, 400);
  }

  if (siteConfig.sections) {
    safeSite.sections = {
      notices: Boolean(siteConfig.sections.notices),
      about: Boolean(siteConfig.sections.about),
      gallery: Boolean(siteConfig.sections.gallery),
      directory: Boolean(siteConfig.sections.directory),
      timeline: Boolean(siteConfig.sections.timeline),
      hoodieNav: Boolean(siteConfig.sections.hoodieNav),
    };
  }

  if (Array.isArray(siteConfig.kpis)) {
    safeSite.kpis = siteConfig.kpis.slice(0, 4).map((k, idx) => ({
      id: clampStr(k.id || `kpi-${idx + 1}`, 40),
      value: clampStr(k.value, 40) || '0',
      label: clampStr(k.label, 80) || 'Metric',
      autoBatchmateCount: Boolean(k.autoBatchmateCount),
    }));
  }

  if (Array.isArray(siteConfig.timeline)) {
    safeSite.timeline = siteConfig.timeline.slice(0, 20).map((t, idx) => ({
      id: clampStr(t.id || `tl-${idx + 1}`, 40),
      tag: clampStr(t.tag, 60) || 'Milestone',
      title: clampStr(t.title, 120) || 'Batch Milestone',
      description: clampStr(t.description, 400),
    }));
  }

  const safeProfile = profile && profile.length <= 350000 ? profile : '';

  try {
    await setDoc(doc(db, 'settings', 'main'), {
      profile: safeProfile,
      hoodieConfig: safeHoodie,
      siteConfig: safeSite,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/main');
  }
}

export async function addActivityLogInFirestore(action: string, detail: string): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  try {
    await setDoc(doc(db, 'activityLogs', id), {
      action: clampStr(action, 80) || 'Admin Action',
      detail: clampStr(detail, 300) || 'Action recorded',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `activityLogs/${id}`);
  }
}

export async function seedDefaultsIfEmptyInFirestore(defaults: PortalState): Promise<void> {
  const [bmSnap, noticeSnap, gallerySnap, settingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'batchmates'), limit(1))),
    getDocs(query(collection(db, 'notices'), limit(1))),
    getDocs(query(collection(db, 'gallery'), limit(1))),
    getDoc(doc(db, 'settings', 'main')),
  ]);

  const tasks: Promise<unknown>[] = [];
  if (bmSnap.empty) {
    for (const bm of defaults.batchmates) tasks.push(createBatchmateInFirestore(bm));
  }
  if (noticeSnap.empty) {
    for (const notice of defaults.notices) tasks.push(createNoticeInFirestore(notice));
  }
  if (gallerySnap.empty) {
    defaults.gallery.forEach((item, idx) => tasks.push(saveGalleryItemInFirestore(item, idx)));
  }
  if (!settingsSnap.exists()) {
    tasks.push(saveSettingsInFirestore(defaults.profile, defaults.hoodieConfig, defaults.siteConfig));
  }
  if (tasks.length > 0) await Promise.all(tasks);
}

export async function syncPortalStateInFirestore(nextState: PortalState, replaceCollections: boolean): Promise<void> {
  if (replaceCollections) {
    const [bmSnap, noticeSnap, gallerySnap] = await Promise.all([
      getDocs(collection(db, 'batchmates')),
      getDocs(collection(db, 'notices')),
      getDocs(collection(db, 'gallery')),
    ]);
    await Promise.all([
      ...bmSnap.docs.map((d) => deleteDoc(d.ref)),
      ...noticeSnap.docs.map((d) => deleteDoc(d.ref)),
      ...gallerySnap.docs.map((d) => deleteDoc(d.ref)),
    ]);
  }
  await Promise.all([
    ...nextState.batchmates.map((bm) => createBatchmateInFirestore(bm)),
    ...(nextState.notices || []).map((n) => createNoticeInFirestore(n)),
    ...nextState.gallery.map((g, idx) => saveGalleryItemInFirestore(g, idx)),
    saveSettingsInFirestore(nextState.profile, nextState.hoodieConfig, nextState.siteConfig),
  ]);
}
