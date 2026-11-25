import { auth } from '../firebase';
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
import {
  addActivityLogInFirestore,
  createBatchmateInFirestore,
  createNoticeInFirestore,
  createOrderInFirestore,
  deleteBatchmateInFirestore,
  deleteGalleryItemInFirestore,
  deleteNoticeInFirestore,
  deleteOrderInFirestore,
  fetchAdminDataFromFirestore,
  fetchPublicPortalFromFirestore,
  saveGalleryItemInFirestore,
  saveSettingsInFirestore,
  seedDefaultsIfEmptyInFirestore,
  subscribeAdminDataFromFirestore,
  subscribePublicPortalFromFirestore,
  syncPortalStateInFirestore,
  updateBatchmateInFirestore,
  updateNoticeInFirestore,
  updateOrderStatusInFirestore,
  type AdminFirestoreCallbacks,
  type PublicFirestoreCallbacks,
} from './firestoreFallback';

let usingFirestoreBackend = false;

export function isUsingFirestoreBackend(): boolean {
  return usingFirestoreBackend;
}

export function subscribePublicPortalInFirestore(callbacks: PublicFirestoreCallbacks): () => void {
  return subscribePublicPortalFromFirestore(callbacks);
}

export function subscribeAdminDataInFirestore(callbacks: AdminFirestoreCallbacks): () => void {
  return subscribeAdminDataFromFirestore(callbacks);
}

class SchemaNotReadyError extends Error {
  constructor() {
    super('SUPABASE_SCHEMA_MISSING');
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const meta = (payload && typeof payload === 'object' ? payload : {}) as {
    error?: string;
    code?: string;
    useFallback?: boolean;
  };
  if (meta.useFallback && meta.code === 'SUPABASE_SCHEMA_MISSING') {
    throw new SchemaNotReadyError();
  }
  if (!res.ok) {
    if (
      res.status >= 502 ||
      (res.status === 500 && meta.code === 'SUPABASE_SCHEMA_MISSING') ||
      meta.code === 'SUPABASE_SCHEMA_MISSING'
    ) {
      throw new SchemaNotReadyError();
    }
    throw new Error(meta.error || 'Request failed');
  }
  return payload as T;
}

async function withSupabaseOrFallback<T>(supabaseCall: () => Promise<T>, fallbackCall: () => Promise<T>): Promise<T> {
  try {
    const result = await supabaseCall();
    usingFirestoreBackend = false;
    return result;
  } catch (err) {
    if (err instanceof SchemaNotReadyError) {
      usingFirestoreBackend = true;
      return fallbackCall();
    }
    throw err;
  }
}

export interface PublicPortalPayload {
  batchmates: Batchmate[];
  notices: BatchNotice[];
  gallery: GalleryItem[];
  settings: {
    profile: string;
    hoodieConfig: HoodieConfig;
    siteConfig: SiteConfig;
  } | null;
}

export interface AdminPortalPayload {
  orders: HoodieOrder[];
  activityLog: ActivityLogEntry[];
}

export async function fetchPublicPortal(): Promise<PublicPortalPayload> {
  return withSupabaseOrFallback(
    async () => {
      const res = await fetch('/api/portal');
      return handleApiResponse<PublicPortalPayload>(res);
    },
    () => fetchPublicPortalFromFirestore()
  );
}

export async function fetchAdminData(): Promise<AdminPortalPayload> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/data', { headers });
      return handleApiResponse<AdminPortalPayload>(res);
    },
    () => fetchAdminDataFromFirestore()
  );
}

export async function createBatchmateInDb(bm: Batchmate): Promise<Batchmate> {
  return withSupabaseOrFallback(
    async () => {
      const res = await fetch('/api/batchmates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bm),
      });
      return handleApiResponse<Batchmate>(res);
    },
    () => createBatchmateInFirestore(bm)
  );
}

export async function updateBatchmateInDb(bm: Batchmate): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/batchmates/${encodeURIComponent(bm.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(bm),
      });
      await handleApiResponse(res);
    },
    () => updateBatchmateInFirestore(bm)
  );
}

export async function deleteBatchmateInDb(id: string): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/batchmates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      await handleApiResponse(res);
    },
    () => deleteBatchmateInFirestore(id)
  );
}

export async function createOrderInDb(order: HoodieOrder): Promise<HoodieOrder> {
  return withSupabaseOrFallback(
    async () => {
      const useAdminEndpoint = Boolean(auth.currentUser && order.status !== 'Pending');
      const endpoint = useAdminEndpoint ? '/api/admin/orders' : '/api/orders';
      const headers = useAdminEndpoint ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(order),
      });
      return handleApiResponse<HoodieOrder>(res);
    },
    () => createOrderInFirestore(order)
  );
}

export async function updateOrderStatusInDb(
  id: string,
  status: OrderStatus,
  notes?: string,
  extra?: Partial<Pick<HoodieOrder, 'customerName' | 'roll' | 'size' | 'quantity' | 'contact'>>
): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, notes, ...(extra || {}) }),
      });
      await handleApiResponse(res);
    },
    () => updateOrderStatusInFirestore(id, status, notes, extra)
  );
}

export async function deleteOrderInDb(id: string): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      await handleApiResponse(res);
    },
    () => deleteOrderInFirestore(id)
  );
}

export async function createNoticeInDb(notice: BatchNotice): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/notices', {
        method: 'POST',
        headers,
        body: JSON.stringify(notice),
      });
      await handleApiResponse(res);
    },
    () => createNoticeInFirestore(notice)
  );
}

export async function updateNoticeInDb(notice: BatchNotice): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/notices/${encodeURIComponent(notice.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(notice),
      });
      await handleApiResponse(res);
    },
    () => updateNoticeInFirestore(notice)
  );
}

export async function deleteNoticeInDb(id: string): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/notices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      await handleApiResponse(res);
    },
    () => deleteNoticeInFirestore(id)
  );
}

export async function saveGalleryItemInDb(item: GalleryItem, sortOrder: number): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/gallery/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ item, sortOrder }),
      });
      await handleApiResponse(res);
    },
    () => saveGalleryItemInFirestore(item, sortOrder)
  );
}

export async function reorderGalleryInDb(items: GalleryItem[]): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/gallery/reorder', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ items }),
      });
      await handleApiResponse(res);
    },
    async () => {
      await Promise.all(items.map((item, idx) => saveGalleryItemInFirestore(item, idx)));
    }
  );
}

export async function deleteGalleryItemInDb(id: string): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/gallery/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      await handleApiResponse(res);
    },
    () => deleteGalleryItemInFirestore(id)
  );
}

export async function saveSettingsInDb(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ profile, hoodieConfig, siteConfig }),
      });
      await handleApiResponse(res);
    },
    () => saveSettingsInFirestore(profile, hoodieConfig, siteConfig)
  );
}

export async function addActivityLogInDb(action: string, detail: string): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, detail }),
      });
      await handleApiResponse(res);
    },
    () => addActivityLogInFirestore(action, detail)
  );
}

export async function seedDefaultsIfEmptyInDb(defaults: PortalState): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers,
        body: JSON.stringify(defaults),
      });
      await handleApiResponse(res);
    },
    () => seedDefaultsIfEmptyInFirestore(defaults)
  );
}

export async function syncPortalStateInDb(state: PortalState, replaceCollections: boolean): Promise<void> {
  return withSupabaseOrFallback(
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ state, replaceCollections }),
      });
      await handleApiResponse(res);
    },
    () => syncPortalStateInFirestore(state, replaceCollections)
  );
}
