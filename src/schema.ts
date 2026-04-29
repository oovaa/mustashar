import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Persists per-chat rolling memory.
 *
 * Columns:
 *  - chatId       : Telegram (or any client) chat identifier — the primary key.
 *  - summary      : AI-generated rolling summary of the full conversation so far.
 *  - lastMessage  : The most recent user message, stored verbatim.
 *  - lastResponse : The AI's most recent reply, stored verbatim.
 *  - count        : Total number of interactions processed for this chat.
 *  - updatedAt    : Timestamp of the last write (auto-updated by the DB default).
 */
export const userMemories = pgTable('user_memories', {
  chatId: text('chat_id').primaryKey(),
  summary: text('summary').notNull().default('No history found'),
  /** Verbatim text of the last user message sent in this chat. */
  lastMessage: text('last_message'),
  /** Verbatim text of the AI's last reply in this chat. */
  lastResponse: text('last_response'),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
