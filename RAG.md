# RAG System Documentation

## Overview

The Retrieval-Augmented Generation (RAG) system in Mustashar provides semantic search over Arabic legal documents. Before every legal answer is generated, the system retrieves the most relevant text chunks from the legal corpus and injects them as grounded context into the LLM prompt.

The RAG pipeline is **fully integrated** into the answer flow (`src/answer.ts`) and runs automatically for every message that contains a legal question.

---

## Architecture

```
User legal question
        │
        ▼
┌───────────────────┐
│  Stand-alone Q    │  src/stand_alone.ts
│  decomposition    │  (1–5 focused sub-questions)
└────────┬──────────┘
         │  (per question)
         ▼
┌───────────────────┐
│  Embed query      │  src/rag/embeddings.ts
│  BAAI/bge-m3      │  (HuggingFace Inference API)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  HNSWLib search   │  src/rag/retriver.ts
│  top-10 chunks    │  (loaded from ./vdb/)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  De-duplicate &   │  src/answer.ts
│  merge context    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  RAG answer agent │  Groq llama-3.3-70b (+ fallbacks)
│  (strict prompt)  │
└───────────────────┘
```

---

## Components

### 1. Document Processing — `src/rag/chunker.ts`

Loads legal documents from the `./docs/` directory and splits them into chunks suitable for embedding.

**Supported formats:** PDF (`.pdf`), plain text (`.txt`), Markdown (`.md`)

**Chunking parameters:**
- Chunk size: **1 500 characters**
- Overlap: **200 characters**
- Splitter: `RecursiveCharacterTextSplitter` from `@langchain/textsplitters`

**Metadata preserved per chunk:**
- `source` — file path
- `page` — PDF page number (PDFs only)

**Usage:**
```typescript
import { loadDocsFromFolder } from './src/rag/chunker'

const documents = await loadDocsFromFolder('./docs')
// Returns Document[] ready for embedding
```

---

### 2. Embeddings — `src/rag/embeddings.ts`

Converts text chunks (and query strings) into dense vector representations.

| Property | Value |
|---|---|
| Provider | HuggingFace Inference API |
| Model | `BAAI/bge-m3` |
| Environment variable | `HF_API_KEY` |
| Multilingual | Yes — optimised for Arabic and 100+ languages |

**Usage:**
```typescript
import { embeddings } from './src/rag/embeddings'

// Single query
const vector = await embeddings.embedQuery('ما هو قانون الإيجار في السودان؟')

// Batch documents
const vectors = await embeddings.embedDocuments(['نص أول', 'نص ثانٍ'])
```

---

### 3. Vector Database Builder — `src/rag/vdb.ts`

One-time script that builds the HNSWLib vector index from the legal document corpus.

**Process:**
1. Initialise an empty `HNSWLib` store.
2. Load and chunk documents via `loadDocsFromFolder()`.
3. Embed all chunks and add them to the store.
4. Persist the index to `./vdb/`.

**Run:**
```bash
bun run src/rag/vdb.ts
```

**Output files:**

| File | Contents |
|---|---|
| `vdb/hnswlib.index` | Binary HNSW graph index |
| `vdb/docstore.json` | Document text and metadata |
| `vdb/args.json` | Index configuration (dimensions, space) |

> **Re-indexing:** Re-run this script any time new documents are added to `./docs/`.

---

### 4. Retriever — `src/rag/retriver.ts`

Loads the pre-built HNSWLib index at startup and exposes a LangChain retriever interface.

| Property | Value |
|---|---|
| Index path | `./vdb/` |
| Results returned (`k`) | **10** most similar chunks |
| Search type | Approximate nearest neighbour (HNSW) |

**Usage:**
```typescript
import { retriver } from './src/rag/retriver'

const chunks = await retriver.invoke('ما هي أحكام الطلاق في القانون السوداني؟')
// Returns Document[] — each has .pageContent and .metadata
```

---

## Setup

### 1. Prepare Documents

Place Arabic legal documents (`.pdf`, `.txt`, or `.md`) in the `./docs/` directory. The documents used in production are:

- `قانون_الاجراءات_المدنية_1983_معدلا_حتي_2019.txt`
- `قانون_الاحوال_الشخصية_للمسلمين1991.txt`
- `قانون المعاملات المدينة ١٩٨٤.txt`

### 2. Set Environment Variables

```env
HF_API_KEY=your_huggingface_api_key
```

### 3. Build the Index

```bash
bun run src/rag/vdb.ts
```

### 4. Verify

```bash
ls -la vdb/
# Should show: hnswlib.index  docstore.json  args.json
```

### 5. Test Retrieval

```bash
bun -e "
import { retriver } from './src/rag/retriver';
const docs = await retriver.invoke('حقوق المستأجر');
console.log(docs.length, 'chunks retrieved');
console.log(docs[0].pageContent.slice(0, 200));
"
```

---

## Integration Details

The retriever is called inside `src/answer.ts` for every message classified as a legal question:

```typescript
// src/answer.ts (simplified)
for (const question of standaloneQuestions) {
  const chunks = await retriever.invoke(question)
  retrievedChunks.push(...chunks)
}

// De-duplicate by page content
const uniqueContext = Array.from(
  new Set(retrievedChunks.map(c => c.pageContent.trim()))
).join('\n\n')

// Pass context to RAG answer agent via RAG_ANSWER_SYSTEM_PROMPT
```

The RAG answer agent is instructed (via `RAG_ANSWER_SYSTEM_PROMPT` in `src/answerPrompts.ts`) to:
- Answer **only** from the retrieved context.
- Cite specific article numbers and law names.
- State clearly when no relevant article is found.

---

## File Structure

```
src/rag/
├── chunker.ts      # Document loading and chunking
├── embeddings.ts   # HuggingFace embedding configuration
├── vdb.ts          # One-time index builder script
└── retriver.ts     # Runtime semantic search retriever

vdb/                # Generated vector database (bind-mounted in Docker)
├── hnswlib.index
├── docstore.json
└── args.json

docs/               # Source legal documents (gitignored)
```

---

## Performance Notes

- The HNSWLib index is **loaded into memory** on startup — queries are fast (milliseconds).
- Chunk size of 1 500 characters balances coherence for long Arabic legal articles against embedding cost.
- `k=10` retrieval per question, with de-duplication across multiple questions, provides broad coverage while keeping the context window manageable.
- The `BAAI/bge-m3` model is multilingual and handles Arabic well without requiring a language-specific model.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Error: cannot find module 'hnswlib-node'` | `bun install` or `npm rebuild hnswlib-node` |
| `vdb/` files missing | Run `bun run src/rag/vdb.ts` |
| Empty search results | Verify `docs/` contains files and the index was built after adding them |
| HuggingFace 401 errors | Check `HF_API_KEY` in `.env` |
| Out-of-memory during indexing | Reduce `chunkSize` in `chunker.ts` or process documents in batches |

---

## Dependencies

| Package | Role |
|---|---|
| `@langchain/community` | `HNSWLib` vector store + `HuggingFaceInferenceEmbeddings` |
| `@langchain/textsplitters` | `RecursiveCharacterTextSplitter` |
| `@langchain/core` | `Document` interface |
| `@langchain/classic` | `TextLoader` for `.txt` / `.md` files |
| `hnswlib-node` | Native HNSW bindings (requires C++ build tools) |</content>
<parameter name="filePath">/home/omar/mustashar/RAG.md