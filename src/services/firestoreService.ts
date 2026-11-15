import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
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
import { db, handleFirestoreError, OperationType } from '../firebase';

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  return cleaned || `${prefix}-${Date.now()}`;
}

function clampStr(val: string | undefined, max: number): string {
  return String(val ?? '').trim().slice(0, max);
}

function timestampToIso(ts: unknown, fallback?: string): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === 'string' && ts) return ts;
  return fallback || new Date().toISOString();
}

export function subscribePublicCollections(callbacks: {
  onBatchmates: (items: Batchmate[]) => void;
  onNotices: (items: BatchNotice[]) => void;
  onGallery: (items: GalleryItem[]) => void;
  onSettings: (settings: { profile: string; hoodieConfig: HoodieConfig; siteConfig: SiteConfig } | null) => void;
  onError?: (err: unknown) => void;
}): () => void {
  const unsubs: (() => void)[] = [];

  const batchmatesQ = query(collection(db, 'batchmates'), orderBy('createdAt', 'desc'));
  unsubs.push(
    onSnapshot(
      batchmatesQ,
      (snap) => {
        const items: Batchmate[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? ''),
            roll: String(data.roll ?? ''),
            group: String(data.group ?? 'Batchmate'),
            social: data.social ? String(data.social) : undefined,
            quote: data.quote ? String(data.quote) : undefined,
            photo: data.photo ? String(data.photo) : undefined,
            registeredAt: data.registeredAt ? String(data.registeredAt) : undefined,
          };
        });
        callbacks.onBatchmates(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'batchmates');
        } catch (err) {
          callbacks.onError?.(err);
        }
      }
    )
  );

  const noticesQ = query(collection(db, 'notices'), orderBy('updatedAt', 'desc'));
  unsubs.push(
    onSnapshot(
      noticesQ,
      (snap) => {
        const items: BatchNotice[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ''),
            message: String(data.message ?? ''),
            category: (data.category as BatchNotice['category']) || 'General',
            pinned: Boolean(data.pinned),
            active: Boolean(data.active),
            createdAt: String(data.createdAt ?? ''),
          };
        });
        callbacks.onNotices(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'notices');
        } catch (err) {
          callbacks.onError?.(err);
        }
      }
    )
  );

  const galleryQ = query(collection(db, 'gallery'), orderBy('sortOrder', 'asc'));
  unsubs.push(
    onSnapshot(
      galleryQ,
      (snap) => {
        const items: GalleryItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            src: String(data.src ?? ''),
            title: String(data.title ?? ''),
            caption: String(data.caption ?? ''),
            date: data.date ? String(data.date) : undefined,
            isVideo: Boolean(data.isVideo),
            videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
          };
        });
        callbacks.onGallery(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'gallery');
        } catch (err) {
          callbacks.onError?.(err);
        }
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'main'),
      (snap) => {
        if (!snap.exists()) {
          callbacks.onSettings(null);
          return;
        }
        const data = snap.data();
        callbacks.onSettings({
          profile: String(data.profile ?? ''),
          hoodieConfig: data.hoodieConfig as HoodieConfig,
          siteConfig: data.siteConfig as SiteConfig,
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'settings/main');
        } catch (err) {
          callbacks.onError?.(err);
        }
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export function subscribeAdminCollections(callbacks: {
  onOrders: (orders: HoodieOrder[]) => void;
  onLogs: (logs: ActivityLogEntry[]) => void;
  onError?: (err: unknown) => void;
}): () => void {
  const unsubs: (() => void)[] = [];

  const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  unsubs.push(
    onSnapshot(
      ordersQ,
      (snap) => {
        const items: HoodieOrder[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            customerName: String(data.customerName ?? ''),
            roll: String(data.roll ?? ''),
            size: (data.size as HoodieOrder['size']) || 'L',
            quantity: Number(data.quantity ?? 1),
            contact: String(data.contact ?? ''),
            notes: data.notes ? String(data.notes) : undefined,
            status: (data.status as OrderStatus) || 'Pending',
            createdAt: timestampToIso(data.createdAt),
          };
        });
        callbacks.onOrders(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'orders');
        } catch (err) {
          callbacks.onError?.(err);
        }
      }
    )
  );

  const logsQ = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'));
  unsubs.push(
    onSnapshot(
      logsQ,
      (snap) => {
        const items: ActivityLogEntry[] = snap.docs.slice(0, 50).map((d) => {
          const data = d.data();
          return {
            id: d.id,
            action: String(data.action ?? ''),
            detail: String(data.detail ?? ''),
            timestamp: timestampToIso(data.createdAt),
          };
        });
        callbacks.onLogs(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'activityLogs');
        } catch (err) {
          callbacks.onError?.(err);
        }
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

/* Batchmates CRUD */
export async function createBatchmateInFirestore(bm: Batchmate): Promise<void> {
  const docId = sanitizeId(bm.id, 'bm');
  const payload: Record<string, unknown> = {
    name: clampStr(bm.name, 100),
    roll: clampStr(bm.roll, 32),
    group: clampStr(bm.group, 60) || 'Batchmate',
    registeredAt: clampStr(bm.registeredAt || new Date().toISOString().slice(0, 10), 32),
    createdAt: serverTimestamp(),
  };
  if (bm.social?.trim()) payload.social = clampStr(bm.social, 100);
  if (bm.quote?.trim()) payload.quote = clampStr(bm.quote, 400);
  if (bm.photo?.trim() && bm.photo.length <= 300000) payload.photo = bm.photo;

  try {
    await setDoc(doc(db, 'batchmates', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `batchmates/${docId}`);
  }
}

export async function updateBatchmateInFirestore(bm: Batchmate): Promise<void> {
  const docId = sanitizeId(bm.id, 'bm');
  const payload: Record<string, unknown> = {
    name: clampStr(bm.name, 100),
    roll: clampStr(bm.roll, 32),
    group: clampStr(bm.group, 60) || 'Batchmate',
    social: clampStr(bm.social, 100),
    quote: clampStr(bm.quote, 400),
    registeredAt: clampStr(bm.registeredAt || new Date().toISOString().slice(0, 10), 32),
  };
  if (bm.photo && bm.photo.length <= 300000) payload.photo = bm.photo;

  try {
    await updateDoc(doc(db, 'batchmates', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `batchmates/${docId}`);
  }
}

export async function deleteBatchmateInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'bm');
  try {
    await deleteDoc(doc(db, 'batchmates', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `batchmates/${docId}`);
  }
}

/* Direct Orders CRUD */
export async function createOrderInFirestore(order: HoodieOrder): Promise<void> {
  const docId = sanitizeId(order.id, 'order');
  const payload: Record<string, unknown> = {
    orderCode: clampStr(order.id, 32),
    customerName: clampStr(order.customerName, 100),
    roll: clampStr(order.roll, 32),
    size: order.size,
    quantity: Math.min(5, Math.max(1, Math.round(order.quantity))),
    contact: clampStr(order.contact, 100),
    status: 'Pending',
    createdAt: serverTimestamp(),
  };
  if (order.notes?.trim()) payload.notes = clampStr(order.notes, 300);

  try {
    await setDoc(doc(db, 'orders', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${docId}`);
  }
}

export async function updateOrderStatusInFirestore(id: string, status: OrderStatus, notes?: string): Promise<void> {
  const docId = sanitizeId(id, 'order');
  const payload: Record<string, unknown> = { status };
  if (notes !== undefined) payload.notes = clampStr(notes, 300);

  try {
    await updateDoc(doc(db, 'orders', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${docId}`);
  }
}

export async function deleteOrderInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'order');
  try {
    await deleteDoc(doc(db, 'orders', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${docId}`);
  }
}

/* Notices CRUD */
export async function createNoticeInFirestore(notice: BatchNotice): Promise<void> {
  const docId = sanitizeId(notice.id, 'notice');
  const payload = {
    title: clampStr(notice.title, 140),
    message: clampStr(notice.message, 1000),
    category: notice.category,
    pinned: Boolean(notice.pinned),
    active: Boolean(notice.active),
    createdAt: clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'notices', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notices/${docId}`);
  }
}

export async function updateNoticeInFirestore(notice: BatchNotice): Promise<void> {
  const docId = sanitizeId(notice.id, 'notice');
  const payload = {
    title: clampStr(notice.title, 140),
    message: clampStr(notice.message, 1000),
    category: notice.category,
    pinned: Boolean(notice.pinned),
    active: Boolean(notice.active),
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(doc(db, 'notices', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notices/${docId}`);
  }
}

export async function deleteNoticeInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'notice');
  try {
    await deleteDoc(doc(db, 'notices', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notices/${docId}`);
  }
}

/* Gallery CRUD */
export async function saveGalleryItemInFirestore(item: GalleryItem, sortOrder: number): Promise<void> {
  const docId = sanitizeId(item.id, 'gal');
  const payload: Record<string, unknown> = {
    src: item.src && item.src.length <= 300000 ? item.src : '',
    title: clampStr(item.title, 140) || 'Untitled Memory',
    caption: clampStr(item.caption, 400),
    date: clampStr(item.date, 40),
    isVideo: Boolean(item.isVideo),
    sortOrder: Math.max(0, Math.min(10000, sortOrder)),
    updatedAt: serverTimestamp(),
  };
  if (item.videoUrl?.trim()) payload.videoUrl = clampStr(item.videoUrl, 500);

  try {
    await setDoc(doc(db, 'gallery', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `gallery/${docId}`);
  }
}

export async function deleteGalleryItemInFirestore(id: string): Promise<void> {
  const docId = sanitizeId(id, 'gal');
  try {
    await deleteDoc(doc(db, 'gallery', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `gallery/${docId}`);
  }
}

/* Settings */
export async function saveSettingsInFirestore(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  const cleanSpecs = hoodieConfig.specs.map((s) => clampStr(s, 140)).filter(Boolean).slice(0, 10);
  const payload = {
    profile: profile.length <= 300000 ? profile : '',
    hoodieConfig: {
      title: clampStr(hoodieConfig.title, 120) || "RCS HOODIE '26-'27",
      subtitle: clampStr(hoodieConfig.subtitle, 500),
      frontImage: hoodieConfig.frontImage.length <= 300000 ? hoodieConfig.frontImage : '',
      backImage: hoodieConfig.backImage.length <= 300000 ? hoodieConfig.backImage : '',
      specs: cleanSpecs.length > 0 ? cleanSpecs : ['350 GSM Cotton Fleece'],
      directOrderOpen: Boolean(hoodieConfig.directOrderOpen),
    },
    siteConfig: {
      heroKicker: clampStr(siteConfig.heroKicker, 120),
      heroTitle: clampStr(siteConfig.heroTitle, 120),
      heroHighlight: clampStr(siteConfig.heroHighlight, 120),
      heroDescription: clampStr(siteConfig.heroDescription, 600),
      announcement: clampStr(siteConfig.announcement, 300),
      instagramUrl: clampStr(siteConfig.instagramUrl, 300),
      devNote: clampStr(siteConfig.devNote, 600),
    },
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'settings', 'main'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/main');
  }
}

/* Activity Logs */
export async function addActivityLogInFirestore(action: string, detail: string): Promise<void> {
  const docId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  try {
    await setDoc(doc(db, 'activityLogs', docId), {
      action: clampStr(action, 80),
      detail: clampStr(detail, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `activityLogs/${docId}`);
  }
}

/* Initial Seed helper for Admin */
export async function seedDefaultsIfEmpty(defaults: PortalState): Promise<void> {
  try {
    const [bmSnap, noticeSnap, galSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'batchmates')),
      getDocs(collection(db, 'notices')),
      getDocs(collection(db, 'gallery')),
      getDoc(doc(db, 'settings', 'main')),
    ]);

    const tasks: Promise<void>[] = [];

    if (bmSnap.empty) {
      for (const bm of defaults.batchmates) {
        tasks.push(createBatchmateInFirestore(bm));
      }
    }
    if (noticeSnap.empty) {
      for (const notice of defaults.notices) {
        tasks.push(createNoticeInFirestore(notice));
      }
    }
    if (galSnap.empty) {
      defaults.gallery.forEach((item, index) => {
        tasks.push(saveGalleryItemInFirestore(item, index));
      });
    }
    if (!settingsSnap.exists()) {
      tasks.push(saveSettingsInFirestore(defaults.profile, defaults.hoodieConfig, defaults.siteConfig));
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed');
  }
}

export async function syncPortalStateToFirestore(nextState: PortalState, replaceCollections = false): Promise<void> {
  try {
    if (replaceCollections) {
      const [bmSnap, noticeSnap, galSnap] = await Promise.all([
        getDocs(collection(db, 'batchmates')),
        getDocs(collection(db, 'notices')),
        getDocs(collection(db, 'gallery')),
      ]);
      await Promise.all([
        ...bmSnap.docs.map((d) => deleteDoc(d.ref)),
        ...noticeSnap.docs.map((d) => deleteDoc(d.ref)),
        ...galSnap.docs.map((d) => deleteDoc(d.ref)),
      ]);
    }

    const tasks: Promise<void>[] = [
      ...nextState.batchmates.map((bm) => createBatchmateInFirestore(bm)),
      ...(nextState.notices || []).map((n) => createNoticeInFirestore(n)),
      ...nextState.gallery.map((g, idx) => saveGalleryItemInFirestore(g, idx)),
      saveSettingsInFirestore(nextState.profile, nextState.hoodieConfig, nextState.siteConfig),
    ];

    await Promise.all(tasks);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'sync');
  }
}
