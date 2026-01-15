import { Hono } from 'hono'
import { llm } from './llm'

export type Env = {
  GROQ_API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

app.post('/', async (c) => {
  const body = await c.req.json()

  const answ = await llm.invoke(body.question)

  return c.json({ answer: answ.content })
})

export default app
