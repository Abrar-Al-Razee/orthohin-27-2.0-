import { asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  activityLogs,
  batchmates,
  galleryItems,
  hoodieOrders,
  notices,
  portalSettings,
} from './schema.ts';
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

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  return cleaned || `${prefix}-${Date.now()}`;
}

function clampStr(val: string | undefined, max: number): string {
  return String(val ?? '').trim().slice(0, max);
}

export async function getPublicPortalData() {
  try {
    const [bmRows, noticeRows, galleryRows, settingsRows] = await Promise.all([
      db.select().from(batchmates).orderBy(desc(batchmates.createdAt)),
      db.select().from(notices).orderBy(desc(notices.updatedAt)),
      db.select().from(galleryItems).orderBy(asc(galleryItems.sortOrder)),
      db.select().from(portalSettings).where(eq(portalSettings.id, 'main')),
    ]);

    const mappedBatchmates: Batchmate[] = bmRows.map((row) => ({
      id: row.id,
      name: row.name,
      roll: row.roll,
      group: row.group,
      social: row.social || undefined,
      quote: row.quote || undefined,
      photo: row.photo || undefined,
      registeredAt: row.registeredAt,
    }));

    const mappedNotices: BatchNotice[] = noticeRows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      category: (row.category as BatchNotice['category']) || 'General',
      pinned: row.pinned,
      active: row.active,
      createdAt: row.createdAt,
    }));

    const mappedGallery: GalleryItem[] = galleryRows.map((row) => ({
      id: row.id,
      src: row.src,
      title: row.title,
      caption: row.caption,
      date: row.date || undefined,
      isVideo: row.isVideo,
      videoUrl: row.videoUrl || undefined,
    }));

    const settingsRow = settingsRows[0] ?? null;

    return {
      batchmates: mappedBatchmates,
      notices: mappedNotices,
      gallery: mappedGallery,
      settings: settingsRow
        ? {
            profile: settingsRow.profile,
            hoodieConfig: settingsRow.hoodieConfig,
            siteConfig: settingsRow.siteConfig,
          }
        : null,
    };
  } catch (error) {
    console.error('Database query failed in getPublicPortalData:', error);
    throw new Error('Failed to load portal data. Please try again later.', { cause: error });
  }
}

export async function getAdminPortalData() {
  try {
    const [orderRows, logRows] = await Promise.all([
      db.select().from(hoodieOrders).orderBy(desc(hoodieOrders.createdAt)),
      db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(50),
    ]);

    const mappedOrders: HoodieOrder[] = orderRows.map((row) => ({
      id: row.id,
      customerName: row.customerName,
      roll: row.roll,
      size: (row.size as HoodieOrder['size']) || 'L',
      quantity: row.quantity,
      contact: row.contact,
      notes: row.notes || undefined,
      status: (row.status as OrderStatus) || 'Pending',
      createdAt: row.createdAt.toISOString(),
    }));

    const mappedLogs: ActivityLogEntry[] = logRows.map((row) => ({
      id: row.id,
      action: row.action,
      detail: row.detail,
      timestamp: row.createdAt.toISOString(),
    }));

    return { orders: mappedOrders, activityLog: mappedLogs };
  } catch (error) {
    console.error('Database query failed in getAdminPortalData:', error);
    throw new Error('Failed to load admin records. Please try again later.', { cause: error });
  }
}

export async function createBatchmate(bm: Batchmate): Promise<Batchmate> {
  const id = sanitizeId(bm.id, 'bm');
  const name = clampStr(bm.name, 100);
  const roll = clampStr(bm.roll, 32);
  const group = clampStr(bm.group, 60) || 'Batchmate';
  const social = bm.social?.trim() ? clampStr(bm.social, 100) : null;
  const quote = bm.quote?.trim() ? clampStr(bm.quote, 400) : null;
  const photo = bm.photo?.trim() && bm.photo.length <= 350000 ? bm.photo : null;
  const registeredAt = clampStr(bm.registeredAt || new Date().toISOString().slice(0, 10), 32);

  try {
    await db
      .insert(batchmates)
      .values({
        id,
        name,
        roll,
        group,
        social,
        quote,
        photo,
        registeredAt,
      })
      .onConflictDoUpdate({
        target: batchmates.id,
        set: { name, roll, group, social, quote, photo, registeredAt },
      });

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
  } catch (error) {
    console.error('Database query failed in createBatchmate:', error);
    throw new Error('Failed to save batchmate registration.', { cause: error });
  }
}

export async function updateBatchmate(id: string, bm: Partial<Batchmate>): Promise<void> {
  const docId = sanitizeId(id, 'bm');
  try {
    await db
      .update(batchmates)
      .set({
        name: clampStr(bm.name, 100),
        roll: clampStr(bm.roll, 32),
        group: clampStr(bm.group, 60) || 'Batchmate',
        social: bm.social?.trim() ? clampStr(bm.social, 100) : null,
        quote: bm.quote?.trim() ? clampStr(bm.quote, 400) : null,
        ...(bm.photo !== undefined ? { photo: bm.photo && bm.photo.length <= 350000 ? bm.photo : null } : {}),
      })
      .where(eq(batchmates.id, docId));
  } catch (error) {
    console.error('Database query failed in updateBatchmate:', error);
    throw new Error('Failed to update batchmate record.', { cause: error });
  }
}

