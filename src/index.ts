import { Hono } from 'hono'
import botService from './botService'
import { config } from 'dotenv'

config()

export type Env = {
  GROQ_API_KEY: string
  BOT_TOKEN: string
  DATABASE_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.get('/check', (c) => c.text('Server is healthy !'))

// Telegram bot webhook
app.post('/', botService)

export default app;