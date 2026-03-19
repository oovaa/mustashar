import { createAgent, modelFallbackMiddleware } from 'langchain'
import { getHistory, updateHistory } from './history'
import { analyzeUserMessage } from './stand_alone'
import { ANSWER_SYSTEM_CHATTING_PROMPT } from './answerPrompts'

const agent_answer_fallback = modelFallbackMiddleware(
  'together:moonshotai/Kimi-K2.5',
  'together:zai-org/GLM-5',
  'together:Qwen/Qwen3.5-397B-A17B',
)

const answer = async (userInput: string, chat_id: string) => {
  const analyzed = await analyzeUserMessage(userInput)

  const { has_quesion } = analyzed

  const history = await getHistory(chat_id)

  if (!has_quesion) {
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
    const result = response.messages.at(1)?.content as string
    updateHistory(userInput, result, '123')
    return result
  }

  console.log('has a q')
  return
}

console.log(await answer('hi there tell me about you', '123'))
