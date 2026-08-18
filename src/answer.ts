import { createAgent, modelFallbackMiddleware } from 'langchain'
import { getHistory } from './history'
import { analyzeUserMessage } from './stand_alone'
import {
  ANSWER_SYSTEM_CHATTING_PROMPT,
  RAG_ANSWER_SYSTEM_PROMPT,
} from './answerPrompts'
import { getRetriever } from './rag/retriver'
import { logger } from './logger'
import { Document } from '@langchain/core/documents'
import { truncateToTokenLimit } from './utils/tokenCounter'

const agent_answer_fallback = modelFallbackMiddleware(
  'cerebras:qwen-3-235b-a22b-instruct-2507',
  'groq:llama-3.3-70b-versatile',
  'cohere:command-r-plus-08-2024',
)

const agent_answer = createAgent({
  model: 'cerebras:qwen-3-235b-a22b-instruct-2507',
  middleware: [agent_answer_fallback],
  systemPrompt: ANSWER_SYSTEM_CHATTING_PROMPT,
})

const ragAnswerAgent = createAgent({
  model: 'groq:llama-3.3-70b-versatile',
  middleware: [agent_answer_fallback],
  systemPrompt: RAG_ANSWER_SYSTEM_PROMPT,
})

/**
 * Main answer pipeline:
 * - analyzes user message into standalone questions
 * - optionally retrieves legal chunks for question flows
 * - answers with the correct prompt strategy
 * - updates/stores rolling chat summary
 */
const answer = async (
  userInput: string,
  chat_id: string,
  requestId?: string,
) => {
  const logPrefix = requestId ? `[${requestId}] ` : ''
  logger.info(`${logPrefix}Starting answer pipeline for chat_id: ${chat_id}`)

  const history = await getHistory(chat_id)

  const analyzed = await analyzeUserMessage(userInput, history)

  const { has_question, stand_alone_questions_array: standaloneQuestions } =
    analyzed

  logger.debug(
    `${logPrefix}Analysis result: has_question=${has_question}, questions=${standaloneQuestions.length}`,
  )

  if (!has_question) {
    logger.info(`${logPrefix}Route: General Conversation`)

    const messagePayload = `
      SUMMARY:
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
  const retriever = await getRetriever()
  let resultsArray: Document[][] = []
  if (!retriever) {
    logger.warn(`${logPrefix}RAG retriever not available, skipping retrieval`)
    resultsArray = standaloneQuestions.map(() => []);
  } else {
    const searchPromises = standaloneQuestions.map((q) => retriever.invoke(q));
    resultsArray = await Promise.all(searchPromises);
  }

  const retrievedChunks: Array<{ pageContent: string }> = [];
  resultsArray.forEach((chunks) => {
    for (const chunk of chunks || []) {
      if (chunk?.pageContent) {
        retrievedChunks.push({ pageContent: chunk.pageContent });
      }
    }
  })

  const uniqueContext = Array.from(
    new Set(retrievedChunks.map((chunk) => chunk.pageContent.trim())),
  )
    .filter(Boolean)
    .join('\n\n')

  logger.debug(`uniqueContext: ${uniqueContext}`)

  const MAX_CONTEXT_TOKENS = 6000 // Leave room for prompt and response
  const truncatedContext = truncateToTokenLimit(uniqueContext, MAX_CONTEXT_TOKENS, true)

  const standAloneQuestions =
    standaloneQuestions.length > 0
      ? standaloneQuestions.map((question) => `- ${question}`).join('\n')
      : '- لا توجد أسئلة قانونية مستقلة.'

  const ragPayload = `
ORIGINAL QUESTION:
${userInput}

STANDALONE QUESTIONS:
${standAloneQuestions}

CHAT SUMMARY:
${history}

RETRIEVED CONTEXT:
${truncatedContext || 'No legal context retrieved.'}
  `

  logger.debug(
    `${logPrefix}Invoking ragAnswerAgent. Input Payload:\n${ragPayload}`,
  )
  const ragResponse = await ragAnswerAgent.invoke({ messages: ragPayload })
  const ragResult = String(ragResponse.messages.at(-1)?.content ?? '').trim()
  logger.debug(`${logPrefix}ragResult output:\n${ragResult}`)

  return ragResult
}

export { answer }
