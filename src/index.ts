import 'dotenv/config'
import express from 'express'
import botService from './botService'
import { logger } from './logger'
import { getHistory } from './history'
import { db } from './db'
import { sql } from 'drizzle-orm'

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
    logger.error(`Error fetching summary for chat ${req.params.chatId}: ${error}`)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

const port = 3000
app.listen(port, () => {
  logger.info(`Bot is running on port ${port}`)
})
