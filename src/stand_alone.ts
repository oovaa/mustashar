import { createAgent, modelFallbackMiddleware } from 'langchain'
import { z } from 'zod'

// 1. Standalone Question Agent
const agent_stand_alone_fallback = modelFallbackMiddleware(
  'cohere:command-r7b-12-2024',
  'google-genai:gemma-3-27b-it',
  'groq:llama-3.1-8b-instant',
)

// 1. The Schema
const responseSchema = z.object({
  has_quesion: z
    .boolean()
    .describe(
      'True if the user input contains a legal scenario/question. False if it is general conversation.',
    ),
  message: z
    .string()
    .describe(
      "Always pass the user's exact original message here, regardless of has_quesion.",
    ),
  stand_alone_quesions_array: z
    .array(z.string())
    .describe(
      'If has_quesion is true, an array of questions. If false, must be an empty array [].',
    ),
})

// 2. The Strict System Prompt (Added Anti-Looping Rules)
const SYSTEM_PROMPT = `You are an expert legal query analyzer. Your strict task is to classify and deconstruct user messages.

1. CLASSIFY: Determine if the message contains a legal inquiry/scenario or if it is general conversation (e.g., greetings, casual remarks, thanks). Set \`has_quesion\` to true or false.
2. PROCESS GENERAL (has_quesion: false): 
   - Pass the user's exact original text into the \`message\` field.
   - Set \`stand_alone_quesions_array\` to an empty array [].
3. PROCESS LEGAL (has_quesion: true): 
   - Pass the user's exact original text into the \`message\` field.
   - Break the inquiry down into a concise list of standalone sub-questions (\`stand_alone_quesions_array\`).

RULES FOR STANDALONE QUESTIONS:
- Break complex scenarios down into single, focused legal questions.
- Resolve all pronouns and implied context. Every question MUST make complete sense on its own.
- The language MUST be the exact same language that the user used.
- ANTI-LOOPING: Extract a MAXIMUM of 3 to 5 distinct, unique questions. 
- CRITICAL: DO NOT repeat questions. DO NOT answer the questions. Your only job is extraction.`

export const agent_stand_alone = createAgent({
  model: 'google-genai:gemini-2.5-flash',
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
const test = await analyzeUserMessage('hi there tell me about you')

// const test = await analyzeUserMessage(`
//  انا مؤجر بيت لي تمانية شهور والعقد مدته سنة وسيد البيت قال  ازيد الايجار او طلع بقدر يطردني قبل القعد ينتهى؟`)

console.log(test.has_quesion ? test.stand_alone_quesions_array : test.message)

// [ "هل يستطيع سيد البيت طرد المستأجر قبل انتهاء مدة عقد الإيجار المتفق عليها لسنة واحدة؟",
//   "هل يحق لسيد البيت طلب زيادة الإيجار من المستأجر خلال فترة سريان عقد الإيجار الذي مدته سنة؟"
// ]