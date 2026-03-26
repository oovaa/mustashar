import "dotenv/config";
import { getLLM } from "../llm";
import { retriver } from "./retriver";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { rerank } from "./reranker";
import { rrfFuse } from "./rrf";

const key = process.env.GROQ_API_KEY || "";
const llm = getLLM(key, "llama-3.3-70b-versatile", 0.4);

// 🔥 NEW: trim long chunks to avoid token overflow
function trimText(text: string, maxChars = 800) {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

export async function answer(question: string, summary?: string) {
  const safeSummary = summary || "لا يوجد سجل سابق";

  /* ===============================
     STEP 1: Generate Standalone Query
     =============================== */

  const standalonePrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `أنت أداة استخراج مواضيع قانونية للبحث في النصوص.

المطلوب:
تحليل سؤال المستخدم واستخراج من 2 إلى 6 مواضيع قانونية أساسية

القواعد:
- كل سطر موضوع قانوني قصير
- لا تكتب شرح
- استخدم كلمات قانونية فقط

إذا لم يكن السؤال قانونياً أرجع:
NO_SEARCH
`
    ],
    ["human", `السؤال: {question}`],
  ]);

  const standaloneChain = standalonePrompt.pipe(llm);

  const standaloneResult = await standaloneChain.invoke({ question });

  const standAloneQuery = String(standaloneResult.content).trim();

  console.log("Generated Search Query:", standAloneQuery);

  if (standAloneQuery === "NO_SEARCH") {
    return {
      content: "أهلاً بك، كيف يمكنني مساعدتك قانونياً اليوم؟"
    };
  }

  /* ===============================
     STEP 2: Topics + Retrieval + RRF
     =============================== */

  const topicsRaw = standAloneQuery;

  let topics = topicsRaw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  // 🔥 LIMIT topics (VERY IMPORTANT)
  topics = topics.slice(0, 3);

  console.log("Extracted topics for retrieval:", topics);

  const perList: any[][] = [];

  for (const t of topics) {
    try {
      // 🔥 LIMIT docs per topic
      const docs = (await retriver.invoke(t))?.slice(0, 1) || [];

      console.log(`Retrieved ${docs.length} docs for topic: ${t}`);
      perList.push(docs);
    } catch (e) {
      console.warn("Retrieval failed for topic:", t, e);
    }
  }

  let finalDocs: any[] = [];

  if (perList.length) {
    // 🔥 LIMIT after RRF
    finalDocs = rrfFuse(perList, 60).slice(0, 3);
    console.log("After RRF fused docs:", finalDocs.length);
  } else {
    finalDocs = (await retriver.invoke(standAloneQuery))?.slice(0, 3) || [];
    console.log("Fallback retrieved:", finalDocs.length);
  }

  /* ===============================
     STEP 3: Optional rerank
     =============================== */

  if (finalDocs.length && process.env.RERANKER_MODEL) {
    try {
      finalDocs = await rerank(
        standAloneQuery,
        finalDocs,
        process.env.RERANKER_MODEL,
        3 // 🔥 keep small
      );
      console.log("After rerank:", finalDocs.length);
    } catch (e) {
      console.warn("Rerank failed:", e);
    }
  } else {
    console.log("Rerank skipped");
  }

  /* ===============================
     DEBUG LOGGING
     =============================== */

  if (finalDocs.length > 0) {
    const topDoc = finalDocs[0];

    const cleanedTopMeta = { ...(topDoc.metadata ?? {}) };

    ["kitabName", "baabName", "faslName", "faraaName"].forEach(k => {
      if (!cleanedTopMeta[k]) delete cleanedTopMeta[k];
    });

    console.log("Top retrieved doc metadata:", cleanedTopMeta);

    console.log(
      "Top retrieved doc excerpt:\n",
      String(topDoc.pageContent).slice(0, 500)
    );

    console.log(
      "All sources:",
      finalDocs.map((d: any, i: number) => ({
        index: i,
        source: d.metadata?.source || null
      }))
    );
  }

  /* ===============================
     STEP 4: Build SAFE Context
     =============================== */

  const contextString = finalDocs
    .map((d: any) => {
      const md = { ...(d.metadata ?? {}) };

      const ruleLabel = md.rule ? `المادة رقم ${md.rule}` : "";
      const sourceLabel = md.source ? `المصدر: ${md.source}` : "";

      // 🔥 CRITICAL: trim text
      const text = trimText(d.pageContent);

      return `${ruleLabel} ${sourceLabel}\n${text}`.trim();
    })
    .join("\n\n");

  /* ===============================
     STEP 5: Answer Generation
     =============================== */

  const answerPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `أنت مساعد قانوني سوداني.

أجب فقط من النصوص المعطاة.

التنسيق:

القاعدة القانونية:
...

التطبيق:
...

النتيجة:
...

المواد:
...`
    ],
    [
      "human",
      `المواد:
${contextString}

السؤال:
${question}`
    ],
  ]);

  const answerChain = answerPrompt.pipe(llm);

  const result = await answerChain.invoke({
    question,
  });

  console.log("FINAL ANSWER:\n", result.content);

  return result;
}