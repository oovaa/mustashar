import "dotenv/config";
import { getLLM } from "../llm";
import { retriver } from "./retriver";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { rerank } from "./reranker";

const key = process.env.GROQ_API_KEY || "";
const llm = getLLM(key, "llama-3.3-70b-versatile", 0.4);

export async function answer(question: string, summary?: string) {
  const safeSummary = summary || "لا يوجد سجل سابق";

  /* ===============================
     STEP 1: Generate Standalone Query FIRST
     =============================== */

  const standalonePrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `أنت مساعد قانوني متخصص في استخراج كلمات البحث.
قم بتحويل سؤال المستخدم إلى جملة بحث قانونية مختصرة.
أرجع جملة البحث فقط بالعربية.
إذا لم يوجد سؤال قانوني واضح أرجع: NO_SEARCH`
    ],
    ["human", `السؤال: {question}`],
  ]);

  const standaloneChain = standalonePrompt.pipe(llm);

  const standaloneResult = await standaloneChain.invoke({
    question,
  });

  const standAloneQuery = String(standaloneResult.content).trim();

  console.log("Generated Search Query:", standAloneQuery);

  if (standAloneQuery === "NO_SEARCH") {
    return {
      content: "أهلاً بك، كيف يمكنني مساعدتك قانونياً اليوم؟"
    };
  }

  /* ===============================
     STEP 2: Retrieve ONCE using standalone query
     =============================== */

  const retrievedDocs = await retriver.invoke(standAloneQuery);

  console.log("Initial Retrieved:", retrievedDocs?.length ?? 0);

  /* ===============================
     STEP 3: Rerank Properly
     =============================== */

  const rerankedDocs = await rerank(
    standAloneQuery,
    retrievedDocs,
    process.env.RERANKER_MODEL,
    5
  );

  const finalDocs = rerankedDocs.length ? rerankedDocs : retrievedDocs;

  console.log("After Rerank:", finalDocs.length);

  const contextString = finalDocs
    .map((d: any) => d.pageContent)
    .join("\n\n");

  /* ===============================
     STEP 4: Generate Answer
     =============================== */

  const answerPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `أنت مستشار قانوني متخصص في القانون السوداني.

- أجب بالعربية الفصحى فقط.
- يمنع استخدام أي لغة غير العربية.
- ابدأ الرد بـ:
"هذا الرد للتوعية القانونية فقط ولا يغني عن استشارة محامي".

Context:
{context}`
    ],
    [
      "human",
      `سؤال المستخدم:
{question}`
    ],
  ]);

  const answerChain = answerPrompt.pipe(llm);

  const result = await answerChain.invoke({
    question,
    context: contextString,
  });

  console.log("FINAL ANSWER:\n", result.content);

  return result;
}