import express from 'express'
import botService from './botService'
import { logger } from './logger'
import { getHistory } from './history'
import { answer } from './answer'
import { sql } from './db'
import { initMemoriesTable } from './create_db'

const app = express()
app.use(express.json())

app.post('/webhook', botService)

app.get('/check', async (req, res) => {
  try {
    await sql`SELECT 1`
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

const port = 3000

async function start() {
  // try to ensure DB table exists (retries while waiting for DB readiness)
  for (let i = 0; i < 10; i++) {
    try {
      await initMemoriesTable()
      break
    } catch (err) {
      logger.warn(`DB not ready yet, retrying (${i + 1}/10)`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  app.listen(port, () => {
    logger.info(`Bot is running on port ${port}`)
  })
}

start()
