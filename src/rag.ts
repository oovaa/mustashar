// =============================================================================
// RAG (Retrieval-Augmented Generation) MODULE
// =============================================================================
// This module handles all RAG operations:
// 1. Text embeddings using Transformers.js (local, no API calls)
// 2. Vector search in LanceDB
// 3. Answer generation using Groq LLM via getLLM()
// =============================================================================

import { connect } from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';
import { getLLM } from './llm';
import { HumanMessage } from 'langchain';

// Initialize the embedding model (runs locally, downloads model once on first run)
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model... (first time only)');
    embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    console.log('Model loaded!');
  }
  return embedder;
}

// =============================================================================
// L2 NORMALIZATION FUNCTION
// =============================================================================
// Normalizes a vector so its length = 1. This is important because:
// - The E5 embedding model expects normalized vectors
// - It makes distance comparisons more accurate
// Math: divide each number by the square root of sum of squares
// =============================================================================
function l2norm(vec: number[]): number[] {
  const n = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map(x => x / n);
}

// =============================================================================
// CONVERT TEXT TO EMBEDDING (VECTOR)
// =============================================================================
// Takes Arabic text and converts it to a 384-dimensional vector using the
// multilingual E5 model. This vector represents the meaning of the text.
// 
// IMPORTANT: We add "query: " prefix because E5 model requires it:
// - Documents use "passage: " prefix (done during indexing)
// - Queries use "query: " prefix (done here)
// This helps the model understand the difference between documents and questions.
// =============================================================================
async function embedQueryE5(text: string): Promise<number[]> {
  const input = `query: ${text}`;
  
  // Use local Transformers.js - no API needed!
  const model = await getEmbedder();
  const output = await model(input, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// =============================================================================
// SEARCH VECTOR DATABASE
// =============================================================================
// Searches the LanceDB vector database for chunks similar to the question.
// Returns the most relevant text chunks with their distance scores.
// =============================================================================
export async function searchDatabase(question: string, limit = 5) {
  const db = await connect('d:/vs/CFS2/arabic-legal-rag/vectordb');
  const table = await db.openTable('arabic_legal');
  const qvec = await embedQueryE5(question);
  const results = await table
    .search(qvec)
    .limit(limit)
    .select(['text', 'metadata', '_distance'])
    .toArray();

  // Return full objects so we can log distances and text
  return results as Array<{ text: string; metadata?: any; _distance: number }>;
}

// =============================================================================
// GENERATE ANSWER USING LLM
// =============================================================================
// Takes the question and relevant chunks, constructs a prompt, and uses
// the Groq LLM (via getLLM) to generate an answer based on Sudanese law.
// =============================================================================
export async function generateAnswer(
  question: string, 
  chunks: string[], 
  apiKey: string
): Promise<string> {
  const prompt = `

أنت مساعد قانوني متخصص في القوانين السودانية فقط.

قواعد صارمة يجب الالتزام بها:
- استخدم حصراً النصوص القانونية السودانية المقدمة لك في السياق.
- لا تعتمد على أي قانون أو نظام قانوني غير سوداني.
- لا تفترض أو تخمّن مواد قانونية غير موجودة في النص.
- إذا لم يتوفر في السياق نص قانوني واضح يجيب على السؤال، قل بوضوح: "لا توجد مادة قانونية صريحة في النص المتاح تجيب على هذا السؤال".
- عند ذكر حكم قانوني، حاول ذكر رقم المادة أو الفصل إن وجد.
- استخدم لغة عربية رسمية واضحة.
- لا تقدم نصيحة قانونية شخصية، بل شرحاً قانونياً للنص فقط.

مهمتك:
شرح النص القانوني السوداني المتعلق بالسؤال، كما ورد في السياق، بطريقة واضحة ومنظمة.

Context:
${chunks.join("\n\n")}

Question:
${question}

If the answer is not found, reply:
"لا أستطيع العثور على إجابة في النصوص القانونية المتاحة."
`;

  // Use getLLM for consistent API interaction
  const llm = getLLM(apiKey, "llama-3.3-70b-versatile", 0, 1024);
  const response = await llm.invoke([new HumanMessage(prompt)]);
  
  return response.content as string;
}
