-- Initializes user_memories table on first database creation
CREATE TABLE IF NOT EXISTS user_memories (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
