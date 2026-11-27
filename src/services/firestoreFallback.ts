import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  ActivityLogEntry,
  AdminTeamMember,
  Batchmate,
  BatchmateContact,
  BatchNotice,
  GalleryItem,
  HoodieConfig,
  HoodieOrder,
  OrderStatus,
  PaymentStatus,
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

function toEpochMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sortByTimestampDesc(docs: QueryDocumentSnapshot[], field: string, fallbackField?: string): QueryDocumentSnapshot[] {
  return [...docs].sort((a, b) => {
    const ad = a.data();
    const bd = b.data();
    const at = toEpochMs(ad[field]) || (fallbackField ? toEpochMs(ad[fallbackField]) : 0);
    const bt = toEpochMs(bd[field]) || (fallbackField ? toEpochMs(bd[fallbackField]) : 0);
    return bt - at;
  });
}

function sortBySortOrderAsc(docs: QueryDocumentSnapshot[]): QueryDocumentSnapshot[] {
  return [...docs].sort((a, b) => {
    const ao = typeof a.data().sortOrder === 'number' ? a.data().sortOrder : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.data().sortOrder === 'number' ? b.data().sortOrder : Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

function mapBatchmateDoc(d: QueryDocumentSnapshot): Batchmate {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name || ''),
    nickname: data.nickname ? String(data.nickname) : undefined,
    roll: String(data.roll || ''),
    group: String(data.group || 'Batchmate'),
    social: data.social ? String(data.social) : undefined,
    quote: data.quote ? String(data.quote) : undefined,
    photo: data.photo ? String(data.photo) : undefined,
    hobbies: data.hobbies ? String(data.hobbies) : undefined,
    bloodGroup: data.bloodGroup ? String(data.bloodGroup) : undefined,
    dreamGoal: data.dreamGoal ? String(data.dreamGoal) : undefined,
    favoriteMemory: data.favoriteMemory ? String(data.favoriteMemory) : undefined,
    hangoutSpot: data.hangoutSpot ? String(data.hangoutSpot) : undefined,
    birthday: data.birthday ? String(data.birthday) : undefined,
    superpower: data.superpower ? String(data.superpower) : undefined,
    registeredAt: data.registeredAt ? String(data.registeredAt) : undefined,
  };
}

function mapBatchmateContactDoc(d: QueryDocumentSnapshot): BatchmateContact {
  const data = d.data();
  return {
    id: d.id,
    batchmateId: String(data.batchmateId || d.id),
    email: data.email ? String(data.email) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
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
    email: data.email ? String(data.email) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    status: (data.status as OrderStatus) || 'Pending',
    paymentStatus: data.paymentStatus === 'Paid' ? 'Paid' : 'Due',
    createdAt: toIsoString(data.createdAt),
  };
}

function mapPublicOrderDoc(d: QueryDocumentSnapshot): HoodieOrder {
  const data = d.data();
  return {
    id: String(data.orderCode || d.id),
    customerName: String(data.customerName || ''),
    roll: String(data.roll || ''),
    size: (data.size as HoodieOrder['size']) || 'L',
    quantity: Number(data.quantity || 1),
    contact: '',
    notes: data.notes ? String(data.notes) : undefined,
    status: (data.status as OrderStatus) || 'Pending',
    paymentStatus: data.paymentStatus === 'Paid' ? 'Paid' : 'Due',
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

function mapAdminTeamDoc(d: QueryDocumentSnapshot): AdminTeamMember {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name || ''),
    role: String(data.role || ''),
    bio: String(data.bio || ''),
    photo: data.photo ? String(data.photo) : undefined,
    social: data.social ? String(data.social) : undefined,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
  };
}

export interface PublicFirestoreCallbacks {
  onBatchmates: (batchmates: Batchmate[]) => void;
  onNotices: (notices: BatchNotice[]) => void;
  onGallery: (gallery: GalleryItem[]) => void;
  onAdminTeam: (adminTeam: AdminTeamMember[]) => void;
  onPublicOrders?: (orders: HoodieOrder[]) => void;
  onSettings: (
    settings: {
      profile: string;
      hoodieConfig: HoodieConfig;
      siteConfig: SiteConfig;
    } | null
  ) => void;
  onError?: (error: unknown, path: string) => void;
}

export interface AdminFirestoreCallbacks {
  onOrders: (orders: HoodieOrder[]) => void;
  onActivityLogs: (logs: ActivityLogEntry[]) => void;
  onBatchmateContacts?: (contacts: BatchmateContact[]) => void;
  onError?: (error: unknown, path: string) => void;
}

function reportListenerError(
  err: unknown,
  operationType: OperationType,
  path: string,
  onError?: (error: unknown, path: string) => void
): void {
  onError?.(err, path);
  try {
    handleFirestoreError(err, operationType, path);
  } catch {
    // Error details logged by handleFirestoreError; keep listener resilient
  }
}

export function subscribePublicPortalFromFirestore(callbacks: PublicFirestoreCallbacks): () => void {
  const unsubBatchmates = onSnapshot(
    collection(db, 'batchmates'),
    (snap) => callbacks.onBatchmates(sortByTimestampDesc(snap.docs, 'createdAt', 'registeredAt').map(mapBatchmateDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'batchmates', callbacks.onError)
  );

  const unsubNotices = onSnapshot(
    collection(db, 'notices'),
    (snap) => callbacks.onNotices(sortByTimestampDesc(snap.docs, 'updatedAt', 'createdAt').map(mapNoticeDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'notices', callbacks.onError)
  );

  const unsubGallery = onSnapshot(
    collection(db, 'gallery'),
    (snap) => callbacks.onGallery(sortBySortOrderAsc(snap.docs).map(mapGalleryDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'gallery', callbacks.onError)
  );

  const unsubAdminTeam = onSnapshot(
    collection(db, 'adminTeam'),
    (snap) => callbacks.onAdminTeam(sortBySortOrderAsc(snap.docs).map(mapAdminTeamDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'adminTeam', callbacks.onError)
  );

  const unsubPublicOrders = callbacks.onPublicOrders
    ? onSnapshot(
        collection(db, 'publicHoodieOrders'),
        (snap) => callbacks.onPublicOrders?.(sortByTimestampDesc(snap.docs, 'createdAt').map(mapPublicOrderDoc)),
        (err) => reportListenerError(err, OperationType.LIST, 'publicHoodieOrders', callbacks.onError)
      )
    : () => {};

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
    (err) => reportListenerError(err, OperationType.GET, 'settings/main', callbacks.onError)
  );

  return () => {
    unsubBatchmates();
    unsubNotices();
    unsubGallery();
    unsubAdminTeam();
    unsubPublicOrders();
    unsubSettings();
  };
}

export function subscribeAdminDataFromFirestore(callbacks: AdminFirestoreCallbacks): () => void {
  const unsubOrders = onSnapshot(
    collection(db, 'orders'),
    (snap) => callbacks.onOrders(sortByTimestampDesc(snap.docs, 'createdAt').map(mapOrderDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'orders', callbacks.onError)
  );

  const unsubLogs = onSnapshot(
    query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => callbacks.onActivityLogs(snap.docs.map(mapActivityLogDoc)),
    (err) => reportListenerError(err, OperationType.LIST, 'activityLogs', callbacks.onError)
  );

  const unsubContacts = callbacks.onBatchmateContacts
    ? onSnapshot(
        collection(db, 'batchmateContacts'),
        (snap) => callbacks.onBatchmateContacts?.(snap.docs.map(mapBatchmateContactDoc)),
        (err) => reportListenerError(err, OperationType.LIST, 'batchmateContacts', callbacks.onError)
      )
    : () => {};

  return () => {
    unsubOrders();
    unsubLogs();
    unsubContacts();
  };
}

export async function fetchPublicPortalFromFirestore() {
  const [bmRes, noticeRes, galleryRes, adminTeamRes, publicOrdersRes, settingsRes] = await Promise.allSettled([
    getDocs(collection(db, 'batchmates')),
    getDocs(collection(db, 'notices')),
    getDocs(collection(db, 'gallery')),
    getDocs(collection(db, 'adminTeam')),
    getDocs(collection(db, 'publicHoodieOrders')),
    getDoc(doc(db, 'settings', 'main')),
  ]);

  if (bmRes.status === 'rejected' && galleryRes.status === 'rejected' && settingsRes.status === 'rejected') {
    handleFirestoreError(bmRes.reason, OperationType.LIST, 'batchmates');
  }

  const batchmates: Batchmate[] =
    bmRes.status === 'fulfilled'
      ? sortByTimestampDesc(bmRes.value.docs, 'createdAt', 'registeredAt').map(mapBatchmateDoc)
      : [];
  const notices: BatchNotice[] =
    noticeRes.status === 'fulfilled'
      ? sortByTimestampDesc(noticeRes.value.docs, 'updatedAt', 'createdAt').map(mapNoticeDoc)
      : [];
  const gallery: GalleryItem[] =
    galleryRes.status === 'fulfilled'
      ? sortBySortOrderAsc(galleryRes.value.docs).map(mapGalleryDoc)
      : [];
  const adminTeam: AdminTeamMember[] =
    adminTeamRes.status === 'fulfilled'
      ? sortBySortOrderAsc(adminTeamRes.value.docs).map(mapAdminTeamDoc)
      : [];
  const publicOrders: HoodieOrder[] =
    publicOrdersRes.status === 'fulfilled'
      ? sortByTimestampDesc(publicOrdersRes.value.docs, 'createdAt').map(mapPublicOrderDoc)
      : [];
  const settingsData =
    settingsRes.status === 'fulfilled' && settingsRes.value.exists() ? settingsRes.value.data() : null;

  return {
    batchmates,
    notices,
    gallery,
    adminTeam,
    publicOrders,
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
  const [orderSnap, logSnap, contactSnap] = await Promise.all([
    getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'orders')
    ),
    getDocs(query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(50))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'activityLogs')
    ),
    getDocs(collection(db, 'batchmateContacts')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'batchmateContacts')
    ),
  ]);

  const orders: HoodieOrder[] = orderSnap.docs.map(mapOrderDoc);
  const activityLog: ActivityLogEntry[] = logSnap.docs.map(mapActivityLogDoc);
  const batchmateContacts: BatchmateContact[] = contactSnap.docs.map(mapBatchmateContactDoc);

  return { orders, activityLog, batchmateContacts };
}

export async function fetchPublicPortalFromFirestoreCacheOnly() {
  const [bmRes, noticeRes, galleryRes, adminTeamRes, publicOrdersRes, settingsRes] = await Promise.allSettled([
    getDocsFromCache(collection(db, 'batchmates')),
    getDocsFromCache(collection(db, 'notices')),
    getDocsFromCache(collection(db, 'gallery')),
    getDocsFromCache(collection(db, 'adminTeam')),
    getDocsFromCache(collection(db, 'publicHoodieOrders')),
    getDocFromCache(doc(db, 'settings', 'main')),
  ]);

  const batchmates: Batchmate[] =
    bmRes.status === 'fulfilled'
      ? sortByTimestampDesc(bmRes.value.docs, 'createdAt', 'registeredAt').map(mapBatchmateDoc)
      : [];
  const notices: BatchNotice[] =
    noticeRes.status === 'fulfilled'
      ? sortByTimestampDesc(noticeRes.value.docs, 'updatedAt', 'createdAt').map(mapNoticeDoc)
      : [];
  const gallery: GalleryItem[] =
    galleryRes.status === 'fulfilled'
      ? sortBySortOrderAsc(galleryRes.value.docs).map(mapGalleryDoc)
      : [];
  const adminTeam: AdminTeamMember[] =
    adminTeamRes.status === 'fulfilled'
      ? sortBySortOrderAsc(adminTeamRes.value.docs).map(mapAdminTeamDoc)
      : [];
  const publicOrders: HoodieOrder[] =
    publicOrdersRes.status === 'fulfilled'
      ? sortByTimestampDesc(publicOrdersRes.value.docs, 'createdAt').map(mapPublicOrderDoc)
      : [];
  const settingsData =
    settingsRes.status === 'fulfilled' && settingsRes.value.exists() ? settingsRes.value.data() : null;

  return {
    batchmates,
    notices,
    gallery,
    adminTeam,
    publicOrders,
    settings: settingsData
      ? {
          profile: String(settingsData.profile || ''),
          hoodieConfig: settingsData.hoodieConfig as HoodieConfig,
          siteConfig: settingsData.siteConfig as SiteConfig,
        }
      : null,
  };
}

export async function fetchAdminDataFromFirestoreCacheOnly() {
  const [orderRes, logRes, contactRes] = await Promise.allSettled([
    getDocsFromCache(collection(db, 'orders')),
    getDocsFromCache(collection(db, 'activityLogs')),
    getDocsFromCache(collection(db, 'batchmateContacts')),
  ]);

  const orders: HoodieOrder[] =
    orderRes.status === 'fulfilled'
      ? sortByTimestampDesc(orderRes.value.docs, 'createdAt').map(mapOrderDoc)
      : [];
  const activityLog: ActivityLogEntry[] =
    logRes.status === 'fulfilled'
      ? sortByTimestampDesc(logRes.value.docs, 'createdAt').slice(0, 50).map(mapActivityLogDoc)
      : [];
  const batchmateContacts: BatchmateContact[] =
    contactRes.status === 'fulfilled' ? contactRes.value.docs.map(mapBatchmateContactDoc) : [];

  return { orders, activityLog, batchmateContacts };
}

export async function createBatchmateInFirestore(bm: Batchmate): Promise<Batchmate> {
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100) || 'Batchmate';
  const nickname = clampStr(bm.nickname, 60);
  const roll = clampStr(bm.roll, 32) || '2700';
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const social = clampStr(bm.social, 100);
  const quote = clampStr(bm.quote, 400);
  const photo = bm.photo?.trim() && bm.photo.length <= 350000 ? bm.photo.trim() : '';
  const hobbies = clampStr(bm.hobbies, 240);
  const bloodGroup = clampStr(bm.bloodGroup, 20);
  const dreamGoal = clampStr(bm.dreamGoal, 200);
  const favoriteMemory = clampStr(bm.favoriteMemory, 400);
  const hangoutSpot = clampStr(bm.hangoutSpot, 140);
  const birthday = clampStr(bm.birthday, 40);
  const superpower = clampStr(bm.superpower, 140);
  const email = clampStr(bm.email, 160);
  const phone = clampStr(bm.phone, 40);
  const registeredAt = clampStr(bm.registeredAt || new Date().toISOString().slice(0, 10), 32);

  const ref = doc(db, 'batchmates', id);
  const contactRef = doc(db, 'batchmateContacts', id);
  const fields: Record<string, unknown> = {
    name,
    roll,
    group,
    ...(nickname ? { nickname } : {}),
    ...(social ? { social } : {}),
    ...(quote ? { quote } : {}),
    ...(photo ? { photo } : {}),
    ...(hobbies ? { hobbies } : {}),
    ...(bloodGroup ? { bloodGroup } : {}),
    ...(dreamGoal ? { dreamGoal } : {}),
    ...(favoriteMemory ? { favoriteMemory } : {}),
    ...(hangoutSpot ? { hangoutSpot } : {}),
    ...(birthday ? { birthday } : {}),
    ...(superpower ? { superpower } : {}),
    ...(registeredAt ? { registeredAt } : {}),
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, fields);
    } else {
      await setDoc(ref, { ...fields, createdAt: serverTimestamp() });
    }

    if (email || phone) {
      const contactFields: Record<string, unknown> = {
        batchmateId: id,
        name,
        roll,
        group,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      };
      if (snap.exists() && auth.currentUser) {
        const contactSnap = await getDoc(contactRef);
        if (contactSnap.exists()) {
          await updateDoc(contactRef, contactFields);
        } else {
          await setDoc(contactRef, { ...contactFields, createdAt: serverTimestamp() });
        }
      } else if (!snap.exists()) {
        await setDoc(contactRef, { ...contactFields, createdAt: serverTimestamp() });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `batchmates/${id}`);
  }

  return {
    id,
    name,
    nickname: nickname || undefined,
    roll,
    group,
    social: social || undefined,
    quote: quote || undefined,
    photo: photo || undefined,
    hobbies: hobbies || undefined,
    bloodGroup: bloodGroup || undefined,
    dreamGoal: dreamGoal || undefined,
    favoriteMemory: favoriteMemory || undefined,
    hangoutSpot: hangoutSpot || undefined,
    birthday: birthday || undefined,
    superpower: superpower || undefined,
    registeredAt: registeredAt || undefined,
  };
}

