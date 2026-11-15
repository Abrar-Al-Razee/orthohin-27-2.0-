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

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Ignore parse error
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
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
  const res = await fetch('/api/portal');
  return handleJsonResponse<PublicPortalPayload>(res);
}

export async function fetchAdminData(): Promise<AdminPortalPayload> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/data', { headers });
  return handleJsonResponse<AdminPortalPayload>(res);
}

export async function createBatchmateInDb(bm: Batchmate): Promise<Batchmate> {
  const res = await fetch('/api/batchmates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bm),
  });
  return handleJsonResponse<Batchmate>(res);
}

export async function updateBatchmateInDb(bm: Batchmate): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/batchmates/${encodeURIComponent(bm.id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(bm),
  });
  await handleJsonResponse(res);
}

export async function deleteBatchmateInDb(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/batchmates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  await handleJsonResponse(res);
}

export async function createOrderInDb(order: HoodieOrder): Promise<HoodieOrder> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  return handleJsonResponse<HoodieOrder>(res);
}

export async function updateOrderStatusInDb(id: string, status: OrderStatus, notes?: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, notes }),
  });
  await handleJsonResponse(res);
}

export async function deleteOrderInDb(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  await handleJsonResponse(res);
}

export async function createNoticeInDb(notice: BatchNotice): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/notices', {
    method: 'POST',
    headers,
    body: JSON.stringify(notice),
  });
  await handleJsonResponse(res);
}

export async function updateNoticeInDb(notice: BatchNotice): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/notices/${encodeURIComponent(notice.id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(notice),
  });
  await handleJsonResponse(res);
}

export async function deleteNoticeInDb(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/notices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  await handleJsonResponse(res);
}

export async function saveGalleryItemInDb(item: GalleryItem, sortOrder: number): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/gallery/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ item, sortOrder }),
  });
  await handleJsonResponse(res);
}

export async function reorderGalleryInDb(items: GalleryItem[]): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/gallery/reorder', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ items }),
  });
  await handleJsonResponse(res);
}

export async function deleteGalleryItemInDb(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/gallery/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  await handleJsonResponse(res);
}

export async function saveSettingsInDb(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ profile, hoodieConfig, siteConfig }),
  });
  await handleJsonResponse(res);
}

export async function addActivityLogInDb(action: string, detail: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/logs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, detail }),
  });
  await handleJsonResponse(res);
}

export async function seedDefaultsIfEmptyInDb(defaults: PortalState): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/seed', {
    method: 'POST',
    headers,
    body: JSON.stringify(defaults),
  });
  await handleJsonResponse(res);
}

export async function syncPortalStateInDb(state: PortalState, replaceCollections: boolean): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({ state, replaceCollections }),
  });
  await handleJsonResponse(res);
}
