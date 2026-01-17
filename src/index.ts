import { Hono } from 'hono'
import botService from './botService'

export type Env = {
  GROQ_API_KEY: string,
  BOT_TOKEN:string
}

const app = new Hono<{ Bindings: Env }>()

app.post('/', botService)

export default app
