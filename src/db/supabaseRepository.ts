import { supabase } from '../lib/supabaseServer.ts';
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
} from '../types.ts';

export class SupabaseSchemaMissingError extends Error {
  readonly code = 'SUPABASE_SCHEMA_MISSING';

  constructor(message = 'Supabase tables have not been created yet.') {
    super(message);
    this.name = 'SupabaseSchemaMissingError';
  }
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

let supabaseOfflineUntil = 0;

export function isSupabaseNetworkOrSchemaMessage(msg: string, code?: string): boolean {
  const lower = msg.toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42501' ||
    lower.includes('schema cache') ||
    lower.includes('does not exist') ||
    lower.includes('row-level security') ||
    lower.includes('invalid api key') ||
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('eai_again') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('network')
  );
}

function assertSupabaseReady(): void {
  if (Date.now() < supabaseOfflineUntil) {
    throw new SupabaseSchemaMissingError('Supabase unreachable; using Firebase Firestore.');
  }
}

function markSupabaseOfflineIfNetwork(msg: string): void {
  const lower = msg.toLowerCase();
  if (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('eai_again') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('network')
  ) {
    supabaseOfflineUntil = Date.now() + 60_000;
  }
}

function throwIfSupabaseError(error: { code?: string; message?: string } | null, fallbackMsg: string): void {
  if (!error) return;
  const msg = String(error.message || '');
  if (isSupabaseNetworkOrSchemaMessage(msg, error.code)) {
    markSupabaseOfflineIfNetwork(msg);
    throw new SupabaseSchemaMissingError(msg || 'Supabase unavailable; falling back to Firestore.');
  }
  console.error(`Supabase query failed (${error.code || 'ERR'}): ${msg}`);
  throw new Error(fallbackMsg);
}

export async function getPublicPortalData() {
  assertSupabaseReady();
  const [bmRes, noticeRes, galleryRes, settingsRes] = await Promise.all([
    supabase.from('batchmates').select('*').order('created_at', { ascending: false }),
    supabase.from('notices').select('*').order('updated_at', { ascending: false }),
    supabase.from('gallery_items').select('*').order('sort_order', { ascending: true }),
    supabase.from('portal_settings').select('*').eq('id', 'main').maybeSingle(),
  ]);

  throwIfSupabaseError(bmRes.error, 'Failed to load batchmates from Supabase.');
  throwIfSupabaseError(noticeRes.error, 'Failed to load notices from Supabase.');
  throwIfSupabaseError(galleryRes.error, 'Failed to load gallery from Supabase.');
  throwIfSupabaseError(settingsRes.error, 'Failed to load settings from Supabase.');

  const batchmates: Batchmate[] = (bmRes.data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || ''),
    roll: String(row.roll || ''),
    group: String(row.group || 'Batchmate'),
    social: row.social ? String(row.social) : undefined,
    quote: row.quote ? String(row.quote) : undefined,
    photo: row.photo ? String(row.photo) : undefined,
    registeredAt: row.registered_at ? String(row.registered_at) : undefined,
  }));

  const notices: BatchNotice[] = (noticeRes.data || []).map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    message: String(row.message || ''),
    category: (row.category as BatchNotice['category']) || 'General',
    pinned: Boolean(row.pinned),
    active: Boolean(row.active),
    createdAt: String(row.created_at || ''),
  }));

  const gallery: GalleryItem[] = (galleryRes.data || []).map((row) => ({
    id: String(row.id),
    src: String(row.src || ''),
    title: String(row.title || ''),
    caption: String(row.caption || ''),
    date: row.date ? String(row.date) : undefined,
    isVideo: Boolean(row.is_video),
    videoUrl: row.video_url ? String(row.video_url) : undefined,
  }));

  const settingsRow = settingsRes.data;

  return {
    batchmates,
    notices,
    gallery,
    settings: settingsRow
      ? {
          profile: String(settingsRow.profile || ''),
          hoodieConfig: settingsRow.hoodie_config as HoodieConfig,
          siteConfig: settingsRow.site_config as SiteConfig,
        }
      : null,
  };
}

