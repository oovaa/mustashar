import { createAgent, modelFallbackMiddleware } from 'langchain'
import { z } from 'zod'

// 1. Standalone Question Agent (Fast / Lightweight Routing)
const agent_stand_alone_fallback = modelFallbackMiddleware(
  'google:gemma-3-27b-it',
  'cohere:command-r7b-12-2024',
  'cohere:command-a-translate-08-2025',
  'groq:openai/gpt-oss-20b',
)

// 1. The Schema (Flattened to a single object to fix the LangChain error)
const responseSchema = z.object({
  has_quesion: z
    .boolean()
    .describe(
      'True if the user input contains a legal scenario or question. False if it is general conversation.',
    ),
  message: z
    .string()
    .describe(
      "If has_quesion is false, pass the user's exact original message here.",
    ),
  stand_alone_quesions_array: z
    .array(z.string())
    .describe(
      'If has_quesion is true, an array of fully contextualized, standalone legal questions.',
    ),
})

// 2. The Strict System Prompt
const SYSTEM_PROMPT = `You are an expert legal query analyzer. Your strict task is to classify and deconstruct user messages.

1. CLASSIFY: Determine if the message contains a legal inquiry/scenario or if it is general conversation (e.g., greetings, casual remarks, thanks). Set \`has_quesion\` to true or false.
2. PROCESS GENERAL (has_quesion: false): If it is a normal message, take the user's exact original text and pass it as-is into the \`message\` field.
3. PROCESS LEGAL (has_quesion: true): If it contains a legal scenario, break the user's inquiry down into a comprehensive list of standalone sub-questions (\`stand_alone_quesions_array\`).

the stand_alone_quesions_array can be empty if there is no legal quesions but messages always pass the original message

RULES FOR STANDALONE QUESTIONS (stand_alone_quesions_array):
- Break complex scenarios down into single, focused legal questions.
- Extract every possible legal angle or implication from the user's text.
- Resolve all pronouns and implied context. Every question MUST make complete sense on its own (e.g., change "Can he do that?" to "Can a landlord legally evict a tenant without notice?").
- The language MUST be the same language that the user used 
- CRITICAL: DO NOT answer the questions. Your only job is extraction and reformulation.
`

export const agent_stand_alone = createAgent({
  model: 'groq:llama-3.1-8b-instant',
  middleware: [agent_stand_alone_fallback],
  responseFormat: responseSchema,
  systemPrompt: SYSTEM_PROMPT,
})

// 3. The Reusable Function
export async function analyzeUserMessage(userInput: string) {
  try {
    const response = await agent_stand_alone.invoke({ messages: userInput })
    return response.structuredResponse
  } catch (error) {
    console.error('Failed to process message:', error)
    throw error
  }
}

// Test it out!
console.log(await analyzeUserMessage('hi there tell me about you'))
console.log(
  await analyzeUserMessage(`
    مؤجرين وقبل مانتم سنة في البيت صاحب البيت بلغنا قبل شهر انو من الشهر الجاي مطالبين ب زيادة وانا بلغتو برفضي للزيادة الا بعد نكمل سنه في البيت
مع العلم اننا صلحنا الحوش مع الجيران كان في أماكن فاتحه ..
ونحن بنينا لينا زيادة مباني
ونحن كلمناه من البداية عايزين ايجار طويل المدى
عشان كدا خسرنا فيهو وزدنا فيهو
الكلام ده كلو شفهي بدون عقد ايجار
ا`),
)

// {
//   stand_alone_quesions_array: [],
//   has_quesion: false,
//   message: "hi there tell me about you",
// }
// {
//   stand_alone_quesions_array: [
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار بعد عام من الإيجار؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار قبل انتهاء عام الإيجار؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار من أصحاب العقار دون عقد؟",
//     "هل يمكن للصاحب أن يحصل على زيادة الإيجار بعد بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان هناك صلح مع الجيران؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة مبنية على إتفاق مع الجيران؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار طويل المدى؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الكلام كان شفهي دون عقد؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب خسارة؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار بعد عام من الإيجار؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار طويل المدى؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار بعد عام من الإيجار؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار طويل المدى؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار بعد عام من الإيجار؟",
//     "هل يمكن للصاحب أن يطلب زيادة الإيجار إذا كان الزيادة بسبب بناء زيادة في العقار؟",
//     "هل يمكن للصاحب أن يرفض زيادة الإيجار إذا كان الإيجار طويل المدى؟"
//   ],
//   has_quesion: true,
//   message: "مؤجرين وقبل مانتم سنة في البيت صاحب البيت بلغنا قبل شهر انو من الشهر الجاي مطالبين ب زيادة وانا بلغتو برفضي للزيادة الا بعد نكمل سنه في البيت",
// }
// ~/repos/mustashar agent !1 ?1 ❯                                                                              3s
