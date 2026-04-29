import { createAgent, modelFallbackMiddleware } from 'langchain'
import { getHistory, updateHistory } from './history'
import { analyzeUserMessage } from './stand_alone'
import {
  ANSWER_SYSTEM_CHATTING_PROMPT,
  RAG_ANSWER_SYSTEM_PROMPT,
} from './answerPrompts'
import { retriver as retriever } from './rag/retriver'
import { logger } from './logger'

/** Fallback model chain for the answer agent. */
const agent_answer_fallback = modelFallbackMiddleware(
  'cerebras:qwen-3-235b-a22b-instruct-2507',
  'groq:llama-3.3-70b-versatile',
  'together:zai-org/GLM-5.1',
)

/**
 * Main answer pipeline.
 *
 * Flow:
 *  1. Fetch the current chat history (rolling summary + last interaction).
 *  2. Analyse the user message to detect whether it contains a legal question.
 *  3a. General conversation → answer directly with the conversation agent.
 *  3b. Legal question → retrieve relevant legal chunks via RAG, then answer.
 *  4. Persist the new interaction to history and return the final response.
 *
 * @param userInput - The raw user message text.
 * @param chat_id   - Unique identifier for the chat session.
 * @param requestId - Optional trace ID used for log correlation.
 * @returns The AI-generated response string.
 */
const answer = async (
  userInput: string,
  chat_id: string,
  requestId?: string,
) => {
  const logPrefix = requestId ? `[${requestId}] ` : ''
  logger.info(`${logPrefix}Starting answer pipeline for chat_id: ${chat_id}`)

  // Retrieve the combined history context (summary + last interaction).
  const history = await getHistory(chat_id)

  const analyzed = await analyzeUserMessage(userInput, history)

  const { has_question, stand_alone_questions_array: standaloneQuestions } =
    analyzed

  logger.debug(
    `${logPrefix}Analysis result: has_question=${has_question}, questions=${standaloneQuestions.length}`,
  )

  if (!has_question) {
    logger.info(`${logPrefix}Route: General Conversation`)
    const agent_answer = createAgent({
      model: 'together:Qwen/Qwen3.5-397B-A17B',
      middleware: [agent_answer_fallback],
      systemPrompt: ANSWER_SYSTEM_CHATTING_PROMPT,
    })

    // Provide the full history context followed by the new user message.
    const messagePayload = `
      CHAT HISTORY:
      ${history}

      USER MESSAGE:
      ${userInput}
    `

    logger.debug(
      `${logPrefix}Invoking agent_answer. Input Payload:\n${messagePayload}`,
    )
    const response = await agent_answer.invoke({ messages: messagePayload })
    const result = String(response.messages.at(-1)?.content ?? '').trim()
    logger.debug(`${logPrefix}agent_answer output:\n${result}`)

    logger.debug(`${logPrefix}Generated general response. Updating history...`)
    await updateHistory(userInput, result, chat_id)
    return result
  }

  /**
   * For legal questions, retrieve context per standalone question.
   * We keep a local store of retrieved chunks, then merge and de-duplicate by
   * page content before passing to the answer agent.
   */
  logger.info(
    `${logPrefix}Route: Legal Question RAG. Processing ${standaloneQuestions.length} questions.`,
  )

  // Fire all retrieval calls in parallel for efficiency.
  const searchPromises = standaloneQuestions.map((q) => retriever.invoke(q));
  const resultsArray = await Promise.all(searchPromises);

  // Flatten results and collect chunks that have content.
  const retrievedChunks: Array<{ pageContent: string }> = [];
  resultsArray.forEach((chunks) => {
    for (const chunk of chunks || []) {
      if (chunk?.pageContent) {
        retrievedChunks.push({ pageContent: chunk.pageContent });
      }
    }
  })

  // De-duplicate chunks by their trimmed text so the prompt isn't bloated.
  const uniqueContext = Array.from(
    new Set(retrievedChunks.map((chunk) => chunk.pageContent.trim())),
  )
    .filter(Boolean)
    .join('\n\n')

  logger.debug(`uniqueContext: ${uniqueContext}`)

  const standAloneQuestions =
    standaloneQuestions.length > 0
      ? standaloneQuestions.map((question) => `- ${question}`).join('\n')
      : '- لا توجد أسئلة قانونية مستقلة.'

  const ragAnswerAgent = createAgent({
    model: 'groq:llama-3.3-70b-versatile',
    middleware: [agent_answer_fallback],
    systemPrompt: RAG_ANSWER_SYSTEM_PROMPT,
  })

  // Build the RAG prompt: original question, standalone sub-questions,
  // full history context, and retrieved legal chunks.
  const ragPayload = `
ORIGINAL QUESTION:
${userInput}

STANDALONE QUESTIONS:
${standAloneQuestions}

CHAT HISTORY:
${history}

RETRIEVED CONTEXT:
${uniqueContext || 'No legal context retrieved.'}
  `

  logger.debug(
    `${logPrefix}Invoking ragAnswerAgent. Input Payload:\n${ragPayload}`,
  )
  const ragResponse = await ragAnswerAgent.invoke({ messages: ragPayload })
  const ragResult = String(ragResponse.messages.at(-1)?.content ?? '').trim()
  logger.debug(`${logPrefix}ragResult output:\n${ragResult}`)

  logger.info(`${logPrefix}RAG Answer generated. Updating history...`)
  await updateHistory(userInput, ragResult, chat_id)

  return ragResult
}

export { answer }
