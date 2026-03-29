import { Request, Response } from 'express'
import { answer } from './answer'
import { db } from './db'
import { userMemories } from './schema'
import { eq } from 'drizzle-orm'
import { logger } from './logger'

const botService = async (req: Request, res: Response) => {
  const requestId = Math.random().toString(36).substring(7);
  logger.info(`[${requestId}] Webhook request received`);

  let chat_id: string | undefined

  try {
    const update = req.body
    chat_id = update.message?.chat?.id?.toString() // Added optional chaining
    const userText = update.message?.text

    logger.debug(`[${requestId}] chatid: ${chat_id} message: ${userText}\n body: ${JSON.stringify({update})}`)

    if (!chat_id || !userText) {
      logger.warn(`[${requestId}] Missing chat_id or userText.`);
      // Use return to stop execution
      return res.status(200).send({ message: "chat id and message are required" });
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
      return res.send('Ok')
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
    return res.send({ answer: finalAnswer })

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

    // Check if headers already sent to avoid double-response errors
    if (!res.headersSent) {
      return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم.' })
    }
  }
}

export default botService