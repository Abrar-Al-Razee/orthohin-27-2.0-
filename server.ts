import 'dotenv/config';
import express, { type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addActivityLog,
  createBatchmate,
  createOrder,
  deleteAdminTeamMember,
  deleteBatchmate,
  deleteGalleryItem,
  deleteNotice,
  deleteOrder,
  getAdminPortalData,
  getPublicPortalData,
  isSupabaseNetworkOrSchemaMessage,
  reorderAdminTeamMembers,
  reorderGalleryItems,
  saveAdminTeamMember,
  saveGalleryItem,
  saveNotice,
  saveSettings,
  seedDefaultsIfEmpty,
  SupabaseSchemaMissingError,
  syncFullPortalState,
  updateBatchmate,
  updateOrderStatus,
} from './src/db/supabaseRepository.ts';
import { ensureSupabaseSchema } from './src/lib/supabaseDbInit.ts';
import { requireAdmin, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import type { AdminTeamMember, Batchmate, BatchNotice, GalleryItem, HoodieOrder, OrderStatus, PortalState } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sendRepoError(res: Response, error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (error instanceof SupabaseSchemaMissingError || isSupabaseNetworkOrSchemaMessage(message)) {
    res.status(200).json({
      useFallback: true,
      code: 'SUPABASE_SCHEMA_MISSING',
    });
    return;
  }
  res.status(500).json({ error: message });
}

async function startServer() {
  await ensureSupabaseSchema();
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  /* Public Portal API (Supabase-backed) */
  app.get('/api/portal', async (_req, res) => {
    try {
      const data = await getPublicPortalData();
      res.json(data);
    } catch (error) {
      sendRepoError(res, error, 'Failed to load portal data');
    }
  });

  app.post('/api/batchmates', async (req, res) => {
    const body = req.body as Partial<Batchmate>;
    if (!body?.name?.trim() || !body?.roll?.trim()) {
      res.status(400).json({ error: 'Name and roll number are required.' });
      return;
    }
    try {
      const created = await createBatchmate({
        id: body.id || `bm-${Date.now()}`,
        name: body.name.trim(),
        roll: body.roll.trim(),
        group: body.group?.trim() || 'Batchmate',
        social: body.social,
        quote: body.quote,
        photo: body.photo,
        registeredAt: body.registeredAt || new Date().toISOString().slice(0, 10),
      });
      res.status(201).json(created);
    } catch (error) {
      sendRepoError(res, error, 'Failed to register batchmate');
    }
  });

  app.post('/api/orders', async (req, res) => {
    const body = req.body as Partial<HoodieOrder>;
    if (!body?.customerName?.trim() || !body?.roll?.trim() || !body?.contact?.trim()) {
      res.status(400).json({ error: 'Name, roll, and contact are required.' });
      return;
    }
    try {
      const created = await createOrder({
        id: body.id || `RCS-${Date.now().toString().slice(-5)}`,
        customerName: body.customerName.trim(),
        roll: body.roll.trim(),
        size: (body.size as HoodieOrder['size']) || 'L',
        quantity: Number(body.quantity || 1),
        contact: body.contact.trim(),
        notes: body.notes,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(created);
    } catch (error) {
      sendRepoError(res, error, 'Failed to place order');
    }
  });

  /* Admin-Protected API (Firebase Google ID Token + Supabase) */
  app.get('/api/admin/verify', requireAuth, requireAdmin, (req: AuthRequest, res) => {
    res.json({ ok: true, email: req.user?.email || null });
  });

  app.get('/api/admin/data', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await getAdminPortalData();
      res.json(data);
    } catch (error) {
      sendRepoError(res, error, 'Failed to load admin data');
    }
  });

  app.post('/api/admin/seed', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const defaults = req.body as PortalState;
      await seedDefaultsIfEmpty(defaults);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to seed defaults');
    }
  });

  app.post('/api/admin/orders', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const body = req.body as Partial<HoodieOrder>;
    if (!body?.customerName?.trim() || !body?.roll?.trim() || !body?.contact?.trim()) {
      res.status(400).json({ error: 'Name, roll, and contact are required.' });
      return;
    }
    try {
      const created = await createOrder({
        id: body.id || `RCS-${Date.now().toString().slice(-5)}`,
        customerName: body.customerName.trim(),
        roll: body.roll.trim(),
        size: (body.size as HoodieOrder['size']) || 'L',
        quantity: Number(body.quantity || 1),
        contact: body.contact.trim(),
        notes: body.notes,
        status: (body.status as OrderStatus) || 'Confirmed',
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(created);
    } catch (error) {
      sendRepoError(res, error, 'Failed to create manual order');
    }
  });

  app.put('/api/admin/batchmates/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await updateBatchmate(req.params.id, req.body as Partial<Batchmate>);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to update batchmate');
    }
  });

  app.delete('/api/admin/batchmates/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteBatchmate(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to remove batchmate');
    }
  });

  app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { status, notes, customerName, roll, size, quantity, contact } = req.body as Partial<HoodieOrder> & {
        status: OrderStatus;
      };
      await updateOrderStatus(req.params.id, status, notes, {
        customerName,
        roll,
        size,
        quantity,
        contact,
      });
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to update order');
    }
  });

  app.delete('/api/admin/orders/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteOrder(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to delete order');
    }
  });

  app.post('/api/admin/notices', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await saveNotice(req.body as BatchNotice);
      res.status(201).json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to save notice');
    }
  });

  app.put('/api/admin/notices/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const notice = req.body as BatchNotice;
      await saveNotice({ ...notice, id: req.params.id });
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to update notice');
    }
  });

  app.delete('/api/admin/notices/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteNotice(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to delete notice');
    }
  });

  app.put('/api/admin/gallery/reorder', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body as { items: GalleryItem[] };
      await reorderGalleryItems(items || []);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to reorder gallery');
    }
  });

  app.put('/api/admin/gallery/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { item, sortOrder } = req.body as { item: GalleryItem; sortOrder: number };
      await saveGalleryItem({ ...item, id: req.params.id }, sortOrder ?? 0);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to save gallery item');
    }
  });

  app.delete('/api/admin/gallery/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteGalleryItem(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to delete gallery item');
    }
  });

  app.put('/api/admin/team/reorder', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { members } = req.body as { members: AdminTeamMember[] };
      await reorderAdminTeamMembers(members || []);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to reorder admin team');
    }
  });

  app.put('/api/admin/team/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { member, sortOrder } = req.body as { member: AdminTeamMember; sortOrder: number };
      await saveAdminTeamMember({ ...member, id: req.params.id }, sortOrder ?? 0);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to save admin team member');
    }
  });

  app.delete('/api/admin/team/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteAdminTeamMember(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to remove admin team member');
    }
  });

  app.put('/api/admin/settings', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { profile, hoodieConfig, siteConfig } = req.body as Pick<
        PortalState,
        'profile' | 'hoodieConfig' | 'siteConfig'
      >;
      await saveSettings(profile, hoodieConfig, siteConfig);
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to save settings');
    }
  });

  app.post('/api/admin/sync', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { state, replaceCollections } = req.body as { state: PortalState; replaceCollections: boolean };
      await syncFullPortalState(state, Boolean(replaceCollections));
      res.json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to sync portal data');
    }
  });

  app.post('/api/admin/logs', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { action, detail } = req.body as { action: string; detail: string };
      await addActivityLog(action, detail, req.user?.uid);
      res.status(201).json({ ok: true });
    } catch (error) {
      sendRepoError(res, error, 'Failed to write activity log');
    }
  });

  /* Frontend serving (Vite dev middleware or built dist/) */
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
