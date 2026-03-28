import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf'

export const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_API_KEY,
  model: "BAAI/bge-m3",
  provider: "hf-inference",
});