export async function getAdminPortalData() {
  assertSupabaseReady();
  const [orderRes, logRes] = await Promise.all([
    supabase.from('hoodie_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  throwIfSupabaseError(orderRes.error, 'Failed to load hoodie orders from Supabase.');
  throwIfSupabaseError(logRes.error, 'Failed to load activity logs from Supabase.');

  const orders: HoodieOrder[] = (orderRes.data || []).map((row) => ({
    id: String(row.id),
    customerName: String(row.customer_name || ''),
    roll: String(row.roll || ''),
    size: (row.size as HoodieOrder['size']) || 'L',
    quantity: Number(row.quantity || 1),
    contact: String(row.contact || ''),
    notes: row.notes ? String(row.notes) : undefined,
    status: (row.status as OrderStatus) || 'Pending',
    createdAt: String(row.created_at || new Date().toISOString()),
  }));

  const activityLog: ActivityLogEntry[] = (logRes.data || []).map((row) => ({
    id: String(row.id),
    action: String(row.action || ''),
    detail: String(row.detail || ''),
    timestamp: String(row.created_at || new Date().toISOString()),
  }));

  return { orders, activityLog };
}

export async function createBatchmate(bm: Batchmate): Promise<Batchmate> {
  assertSupabaseReady();
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100) || 'Batchmate';
  const roll = clampStr(bm.roll, 32) || '2700';
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const social = bm.social?.trim() ? clampStr(bm.social, 100) : null;
  const quote = bm.quote?.trim() ? clampStr(bm.quote, 400) : null;
  const photo = bm.photo?.trim() && bm.photo.length <= 350000 ? bm.photo.trim() : null;
  const registeredAt = clampStr(bm.registeredAt || new Date().toISOString().slice(0, 10), 32);

  const { error } = await supabase.from('batchmates').upsert(
    {
      id,
      name,
      roll,
      group,
      social,
      quote,
      photo,
      registered_at: registeredAt,
    },
    { onConflict: 'id' }
  );

  throwIfSupabaseError(error, 'Failed to save batchmate registration.');

  return {
    id,
    name,
    roll,
    group,
    social: social || undefined,
    quote: quote || undefined,
    photo: photo || undefined,
    registeredAt,
  };
}

export async function updateBatchmate(id: string, bm: Partial<Batchmate>): Promise<void> {
  assertSupabaseReady();
  const docId = sanitizeId(id, 'bm');
  const patch: Record<string, unknown> = {
    name: clampStr(bm.name, 100),
    roll: clampStr(bm.roll, 32),
    group: clampStr(bm.group, 60) || 'Batchmate',
    social: bm.social?.trim() ? clampStr(bm.social, 100) : null,
    quote: bm.quote?.trim() ? clampStr(bm.quote, 400) : null,
  };
  if (bm.photo !== undefined) {
    patch.photo = bm.photo.trim() && bm.photo.length <= 350000 ? bm.photo.trim() : null;
  }

  const { error } = await supabase.from('batchmates').update(patch).eq('id', docId);
  throwIfSupabaseError(error, 'Failed to update batchmate record.');
}

export async function deleteBatchmate(id: string): Promise<void> {
  assertSupabaseReady();
  const docId = sanitizeId(id, 'bm');
  const { error } = await supabase.from('batchmates').delete().eq('id', docId);
  throwIfSupabaseError(error, 'Failed to remove batchmate record.');
}

export async function createOrder(order: HoodieOrder): Promise<HoodieOrder> {
  assertSupabaseReady();
  const id = sanitizeId(order.id, 'RCS');
  const customerName = clampStr(order.customerName, 100) || 'Student';
  const roll = clampStr(order.roll, 32) || '0000';
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const size = allowedSizes.includes(order.size) ? order.size : 'L';
  const quantity = Math.min(5, Math.max(1, Math.round(Number(order.quantity) || 1)));
  const contact = clampStr(order.contact, 100) || 'N/A';
  const notes = order.notes?.trim() ? clampStr(order.notes, 300) : null;
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const status: OrderStatus = allowedStatuses.includes(order.status) ? order.status : 'Pending';

  const { data, error } = await supabase
    .from('hoodie_orders')
    .insert({
      id,
      customer_name: customerName,
      roll,
      size,
      quantity,
      contact,
      notes,
      status,
    })
    .select()
    .single();

  throwIfSupabaseError(error, 'Failed to place hoodie order.');

  return {
    id: String(data?.id || id),
    customerName: String(data?.customer_name || customerName),
    roll: String(data?.roll || roll),
    size: (data?.size as HoodieOrder['size']) || size,
    quantity: Number(data?.quantity || quantity),
    contact: String(data?.contact || contact),
    notes: data?.notes ? String(data.notes) : undefined,
    status: (data?.status as OrderStatus) || status,
    createdAt: String(data?.created_at || new Date().toISOString()),
  };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  notes?: string,
  extra?: Partial<Pick<HoodieOrder, 'customerName' | 'roll' | 'size' | 'quantity' | 'contact'>>
): Promise<void> {
  assertSupabaseReady();
  const docId = sanitizeId(id, 'RCS');
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'Pending';
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const patch: Record<string, unknown> = { status: safeStatus };
  if (notes !== undefined) patch.notes = clampStr(notes, 300) || null;
  if (extra?.customerName?.trim()) patch.customer_name = clampStr(extra.customerName, 100);
  if (extra?.roll?.trim()) patch.roll = clampStr(extra.roll, 32);
  if (extra?.size && allowedSizes.includes(extra.size)) patch.size = extra.size;
  if (extra?.quantity !== undefined) {
    patch.quantity = Math.min(5, Math.max(1, Math.round(Number(extra.quantity) || 1)));
  }
  if (extra?.contact?.trim()) patch.contact = clampStr(extra.contact, 100);

  const { error } = await supabase.from('hoodie_orders').update(patch).eq('id', docId);
  throwIfSupabaseError(error, 'Failed to update order.');
}

export async function deleteOrder(id: string): Promise<void> {
  assertSupabaseReady();
  const docId = sanitizeId(id, 'RCS');
  const { error } = await supabase.from('hoodie_orders').delete().eq('id', docId);
  throwIfSupabaseError(error, 'Failed to delete order.');
}

export async function saveNotice(notice: BatchNotice): Promise<void> {
  assertSupabaseReady();
  const id = sanitizeId(notice.id, 'notice');
  const title = clampStr(notice.title, 140) || 'Notice';
  const message = clampStr(notice.message, 1000) || 'Details updated.';
  const category = ['General', 'Urgent', 'Event'].includes(notice.category) ? notice.category : 'General';
  const pinned = Boolean(notice.pinned);
  const active = Boolean(notice.active);
  const createdAt = clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32);

  const { error } = await supabase.from('notices').upsert(
    {
      id,
      title,
      message,
      category,
      pinned,
      active,
      created_at: createdAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  throwIfSupabaseError(error, 'Failed to save notice.');
}

export async function deleteNotice(id: string): Promise<void> {
  assertSupabaseReady();
  const docId = sanitizeId(id, 'notice');
  const { error } = await supabase.from('notices').delete().eq('id', docId);
  throwIfSupabaseError(error, 'Failed to delete notice.');
}

export async function saveGalleryItem(item: GalleryItem, sortOrder: number): Promise<void> {
  assertSupabaseReady();
  const id = sanitizeId(item.id, 'gal');
  const src = item.src && item.src.length <= 350000 ? item.src : '';
  const title = clampStr(item.title, 140) || 'Untitled Memory';
  const caption = clampStr(item.caption, 400);
  const date = clampStr(item.date, 40) || null;
  const isVideo = Boolean(item.isVideo);
  const videoUrl = item.videoUrl?.trim() ? clampStr(item.videoUrl, 500) : null;
  const clampedSort = Math.max(0, Math.min(10000, Math.round(sortOrder)));

  const { error } = await supabase.from('gallery_items').upsert(
    {
      id,
      src,
      title,
      caption,
      date,
      is_video: isVideo,
      video_url: videoUrl,
      sort_order: clampedSort,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  throwIfSupabaseError(error, 'Failed to save gallery item.');
}

export async function reorderGalleryItems(items: GalleryItem[]): Promise<void> {
  await Promise.all(items.map((item, idx) => saveGalleryItem(item, idx)));
}

export async function deleteGalleryItem(id: string): Promise<void> {
  assertSupabaseReady();
  const docId = sanitizeId(id, 'gal');
  const { error } = await supabase.from('gallery_items').delete().eq('id', docId);
  throwIfSupabaseError(error, 'Failed to delete gallery item.');
}

export async function saveSettings(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  assertSupabaseReady();
  const cleanSpecs = (hoodieConfig.specs || [])
    .map((s) => clampStr(s, 140))
    .filter(Boolean)
    .slice(0, 12);

  const safeHoodie: HoodieConfig = {
    kicker: clampStr(hoodieConfig.kicker, 140) || undefined,
    title: clampStr(hoodieConfig.title, 120) || "RCS HOODIE '26-'27",
    subtitle: clampStr(hoodieConfig.subtitle, 500),
    frontImage: hoodieConfig.frontImage && hoodieConfig.frontImage.length <= 350000 ? hoodieConfig.frontImage : '',
    backImage: hoodieConfig.backImage && hoodieConfig.backImage.length <= 350000 ? hoodieConfig.backImage : '',
    frontLabel: clampStr(hoodieConfig.frontLabel, 80) || undefined,
    backLabel: clampStr(hoodieConfig.backLabel, 80) || undefined,
    specs: cleanSpecs.length > 0 ? cleanSpecs : ['350 GSM Cotton Fleece'],
    directOrderOpen: Boolean(hoodieConfig.directOrderOpen),
  };

  const safeKpis = Array.isArray(siteConfig.kpis)
    ? siteConfig.kpis.slice(0, 4).map((k, idx) => ({
        id: clampStr(k.id || `kpi-${idx + 1}`, 40),
        value: clampStr(k.value, 40) || '0',
        label: clampStr(k.label, 80) || 'Metric',
        autoBatchmateCount: Boolean(k.autoBatchmateCount),
      }))
    : undefined;

  const safeTimeline = Array.isArray(siteConfig.timeline)
    ? siteConfig.timeline.slice(0, 20).map((t, idx) => ({
        id: clampStr(t.id || `tl-${idx + 1}`, 40),
        tag: clampStr(t.tag, 60) || 'Milestone',
        title: clampStr(t.title, 120) || 'Batch Milestone',
        description: clampStr(t.description, 400),
      }))
    : undefined;

  const safeSite: SiteConfig = {
    brandName: clampStr(siteConfig.brandName, 40) || undefined,
    brandAccent: clampStr(siteConfig.brandAccent, 20) || undefined,
    heroKicker: clampStr(siteConfig.heroKicker, 120),
    heroTitle: clampStr(siteConfig.heroTitle, 120),
    heroHighlight: clampStr(siteConfig.heroHighlight, 120),
    heroDescription: clampStr(siteConfig.heroDescription, 600),
    heroImage: siteConfig.heroImage && siteConfig.heroImage.length <= 350000 ? siteConfig.heroImage : undefined,
    announcement: clampStr(siteConfig.announcement, 300),
    instagramUrl: clampStr(siteConfig.instagramUrl, 300),
    instagramHandle: clampStr(siteConfig.instagramHandle, 80) || undefined,
    instagramBio: clampStr(siteConfig.instagramBio, 300) || undefined,
    devNote: clampStr(siteConfig.devNote, 600),
    aboutKicker: clampStr(siteConfig.aboutKicker, 80) || undefined,
    aboutTitle: clampStr(siteConfig.aboutTitle, 160) || undefined,
    aboutDescription: clampStr(siteConfig.aboutDescription, 800) || undefined,
    visionTitle: clampStr(siteConfig.visionTitle, 100) || undefined,
    visionText: clampStr(siteConfig.visionText, 300) || undefined,
    unityTitle: clampStr(siteConfig.unityTitle, 100) || undefined,
    unityText: clampStr(siteConfig.unityText, 300) || undefined,
    leadSectionKicker: clampStr(siteConfig.leadSectionKicker, 80) || undefined,
    leadSectionTitle: clampStr(siteConfig.leadSectionTitle, 120) || undefined,
    leadSectionSubtitle: clampStr(siteConfig.leadSectionSubtitle, 240) || undefined,
    leadRole: clampStr(siteConfig.leadRole, 120) || undefined,
    leadName: clampStr(siteConfig.leadName, 120) || undefined,
    footerText: clampStr(siteConfig.footerText, 240) || undefined,
    registrationOpen: siteConfig.registrationOpen !== undefined ? Boolean(siteConfig.registrationOpen) : true,
    maintenanceMode: Boolean(siteConfig.maintenanceMode),
    maintenanceMessage: clampStr(siteConfig.maintenanceMessage, 400) || undefined,
    sections: siteConfig.sections
      ? {
          notices: Boolean(siteConfig.sections.notices),
          about: Boolean(siteConfig.sections.about),
          gallery: Boolean(siteConfig.sections.gallery),
          directory: Boolean(siteConfig.sections.directory),
          timeline: Boolean(siteConfig.sections.timeline),
          hoodieNav: Boolean(siteConfig.sections.hoodieNav),
        }
      : undefined,
    kpis: safeKpis,
    timeline: safeTimeline,
  };

  const safeProfile = profile && profile.length <= 350000 ? profile : '';

  const { error } = await supabase.from('portal_settings').upsert(
    {
      id: 'main',
      profile: safeProfile,
      hoodie_config: safeHoodie,
      site_config: safeSite,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  throwIfSupabaseError(error, 'Failed to save portal settings.');
}

export async function addActivityLog(action: string, detail: string, userUid?: string): Promise<void> {
  assertSupabaseReady();
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const { error } = await supabase.from('activity_logs').insert({
    id,
    user_uid: userUid || null,
    action: clampStr(action, 80) || 'Admin Action',
    detail: clampStr(detail, 300) || 'Action recorded',
  });

  throwIfSupabaseError(error, 'Failed to record activity log.');
}

export async function seedDefaultsIfEmpty(defaults: PortalState): Promise<void> {
  assertSupabaseReady();
  const [bmRes, noticeRes, galleryRes, settingsRes] = await Promise.all([
    supabase.from('batchmates').select('id').limit(1),
    supabase.from('notices').select('id').limit(1),
    supabase.from('gallery_items').select('id').limit(1),
    supabase.from('portal_settings').select('id').eq('id', 'main').maybeSingle(),
  ]);

  throwIfSupabaseError(bmRes.error, 'Failed to check batchmates.');
  throwIfSupabaseError(noticeRes.error, 'Failed to check notices.');
  throwIfSupabaseError(galleryRes.error, 'Failed to check gallery.');
  throwIfSupabaseError(settingsRes.error, 'Failed to check settings.');

  const tasks: Promise<unknown>[] = [];
  if (!bmRes.data || bmRes.data.length === 0) {
    for (const bm of defaults.batchmates) {
      tasks.push(createBatchmate(bm));
    }
  }
  if (!noticeRes.data || noticeRes.data.length === 0) {
    for (const notice of defaults.notices) {
      tasks.push(saveNotice(notice));
    }
  }
  if (!galleryRes.data || galleryRes.data.length === 0) {
    defaults.gallery.forEach((item, idx) => {
      tasks.push(saveGalleryItem(item, idx));
    });
  }
  if (!settingsRes.data) {
    tasks.push(saveSettings(defaults.profile, defaults.hoodieConfig, defaults.siteConfig));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

export async function syncFullPortalState(nextState: PortalState, replaceCollections: boolean): Promise<void> {
  assertSupabaseReady();
  if (replaceCollections) {
    const [bmDel, noticeDel, galleryDel] = await Promise.all([
      supabase.from('batchmates').delete().neq('id', ''),
      supabase.from('notices').delete().neq('id', ''),
      supabase.from('gallery_items').delete().neq('id', ''),
    ]);
    throwIfSupabaseError(bmDel.error, 'Failed to clear batchmates.');
    throwIfSupabaseError(noticeDel.error, 'Failed to clear notices.');
    throwIfSupabaseError(galleryDel.error, 'Failed to clear gallery.');
  }

  await Promise.all([
    ...nextState.batchmates.map((bm) => createBatchmate(bm)),
    ...(nextState.notices || []).map((n) => saveNotice(n)),
    ...nextState.gallery.map((g, idx) => saveGalleryItem(g, idx)),
    saveSettings(nextState.profile, nextState.hoodieConfig, nextState.siteConfig),
  ]);
}
