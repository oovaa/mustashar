import { createAgent, modelFallbackMiddleware } from 'langchain'
import { getHistory, updateHistory } from './history'
import { analyzeUserMessage } from './stand_alone'
import {
  ANSWER_SYSTEM_CHATTING_PROMPT,
  RAG_ANSWER_SYSTEM_PROMPT,
} from './answerPrompts'
import { retriver as retriever } from './rag/retriver'

const agent_answer_fallback = modelFallbackMiddleware(
  'together:Qwen/Qwen3.5-397B-A17B',
  'together:moonshotai/Kimi-K2.5',
  'together:zai-org/GLM-5',
)

/**
 * Main answer pipeline:
 * - analyzes user message into standalone questions
 * - optionally retrieves legal chunks for question flows
 * - answers with the correct prompt strategy
 * - updates/stores rolling chat summary
 */
const answer = async (userInput: string, chat_id: string) => {
  const analyzed = await analyzeUserMessage(userInput)

  const {
    has_quesion: has_question,
    stand_alone_quesions_array: standaloneQuestions,
  } = analyzed

  const history = await getHistory(chat_id)

  if (!has_question) {
    const agent_answer = createAgent({
      model: 'groq:llama-3.3-70b-versatile',
      middleware: [agent_answer_fallback],
      systemPrompt: ANSWER_SYSTEM_CHATTING_PROMPT,
    })

    const messagePayload = `
      SUMMARY:
      ${history}

      USER MESSAGE:
      ${userInput}
    `

    const response = await agent_answer.invoke({ messages: messagePayload })
    const result = String(response.messages.at(-1)?.content ?? '').trim()
    await updateHistory(userInput, result, chat_id)
    return result
  }

  /**
   * For legal questions, retrieve context per standalone question.
   * We keep a local store of retrieved chunks, then merge and de-duplicate by
   * page content before passing to the answer agent.
   */
  const retrievedChunks: Array<{ pageContent: string }> = []
  for (const standAloneQuestion of standaloneQuestions) {
    const chunks = await retriever.invoke(standAloneQuestion)
    for (const chunk of chunks || []) {
      if (chunk?.pageContent) {
        retrievedChunks.push({ pageContent: chunk.pageContent })
      }
    }
  }

  const uniqueContext = Array.from(
    new Set(retrievedChunks.map((chunk) => chunk.pageContent.trim())),
  )
    .filter(Boolean)
    .join('\n\n')

  console.log('uniqueContext: ', uniqueContext)

  const standAloneQuestions =
    standaloneQuestions.length > 0
      ? standaloneQuestions.map((question) => `- ${question}`).join('\n')
      : '- لا توجد أسئلة قانونية مستقلة.'

  const ragAnswerAgent = createAgent({
    model: 'groq:llama-3.3-70b-versatile',
    middleware: [agent_answer_fallback],
    systemPrompt: RAG_ANSWER_SYSTEM_PROMPT,
  })

  const ragPayload = `
ORIGINAL QUESTION:
${userInput}

STANDALONE QUESTIONS:
${standAloneQuestions}

CHAT SUMMARY:
${history}

RETRIEVED CONTEXT:
${uniqueContext || 'No legal context retrieved.'}
  `

  const ragResponse = await ragAnswerAgent.invoke({ messages: ragPayload })
  const ragResult = String(ragResponse.messages.at(-1)?.content ?? '').trim()
  await updateHistory(userInput, ragResult, chat_id)
  return ragResult
}

export { answer }



