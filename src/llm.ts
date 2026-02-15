import { ChatGroq } from '@langchain/groq'

// creating the model from chatgroq
export const getLLM = (
  apiKey?: string,
  model: string = 'llama-3.3-70b-versatile',
  temperature: number = 0,
  fallbackModel: string | null = null,
) => {
  const primary = new ChatGroq({
    apiKey: apiKey || process.env.GROQ_API_KEY,
    model: model,
    temperature: temperature,
    maxRetries: 0, // Disable internal retries to fail fast and trigger fallback
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
