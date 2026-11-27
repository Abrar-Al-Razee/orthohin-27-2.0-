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
  PortalState,
  SiteConfig,
} from '../types';
import {
  fetchAdminDataFromFirestore,
  fetchAdminDataFromFirestoreCacheOnly,
  fetchPublicPortalFromFirestore,
  fetchPublicPortalFromFirestoreCacheOnly,
  syncPortalStateInFirestore,
  type AdminFirestoreCallbacks,
  type PublicFirestoreCallbacks,
} from './firestoreFallback';
import {
  addActivityLogInRtdb,
  createBatchmateInRtdb,
  createNoticeInRtdb,
  createOrderInRtdb,
  deleteAdminTeamMemberInRtdb,
  deleteBatchmateInRtdb,
  deleteGalleryItemInRtdb,
  deleteNoticeInRtdb,
  deleteOrderInRtdb,
  fetchAdminDataFromRtdb,
  fetchPublicPortalFromRtdb,
  saveAdminTeamMemberInRtdb,
  saveGalleryItemInRtdb,
  saveSettingsInRtdb,
  seedDefaultsIfEmptyInRtdb,
  subscribeAdminDataFromRtdb,
  subscribePublicPortalFromRtdb,
  syncPortalStateInRtdb,
  updateBatchmateInRtdb,
  updateNoticeInRtdb,
  updateOrderStatusInRtdb,
} from './rtdbService';

export function isUsingFirestoreBackend(): boolean {
  return true;
}

export function subscribePublicPortalInFirestore(callbacks: PublicFirestoreCallbacks): () => void {
  return subscribePublicPortalFromRtdb(callbacks);
}

export function subscribeAdminDataInFirestore(callbacks: AdminFirestoreCallbacks): () => void {
  return subscribeAdminDataFromRtdb(callbacks);
}

export interface PublicPortalPayload {
  batchmates: Batchmate[];
  notices: BatchNotice[];
  gallery: GalleryItem[];
  adminTeam?: AdminTeamMember[];
  publicOrders?: HoodieOrder[];
  settings: {
    profile: string;
    hoodieConfig: HoodieConfig;
    siteConfig: SiteConfig;
  } | null;
}

export interface AdminPortalPayload {
  orders: HoodieOrder[];
  activityLog: ActivityLogEntry[];
  batchmateContacts?: BatchmateContact[];
}

export async function fetchPublicPortal(): Promise<PublicPortalPayload> {
  return fetchPublicPortalFromRtdb();
}

export async function fetchAdminData(): Promise<AdminPortalPayload> {
  return fetchAdminDataFromRtdb();
}

export async function fetchCachedFirestoreSnapshot(): Promise<PublicPortalPayload | null> {
  try {
    const cached = await fetchPublicPortalFromFirestoreCacheOnly();
    const hasData =
      cached.settings !== null ||
      cached.batchmates.length > 0 ||
      cached.gallery.length > 0 ||
      cached.notices.length > 0 ||
      (cached.adminTeam?.length || 0) > 0;
    return hasData ? cached : null;
  } catch {
    return null;
  }
}

export async function createBatchmateInDb(bm: Batchmate): Promise<Batchmate> {
  return createBatchmateInRtdb(bm);
}

export async function updateBatchmateInDb(bm: Batchmate): Promise<void> {
  return updateBatchmateInRtdb(bm);
}

export async function deleteBatchmateInDb(id: string): Promise<void> {
  return deleteBatchmateInRtdb(id);
}

export async function createOrderInDb(order: HoodieOrder): Promise<HoodieOrder> {
  return createOrderInRtdb(order);
}

export async function updateOrderStatusInDb(
  id: string,
  status: OrderStatus,
  notes?: string,
  extra?: Partial<Pick<HoodieOrder, 'customerName' | 'roll' | 'size' | 'quantity' | 'contact' | 'email' | 'paymentStatus'>>
): Promise<void> {
  return updateOrderStatusInRtdb(id, status, notes, extra);
}

export async function deleteOrderInDb(id: string): Promise<void> {
  return deleteOrderInRtdb(id);
}

export async function createNoticeInDb(notice: BatchNotice): Promise<void> {
  return createNoticeInRtdb(notice);
}

export async function updateNoticeInDb(notice: BatchNotice): Promise<void> {
  return updateNoticeInRtdb(notice);
}

export async function deleteNoticeInDb(id: string): Promise<void> {
  return deleteNoticeInRtdb(id);
}

export async function saveGalleryItemInDb(item: GalleryItem, sortOrder: number): Promise<void> {
  return saveGalleryItemInRtdb(item, sortOrder);
}

export async function reorderGalleryInDb(items: GalleryItem[]): Promise<void> {
  await Promise.all(items.map((item, idx) => saveGalleryItemInRtdb(item, idx)));
}

