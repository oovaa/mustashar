import { sql } from './db'

export async function initMemoriesTable() {
  try {
    const query = await sql`
      CREATE TABLE IF NOT EXISTS user_memories (
        chat_id TEXT PRIMARY KEY,
        summary TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )`
    console.log('user_memories table ready')
  } catch (error) {
    console.error('failed to create user_memories table:', error)
  }
}

// call it anywhere in your code without the 'await' keyword.
// this lets it run entirely in the background while your code keeps moving:
initMemoriesTable()
