import 'dotenv/config'
import express from 'express'
import botService from './botService'

const app = express()
app.use(express.json())

app.post('/webhook', botService)

app.get('/check', (req, res) => {
  res.send('Server is healthy !')
})

const port = 3000
app.listen(port, () => {
  console.log(`Bot is running on port ${port}`)
})
