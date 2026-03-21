import { sql } from "./db";

    await sql`
      CREATE TABLE IF NOT EXISTS user_memories (
        chat_id TEXT PRIMARY KEY,
        summary TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )`
