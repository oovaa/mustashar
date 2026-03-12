import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf'

export const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_API_KEY, // Defaults to process.env.HUGGINGFACEHUB_API_KEY
  model: 'Omartificial-Intelligence-Space/GATE-AraBert-v1', // Defaults to `BAAI/bge-base-en-v1.5` if not provided
  provider: 'hf-inference',
})