export async function updateBatchmateInFirestore(bm: Batchmate): Promise<void> {
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100) || 'Batchmate';
  const roll = clampStr(bm.roll, 32) || '2700';
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const payload: Record<string, unknown> = {
    name,
    nickname: clampStr(bm.nickname, 60),
    roll,
    group,
    social: clampStr(bm.social, 100),
    quote: clampStr(bm.quote, 400),
    hobbies: clampStr(bm.hobbies, 240),
    bloodGroup: clampStr(bm.bloodGroup, 20),
    dreamGoal: clampStr(bm.dreamGoal, 200),
    favoriteMemory: clampStr(bm.favoriteMemory, 400),
    hangoutSpot: clampStr(bm.hangoutSpot, 140),
    birthday: clampStr(bm.birthday, 40),
    superpower: clampStr(bm.superpower, 140),
  };
  if (bm.photo !== undefined) {
    payload.photo = bm.photo.trim() && bm.photo.length <= 350000 ? bm.photo.trim() : '';
  }
  if (bm.registeredAt) {
    payload.registeredAt = clampStr(bm.registeredAt, 32);
  }

  const ref = doc(db, 'batchmates', id);
  const contactRef = doc(db, 'batchmateContacts', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        registeredAt: payload.registeredAt || new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
      });
    }

    if (bm.email !== undefined || bm.phone !== undefined) {
      const contactPayload: Record<string, unknown> = {
        batchmateId: id,
        name,
        roll,
        group,
        email: clampStr(bm.email, 160),
        phone: clampStr(bm.phone, 40),
      };
      const contactSnap = await getDoc(contactRef);
      if (contactSnap.exists()) {
        await updateDoc(contactRef, contactPayload);
      } else if (contactPayload.email || contactPayload.phone) {
        await setDoc(contactRef, { ...contactPayload, createdAt: serverTimestamp() });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `batchmates/${id}`);
  }
}

