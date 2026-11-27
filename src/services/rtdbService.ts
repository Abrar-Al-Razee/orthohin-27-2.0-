import {
  get,
  limitToLast,
  onValue,
  query,
  ref,
  remove,
  set,
  update,
  type DataSnapshot,
} from 'firebase/database';
import { rtdb } from '../firebase';
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
import type { AdminFirestoreCallbacks, PublicFirestoreCallbacks } from './firestoreFallback';

const MAX_RTDB_IMAGE_LENGTH = 4_500_000;

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
  return cleaned || `${prefix}-${Date.now()}`;
}

function clampStr(val: string | undefined, max: number): string {
  return String(val ?? '').trim().slice(0, max);
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function toEpochMs(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIsoString(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val)) return new Date(val).toISOString();
  if (typeof val === 'string' && val.trim()) return val;
  return new Date().toISOString();
}

function snapshotToEntries(snap: DataSnapshot): Array<{ id: string; data: Record<string, unknown> }> {
  if (!snap.exists()) return [];
  const raw = snap.val();
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([, val]) => val && typeof val === 'object')
    .map(([id, val]) => ({ id, data: val as Record<string, unknown> }));
}

function mapBatchmateEntry(id: string, data: Record<string, unknown>): Batchmate {
  return {
    id,
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

function mapBatchmateContactEntry(id: string, data: Record<string, unknown>): BatchmateContact {
  return {
    id,
    batchmateId: String(data.batchmateId || id),
    email: data.email ? String(data.email) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
  };
}

function mapNoticeEntry(id: string, data: Record<string, unknown>): BatchNotice {
  return {
    id,
    title: String(data.title || ''),
    message: String(data.message || ''),
    category: (data.category as BatchNotice['category']) || 'General',
    pinned: Boolean(data.pinned),
    active: Boolean(data.active),
    createdAt: String(data.createdAt || ''),
  };
}

function mapGalleryEntry(id: string, data: Record<string, unknown>): GalleryItem {
  return {
    id,
    src: String(data.src || ''),
    title: String(data.title || ''),
    caption: String(data.caption || ''),
    date: data.date ? String(data.date) : undefined,
    isVideo: Boolean(data.isVideo),
    videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
  };
}

function mapOrderEntry(id: string, data: Record<string, unknown>): HoodieOrder {
  return {
    id: String(data.orderCode || id),
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

function mapPublicOrderEntry(id: string, data: Record<string, unknown>): HoodieOrder {
  return {
    id: String(data.orderCode || id),
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

function mapActivityLogEntry(id: string, data: Record<string, unknown>): ActivityLogEntry {
  return {
    id,
    action: String(data.action || ''),
    detail: String(data.detail || ''),
    timestamp: toIsoString(data.createdAt),
  };
}

function mapAdminTeamEntry(id: string, data: Record<string, unknown>): AdminTeamMember {
  return {
    id,
    name: String(data.name || ''),
    role: String(data.role || ''),
    bio: String(data.bio || ''),
    photo: data.photo ? String(data.photo) : undefined,
    social: data.social ? String(data.social) : undefined,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
  };
}

function sortEntriesByTimestampDesc(
  entries: Array<{ id: string; data: Record<string, unknown> }>,
  field: string,
  fallbackField?: string
) {
  return [...entries].sort((a, b) => {
    const at = toEpochMs(a.data[field]) || (fallbackField ? toEpochMs(a.data[fallbackField]) : 0);
    const bt = toEpochMs(b.data[field]) || (fallbackField ? toEpochMs(b.data[fallbackField]) : 0);
    return bt - at;
  });
}

function sortEntriesBySortOrderAsc(entries: Array<{ id: string; data: Record<string, unknown> }>) {
  return [...entries].sort((a, b) => {
    const ao = typeof a.data.sortOrder === 'number' ? a.data.sortOrder : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.data.sortOrder === 'number' ? b.data.sortOrder : Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

export function subscribePublicPortalFromRtdb(callbacks: PublicFirestoreCallbacks): () => void {
  const unsubBatchmates = onValue(
    ref(rtdb, 'batchmates'),
    (snap) => {
      const sorted = sortEntriesByTimestampDesc(snapshotToEntries(snap), 'createdAt', 'registeredAt');
      callbacks.onBatchmates(sorted.map((e) => mapBatchmateEntry(e.id, e.data)));
    },
    (err) => callbacks.onError?.(err, 'batchmates')
  );

  const unsubNotices = onValue(
    ref(rtdb, 'notices'),
    (snap) => {
      const sorted = sortEntriesByTimestampDesc(snapshotToEntries(snap), 'updatedAt', 'createdAt');
      callbacks.onNotices(sorted.map((e) => mapNoticeEntry(e.id, e.data)));
    },
    (err) => callbacks.onError?.(err, 'notices')
  );

  const unsubGallery = onValue(
    ref(rtdb, 'gallery'),
    (snap) => {
      const sorted = sortEntriesBySortOrderAsc(snapshotToEntries(snap));
      callbacks.onGallery(sorted.map((e) => mapGalleryEntry(e.id, e.data)));
    },
    (err) => callbacks.onError?.(err, 'gallery')
  );

  const unsubAdminTeam = onValue(
    ref(rtdb, 'adminTeam'),
    (snap) => {
      const sorted = sortEntriesBySortOrderAsc(snapshotToEntries(snap));
      callbacks.onAdminTeam(sorted.map((e) => mapAdminTeamEntry(e.id, e.data)));
    },
    (err) => callbacks.onError?.(err, 'adminTeam')
  );

  const unsubPublicOrders = callbacks.onPublicOrders
    ? onValue(
        ref(rtdb, 'publicHoodieOrders'),
        (snap) => {
          const sorted = sortEntriesByTimestampDesc(snapshotToEntries(snap), 'createdAt');
          callbacks.onPublicOrders?.(sorted.map((e) => mapPublicOrderEntry(e.id, e.data)));
        },
        (err) => callbacks.onError?.(err, 'publicHoodieOrders')
      )
    : () => {};

  const unsubSettings = onValue(
    ref(rtdb, 'settings/main'),
    (snap) => {
      const data = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
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
    (err) => callbacks.onError?.(err, 'settings/main')
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

export function subscribeAdminDataFromRtdb(callbacks: AdminFirestoreCallbacks): () => void {
  const unsubOrders = onValue(
    ref(rtdb, 'orders'),
    (snap) => {
      const sorted = sortEntriesByTimestampDesc(snapshotToEntries(snap), 'createdAt');
      callbacks.onOrders(sorted.map((e) => mapOrderEntry(e.id, e.data)));
    },
    (err) => callbacks.onError?.(err, 'orders')
  );

  const unsubLogs = onValue(
    query(ref(rtdb, 'activityLogs'), limitToLast(50)),
    (snap) => {
      const sorted = sortEntriesByTimestampDesc(snapshotToEntries(snap), 'createdAt');
      callbacks.onActivityLogs(sorted.map((e) => mapActivityLogEntry(e.id, e.data)));
    },
    (err) => callbacks.onError?.(err, 'activityLogs')
  );

  const unsubContacts = callbacks.onBatchmateContacts
    ? onValue(
        ref(rtdb, 'batchmateContacts'),
        (snap) => {
          callbacks.onBatchmateContacts?.(
            snapshotToEntries(snap).map((e) => mapBatchmateContactEntry(e.id, e.data))
          );
        },
        (err) => callbacks.onError?.(err, 'batchmateContacts')
      )
    : () => {};

  return () => {
    unsubOrders();
    unsubLogs();
    unsubContacts();
  };
}

export async function fetchPublicPortalFromRtdb() {
  const [bmRes, noticeRes, galleryRes, adminTeamRes, publicOrdersRes, settingsRes] = await Promise.allSettled([
    get(ref(rtdb, 'batchmates')),
    get(ref(rtdb, 'notices')),
    get(ref(rtdb, 'gallery')),
    get(ref(rtdb, 'adminTeam')),
    get(ref(rtdb, 'publicHoodieOrders')),
    get(ref(rtdb, 'settings/main')),
  ]);

  if (bmRes.status === 'rejected' && galleryRes.status === 'rejected' && settingsRes.status === 'rejected') {
    throw bmRes.reason;
  }

  const batchmates: Batchmate[] =
    bmRes.status === 'fulfilled'
      ? sortEntriesByTimestampDesc(snapshotToEntries(bmRes.value), 'createdAt', 'registeredAt').map((e) =>
          mapBatchmateEntry(e.id, e.data)
        )
      : [];
  const notices: BatchNotice[] =
    noticeRes.status === 'fulfilled'
      ? sortEntriesByTimestampDesc(snapshotToEntries(noticeRes.value), 'updatedAt', 'createdAt').map((e) =>
          mapNoticeEntry(e.id, e.data)
        )
      : [];
  const gallery: GalleryItem[] =
    galleryRes.status === 'fulfilled'
      ? sortEntriesBySortOrderAsc(snapshotToEntries(galleryRes.value)).map((e) => mapGalleryEntry(e.id, e.data))
      : [];
  const adminTeam: AdminTeamMember[] =
    adminTeamRes.status === 'fulfilled'
      ? sortEntriesBySortOrderAsc(snapshotToEntries(adminTeamRes.value)).map((e) =>
          mapAdminTeamEntry(e.id, e.data)
        )
      : [];
  const publicOrders: HoodieOrder[] =
    publicOrdersRes.status === 'fulfilled'
      ? sortEntriesByTimestampDesc(snapshotToEntries(publicOrdersRes.value), 'createdAt').map((e) =>
          mapPublicOrderEntry(e.id, e.data)
        )
      : [];
  const settingsData =
    settingsRes.status === 'fulfilled' && settingsRes.value.exists()
      ? (settingsRes.value.val() as Record<string, unknown>)
      : null;

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

export async function fetchAdminDataFromRtdb() {
  const [orderSnap, logSnap, contactSnap] = await Promise.all([
    get(ref(rtdb, 'orders')),
    get(query(ref(rtdb, 'activityLogs'), limitToLast(50))),
    get(ref(rtdb, 'batchmateContacts')),
  ]);

  const orders = sortEntriesByTimestampDesc(snapshotToEntries(orderSnap), 'createdAt').map((e) =>
    mapOrderEntry(e.id, e.data)
  );
  const activityLog = sortEntriesByTimestampDesc(snapshotToEntries(logSnap), 'createdAt').map((e) =>
    mapActivityLogEntry(e.id, e.data)
  );
  const batchmateContacts = snapshotToEntries(contactSnap).map((e) => mapBatchmateContactEntry(e.id, e.data));

  return { orders, activityLog, batchmateContacts };
}

export async function createBatchmateInRtdb(bm: Batchmate): Promise<Batchmate> {
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100) || 'Batchmate';
  const nickname = clampStr(bm.nickname, 60);
  const roll = clampStr(bm.roll, 32) || '2700';
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const social = clampStr(bm.social, 100);
  const quote = clampStr(bm.quote, 400);
  const photo = bm.photo?.trim() && bm.photo.length <= MAX_RTDB_IMAGE_LENGTH ? bm.photo.trim() : '';
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

  const nowIso = new Date().toISOString();
  const fields = stripUndefined<Record<string, unknown>>({
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
    createdAt: nowIso,
  });

  await set(ref(rtdb, `batchmates/${id}`), fields);

  if (email || phone) {
    const contactFields = stripUndefined<Record<string, unknown>>({
      batchmateId: id,
      name,
      roll,
      group,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      createdAt: nowIso,
    });
    await set(ref(rtdb, `batchmateContacts/${id}`), contactFields).catch(() => {
      // Ignore if duplicate create rule blocks overwrite
    });
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

export async function updateBatchmateInRtdb(bm: Batchmate): Promise<void> {
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100) || 'Batchmate';
  const roll = clampStr(bm.roll, 32) || '2700';
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const payload = stripUndefined<Record<string, unknown>>({
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
    ...(bm.photo !== undefined
      ? { photo: bm.photo.trim() && bm.photo.length <= MAX_RTDB_IMAGE_LENGTH ? bm.photo.trim() : '' }
      : {}),
    ...(bm.registeredAt ? { registeredAt: clampStr(bm.registeredAt, 32) } : {}),
  });

  const targetRef = ref(rtdb, `batchmates/${id}`);
  const existingSnap = await get(targetRef);
  if (existingSnap.exists()) {
    await update(targetRef, payload);
  } else {
    await set(targetRef, {
      ...payload,
      registeredAt: payload.registeredAt || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });
  }

  if (bm.email !== undefined || bm.phone !== undefined) {
    const contactRef = ref(rtdb, `batchmateContacts/${id}`);
    const contactPayload = stripUndefined<Record<string, unknown>>({
      batchmateId: id,
      name,
      roll,
      group,
      email: clampStr(bm.email, 160),
      phone: clampStr(bm.phone, 40),
    });
    const contactSnap = await get(contactRef);
    if (contactSnap.exists()) {
      await update(contactRef, contactPayload);
    } else if (contactPayload.email || contactPayload.phone) {
      await set(contactRef, { ...contactPayload, createdAt: new Date().toISOString() });
    }
  }
}

export async function deleteBatchmateInRtdb(id: string): Promise<void> {
  const docId = sanitizeId(id, 'bm');
  await Promise.all([
    remove(ref(rtdb, `batchmates/${docId}`)),
    remove(ref(rtdb, `batchmateContacts/${docId}`)).catch(() => {}),
  ]);
}

export async function createOrderInRtdb(order: HoodieOrder): Promise<HoodieOrder> {
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
  const createdAt = order.createdAt || new Date().toISOString();

  await Promise.all([
    set(
      ref(rtdb, `orders/${id}`),
      stripUndefined({
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
        createdAt,
      })
    ),
    set(
      ref(rtdb, `publicHoodieOrders/${id}`),
      stripUndefined({
        orderCode: id,
        customerName,
        roll,
        size,
        quantity,
        ...(notes ? { notes } : {}),
        status,
        paymentStatus,
        createdAt,
      })
    ),
  ]);

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
    createdAt,
  };
}

export async function updateOrderStatusInRtdb(
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

  const orderRef = ref(rtdb, `orders/${docId}`);
  const pubRef = ref(rtdb, `publicHoodieOrders/${docId}`);
  await update(orderRef, stripUndefined(payload));

  const pubSnap = await get(pubRef);
  if (pubSnap.exists()) {
    await update(pubRef, stripUndefined(publicPayload));
  } else {
    const orderSnap = await get(orderRef);
    if (orderSnap.exists()) {
      const base = orderSnap.val() as Record<string, unknown>;
      const mergedNotes =
        publicPayload.notes !== undefined
          ? String(publicPayload.notes)
          : base.notes
            ? String(base.notes)
            : '';
      await set(
        pubRef,
        stripUndefined({
          orderCode: String(base.orderCode || docId).slice(0, 32),
          customerName: String(publicPayload.customerName || base.customerName || 'Student').slice(0, 100),
          roll: String(publicPayload.roll || base.roll || '0000').slice(0, 32),
          size: (publicPayload.size || base.size || 'L') as HoodieOrder['size'],
          quantity: Number(publicPayload.quantity || base.quantity || 1),
          ...(mergedNotes ? { notes: mergedNotes } : {}),
          status: safeStatus,
          paymentStatus: (publicPayload.paymentStatus || base.paymentStatus || 'Due') as PaymentStatus,
          createdAt: String(base.createdAt || new Date().toISOString()),
        })
      );
    }
  }
}

export async function deleteOrderInRtdb(id: string): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  await Promise.all([
    remove(ref(rtdb, `orders/${docId}`)),
    remove(ref(rtdb, `publicHoodieOrders/${docId}`)).catch(() => {}),
  ]);
}

export async function createNoticeInRtdb(notice: BatchNotice): Promise<void> {
  const id = sanitizeId(notice.id, 'notice');
  const title = clampStr(notice.title, 140) || 'Notice';
  const message = clampStr(notice.message, 1000) || 'Details updated.';
  const category = ['General', 'Urgent', 'Event'].includes(notice.category) ? notice.category : 'General';
  const createdAt = clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32);

  await set(ref(rtdb, `notices/${id}`), {
    title,
    message,
    category,
    pinned: Boolean(notice.pinned),
    active: Boolean(notice.active),
    createdAt,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateNoticeInRtdb(notice: BatchNotice): Promise<void> {
  const id = sanitizeId(notice.id, 'notice');
  const title = clampStr(notice.title, 140) || 'Notice';
  const message = clampStr(notice.message, 1000) || 'Details updated.';
  const category = ['General', 'Urgent', 'Event'].includes(notice.category) ? notice.category : 'General';

  const targetRef = ref(rtdb, `notices/${id}`);
  const snap = await get(targetRef);
  if (snap.exists()) {
    await update(targetRef, {
      title,
      message,
      category,
      pinned: Boolean(notice.pinned),
      active: Boolean(notice.active),
      updatedAt: new Date().toISOString(),
    });
  } else {
    await set(targetRef, {
      title,
      message,
      category,
      pinned: Boolean(notice.pinned),
      active: Boolean(notice.active),
      createdAt: clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function deleteNoticeInRtdb(id: string): Promise<void> {
  await remove(ref(rtdb, `notices/${sanitizeId(id, 'notice')}`));
}

export async function saveGalleryItemInRtdb(item: GalleryItem, sortOrder: number): Promise<void> {
  const id = sanitizeId(item.id, 'gal');
  const src = item.src && item.src.length <= MAX_RTDB_IMAGE_LENGTH ? item.src : '';
  const title = clampStr(item.title, 140) || 'Untitled Memory';
  const caption = clampStr(item.caption, 400);
  const date = clampStr(item.date, 40);
  const isVideo = Boolean(item.isVideo);
  const videoUrl = clampStr(item.videoUrl, 500);
  const clampedSort = Math.max(0, Math.min(10000, Math.round(sortOrder)));

  await set(
    ref(rtdb, `gallery/${id}`),
    stripUndefined({
      src,
      title,
      caption,
      ...(date ? { date } : {}),
      isVideo,
      ...(videoUrl ? { videoUrl } : {}),
      sortOrder: clampedSort,
      updatedAt: new Date().toISOString(),
    })
  );
}

export async function deleteGalleryItemInRtdb(id: string): Promise<void> {
  await remove(ref(rtdb, `gallery/${sanitizeId(id, 'gal')}`));
}

export async function saveAdminTeamMemberInRtdb(member: AdminTeamMember, sortOrder: number): Promise<void> {
  const id = sanitizeId(member.id, 'admin');
  const name = clampStr(member.name, 100) || 'Organizer';
  const role = clampStr(member.role, 120) || 'Batch Admin';
  const bio = clampStr(member.bio, 500);
  const photo = member.photo && member.photo.trim().length <= MAX_RTDB_IMAGE_LENGTH ? member.photo.trim() : '';
  const social = clampStr(member.social, 200);
  const clampedSort = Math.max(0, Math.min(10000, Math.round(sortOrder)));

  await set(
    ref(rtdb, `adminTeam/${id}`),
    stripUndefined({
      name,
      role,
      bio,
      ...(photo ? { photo } : {}),
      ...(social ? { social } : {}),
      sortOrder: clampedSort,
      updatedAt: new Date().toISOString(),
    })
  );
}

export async function deleteAdminTeamMemberInRtdb(id: string): Promise<void> {
  await remove(ref(rtdb, `adminTeam/${sanitizeId(id, 'admin')}`));
}

export async function saveSettingsInRtdb(
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
    frontImage:
      hoodieConfig.frontImage && hoodieConfig.frontImage.length <= MAX_RTDB_IMAGE_LENGTH
        ? hoodieConfig.frontImage
        : '',
    backImage:
      hoodieConfig.backImage && hoodieConfig.backImage.length <= MAX_RTDB_IMAGE_LENGTH
        ? hoodieConfig.backImage
        : '',
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
  if (siteConfig.heroImage !== undefined && siteConfig.heroImage.length <= MAX_RTDB_IMAGE_LENGTH) {
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

  const safeProfile = profile && profile.length <= MAX_RTDB_IMAGE_LENGTH ? profile : '';

  await set(
    ref(rtdb, 'settings/main'),
    stripUndefined({
      profile: safeProfile,
      hoodieConfig: safeHoodie,
      siteConfig: safeSite,
      updatedAt: new Date().toISOString(),
    })
  );
}

export async function addActivityLogInRtdb(action: string, detail: string): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  await set(ref(rtdb, `activityLogs/${id}`), {
    action: clampStr(action, 80) || 'Admin Action',
    detail: clampStr(detail, 300) || 'Action recorded',
    createdAt: new Date().toISOString(),
  });
}

export async function seedDefaultsIfEmptyInRtdb(defaults: PortalState): Promise<void> {
  const [bmSnap, gallerySnap, settingsSnap] = await Promise.all([
    get(ref(rtdb, 'batchmates')),
    get(ref(rtdb, 'gallery')),
    get(ref(rtdb, 'settings/main')),
  ]);

  if (settingsSnap.exists() || bmSnap.exists() || gallerySnap.exists()) {
    return;
  }

  await syncPortalStateInRtdb(defaults, false);
}

export async function syncPortalStateInRtdb(nextState: PortalState, replaceCollections: boolean): Promise<void> {
  await Promise.all([
    ...nextState.batchmates.map((bm) => createBatchmateInRtdb(bm)),
    ...(nextState.notices || []).map((n) => createNoticeInRtdb(n)),
    ...nextState.gallery.map((g, idx) => saveGalleryItemInRtdb(g, idx)),
    ...(nextState.adminTeam || []).map((m, idx) => saveAdminTeamMemberInRtdb(m, idx)),
    ...(nextState.orders || []).map((o) => createOrderInRtdb(o)),
    saveSettingsInRtdb(nextState.profile, nextState.hoodieConfig, nextState.siteConfig),
  ]);

  if (replaceCollections) {
    const keepBmIds = new Set(nextState.batchmates.map((bm) => sanitizeId(bm.id, 'bm')));
    const keepNoticeIds = new Set((nextState.notices || []).map((n) => sanitizeId(n.id, 'notice')));
    const keepGalleryIds = new Set(nextState.gallery.map((g) => sanitizeId(g.id, 'gal')));
    const keepTeamIds = new Set((nextState.adminTeam || []).map((m) => sanitizeId(m.id, 'admin')));

    const [bmSnap, contactSnap, noticeSnap, gallerySnap, adminTeamSnap] = await Promise.all([
      get(ref(rtdb, 'batchmates')),
      get(ref(rtdb, 'batchmateContacts')),
      get(ref(rtdb, 'notices')),
      get(ref(rtdb, 'gallery')),
      get(ref(rtdb, 'adminTeam')),
    ]);

    await Promise.all([
      ...snapshotToEntries(bmSnap)
        .filter((e) => !keepBmIds.has(e.id))
        .map((e) => remove(ref(rtdb, `batchmates/${e.id}`))),
      ...snapshotToEntries(contactSnap)
        .filter((e) => !keepBmIds.has(e.id))
        .map((e) => remove(ref(rtdb, `batchmateContacts/${e.id}`))),
      ...snapshotToEntries(noticeSnap)
        .filter((e) => !keepNoticeIds.has(e.id))
        .map((e) => remove(ref(rtdb, `notices/${e.id}`))),
      ...snapshotToEntries(gallerySnap)
        .filter((e) => !keepGalleryIds.has(e.id))
        .map((e) => remove(ref(rtdb, `gallery/${e.id}`))),
      ...snapshotToEntries(adminTeamSnap)
        .filter((e) => !keepTeamIds.has(e.id))
        .map((e) => remove(ref(rtdb, `adminTeam/${e.id}`))),
    ]);
  }
}