export async function deleteGalleryItemInDb(id: string): Promise<void> {
  return deleteGalleryItemInRtdb(id);
}

export async function saveAdminTeamMemberInDb(member: AdminTeamMember, sortOrder: number): Promise<void> {
  return saveAdminTeamMemberInRtdb(member, sortOrder);
}

export async function reorderAdminTeamInDb(members: AdminTeamMember[]): Promise<void> {
  await Promise.all(members.map((m, idx) => saveAdminTeamMemberInRtdb(m, idx)));
}

export async function deleteAdminTeamMemberInDb(id: string): Promise<void> {
  return deleteAdminTeamMemberInRtdb(id);
}

export async function saveSettingsInDb(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  return saveSettingsInRtdb(profile, hoodieConfig, siteConfig);
}

export async function addActivityLogInDb(action: string, detail: string): Promise<void> {
  return addActivityLogInRtdb(action, detail);
}

export async function seedDefaultsIfEmptyInDb(defaults: PortalState): Promise<void> {
  return seedDefaultsIfEmptyInRtdb(defaults);
}

export async function syncPortalStateInDb(state: PortalState, replaceCollections: boolean): Promise<void> {
  return syncPortalStateInRtdb(state, replaceCollections);
}

export async function migrateFirestoreToRtdb(
  currentFallback: PortalState,
  options?: { cacheOnly?: boolean }
): Promise<{
  batchmates: number;
  gallery: number;
  orders: number;
  notices: number;
  totalMoved: number;
}> {
  let pub = await fetchPublicPortalFromFirestoreCacheOnly().catch(() => null);
  let hasPublicCache =
    pub !== null &&
    (pub.settings !== null ||
      pub.batchmates.length > 0 ||
      pub.gallery.length > 0 ||
      pub.notices.length > 0 ||
      (pub.adminTeam?.length || 0) > 0);

  if (!hasPublicCache && !options?.cacheOnly) {
    pub = await fetchPublicPortalFromFirestore();
  }

  if (!pub) {
    return { batchmates: 0, gallery: 0, orders: 0, notices: 0, totalMoved: 0 };
  }

  let orders: HoodieOrder[] = [];
  const contactsByBmId: Record<string, BatchmateContact> = {};
  let activityLog: ActivityLogEntry[] = [];

  try {
    const cachedAdmin = await fetchAdminDataFromFirestoreCacheOnly();
    if (
      cachedAdmin.orders.length > 0 ||
      cachedAdmin.batchmateContacts.length > 0 ||
      cachedAdmin.activityLog.length > 0
    ) {
      orders = cachedAdmin.orders;
      activityLog = cachedAdmin.activityLog;
      for (const c of cachedAdmin.batchmateContacts) {
        contactsByBmId[c.batchmateId] = c;
      }
    } else if (!options?.cacheOnly) {
      const adminData = await fetchAdminDataFromFirestore();
      orders = adminData.orders;
      activityLog = adminData.activityLog;
      for (const c of adminData.batchmateContacts || []) {
        contactsByBmId[c.batchmateId] = c;
      }
    }
  } catch {
    orders = pub.publicOrders || [];
  }

  const hydratedBatchmates = pub.batchmates.map((bm) => ({
    ...bm,
    email: contactsByBmId[bm.id]?.email ?? bm.email,
    phone: contactsByBmId[bm.id]?.phone ?? bm.phone,
  }));

  const totalMoved =
    hydratedBatchmates.length +
    pub.gallery.length +
    orders.length +
    pub.notices.length +
    (pub.adminTeam?.length || 0) +
    (pub.settings ? 1 : 0);

  if (totalMoved === 0) {
    return { batchmates: 0, gallery: 0, orders: 0, notices: 0, totalMoved: 0 };
  }

  const nextState: PortalState = {
    batchmates: hydratedBatchmates,
    notices: pub.notices,
    gallery: pub.gallery,
    adminTeam: pub.adminTeam || [],
    orders,
    publicOrders: pub.publicOrders || [],
    activityLog,
    profile: pub.settings?.profile || currentFallback.profile,
    hoodieConfig: pub.settings?.hoodieConfig || currentFallback.hoodieConfig,
    siteConfig: pub.settings?.siteConfig || currentFallback.siteConfig,
  };

  await syncPortalStateInRtdb(nextState, false);

  return {
    batchmates: nextState.batchmates.length,
    gallery: nextState.gallery.length,
    orders: nextState.orders.length,
    notices: nextState.notices.length,
    totalMoved,
  };
}

export async function backupRtdbToFirestore(state: PortalState): Promise<void> {
  await syncPortalStateInFirestore(state, false);
}
