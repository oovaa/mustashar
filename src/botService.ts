import { Request, Response } from 'express'
import { answer } from './answer'
import { db } from './db'
import { userMemories } from './schema'
import { eq } from 'drizzle-orm'
import { logger } from './logger'

const botService = async (req: Request, res: Response) => {
  const requestId = Math.random().toString(36).substring(7);
  logger.info(`[${requestId}] Webhook request received`);

  // Telegram only needs an ACK for webhook delivery.
  res.status(200).send('OK')

  let chat_id: string | undefined

  try {
    const update = req.body
    chat_id = update.message?.chat?.id?.toString() // Added optional chaining
    const userText = update.message?.text

    logger.debug(`[${requestId}] chatid: ${chat_id} message: ${userText}\n body: ${JSON.stringify({ update })}`)

    if (!chat_id || !userText) {
      logger.warn(`[${requestId}] Missing chat_id or userText.`);
      return
    }

    // Handle /clear command
    if (userText === '/clear') {
      logger.info(`[${requestId}] user requested history clear`)
      await db
        .update(userMemories)
        .set({ summary: 'No history found' })
        .where(eq(userMemories.chatId, chat_id))

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
      return
    }

    // Optimization: Table creation should ideally be in a separate migration/init file, 
    // but kept here for now per your original logic.

    logger.info(`[${requestId}] Processing user request via answer pipeline...`)
    const finalAnswer = await answer(userText, chat_id, requestId)

    logger.debug(`[${requestId}] Sending response to Telegram...`)
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: finalAnswer }),
      }
    )

    logger.info(`[${requestId}] Response sent successfully`)
    console.log(finalAnswer);

    return


  } catch (error: any) {
    logger.error(`[${requestId || 'unknown'}] Internal server error: ${error.message || error}`)

    if (chat_id) {
      try {
        await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id,
              text: 'عذراً، البوت يواجه ضغطاً كبيراً في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً 🙏',
            }),
          },
        )
      } catch (sendError: any) {
        logger.error(`[${requestId || 'unknown'}] Failed to send error message to user: ${sendError.message || sendError}`)
      }
    }

    return
  }
}

export default botService