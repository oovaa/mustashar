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
    throw error
  }
}

// When this module is run directly (e.g., as a migration script), initialize the table and
// exit with a non-zero status if initialization fails.
if (require.main === module) {
  ;(async () => {
    try {
      await initMemoriesTable()
    } catch (error) {
      console.error('exiting due to user_memories table initialization failure')
      process.exit(1)
    }
  })()
}
