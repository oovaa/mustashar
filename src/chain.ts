import "dotenv/config";
import { getLLM } from "../llm";
import { retriver } from "./retriver";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { rrfFuse } from "./rrf";

const key = process.env.GROQ_API_KEY || "";
const llm = getLLM(key, "llama-3.3-70b-versatile", 0.4);

export async function answer(question: string) {

  /* ===============================
     STEP 1: Generate SMART queries
     =============================== */

  const queryPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
أنت خبير قانوني.

حوّل السؤال إلى 1 إلى 4 أسئلة قانونية واضحة للبحث.

القواعد:
- كل سطر سؤال
- لا كلمات مفردة
- لا شرح
- استخدم المصطلحات القانونية الصحيحة (نشوز، نفقة، حضانة، طلاق)
- إذا بسيط → سؤال واحد
- إذا معقد → عدة أسئلة

مثال:
هل تعتبر الزوجة ناشزاً إذا غادرت منزل الزوجية؟
هل تسقط نفقة الزوجة في حالة النشوز؟
ما حكم نفقة الطفل بعد الانفصال؟

إذا ليس قانوني:
NO_SEARCH
`
    ],
    ["human", `السؤال: {question}`],
  ]);

  const queryChain = queryPrompt.pipe(llm);
  const queryResult = await queryChain.invoke({ question });

  let queries = String(queryResult.content)
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  if (queries[0] === "NO_SEARCH") {
    return { content: "أهلاً بك، كيف يمكنني مساعدتك قانونياً اليوم؟" };
  }

  queries = queries.slice(0, 4);

  console.log("Queries:", queries);

  /* ===============================
     STEP 2: Retrieval
     =============================== */

  const perList: any[][] = [];

  for (const q of queries) {
    try {
      const docs = (await retriver.invoke(q))?.slice(0, 10) || [];

      console.log(`Retrieved ${docs.length} docs for: ${q}`);
      perList.push(docs);

    } catch (e) {
      console.warn("Retrieval failed:", q);
    }
  }

  let finalDocs: any[] = [];

  if (perList.length) {
    finalDocs = rrfFuse(perList, 60);
  } else {
    finalDocs = (await retriver.invoke(question))?.slice(0, 15) || [];
  }

  /* ===============================
     STEP 3: Deduplicate + limit
     =============================== */

  const seen = new Set();

  finalDocs = finalDocs.filter((d: any) => {
    const key = d.pageContent;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  finalDocs = finalDocs.slice(0, 20);

  console.log("Final docs:", finalDocs.length);

  /* ===============================
     STEP 4: Build context
     =============================== */

  const contextString = finalDocs
    .map((d: any) => {
      const source = d.metadata?.source || "";
      return `المصدر: ${source}\n${d.pageContent}`;
    })
    .join("\n\n");

  /* ===============================
     STEP 5: Answer
     =============================== */

  const answerPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
أنت مساعد قانوني سوداني متخصص.

مهم جداً:

1. لا تستخدم أي مادة قانونية إلا إذا كانت مرتبطة مباشرة بسؤال المستخدم.
2. إذا كانت المادة القانونية غير مرتبطة، تجاهلها تماماً.
3. لا تشرح مواد لا تنطبق.
4. استخدم فقط المواد المناسبة.
5. إذا لم توجد مواد كافية:
   قل:
   "لا توجد مادة قانونية مرتبطة بشكل كافٍ بالسؤال في النصوص المتاحة."

طريقة الإجابة:

القاعدة القانونية:
...

التطبيق:
...

النتيجة:
...

المواد:
...

----------------------

المواد القانونية:
{context}

----------------------

سؤال المستخدم:
{question}
`
    ],
  ]);

  const answerChain = answerPrompt.pipe(llm);

  const result = await answerChain.invoke({
    context: contextString,
    question,
  });

  console.log("FINAL ANSWER:\n", result.content);

  return result;
}
