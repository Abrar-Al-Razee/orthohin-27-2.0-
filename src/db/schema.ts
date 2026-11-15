import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { HoodieConfig, SiteConfig } from '../types.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const batchmates = pgTable('batchmates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  roll: text('roll').notNull(),
  group: text('group').notNull(),
  social: text('social'),
  quote: text('quote'),
  photo: text('photo'),
  registeredAt: text('registered_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notices = pgTable('notices', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const galleryItems = pgTable('gallery_items', {
  id: text('id').primaryKey(),
  src: text('src').notNull().default(''),
  title: text('title').notNull(),
  caption: text('caption').notNull().default(''),
  date: text('date'),
  isVideo: boolean('is_video').notNull().default(false),
  videoUrl: text('video_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hoodieOrders = pgTable('hoodie_orders', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  roll: text('roll').notNull(),
  size: text('size').notNull(),
  quantity: integer('quantity').notNull().default(1),
  contact: text('contact').notNull(),
  notes: text('notes'),
  status: text('status').notNull().default('Pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const portalSettings = pgTable('portal_settings', {
  id: text('id').primaryKey(),
  profile: text('profile').notNull(),
  hoodieConfig: jsonb('hoodie_config').$type<HoodieConfig>().notNull(),
  siteConfig: jsonb('site_config').$type<SiteConfig>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  action: text('action').notNull(),
  detail: text('detail').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  actor: one(users, {
    fields: [activityLogs.userUid],
    references: [users.uid],
  }),
}));
