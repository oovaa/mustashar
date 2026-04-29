-- Initializes user_memories table on first database creation
CREATE TABLE IF NOT EXISTS user_memories (
  chat_id       TEXT PRIMARY KEY,
  summary       TEXT NOT NULL DEFAULT 'No history found',
  last_message  TEXT,
  last_response TEXT,
  count         INTEGER DEFAULT 0,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
