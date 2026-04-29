import { createAgent, modelFallbackMiddleware } from 'langchain'
import { z } from 'zod'
import { logger } from './logger'

// ==========================================
// STANDALONE QUESTION ANALYZER AGENT
// Classifies a user message and, for legal inputs, breaks it down into
// focused standalone sub-questions that can be used for RAG retrieval.
// ==========================================

/** Fallback model chain for the standalone question analyzer. */
const agent_stand_alone_fallback = modelFallbackMiddleware(
  'mistral:mistral-large-latest',
  'together:openai/gpt-oss-120b',
  'google-genai:gemma-3-27b-it',
)

/**
 * Zod schema that describes the structured JSON response expected from the
 * standalone question analyzer agent.
 */
const responseSchema = z.object({
  has_question: z
    .boolean()
    .describe(
      'True if the user input contains a legal scenario/question. False if it is general conversation.',
    ),
  message: z
    .string()
    .describe(
      "Always pass the user's exact original message here, regardless of has_question.",
    ),
  stand_alone_questions_array: z
    .array(z.string())
    .describe(
      'If has_question is true, an array of questions. If false, must be an empty array [].',
    ),
})

/**
 * System prompt that instructs the agent to classify messages and extract
 * concise, context-independent legal sub-questions.
 */
const SYSTEM_PROMPT = `You are an expert legal query analyzer. Your strict task is to classify and deconstruct user messages.

1. CLASSIFY: Determine if the message contains a legal inquiry/scenario or if it is strictly general conversation. 
   - CRITICAL RULE: Users often start with greetings (e.g., "السلام عليكم"). You MUST read the ENTIRE message. If there is a legal story, scenario, or question ANYWHERE in the text after the greeting, you MUST set \`has_question\` to true.
   - Set \`has_question\` to false ONLY if the ENTIRE message is just a greeting or thank you.

2. PROCESS GENERAL (has_question: false): 
   - Pass the user's exact original text into the \`message\` field.
   - Set \`stand_alone_questions_array\` to an empty array [].

3. PROCESS LEGAL (has_question: true): 
   - Pass the user's exact original text into the \`message\` field.
   - Break the legal scenario down into a concise list of standalone legal sub-questions (\`stand_alone_questions_array\`).

RULES FOR STANDALONE QUESTIONS:
- If the user explains a scenario but doesn't explicitly ask a question with a question mark, formulate the implied legal questions based on their situation.
- Break complex scenarios down into single, focused legal questions.
- Resolve all pronouns (e.g., "my husband", "he") and implied context using the provided CHAT HISTORY so each question makes complete sense on its own.
- The language MUST be the exact same language that the user used.
- Convert colloquial Arabic to Modern Standard Arabic (الفصحى).
- ANTI-LOOPING: Extract a MAXIMUM of 3 to 5 distinct, unique questions. 
- CRITICAL: DO NOT repeat questions. DO NOT answer the questions. Your only job is extraction.
`

/** Pre-configured standalone-question analyzer agent with structured JSON output. */
export const agent_stand_alone = createAgent({
  model: 'google-genai:gemini-2.5-flash',
  middleware: [agent_stand_alone_fallback],
  responseFormat: responseSchema,
  systemPrompt: SYSTEM_PROMPT,
})

/**
 * Analyzes a user message to classify it and extract standalone legal questions.
 *
 * The full chat history context is included in the prompt so the agent can
 * resolve pronouns and implicit references against prior conversation turns.
 *
 * @param userInput - The raw user message text.
 * @param history   - Current chat history context (summary + last interaction).
 *                    Defaults to an empty string when no history exists yet.
 * @returns The agent's structured response containing `has_question`,
 *          the original `message`, and `stand_alone_questions_array`.
 * @throws Re-throws any agent error after logging it.
 */
export async function analyzeUserMessage(
  userInput: string,
  history: string = '',
) {
  try {
    const inputPayload = `
      CHAT HISTORY:
      ${history}

      CURRENT USER MESSAGE:
      ${userInput}
    `
    const response = await agent_stand_alone.invoke({ messages: inputPayload })
    return response.structuredResponse
  } catch (error) {
    logger.error(`Failed to process message: ${error}`)
    throw error
  }
}
