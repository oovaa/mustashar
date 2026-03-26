import { ChatGroq } from '@langchain/groq'

// Creating the model from ChatGroq
export const getLLM = (
  apiKey?: string,
  // Primary: Qwen 3 (32B) - Excellent for Arabic & Legal reasoning
  model: string = 'qwen-3-32b', 
  temperature: number = 0,
  // Fallback: Llama 3.3 (70B) - Highly reliable versatile model
  fallbackModel: string | null = 'llama-3.3-70b-versatile',
) => {
  const primary = new ChatGroq({
    apiKey: apiKey || process.env.GROQ_API_KEY,
    model: model,
    temperature: temperature,
    maxRetries: 0, 
    callbacks: [
      {
        handleLLMError: (err: any) => {
          console.error(
            `Primary LLM Error on model ${model}:`,
            JSON.stringify(err, null, 2),
          )
        },
      },
    ],
  })

  if (!fallbackModel) return primary

  const fallback = new ChatGroq({
    apiKey: apiKey || process.env.GROQ_API_KEY,
    model: fallbackModel,
    temperature: temperature,
    maxRetries: 0,
    callbacks: [
      {
        handleLLMError: (err: any) => {
          console.error(
            `Fallback LLM Error on model ${fallbackModel}:`,
            JSON.stringify(err, null, 2),
          )
        },
      },
      {
        handleLLMStart: () => {
          console.log(`Starting Fallback LLM with model: ${fallbackModel}`)
        },
      },
    ],
  })

  return primary.withFallbacks({
    fallbacks: [fallback],
  })
}