export async function deleteBatchmateInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'bm');
  try {
    await deleteDoc(doc(db, 'batchmates', docId));
    await deleteDoc(doc(db, 'batchmateContacts', docId)).catch(() => {
      // Ignore missing private contact document
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `batchmates/${docId}`);
  }
}

export async function createOrderInFirestore(order: HoodieOrder): Promise<HoodieOrder> {
  const id = sanitizeId(order.id, 'RCS').slice(0, 32);
  const customerName = clampStr(order.customerName, 100) || 'Student';
  const roll = clampStr(order.roll, 32) || '0000';
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const size = allowedSizes.includes(order.size) ? order.size : 'L';
  const quantity = Math.min(5, Math.max(1, Math.round(Number(order.quantity) || 1)));
  const contact = clampStr(order.contact, 100) || 'N/A';
  const email = clampStr(order.email, 160);
  const notes = clampStr(order.notes, 300);
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const status: OrderStatus = allowedStatuses.includes(order.status) ? order.status : 'Pending';
  const paymentStatus: PaymentStatus = order.paymentStatus === 'Paid' ? 'Paid' : 'Due';

  const nowTs = serverTimestamp();

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', id), {
      orderCode: id,
      customerName,
      roll,
      size,
      quantity,
      contact,
      ...(email ? { email } : {}),
      ...(notes ? { notes } : {}),
      status,
      paymentStatus,
      createdAt: nowTs,
    });
    batch.set(doc(db, 'publicHoodieOrders', id), {
      orderCode: id,
      customerName,
      roll,
      size,
      quantity,
      ...(notes ? { notes } : {}),
      status,
      paymentStatus,
      createdAt: nowTs,
    });
    await batch.commit();
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
    email: email || undefined,
    notes: notes || undefined,
    status,
    paymentStatus,
    createdAt: order.createdAt || new Date().toISOString(),
  };
}

