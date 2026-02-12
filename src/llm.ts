import { ChatGroq } from '@langchain/groq'

// creating the model from chatgroq
export const getLLM = (
  apiKey?: string,
  model: string = 'llama-3.3-70b-versatile',
  temperature: number = 0,
) => {
  return new ChatGroq({
    apiKey: apiKey || process.env.GROQ_API_KEYS,
    model: model,
    temperature: temperature,
    maxRetries: 2,
  })
}
