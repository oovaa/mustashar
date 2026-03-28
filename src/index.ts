import express from 'express'
import botService from './botService'
import { logger } from './logger'
import { getHistory } from './history'
import { db } from './db'
import { sql, eq, sum } from 'drizzle-orm'
import { userMemories } from './schema'
import { answer } from './answer'

const app = express()
app.use(express.json())

app.post('/webhook', botService)

app.get('/check', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`)
    res.send('Server and database are healthy!')
  } catch (error) {
    res.status(500).send('Database connection failed')
  }
})

app.get('/summary/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params
    const history = await getHistory(chatId)
    res.json({ history })
  } catch (error) {
    logger.error(
      `Error fetching summary for chat ${req.params.chatId}: ${error}`,
    )
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

app.post('/answer', async (req, res) => {
  const { question, chatId } = req.body

  if (!question || !chatId) {
    res.status(400).send('Missing question or chatId')
    return
  }

  try {
    const result = await answer(question, chatId)
    res.json({ answer: result })
  } catch (error) {
    logger.error(`Error processing answer for chat ${chatId}: ${error}`)
    res.status(500).json({ error: 'Failed to answer question' })
  }
})

app.get('/stats/users', async (_req, res) => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(userMemories)
    res.json({ users: Number(result[0]?.count ?? 0) })
  } catch (error) {
    logger.error(`Error fetching user count: ${error}`)
    res.status(500).json({ error: 'Failed to fetch user count' })
  }
})

app.get('/stats/messages', async (_req, res) => {
  try {
    const result = await db
      .select({ total: sum(userMemories.count) })
      .from(userMemories)
    res.json({ messages: Number(result[0]?.total ?? 0) })
  } catch (error) {
    logger.error(`Error fetching total message count: ${error}`)
    res.status(500).json({ error: 'Failed to fetch total message count' })
  }
})

app.get('/stats/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params
    const result = await db
      .select({ count: userMemories.count })
      .from(userMemories)
      .where(eq(userMemories.chatId, chatId))
      .limit(1)

    if (result.length === 0) {
      res.status(404).json({ error: 'Chat not found' })
      return
    }

    res.json({ chatId, messages: result[0]?.count ?? 0 })
  } catch (error) {
    logger.error(
      `Error fetching message count for chat ${req.params.chatId}: ${error}`,
    )
    res.status(500).json({ error: 'Failed to fetch message count' })
  }
})

const port = 3000
app.listen(port, () => {
  logger.info(`Bot is running on port ${port}`)
})
