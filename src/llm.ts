import { ChatGroq } from "@langchain/groq";

// creating the model from chatgroq
export const getLLM = (
  apiKey: string,
  model: string = "llama-3.3-70b-versatile",
  temperature:number = 0,
  maxTokens: number = 600,
) => {
  return new ChatGroq({
    apiKey: apiKey,
    model: model,
    temperature: temperature,
    maxRetries: 2,
    maxTokens,
  });
};
