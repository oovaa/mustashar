import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const userMemories = pgTable('user_memories', {
  chatId: text('chat_id').primaryKey(),
  summary: text('summary').notNull().default('No history found'),
  count: integer("count").default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
