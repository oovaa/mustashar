import { Hono } from 'hono'
import { llm } from './llm'

const app = new Hono()

app.post('/', async (c) => {
  const body = await c.req.json()
  console.log(body)

  const answ = await llm.invoke(body.quesion)

  return c.json({ answer: answ.content })
})

export default app
