import { createAgent, modelFallbackMiddleware } from 'langchain'
import { db } from './db'
import { userMemories } from './schema'
import { eq, sql } from 'drizzle-orm'
import { logger } from './logger'

// ==========================================
// 3. SUMMARIZE AGENT (Rolling Memory Manager)
// Primary: Cohere's latest flagship for heavy document processing.
// ==========================================

const agent_summrize_fallback = modelFallbackMiddleware(
  'cerebras:qwen-3-235b-a22b-instruct-2507',
  'groq:openai/gpt-oss-120b',
  'cohere:command-r-plus-08-2024',
)

// The Rolling Memory Prompt
// The Strict Rolling Memory Prompt
const SUMMARIZE_SYSTEM_PROMPT = `You are an expert AI conversation memory manager. Your task is to maintain a concise, running summary of a chat history.

You will receive:
1. The OLD SUMMARY of the conversation so far.
2. The LATEST USER MESSAGE.
3. The LATEST AI RESPONSE.

YOUR INSTRUCTIONS:
- Create a NEW SUMMARY that seamlessly blends the old summary with the new interaction.
- Keep it incredibly concise, but NEVER lose critical facts (dates, legal scenarios, specific numbers, or core context).
- Write in a neutral, third-person perspective.
- If the OLD SUMMARY says "No history found", simply summarize the new interaction on its own.
- Output ONLY the text of the new summary. Do not add conversational filler.

CRITICAL LANGUAGE RULES:
- You MUST write the ENTIRE summary in the EXACT SAME LANGUAGE as the LATEST USER MESSAGE.
- If the user writes in Arabic, the ENTIRE summary MUST be in pure Arabic.
- STRICTLY FORBIDDEN: Do not mix languages. Do not use English words like "landlord", "user", or "AI" if the text is Arabic (use "المؤجر", "المستخدم", "الذكاء الاصطناعي").
- STRICTLY FORBIDDEN: ABSOLUTELY NO CHINESE or any other third language.
- Your output must be 100% monolingual matching the user.
`

export const agent_summrize = createAgent({
  model: 'cohere:command-a-03-2025',
  middleware: [agent_summrize_fallback],
  systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
})

// ==========================================
// DATABASE MEMORY FUNCTIONS
// ==========================================

/** Fetches the rolling conversation summary for a given chat. Returns 'No history found' if none exists. */
export const getHistory = async (chat_id: string) => {
  logger.debug(`Fetching history for chat_id: ${chat_id}`)
  try {
    const result = await db
      .select({ summary: userMemories.summary })
      .from(userMemories)
      .where(eq(userMemories.chatId, chat_id))
      .limit(1)

    return result[0]?.summary ?? 'No history found'
  } catch (error) {
    logger.error(`Failed to fetch history for chat ${chat_id}: ${error}`)
    return 'No history found'
  }
}

/** Generates a new rolling summary by combining old history with the latest exchange, then upserts it. */
export const updateHistory = async (
  message: string,
  response: string,
  chat_id: string,
) => {
  logger.debug(
    `Updating history for chat_id: ${chat_id}. Message len: ${message.length}, Response len: ${response.length}`,
  )
  try {
    // 1. Fetch the existing history
    const oldHistory = await getHistory(chat_id)

    // 2. Format the payload for the summarizer agent
    const summaryPayload = `
      OLD SUMMARY:
      ${oldHistory}

      LATEST USER MESSAGE:
      ${message}

      LATEST AI RESPONSE:
      ${response}
    `

    // 3. Generate the new updated summary
    logger.debug(`Generating summary via agent for chat_id: ${chat_id}`)
    logger.debug(`Invoking agent_summrize. Input Payload:\n${summaryPayload}`)
    const aiResponse = await agent_summrize.invoke({ messages: summaryPayload })
    // LangChain text responses are usually in aiResponse.content or aiResponse.text depending on the wrapper, assuming .content here:
    // console.log('Ai summary response:\n', aiResponse.messages.at(1)?.content)

    const updatedSummaryText = String(
      aiResponse.messages.at(-1)?.content,
    ).trim()
    logger.debug(`agent_summrize output:\n${updatedSummaryText}`)

    // 4. Upsert the new summary into the database, incrementing message count
    await db
      .insert(userMemories)
      .values({ chatId: chat_id, summary: updatedSummaryText, count: 1 })
      .onConflictDoUpdate({
        target: userMemories.chatId,
        set: {
          summary: updatedSummaryText,
          count: sql`${userMemories.count} + 1`,
        },
      })

    logger.debug(`Successfully updated history for chat: ${chat_id}`)
    return updatedSummaryText
  } catch (error) {
    logger.error(`Failed to update history for chat ${chat_id}: ${error}`)
    throw error
  }
}

