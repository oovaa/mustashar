import { Request, Response } from 'express'
import { answer } from './answer'
import { db } from './db'
import { userMemories } from './schema'
import { eq } from 'drizzle-orm'
import { logger } from './logger'
import { updateHistory } from './history'

/**
 * Tracks recently processed Telegram update_ids to prevent duplicate
 * processing when Telegram retries a webhook that took too long to respond.
 * Capped at MAX_SEEN_IDS entries to avoid unbounded memory growth.
 */
const seenUpdateIds = new Set<number>()
const MAX_SEEN_IDS = 1000


const sendTelegramMessage = async (
  chat_id: string,
  text: string,
  requestId: string,
) => {

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text }),
    },
  )

  const responseBody = await response.text()
  if (!response.ok) {
    logger.error(
      `[${requestId}] Telegram sendMessage failed (${response.status}): ${responseBody}`,
    )
    throw new Error(`Telegram sendMessage failed with status ${response.status}`)
  }

  logger.debug(`[${requestId}] Telegram sendMessage success: ${responseBody}`)
}

const botService = async (req: Request, res: Response) => {
  const requestId = Math.random().toString(36).substring(7);
  logger.info(`[${requestId}] Webhook request received`);


  const update = req.body
  const updateId: number | undefined = update.update_id
  const chat_id: string | undefined = update.message?.chat?.id?.toString() || update.chat_id
  const userText: string | undefined = update.message?.text || update.userText
  const logPrefix = requestId ? `[${requestId}] ` : ''

  logger.debug(`[${requestId}] chatid: ${chat_id} message: ${userText}\n body: ${JSON.stringify({ update })}`)

  // Deduplicate: if this update_id was already processed, acknowledge and skip.
  // Mark it seen immediately (before any await) to eliminate the race condition
  // where two simultaneous retries both pass the has() check.
  if (updateId !== undefined) {
    if (seenUpdateIds.has(updateId)) {
      logger.warn(`[${requestId}] Duplicate update_id=${updateId} received — ignoring.`)
      return res.status(200).send({ message: 'duplicate update ignored' })
    }
    seenUpdateIds.add(updateId)
    if (seenUpdateIds.size > MAX_SEEN_IDS) {
      // Remove the oldest entry to keep the set bounded (insertion order is
      // guaranteed in ES2015+ which is the project's ESNext target).
      seenUpdateIds.delete(seenUpdateIds.values().next().value as number)
    }
  }

  if (!chat_id) {
    logger.warn(`[${requestId}] Missing chat_id.`);
    return res.status(200).send({ message: 'chat id is required' });
  }

  const chatId = chat_id
  const messageText = userText ?? ''
  const isEmptyMessage = messageText.trim().length === 0

  // Acknowledge the webhook immediately so Telegram does not retry this update.
  res.status(200).send({ message: 'ok' })

    // Process the message asynchronously after responding.
    ; (async () => {
      try {
        if (isEmptyMessage) {
          logger.info(`[${requestId}] Empty or non-text message received`)
          await sendTelegramMessage(
            chatId,
            'يرجى إرسال رسائل نصية فقط.',
            requestId,
          )
          return
        }

        // Handle /clear command
        if (messageText === '/clear') {
          logger.info(`[${requestId}] user requested history clear`)
          await db
            .update(userMemories)
            .set({ summary: 'No history found' })
            .where(eq(userMemories.chatId, chatId))

          await sendTelegramMessage(
            chatId,
            'تم مسح الذاكرة بنجاح، سأبدأ الآن معك صفحة جديدة ✅',
            requestId,
          )
          return
        }

        // await sendTelegramMessage(
        //   chatId,
        //   'البوت متوقف للصيانة سنعود قريبا 😅',
        //   requestId,
        // )
        // return

        logger.info(`[${requestId}] Processing user request via answer pipeline...`)
        const finalAnswer = await answer(messageText, chatId, requestId)


        // Log all relevant variables that reached this point for debugging
        try {
          const varsToLog = {
            requestId,
            updateId,
            chat_id,
            chatId,
            userText,
            messageText,
            finalAnswer,
            seenUpdateIdsSize: seenUpdateIds.size,
            MAX_SEEN_IDS,
            // include the raw update body for full context
            update,
          }
          logger.debug(`[${requestId}] Vars at checkpoint: ${JSON.stringify(varsToLog, null, 3)}`)
        } catch (err: any) {
          logger.error(`[${requestId}] Failed to serialize vars for logging: ${err.message || err}`)
        }

        logger.debug(`[${requestId}] Sending response to Telegram...`)
        await sendTelegramMessage(chatId, finalAnswer, requestId)


        logger.debug(`${logPrefix}Generated general response. Updating history...`)
        await updateHistory(messageText, finalAnswer, chat_id)


        logger.info(`[${requestId}] Response sent successfully`)
      } catch (error: any) {
        logger.error(`[${requestId}] Internal server error: ${error.message || error}`)

        try {
          await sendTelegramMessage(
            chatId,
            'عذراً، البوت يواجه ضغطاً كبيراً في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً 🙏',
            requestId,
          )
        } catch (sendError: any) {
          logger.error(`[${requestId}] Failed to send error message to user: ${sendError.message || sendError}`)
        }
      }
    })().catch((err: any) => {
      logger.error(`[${requestId}] Unhandled error in async processing: ${err.message || err}`)
    })
}

export default botService