export async function updateOrderStatusInFirestore(
  id: string,
  status: OrderStatus,
  notes?: string,
  extra?: Partial<Pick<HoodieOrder, 'customerName' | 'roll' | 'size' | 'quantity' | 'contact' | 'email' | 'paymentStatus'>>
): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'Pending';
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const payload: Record<string, unknown> = { status: safeStatus };
  const publicPayload: Record<string, unknown> = { status: safeStatus };

  if (notes !== undefined) {
    const cleanNote = clampStr(notes, 300);
    payload.notes = cleanNote;
    publicPayload.notes = cleanNote;
  }
  if (extra?.customerName?.trim()) {
    const cleanName = clampStr(extra.customerName, 100);
    payload.customerName = cleanName;
    publicPayload.customerName = cleanName;
  }
  if (extra?.roll?.trim()) {
    const cleanRoll = clampStr(extra.roll, 32);
    payload.roll = cleanRoll;
    publicPayload.roll = cleanRoll;
  }
  if (extra?.size && allowedSizes.includes(extra.size)) {
    payload.size = extra.size;
    publicPayload.size = extra.size;
  }
  if (extra?.quantity !== undefined) {
    const cleanQty = Math.min(5, Math.max(1, Math.round(Number(extra.quantity) || 1)));
    payload.quantity = cleanQty;
    publicPayload.quantity = cleanQty;
  }
  if (extra?.contact?.trim()) {
    payload.contact = clampStr(extra.contact, 100);
  }
  if (extra?.email !== undefined) {
    payload.email = clampStr(extra.email, 160);
  }
  if (extra?.paymentStatus === 'Paid' || extra?.paymentStatus === 'Due') {
    payload.paymentStatus = extra.paymentStatus;
    publicPayload.paymentStatus = extra.paymentStatus;
  }

  try {
    const orderRef = doc(db, 'orders', docId);
    const pubRef = doc(db, 'publicHoodieOrders', docId);
    const pubSnap = await getDoc(pubRef);

    const batch = writeBatch(db);
    batch.update(orderRef, payload);

    if (pubSnap.exists()) {
      batch.update(pubRef, publicPayload);
    } else {
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const base = orderSnap.data();
        const mergedNotes =
          publicPayload.notes !== undefined
            ? String(publicPayload.notes)
            : base.notes
              ? String(base.notes)
              : '';
        batch.set(pubRef, {
          orderCode: String(base.orderCode || docId).slice(0, 32),
          customerName: String(publicPayload.customerName || base.customerName || 'Student').slice(0, 100),
          roll: String(publicPayload.roll || base.roll || '0000').slice(0, 32),
          size: (publicPayload.size || base.size || 'L') as HoodieOrder['size'],
          quantity: Number(publicPayload.quantity || base.quantity || 1),
          ...(mergedNotes ? { notes: mergedNotes } : {}),
          status: safeStatus,
          paymentStatus: (publicPayload.paymentStatus || base.paymentStatus || 'Due') as PaymentStatus,
          createdAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${docId}`);
  }
}

export async function deleteOrderInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  try {
    await deleteDoc(doc(db, 'orders', docId));
    await deleteDoc(doc(db, 'publicHoodieOrders', docId)).catch(() => {
      // Ignore if public mirror did not exist
    });
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

  const ref = doc(db, 'notices', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        title,
        message,
        category,
        pinned: Boolean(notice.pinned),
        active: Boolean(notice.active),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        title,
        message,
        category,
        pinned: Boolean(notice.pinned),
        active: Boolean(notice.active),
        createdAt: clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32),
        updatedAt: serverTimestamp(),
      });
    }
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

export async function saveAdminTeamMemberInFirestore(member: AdminTeamMember, sortOrder: number): Promise<void> {
  const id = sanitizeId(member.id, 'admin');
  const name = clampStr(member.name, 100) || 'Organizer';
  const role = clampStr(member.role, 120) || 'Batch Admin';
  const bio = clampStr(member.bio, 500);
  const photo = member.photo && member.photo.trim().length <= 350000 ? member.photo.trim() : '';
  const social = clampStr(member.social, 200);
  const clampedSort = Math.max(0, Math.min(10000, Math.round(sortOrder)));

  try {
    await setDoc(doc(db, 'adminTeam', id), {
      name,
      role,
      bio,
      ...(photo ? { photo } : {}),
      ...(social ? { social } : {}),
      sortOrder: clampedSort,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `adminTeam/${id}`);
  }
}

export async function deleteAdminTeamMemberInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'admin');
  try {
    await deleteDoc(doc(db, 'adminTeam', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `adminTeam/${docId}`);
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
  const [bmSnap, noticeSnap, gallerySnap, adminTeamSnap, settingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'batchmates'), limit(1))),
    getDocs(query(collection(db, 'notices'), limit(1))),
    getDocs(query(collection(db, 'gallery'), limit(1))),
    getDocs(query(collection(db, 'adminTeam'), limit(1))),
    getDoc(doc(db, 'settings', 'main')),
  ]);

  const isBrandNewDatabase = !settingsSnap.exists() && bmSnap.empty && gallerySnap.empty;
  if (!isBrandNewDatabase) {
    return;
  }

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
  if (adminTeamSnap.empty && Array.isArray(defaults.adminTeam)) {
    defaults.adminTeam.forEach((member, idx) => tasks.push(saveAdminTeamMemberInFirestore(member, idx)));
  }
  if (!settingsSnap.exists()) {
    tasks.push(saveSettingsInFirestore(defaults.profile, defaults.hoodieConfig, defaults.siteConfig));
  }
  if (tasks.length > 0) await Promise.all(tasks);
}

export async function syncPortalStateInFirestore(nextState: PortalState, replaceCollections: boolean): Promise<void> {
  // Write/upsert all incoming records FIRST so a network interruption never leaves collections wiped.
  await Promise.all([
    ...nextState.batchmates.map((bm) => createBatchmateInFirestore(bm)),
    ...(nextState.notices || []).map((n) => createNoticeInFirestore(n)),
    ...nextState.gallery.map((g, idx) => saveGalleryItemInFirestore(g, idx)),
    ...(nextState.adminTeam || []).map((m, idx) => saveAdminTeamMemberInFirestore(m, idx)),
    saveSettingsInFirestore(nextState.profile, nextState.hoodieConfig, nextState.siteConfig),
  ]);

  if (replaceCollections) {
    const keepBmIds = new Set(nextState.batchmates.map((bm) => sanitizeId(bm.id, 'bm')));
    const keepNoticeIds = new Set((nextState.notices || []).map((n) => sanitizeId(n.id, 'notice')));
    const keepGalleryIds = new Set(nextState.gallery.map((g) => sanitizeId(g.id, 'gal')));
    const keepTeamIds = new Set((nextState.adminTeam || []).map((m) => sanitizeId(m.id, 'admin')));

    const [bmSnap, contactSnap, noticeSnap, gallerySnap, adminTeamSnap] = await Promise.all([
      getDocs(collection(db, 'batchmates')),
      getDocs(collection(db, 'batchmateContacts')),
      getDocs(collection(db, 'notices')),
      getDocs(collection(db, 'gallery')),
      getDocs(collection(db, 'adminTeam')),
    ]);

    await Promise.all([
      ...bmSnap.docs.filter((d) => !keepBmIds.has(d.id)).map((d) => deleteDoc(d.ref)),
      ...contactSnap.docs.filter((d) => !keepBmIds.has(d.id)).map((d) => deleteDoc(d.ref)),
      ...noticeSnap.docs.filter((d) => !keepNoticeIds.has(d.id)).map((d) => deleteDoc(d.ref)),
      ...gallerySnap.docs.filter((d) => !keepGalleryIds.has(d.id)).map((d) => deleteDoc(d.ref)),
      ...adminTeamSnap.docs.filter((d) => !keepTeamIds.has(d.id)).map((d) => deleteDoc(d.ref)),
    ]);
  }
}
