import { ChatGroq } from "@langchain/groq";

// creating the model from chatgroq
export const getLLM = (apiKey: string) => {
  return new ChatGroq({
    apiKey: apiKey,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    maxRetries: 2,
  });
};

// invoking (asking)
// const ans = await llm.invoke('hi there tell me about RAG in AI')

// the answer is in .content
// console.log(ans.content)
