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
  addActivityLogInFirestore,
  createBatchmateInFirestore,
  createNoticeInFirestore,
  createOrderInFirestore,
  deleteAdminTeamMemberInFirestore,
  deleteBatchmateInFirestore,
  deleteGalleryItemInFirestore,
  deleteNoticeInFirestore,
  deleteOrderInFirestore,
  fetchAdminDataFromFirestore,
  fetchPublicPortalFromFirestore,
  saveAdminTeamMemberInFirestore,
  saveGalleryItemInFirestore,
  saveSettingsInFirestore,
  syncPortalStateInFirestore,
  updateBatchmateInFirestore,
  updateNoticeInFirestore,
  updateOrderStatusInFirestore,
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

const FIRESTORE_IMAGE_CAP = 350000;

function fitsFirestoreImage(val: string | undefined): boolean {
  return !val || val.length <= FIRESTORE_IMAGE_CAP;
}

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

export async function createBatchmateInDb(bm: Batchmate): Promise<Batchmate> {
  const saved = await createBatchmateInRtdb(bm);
  if (fitsFirestoreImage(bm.photo)) {
    void createBatchmateInFirestore(bm).catch(() => {});
  }
  return saved;
}

export async function updateBatchmateInDb(bm: Batchmate): Promise<void> {
  await updateBatchmateInRtdb(bm);
  if (fitsFirestoreImage(bm.photo)) {
    void updateBatchmateInFirestore(bm).catch(() => {});
  }
}

export async function deleteBatchmateInDb(id: string): Promise<void> {
  await deleteBatchmateInRtdb(id);
  void deleteBatchmateInFirestore(id).catch(() => {});
}

export async function createOrderInDb(order: HoodieOrder): Promise<HoodieOrder> {
  const saved = await createOrderInRtdb(order);
  void createOrderInFirestore(order).catch(() => {});
  return saved;
}

export async function updateOrderStatusInDb(
  id: string,
  status: OrderStatus,
  notes?: string,
  extra?: Partial<Pick<HoodieOrder, 'customerName' | 'roll' | 'size' | 'quantity' | 'contact' | 'email' | 'paymentStatus'>>
): Promise<void> {
  await updateOrderStatusInRtdb(id, status, notes, extra);
  void updateOrderStatusInFirestore(id, status, notes, extra).catch(() => {});
}

export async function deleteOrderInDb(id: string): Promise<void> {
  await deleteOrderInRtdb(id);
  void deleteOrderInFirestore(id).catch(() => {});
}

export async function createNoticeInDb(notice: BatchNotice): Promise<void> {
  await createNoticeInRtdb(notice);
  void createNoticeInFirestore(notice).catch(() => {});
}

export async function updateNoticeInDb(notice: BatchNotice): Promise<void> {
  await updateNoticeInRtdb(notice);
  void updateNoticeInFirestore(notice).catch(() => {});
}

export async function deleteNoticeInDb(id: string): Promise<void> {
  await deleteNoticeInRtdb(id);
  void deleteNoticeInFirestore(id).catch(() => {});
}

export async function saveGalleryItemInDb(item: GalleryItem, sortOrder: number): Promise<void> {
  await saveGalleryItemInRtdb(item, sortOrder);
  if (fitsFirestoreImage(item.src)) {
    void saveGalleryItemInFirestore(item, sortOrder).catch(() => {});
  }
}

export async function reorderGalleryInDb(items: GalleryItem[]): Promise<void> {
  await Promise.all(items.map((item, idx) => saveGalleryItemInDb(item, idx)));
}

export async function deleteGalleryItemInDb(id: string): Promise<void> {
  await deleteGalleryItemInRtdb(id);
  void deleteGalleryItemInFirestore(id).catch(() => {});
}

export async function saveAdminTeamMemberInDb(member: AdminTeamMember, sortOrder: number): Promise<void> {
  await saveAdminTeamMemberInRtdb(member, sortOrder);
  if (fitsFirestoreImage(member.photo)) {
    void saveAdminTeamMemberInFirestore(member, sortOrder).catch(() => {});
  }
}

export async function reorderAdminTeamInDb(members: AdminTeamMember[]): Promise<void> {
  await Promise.all(members.map((m, idx) => saveAdminTeamMemberInDb(m, idx)));
}

export async function deleteAdminTeamMemberInDb(id: string): Promise<void> {
  await deleteAdminTeamMemberInRtdb(id);
  void deleteAdminTeamMemberInFirestore(id).catch(() => {});
}

export async function saveSettingsInDb(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  await saveSettingsInRtdb(profile, hoodieConfig, siteConfig);
  if (
    fitsFirestoreImage(profile) &&
    fitsFirestoreImage(hoodieConfig.frontImage) &&
    fitsFirestoreImage(hoodieConfig.backImage) &&
    fitsFirestoreImage(siteConfig.heroImage)
  ) {
    void saveSettingsInFirestore(profile, hoodieConfig, siteConfig).catch(() => {});
  }
}

export async function addActivityLogInDb(action: string, detail: string): Promise<void> {
  await addActivityLogInRtdb(action, detail);
  void addActivityLogInFirestore(action, detail).catch(() => {});
}

export async function seedDefaultsIfEmptyInDb(defaults: PortalState): Promise<void> {
  return seedDefaultsIfEmptyInRtdb(defaults);
}

export async function syncPortalStateInDb(state: PortalState, replaceCollections: boolean): Promise<void> {
  await syncPortalStateInRtdb(state, replaceCollections);
  void syncPortalStateInFirestore(state, replaceCollections).catch(() => {});
}

export async function migrateFirestoreToRtdb(currentFallback: PortalState): Promise<{
  batchmates: number;
  gallery: number;
  orders: number;
  notices: number;
}> {
  const pub = await fetchPublicPortalFromFirestore();
  let orders: HoodieOrder[] = [];
  let contactsByBmId: Record<string, BatchmateContact> = {};
  let activityLog: ActivityLogEntry[] = [];

  try {
    const adminData = await fetchAdminDataFromFirestore();
    orders = adminData.orders;
    activityLog = adminData.activityLog;
    for (const c of adminData.batchmateContacts || []) {
      contactsByBmId[c.batchmateId] = c;
    }
  } catch {
    orders = pub.publicOrders || [];
  }

  const hydratedBatchmates = pub.batchmates.map((bm) => ({
    ...bm,
    email: contactsByBmId[bm.id]?.email ?? bm.email,
    phone: contactsByBmId[bm.id]?.phone ?? bm.phone,
  }));

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
  };
}