export async function deleteBatchmate(id: string): Promise<void> {
  const docId = sanitizeId(id, 'bm');
  try {
    await db.delete(batchmates).where(eq(batchmates.id, docId));
  } catch (error) {
    console.error('Database query failed in deleteBatchmate:', error);
    throw new Error('Failed to remove batchmate record.', { cause: error });
  }
}

export async function createOrder(order: HoodieOrder): Promise<HoodieOrder> {
  const id = sanitizeId(order.id, 'RCS');
  const customerName = clampStr(order.customerName, 100);
  const roll = clampStr(order.roll, 32);
  const allowedSizes: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const size = allowedSizes.includes(order.size) ? order.size : 'L';
  const quantity = Math.min(5, Math.max(1, Math.round(Number(order.quantity) || 1)));
  const contact = clampStr(order.contact, 100);
  const notes = order.notes?.trim() ? clampStr(order.notes, 300) : null;

  try {
    const inserted = await db
      .insert(hoodieOrders)
      .values({
        id,
        customerName,
        roll,
        size,
        quantity,
        contact,
        notes,
        status: 'Pending',
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      customerName: row.customerName,
      roll: row.roll,
      size: row.size as HoodieOrder['size'],
      quantity: row.quantity,
      contact: row.contact,
      notes: row.notes || undefined,
      status: 'Pending',
      createdAt: row.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in createOrder:', error);
    throw new Error('Failed to place hoodie order.', { cause: error });
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus, notes?: string): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  const allowedStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Delivered'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'Pending';

  try {
    await db
      .update(hoodieOrders)
      .set({
        status: safeStatus,
        ...(notes !== undefined ? { notes: clampStr(notes, 300) || null } : {}),
      })
      .where(eq(hoodieOrders.id, docId));
  } catch (error) {
    console.error('Database query failed in updateOrderStatus:', error);
    throw new Error('Failed to update order status.', { cause: error });
  }
}

export async function deleteOrder(id: string): Promise<void> {
  const docId = sanitizeId(id, 'RCS');
  try {
    await db.delete(hoodieOrders).where(eq(hoodieOrders.id, docId));
  } catch (error) {
    console.error('Database query failed in deleteOrder:', error);
    throw new Error('Failed to delete order.', { cause: error });
  }
}

export async function saveNotice(notice: BatchNotice): Promise<void> {
  const id = sanitizeId(notice.id, 'notice');
  const title = clampStr(notice.title, 140);
  const message = clampStr(notice.message, 1000);
  const category = ['General', 'Urgent', 'Event'].includes(notice.category) ? notice.category : 'General';
  const pinned = Boolean(notice.pinned);
  const active = Boolean(notice.active);
  const createdAt = clampStr(notice.createdAt || new Date().toISOString().slice(0, 10), 32);

  try {
    await db
      .insert(notices)
      .values({
        id,
        title,
        message,
        category,
        pinned,
        active,
        createdAt,
      })
      .onConflictDoUpdate({
        target: notices.id,
        set: {
          title,
          message,
          category,
          pinned,
          active,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Database query failed in saveNotice:', error);
    throw new Error('Failed to save notice.', { cause: error });
  }
}

export async function deleteNotice(id: string): Promise<void> {
  const docId = sanitizeId(id, 'notice');
  try {
    await db.delete(notices).where(eq(notices.id, docId));
  } catch (error) {
    console.error('Database query failed in deleteNotice:', error);
    throw new Error('Failed to delete notice.', { cause: error });
  }
}

export async function saveGalleryItem(item: GalleryItem, sortOrder: number): Promise<void> {
  const id = sanitizeId(item.id, 'gal');
  const src = item.src && item.src.length <= 350000 ? item.src : '';
  const title = clampStr(item.title, 140) || 'Untitled Memory';
  const caption = clampStr(item.caption, 400);
  const date = clampStr(item.date, 40) || null;
  const isVideo = Boolean(item.isVideo);
  const videoUrl = item.videoUrl?.trim() ? clampStr(item.videoUrl, 500) : null;
  const clampedSort = Math.max(0, Math.min(10000, Math.round(sortOrder)));

  try {
    await db
      .insert(galleryItems)
      .values({
        id,
        src,
        title,
        caption,
        date,
        isVideo,
        videoUrl,
        sortOrder: clampedSort,
      })
      .onConflictDoUpdate({
        target: galleryItems.id,
        set: {
          src,
          title,
          caption,
          date,
          isVideo,
          videoUrl,
          sortOrder: clampedSort,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Database query failed in saveGalleryItem:', error);
    throw new Error('Failed to save gallery item.', { cause: error });
  }
}

export async function reorderGalleryItems(items: GalleryItem[]): Promise<void> {
  try {
    await Promise.all(items.map((item, idx) => saveGalleryItem(item, idx)));
  } catch (error) {
    console.error('Database query failed in reorderGalleryItems:', error);
    throw new Error('Failed to reorder gallery items.', { cause: error });
  }
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const docId = sanitizeId(id, 'gal');
  try {
    await db.delete(galleryItems).where(eq(galleryItems.id, docId));
  } catch (error) {
    console.error('Database query failed in deleteGalleryItem:', error);
    throw new Error('Failed to delete gallery item.', { cause: error });
  }
}

export async function saveSettings(
  profile: string,
  hoodieConfig: HoodieConfig,
  siteConfig: SiteConfig
): Promise<void> {
  const cleanSpecs = (hoodieConfig.specs || [])
    .map((s) => clampStr(s, 140))
    .filter(Boolean)
    .slice(0, 10);

  const safeHoodie: HoodieConfig = {
    title: clampStr(hoodieConfig.title, 120) || "RCS HOODIE '26-'27",
    subtitle: clampStr(hoodieConfig.subtitle, 500),
    frontImage: hoodieConfig.frontImage && hoodieConfig.frontImage.length <= 350000 ? hoodieConfig.frontImage : '',
    backImage: hoodieConfig.backImage && hoodieConfig.backImage.length <= 350000 ? hoodieConfig.backImage : '',
    specs: cleanSpecs.length > 0 ? cleanSpecs : ['350 GSM Cotton Fleece'],
    directOrderOpen: Boolean(hoodieConfig.directOrderOpen),
  };

  const safeSite: SiteConfig = {
    heroKicker: clampStr(siteConfig.heroKicker, 120),
    heroTitle: clampStr(siteConfig.heroTitle, 120),
    heroHighlight: clampStr(siteConfig.heroHighlight, 120),
    heroDescription: clampStr(siteConfig.heroDescription, 600),
    announcement: clampStr(siteConfig.announcement, 300),
    instagramUrl: clampStr(siteConfig.instagramUrl, 300),
    devNote: clampStr(siteConfig.devNote, 600),
  };

  const safeProfile = profile && profile.length <= 350000 ? profile : '';

  try {
    await db
      .insert(portalSettings)
      .values({
        id: 'main',
        profile: safeProfile,
        hoodieConfig: safeHoodie,
        siteConfig: safeSite,
      })
      .onConflictDoUpdate({
        target: portalSettings.id,
        set: {
          profile: safeProfile,
          hoodieConfig: safeHoodie,
          siteConfig: safeSite,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Database query failed in saveSettings:', error);
    throw new Error('Failed to save portal settings.', { cause: error });
  }
}

export async function addActivityLog(action: string, detail: string, userUid?: string): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  try {
    await db.insert(activityLogs).values({
      id,
      userUid: userUid || null,
      action: clampStr(action, 80),
      detail: clampStr(detail, 300),
    });
  } catch (error) {
    console.error('Database query failed in addActivityLog:', error);
    throw new Error('Failed to record activity log.', { cause: error });
  }
}

export async function seedDefaultsIfEmpty(defaults: PortalState): Promise<void> {
  try {
    const [existingBm, existingNotices, existingGallery, existingSettings] = await Promise.all([
      db.select({ id: batchmates.id }).from(batchmates).limit(1),
      db.select({ id: notices.id }).from(notices).limit(1),
      db.select({ id: galleryItems.id }).from(galleryItems).limit(1),
      db.select({ id: portalSettings.id }).from(portalSettings).where(eq(portalSettings.id, 'main')),
    ]);

    const tasks: Promise<unknown>[] = [];

    if (existingBm.length === 0) {
      for (const bm of defaults.batchmates) {
        tasks.push(createBatchmate(bm));
      }
    }
    if (existingNotices.length === 0) {
      for (const notice of defaults.notices) {
        tasks.push(saveNotice(notice));
      }
    }
    if (existingGallery.length === 0) {
      defaults.gallery.forEach((item, index) => {
        tasks.push(saveGalleryItem(item, index));
      });
    }
    if (existingSettings.length === 0) {
      tasks.push(saveSettings(defaults.profile, defaults.hoodieConfig, defaults.siteConfig));
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  } catch (error) {
    console.error('Database query failed in seedDefaultsIfEmpty:', error);
    throw new Error('Failed to initialize default portal records.', { cause: error });
  }
}

export async function syncFullPortalState(nextState: PortalState, replaceCollections: boolean): Promise<void> {
  try {
    if (replaceCollections) {
      await Promise.all([
        db.delete(batchmates),
        db.delete(notices),
        db.delete(galleryItems),
      ]);
    }

    await Promise.all([
      ...nextState.batchmates.map((bm) => createBatchmate(bm)),
      ...(nextState.notices || []).map((n) => saveNotice(n)),
      ...nextState.gallery.map((g, idx) => saveGalleryItem(g, idx)),
      saveSettings(nextState.profile, nextState.hoodieConfig, nextState.siteConfig),
    ]);
  } catch (error) {
    console.error('Database query failed in syncFullPortalState:', error);
    throw new Error('Failed to synchronize portal backup.', { cause: error });
  }
}
