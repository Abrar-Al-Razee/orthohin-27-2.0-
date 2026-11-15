import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import {
  addActivityLog,
  createBatchmate,
  createOrder,
  deleteBatchmate,
  deleteGalleryItem,
  deleteNotice,
  deleteOrder,
  getAdminPortalData,
  getPublicPortalData,
  reorderGalleryItems,
  saveGalleryItem,
  saveNotice,
  saveSettings,
  seedDefaultsIfEmpty,
  syncFullPortalState,
  updateBatchmate,
  updateOrderStatus,
} from './src/db/portalRepository.ts';
import { requireAdmin, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import type { Batchmate, BatchNotice, GalleryItem, HoodieOrder, OrderStatus, PortalState } from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '5mb' }));

  /* Public Portal API */
  app.get('/api/portal', async (_req, res) => {
    try {
      const data = await getPublicPortalData();
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load portal data';
      res.status(500).json({ error: message });
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
      const message = error instanceof Error ? error.message : 'Failed to register batchmate';
      res.status(500).json({ error: message });
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
      const message = error instanceof Error ? error.message : 'Failed to place order';
      res.status(500).json({ error: message });
    }
  });

  /* Admin-Protected API */
  app.get('/api/admin/data', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await getAdminPortalData();
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load admin data';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/admin/seed', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const defaults = req.body as PortalState;
      await seedDefaultsIfEmpty(defaults);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to seed defaults';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/admin/batchmates/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await updateBatchmate(req.params.id, req.body as Partial<Batchmate>);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update batchmate';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/admin/batchmates/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteBatchmate(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove batchmate';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { status, notes } = req.body as { status: OrderStatus; notes?: string };
      await updateOrderStatus(req.params.id, status, notes);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update order';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/admin/orders/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteOrder(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete order';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/admin/notices', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await saveNotice(req.body as BatchNotice);
      res.status(201).json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save notice';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/admin/notices/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const notice = req.body as BatchNotice;
      await saveNotice({ ...notice, id: req.params.id });
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update notice';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/admin/notices/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteNotice(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete notice';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/admin/gallery/reorder', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body as { items: GalleryItem[] };
      await reorderGalleryItems(items || []);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reorder gallery';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/admin/gallery/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { item, sortOrder } = req.body as { item: GalleryItem; sortOrder: number };
      await saveGalleryItem({ ...item, id: req.params.id }, sortOrder ?? 0);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save gallery item';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/admin/gallery/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteGalleryItem(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete gallery item';
      res.status(500).json({ error: message });
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
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/admin/sync', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { state, replaceCollections } = req.body as { state: PortalState; replaceCollections: boolean };
      await syncFullPortalState(state, Boolean(replaceCollections));
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync portal data';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/admin/logs', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { action, detail } = req.body as { action: string; detail: string };
      await addActivityLog(action, detail, req.user?.uid);
      res.status(201).json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to write activity log';
      res.status(500).json({ error: message });
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
