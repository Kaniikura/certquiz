import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Exams table (lookup table for exam types)
export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // 'CCNA', 'CCNP_ENCOR', 'CCNP_ENARSI', etc.
    name: text('name').notNull(), // Full display name
    description: text('description'), // Optional description
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_exams_code').on(table.code),
    index('idx_exams_active').on(table.isActive),
  ]
);

// Categories table (lookup table for question categories)
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // 'NETWORK_FUNDAMENTALS', 'OSPF', 'QOS', etc.
    name: text('name').notNull(), // Full display name
    description: text('description'), // Optional description
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_categories_code').on(table.code),
    index('idx_categories_active').on(table.isActive),
  ]
);
