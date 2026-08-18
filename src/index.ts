import express, { Request, Response } from 'express'
import botService, { handleUpdate } from './botService'
import { logger } from './logger'
import { getHistory } from './history'
import { db } from './db'
import { sql, eq, sum } from 'drizzle-orm'
import { userMemories } from './schema'
import { answer } from './answer'
import { validateEnvironment } from './utils/config'

const app = express()
app.use(express.json())

validateEnvironment()

app.post('/webhook', botService)

/** Deletes any previously registered Telegram webhook so long polling can take over. */
async function deleteWebhook(): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/deleteWebhook`,
      { method: 'POST' },
    )
    const data: any = await response.json()
    if (data.ok) {
      logger.info('Webhook deleted successfully')
    } else {
      logger.warn(`Failed to delete webhook: ${data.description}`)
    }
  } catch (error: any) {
    logger.error(`Error deleting webhook: ${error.message || error}`)
  }
}

/** Infinite loop polling Telegram getUpdates. Uses 30s long-poll timeout for near-realtime delivery. */
async function startPolling() {
  await deleteWebhook()
  let offset = 0
  logger.info('Starting Telegram long polling...')

  while (true) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getUpdates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset,
            timeout: 30,
            allowed_updates: ['message'],
          }),
        },
      )

      if (!response.ok) {
        logger.error(`Polling request failed: ${response.status}`)
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      const data: any = await response.json()

      if (data.ok && data.result) {
        for (const update of data.result) {
          const requestId = Math.random().toString(36).substring(7)
          handleUpdate(update, requestId).catch((err: any) => {
            logger.error(`[${requestId}] Polling processing error: ${err.message || err}`)
          })
          offset = update.update_id + 1
        }
      }
    } catch (error: any) {
      logger.error(`Polling error: ${error.message || error}`)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}

/** Health-check endpoint: verifies DB connectivity and returns 200/500. */
app.get('/check', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`)
    res.send('Server and database are healthy!')
  } catch (error) {
    res.status(500).send('Database connection failed')
  }
})

/** Returns the rolling conversation summary for a given chat. */
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

/** REST endpoint to ask a question programmatically (bypasses Telegram). */
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

/** Returns the total number of unique users across all chats. */
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

/** Returns the total message count across all users. */
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

/** Returns the message count for a specific chat. */
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
  if (process.env.POLLING === 'true') {
    startPolling()
    logger.info('Mode: long polling (no webhook needed)')
  } else {
    logger.info('Mode: webhook')
  }
})
