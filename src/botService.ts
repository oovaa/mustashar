import { Request, Response } from 'express'
import { answer } from './answer'
import { db } from './db'
import { userMemories } from './schema'
import { eq } from 'drizzle-orm'
import { logger } from './logger'
import { updateHistory } from './history'

// === Rate Limiting ===
interface RateLimitEntry { timestamps: number[] }
// const RATE_LIMIT_SECONDS = 10
const RATE_LIMIT_MAX_REQUESTS = 5
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 600000

const rateLimitMap = new Map<string, RateLimitEntry>()

/** Checks whether this chat has exceeded the rate-limit window. Returns true if the request should be dropped. */
function isRateLimited(chatId: string): boolean {
  const now = Math.floor(Date.now() / 1000)
  let entry = rateLimitMap.get(chatId)
  if (!entry) {
    entry = { timestamps: [] }
    rateLimitMap.set(chatId, entry)
  }

  entry.timestamps = entry.timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_SECONDS)

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true
  }

  entry.timestamps.push(now)
  return false
}

// this removes every entry that didint send in 10 mins
setInterval(() => {
  const now = Math.floor(Date.now() / 1000)
  for (const [chatId, entry] of rateLimitMap) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_SECONDS)
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(chatId)
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS)

// === End Rate Limiting ===

const seenUpdateIds = new Set<number>()
const MAX_SEEN_IDS = 1000

/** Sends a text message to a Telegram chat via the Bot API. Throws on non-ok responses. */
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
      `[${requestId}] Telegram sendMessage failed (${response.status})`,
    )
    throw new Error(`Telegram sendMessage failed with status ${response.status}`)
  }

  logger.debug(`[${requestId}] Telegram sendMessage success`)
}

/** Processes a single Telegram update: rate-limited dispatch of /clear, answer pipeline, and history update. */
export async function handleUpdate(update: any, requestId: string): Promise<void> {
  const chat_id: string | undefined = update.message?.chat?.id?.toString()
  const userText: string | undefined = update.message?.text

  if (!chat_id || !userText) {
    logger.warn(`[${requestId}] Missing chat_id or userText`)
    return
  }

  const isEmptyMessage = userText.trim().length === 0

  if (isEmptyMessage) {
    logger.info(`[${requestId}] Empty or non-text message received`)
    await sendTelegramMessage(
      chat_id,
      'يرجى إرسال رسائل نصية فقط.',
      requestId,
    )
    return
  }

  logger.debug(`[${requestId}] chatid: ${chat_id} message: ${userText}`)

  if (isRateLimited(chat_id)) {
    logger.warn(`[${requestId}] Rate limited for chat ${chat_id}`)
    return
  }

  try {
    if (userText === '/clear') {
      logger.info(`[${requestId}] user requested history clear`)
      await db
        .update(userMemories)
        .set({ summary: 'No history found' })
        .where(eq(userMemories.chatId, chat_id))

      await sendTelegramMessage(
        chat_id,
        'تم مسح الذاكرة بنجاح، سأبدأ الآن معك صفحة جديدة ✅',
        requestId,
      )
      return
    }

    logger.info(`[${requestId}] Processing user request via answer pipeline...`)
    const finalAnswer = await answer(userText, chat_id, requestId)

    logger.debug(`[${requestId}] Sending response to Telegram...`)
    await sendTelegramMessage(chat_id, finalAnswer, requestId)

    logger.debug(`${requestId ? `[${requestId}] ` : ''}Response generated. Updating history...`)
    await updateHistory(userText, finalAnswer, chat_id)

    logger.info(`[${requestId}] Response sent successfully`)
  } catch (error: any) {
    logger.error(`[${requestId}] Internal server error: ${error.message || error}`)

    try {
      await sendTelegramMessage(
        chat_id,
        'عذراً، البوت يواجه ضغطاً كبيراً في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً 🙏',
        requestId,
      )
    } catch (sendError: any) {
      logger.error(`[${requestId}] Failed to send error message to user: ${sendError.message || sendError}`)
    }
  }
}

/** Express middleware for Telegram webhook. Acknowledges immediately, then processes asynchronously to avoid retries. */
const botService = async (req: Request, res: Response) => {
  const requestId = Math.random().toString(36).substring(7);
  logger.info(`[${requestId}] Webhook request received`)

  const update = req.body
  const updateId: number | undefined = update.update_id

  if (updateId !== undefined) {
    if (seenUpdateIds.has(updateId)) {
      logger.warn(`[${requestId}] Duplicate update_id=${updateId} received — ignoring.`)
      return res.status(200).send({ message: 'duplicate update ignored' })
    }
    seenUpdateIds.add(updateId)
    if (seenUpdateIds.size > MAX_SEEN_IDS) {
      seenUpdateIds.delete(seenUpdateIds.values().next().value as number)
    }
  }

  res.status(200).send({ message: 'ok' })

  handleUpdate(update, requestId).catch((err: any) => {
    logger.error(`[${requestId}] Unhandled error in async processing: ${err.message || err}`)
  })
}

export default botService
