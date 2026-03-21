import { Request, Response } from 'express'
import { answer } from './answer'
import { sql } from './db'
import { logger } from './logger'

const botService = async (req: Request, res: Response) => {
  try {
    const update = req.body
    const chat_id = update.message?.chat.id.toString()
    const userText = update.message?.text

    logger.debug(`chatid: ${chat_id} message: ${userText}\n  body : ${update}`)


    if (!chat_id || !userText) {
      logger.error(`chatid and message are needed current are : ${chat_id}, ${userText}`)
      res.send({message: "chat id and message are required"})
      return
    }
    if (userText === '/clear') {
      try {
        await sql`UPDATE user_memories SET summary = 'No history found', updated_at = NOW() WHERE chat_id = ${chat_id}`
        logger.info(`summary is cleaned for the user with chat id:${chat_id}`)
        await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id,
              text: 'تم مسح الذاكرة بنجاح، سأبدأ الآن معك صفحة جديدة ✅',
            }),
          },
        )
        res.send('Ok')
        return
      } catch (err) {
        console.error('could not be able to clear the chat :', err)
        throw err
      }
    }

    await sql`
    CREATE TABLE IF NOT EXISTS user_memories (
      chat_id TEXT PRIMARY KEY,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )`

    logger.info('Table check/creation complete.')

    try {
      // The answer pipeline now handles:
      // 1) standalone analysis
      // 2) conditional retrieval for legal question loops
      // 3) answer generation
      // 4) rolling summary update in storage
      const finalAnswer = await answer(userText, chat_id)
      logger.info(`AI answered with ${finalAnswer}`)

      // 5. Telegram fetch
      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text: finalAnswer }),
        },
      )
      res.send({ answer: finalAnswer })
    } catch (err: any) {
      console.error('Error processing update:', err)
      res.json({
        error: 'حدث خطأ أثناء معالجة الاستعلام. يرجى المحاولة مرة أخرى.',
      })
    }
  } catch (error) {
    console.log(error)
    res.json({ error: 'حدث خطأ داخلي في الخادم.' })
  }
}

export default botService
