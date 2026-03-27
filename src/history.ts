import { createAgent, modelFallbackMiddleware } from 'langchain'
import { db } from './db'
import { userMemories } from './schema'
import { eq } from 'drizzle-orm'
import { logger } from './logger'

// ==========================================
// 3. SUMMARIZE AGENT (Rolling Memory Manager)
// Primary: Cohere's latest flagship for heavy document processing.
// ==========================================

const agent_summrize_fallback = modelFallbackMiddleware(
  'together:MiniMaxAI/MiniMax-M2.5',
  'cohere:command-r-plus-08-2024',
  'groq:openai/gpt-oss-120b',
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
- Your output must be 100% monolingual matching the user.`

export const agent_summrize = createAgent({
  model: 'cohere:command-a-03-2025',
  middleware: [agent_summrize_fallback],
  systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
})

// ==========================================
// DATABASE MEMORY FUNCTIONS
// ==========================================

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

    // 4. Upsert the new summary into the database
    await db
      .insert(userMemories)
      .values({ chatId: chat_id, summary: updatedSummaryText })
      .onConflictDoUpdate({
        target: userMemories.chatId,
        set: { summary: updatedSummaryText },
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
      logger.info(newSummary) // Prints the summary in green for readability
    } catch (error) {
      logger.error(`❌ Failed at step ${interaction.step}: ${error}`)
      break // Stop the test if an error occurs
    }
  }

  logger.info(`\n🏁 Test Complete!`)
}

// Uncomment the line below to run the test when you execute the file
// testArabicSummarizer()

//  Starting Summarizer Test for Chat ID: test-chat-arabic-001

// --- Processing Step 1 ---
// User: مرحباً، أريد استشارة قانونية بخصوص إيجار بيت. نحن مستأجرين بيت بدون عقد مكتوب.
// AI: أهلاً بك. تفضل، العقود الشفهية معترف بها قانونياً في العديد من الحالات إذا أمكن إثباتها. ما هي المشكلة تحديداً؟
// ⏳ Generating new summary...
// Successfully updated history for chat: test-chat-arabic-001
// ✅ NEW DATABASE SUMMARY:
// المستخدم يطلب استشارة قانونية بخصوص إيجار بيت بدون عقد مكتوب. وكان قد رفض رفضاً قاطعاً زيادة الإيجار وأخبر المؤجر أنه لن يدفع زيادة إلا بعد إكمال السنة، كما أعلمه بإجراء إصلاحات في الحوش وبناء مبانٍ إضافية على حسابه. الذكاء الاصطناعي أوضح له أن رفضه مبرر قانونياً، وأن له الحق في المطالبة بقيمة التحسينات أو خصمها من الإيجار شريطة موافقة المؤجر وعلمه بذلك، خاصة مع وجود اتفاق شفهي على إيجار طويل المدى.

// --- Processing Step 2 ---
// User: صاحب البيت بلغنا قبل شهر أنه يريد زيادة الإيجار ابتداءً من الشهر القادم، ونحن لم نكمل سنة في البيت بعد.
// AI: عادةً، لا يحق للمؤجر زيادة القيمة الإيجارية قبل انتهاء المدة المتفق عليها (والتي تُعتبر سنة في العادة للعقود السكنية) إلا بموافقة الطرفين. هل وافقتم على هذه الزيادة؟
// ⏳ Generating new summary...
// Successfully updated history for chat: test-chat-arabic-001
// ✅ NEW DATABASE SUMMARY:
// المستخدم يستشير في إيجار بيت بدون عقد مكتوب، وقد رفض رفضاً قاطعاً زيادة الإيجار وأخبر المؤجر أنه لن يدفع زيادة إلا بعد إكمال السنة، كما أعلمه بإجراء إصلاحات في الحوش وبناء مبانٍ إضافية على حسابه. الذكاء الاصطناعي أوضح له أن رفضه مبرر قانونياً، وأن له الحق في المطالبة بقيمة التحسينات أو خصمها من الإيجار شريطة موافقة المؤجر وعلمه بذلك، خاصة مع وجود اتفاق شفهي على إيجار طويل المدى. ثم أبلغ المؤجر المستخدم قبل شهر أنه يريد زيادة الإيجار ابتداءً من الشهر القادم، علماً أنهم لم يكملوا سنة في البيت بعد. الذكاء الاصطناعي سأل المستخدم عما إذا كان وافق على هذه الزيادة.

// --- Processing Step 3 ---
// User: لا، أنا رفضت الزيادة تماماً وأخبرته أننا لن ندفع زيادة إلا بعد إكمال السنة. مع العلم أننا قمنا ببعض الإصلاحات في الحوش وبنينا مباني إضافية على حسابنا.
// AI: رفضك في محله القانوني. بالنسبة للإصلاحات والمباني الإضافية التي قمتم بها على حسابكم، يحق لكم المطالبة بقيمتها أو خصمها من الإيجار إذا كانت تمت بموافقته وعلمه، خاصة وأنكم اتفقتم شفهياً على إيجار طويل المدى.
// ⏳ Generating new summary...
// Successfully updated history for chat: test-chat-arabic-001
// ✅ NEW DATABASE SUMMARY:
// المستخدم يستشير في إيجار بيت بدون عقد مكتوب، وقد رفض رفضاً قاطعاً زيادة الإيجار وأخبر المؤجر أنه لن يدفع زيادة إلا بعد إكمال السنة. كما أعلمه بأنه قام بإصلاحات في الحوش وبنى مبانٍ إضافية على حسابه. المؤجر أعلمه قبل شهر برغبته في زيادة الإيجار ابتداءً من الشهر القادم، علماً بأنهم لم يكملوا سنة في البيت بعد. المستخدم رفض الزيادة تماماً وأخبره بذلك. الذكاء الاصطناعي أكد أن رفضه مبرر قانونياً، وأن له الحق في المطالبة بقيمة التحسينات أو خصمها من الإيجار إذا تمت بموافقة المؤجر وعلمه بذلك، خاصة مع وجود اتفاق شفهي على إيجار طويل المدى.

// 🏁 Test Complete!
// ^C
// ~/repos/mustashar agent !1 ?3 ❯                                                ✘ INT 47s
