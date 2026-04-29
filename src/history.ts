import { createAgent, modelFallbackMiddleware } from 'langchain'
import { db } from './db'
import { userMemories } from './schema'
import { eq, sql } from 'drizzle-orm'
import { logger } from './logger'

// ==========================================
// SUMMARIZE AGENT (Rolling Memory Manager)
// Primary: Cohere's latest flagship for heavy document processing.
// Fallback chain ensures availability even when the primary model is rate-limited.
// ==========================================

/** Fallback model chain for the summarizer agent. */
const agent_summrize_fallback = modelFallbackMiddleware(
  'together:MiniMaxAI/MiniMax-M2.7',
  'groq:openai/gpt-oss-120b',
  'cohere:command-r-plus-08-2024',
)

/**
 * System prompt that instructs the summarizer agent to produce a concise,
 * language-matched, rolling summary of the conversation.
 */
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

/** Pre-configured summarizer agent instance with its fallback middleware attached. */
export const agent_summrize = createAgent({
  model: 'cohere:command-a-03-2025',
  middleware: [agent_summrize_fallback],
  systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
})

// ==========================================
// DATABASE MEMORY FUNCTIONS
// ==========================================

/**
 * Retrieves the stored conversation context for a given chat.
 *
 * Returns a formatted string that includes:
 *  - The rolling summary of the full conversation.
 *  - The verbatim last user message and AI response (when available).
 *
 * This combined context is passed directly into AI prompts so the model
 * has both high-level history and the most recent exchange.
 *
 * Falls back to `"No history found"` on any DB error.
 *
 * @param chat_id - Unique identifier for the chat session.
 * @returns Formatted history context string.
 */
export const getHistory = async (chat_id: string) => {
  logger.debug(`Fetching history for chat_id: ${chat_id}`)
  try {
    const result = await db
      .select({
        summary: userMemories.summary,
        lastMessage: userMemories.lastMessage,
        lastResponse: userMemories.lastResponse,
      })
      .from(userMemories)
      .where(eq(userMemories.chatId, chat_id))
      .limit(1)

    const row = result[0]

    // No record yet — return the default sentinel value.
    if (!row) return 'No history found'

    const { summary, lastMessage, lastResponse } = row

    // Build the combined context block.
    // Always include the rolling summary; append the last interaction only
    // when both sides of the exchange have been recorded.
    let context = `ROLLING SUMMARY:\n${summary}`

    if (lastMessage && lastResponse) {
      context += `\n\nLATEST INTERACTION:\nUser: ${lastMessage}\nAI: ${lastResponse}`
    }

    return context
  } catch (error) {
    logger.error(`Failed to fetch history for chat ${chat_id}: ${error}`)
    return 'No history found'
  }
}

/**
 * Generates an updated rolling summary and persists the full interaction to the DB.
 *
 * Steps:
 *  1. Fetch the existing history context for the chat.
 *  2. Build a structured payload for the summarizer agent.
 *  3. Invoke the summarizer to produce a new, blended summary.
 *  4. Upsert the new summary, verbatim last message/response, and incremented
 *     interaction count back into the database.
 *
 * @param message  - The user's message text.
 * @param response - The AI's reply text.
 * @param chat_id  - Unique identifier for the chat session.
 * @returns The newly generated summary text.
 * @throws Re-throws any DB or agent error after logging it.
 */
export const updateHistory = async (
  message: string,
  response: string,
  chat_id: string,
) => {
  logger.debug(
    `Updating history for chat_id: ${chat_id}. Message len: ${message.length}, Response len: ${response.length}`,
  )
  try {
    // 1. Fetch the existing history context (summary + last interaction).
    const oldHistory = await getHistory(chat_id)

    // 2. Format the payload for the summarizer agent.
    const summaryPayload = `
      OLD SUMMARY:
      ${oldHistory}

      LATEST USER MESSAGE:
      ${message}

      LATEST AI RESPONSE:
      ${response}
    `

    // 3. Generate the new updated summary via the rolling-memory agent.
    logger.debug(`Generating summary via agent for chat_id: ${chat_id}`)
    logger.debug(`Invoking agent_summrize. Input Payload:\n${summaryPayload}`)
    const aiResponse = await agent_summrize.invoke({ messages: summaryPayload })

    const updatedSummaryText = String(
      aiResponse.messages.at(-1)?.content,
    ).trim()
    logger.debug(`agent_summrize output:\n${updatedSummaryText}`)

    // 4. Upsert: store the new summary, verbatim last interaction, and bump count.
    await db
      .insert(userMemories)
      .values({
        chatId: chat_id,
        summary: updatedSummaryText,
        lastMessage: message,
        lastResponse: response,
        count: 1,
      })
      .onConflictDoUpdate({
        target: userMemories.chatId,
        set: {
          summary: updatedSummaryText,
          lastMessage: message,
          lastResponse: response,
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

// ==========================================
// TEST FUNCTION
// ==========================================

/** Smoke-tests the Arabic summarizer against a multi-step simulated conversation. */
export async function testArabicSummarizer() {
  const testChatId = 'test-chat-arabic-001'

  logger.info(`\n🚀 Starting Summarizer Test for Chat ID: ${testChatId}\n`)

  // Simulated conversation history (Array of interactions)
  const dummyInteractions = [
    {
      step: 1,
      user: 'مرحباً، أريد استشارة قانونية بخصوص إيجار بيت. نحن مستأجرين بيت بدون عقد مكتوب.',
      ai: 'أهلاً بك. تفضل، العقود الشفهية معترف بها قانونياً في العديد من الحالات إذا أمكن إثباتها. ما هي المشكلة تحديداً؟',
    },
    {
      step: 2,
      user: 'صاحب البيت بلغنا قبل شهر أنه يريد زيادة الإيجار ابتداءً من الشهر القادم، ونحن لم نكمل سنة في البيت بعد.',
      ai: 'عادةً، لا يحق للمؤجر زيادة القيمة الإيجارية قبل انتهاء المدة المتفق عليها (والتي تُعتبر سنة في العادة للعقود السكنية) إلا بموافقة الطرفين. هل وافقتم على هذه الزيادة؟',
    },
    {
      step: 3,
      user: 'لا، أنا رفضت الزيادة تماماً وأخبرته أننا لن ندفع زيادة إلا بعد إكمال السنة. مع العلم أننا قمنا ببعض الإصلاحات في الحوش وبنينا مباني إضافية على حسابنا.',
      ai: 'رفضك في محله القانوني. بالنسبة للإصلاحات والمباني الإضافية التي قمتم بها على حسابكم، يحق لكم المطالبة بقيمتها أو خصمها من الإيجار إذا كانت تمت بموافقته وعلمه، خاصة وأنكم اتفقتم شفهياً على إيجار طويل المدى.',
    },
  ]

  for (const interaction of dummyInteractions) {
    logger.info(`--- Processing Step ${interaction.step} ---`)
    logger.info(`User: ${interaction.user}`)
    logger.info(`AI: ${interaction.ai}`)
    logger.info(`⏳ Generating new summary...`)

    try {
      const newSummary = await updateHistory(
        interaction.user,
        interaction.ai,
        testChatId,
      )

      logger.info(`✅ NEW DATABASE SUMMARY:`)
      logger.info(newSummary)
    } catch (error) {
      logger.error(`❌ Failed at step ${interaction.step}: ${error}`)
      break // Stop the test if an error occurs
    }
  }

  logger.info(`\n🏁 Test Complete!`)
}

// Uncomment the line below to run the test when you execute the file
// testArabicSummarizer()
