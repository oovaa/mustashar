import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	throw new Error('DATABASE_URL is not set')
}

// SSL disabled — DB is on Docker's internal network, not exposed to the internet.
// For external DBs, set DATABASE_SSL=true and ensure the server supports it.
const useSsl = process.env.DATABASE_SSL === 'true'

export const sql = postgres(connectionString, { ssl: useSsl })
export const db = drizzle(sql, { schema })

