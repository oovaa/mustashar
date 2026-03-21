import 'dotenv/config'
import express from 'express'
import botService from './botService'
import postgres from 'postgres'
import { logger } from './logger'

const app = express()
app.use(express.json())


const sql = postgres(process.env.DATABASE_URL!, { ssl: false })

app.post('/webhook', botService)

app.get('/check', async (req, res) => {
  try {
    await sql`SELECT 1`
    res.send('Server and database are healthy!')
  } catch (error) {
    res.status(500).send('Database connection failed')
  }
})

const port = 3000
app.listen(port, () => {
  logger.info(`Bot is running on port ${port}`)
})
