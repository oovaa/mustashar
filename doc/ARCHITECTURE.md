# System Architecture

This document describes the internal design of Mustashar — how components are structured, how data flows through the system, and the responsibilities of each module.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Component Map](#component-map)
- [Data Flow: Incoming Message](#data-flow-incoming-message)
- [Module Descriptions](#module-descriptions)
  - [Entry Point — `src/index.ts`](#entry-point--srcindexts)
  - [Bot Service — `src/botService.ts`](#bot-service--srcbotservicets)
  - [Answer Pipeline — `src/answer.ts`](#answer-pipeline--srcanswerts)
  - [Message Classifier — `src/stand_alone.ts`](#message-classifier--srcstand_alonets)
  - [History Manager — `src/history.ts`](#history-manager--srchistoryts)
  - [Answer Prompts — `src/answerPrompts.ts`](#answer-prompts--srcanswerprompsts)
  - [RAG Subsystem — `src/rag/`](#rag-subsystem--srcrag)
  - [Database — `src/db.ts` + `src/schema.ts`](#database--srcdbbts--srcschemats)
  - [Logger — `src/logger.ts`](#logger--srcloggerts)
- [LLM Agents and Fallback Strategy](#llm-agents-and-fallback-strategy)
- [Database Schema](#database-schema)
- [Infrastructure](#infrastructure)

---

## High-Level Overview

```
┌──────────────────────────────────────────────────────┐
│                    Telegram User                      │
└────────────────────────┬─────────────────────────────┘
                         │ HTTPS webhook
                         ▼
┌──────────────────────────────────────────────────────┐
│               Express.js Server (port 3000)           │
│  POST /webhook  ──►  botService.ts                   │
│  POST /answer   ──►  answer.ts (direct)              │
│  GET  /check    ──►  DB health check                 │
│  GET  /summary/:chatId  ──►  history.ts              │
│  GET  /stats/*  ──►  Drizzle ORM queries             │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                  Answer Pipeline                      │
│  1. getHistory()   ──►  PostgreSQL                   │
│  2. analyzeUserMessage()  ──►  Gemini 2.5 Flash      │
│  3. retriver.invoke()     ──►  HNSWLib (RAG)         │
│  4. ragAnswerAgent / chatAgent  ──►  LLM             │
│  5. updateHistory()  ──►  Cohere + PostgreSQL        │
└──────────────────────────────────────────────────────┘
```

---

## Component Map

```
mustashar/
├── src/
│   ├── index.ts            # Express app + route definitions
│   ├── botService.ts       # Telegram webhook handler
│   ├── answer.ts           # Core answer pipeline orchestrator
│   ├── stand_alone.ts      # Query classifier & decomposer
│   ├── history.ts          # Rolling summary CRUD + summariser agent
│   ├── answerPrompts.ts    # System prompt strings for answer agents
│   ├── db.ts               # Drizzle + postgres-js connection
│   ├── schema.ts           # Drizzle table definitions
│   ├── logger.ts           # Winston logger configuration
│   └── rag/
│       ├── chunker.ts      # Document loader & text splitter
│       ├── embeddings.ts   # HuggingFace embedding config
│       ├── vdb.ts          # One-time index builder script
│       └── retriver.ts     # HNSWLib retriever (runtime)
├── vdb/                    # Generated vector database files
├── docs/                   # Source Arabic legal documents (gitignored)
├── doc/                    # Project documentation
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
└── package.json
```

---

## Data Flow: Incoming Message

```
Telegram sends POST /webhook
          │
          ▼
botService.ts
  • Extract chat_id + userText from req.body
  • If text === '/clear' → reset DB summary, send confirmation
  • Else → call answer(userText, chat_id, requestId)
          │
          ▼
answer.ts  [Step 1: Load history]
  • getHistory(chat_id) → SELECT summary FROM user_memories
          │
          ▼
answer.ts  [Step 2: Classify]
  • analyzeUserMessage(userInput, history)
    └─► stand_alone.ts
         • Gemini 2.5 Flash with structured output (Zod schema)
         • Returns: { has_question, message, stand_alone_questions_array }
          │
    ┌─────┴──────┐
    │            │
  false        true
(chat)       (legal Q)
    │            │
    │            ▼
    │       answer.ts  [Step 3: RAG retrieval]
    │         • For each standalone question:
    │           retriver.invoke(question)
    │             └─► HNSWLib ANN search (k=10)
    │         • Merge + de-duplicate chunks
    │            │
    ▼            ▼
answer.ts  [Step 4: Generate]
  • has_question=false → chatAgent (Qwen3.5-397B, ANSWER_SYSTEM_CHATTING_PROMPT)
  • has_question=true  → ragAnswerAgent (Llama-3.3-70b, RAG_ANSWER_SYSTEM_PROMPT)
  • Both use modelFallbackMiddleware for resilience
          │
          ▼
answer.ts  [Step 5: Update memory]
  • updateHistory(userInput, result, chat_id)
    └─► history.ts
         • Summariser agent (Cohere command-a-03-2025)
         • UPSERT summary into user_memories
          │
          ▼
botService.ts
  • POST https://api.telegram.org/bot.../sendMessage
  • Return { answer } in HTTP response
```

---

## Module Descriptions

### Entry Point — `src/index.ts`

Bootstraps Express, registers all routes, and starts the HTTP server on port 3000.

Routes:
| Method | Path | Handler |
|---|---|---|
| `POST` | `/webhook` | `botService` |
| `GET` | `/check` | inline DB ping |
| `GET` | `/summary/:chatId` | `getHistory` |
| `POST` | `/answer` | `answer` |
| `GET` | `/stats/users` | Drizzle count query |
| `GET` | `/stats/messages` | Drizzle sum query |
| `GET` | `/stats/messages/:chatId` | Drizzle per-chat query |

---

### Bot Service — `src/botService.ts`

Handles incoming Telegram Update objects from the `/webhook` endpoint.

Responsibilities:
- Validate presence of `chat_id` and `userText`.
- Handle the `/clear` command — resets the user's summary in the DB and sends an Arabic confirmation message via Telegram.
- Delegate all other messages to the `answer()` pipeline.
- Forward the final answer back to Telegram via `sendMessage`.
- Catch and log errors; return `500` if an unexpected error occurs.

---

### Answer Pipeline — `src/answer.ts`

The central orchestrator. Called by both `botService` (Telegram) and the `/answer` REST endpoint.

Steps (in order):
1. Load conversation summary via `getHistory()`.
2. Classify + decompose the message via `analyzeUserMessage()`.
3. **Conversational path**: invoke `chatAgent` with history-aware prompt.
4. **Legal path**: retrieve RAG chunks for each standalone question, merge context, invoke `ragAnswerAgent`.
5. Update rolling summary via `updateHistory()`.

Both agents are created with `createAgent()` + `modelFallbackMiddleware()` for automatic failover.

---

### Message Classifier — `src/stand_alone.ts`

Uses a structured-output LLM call (Gemini 2.5 Flash, validated with Zod) to:
- Decide if the message is conversational (`has_question: false`) or contains legal questions (`has_question: true`).
- Decompose complex legal queries into up to **5 standalone sub-questions** in the user's language.
- Convert colloquial Arabic phrasing to Modern Standard Arabic in the standalone questions.

Output schema (Zod):
```typescript
{
  has_question: boolean,
  message: string,           // original user text, verbatim
  stand_alone_questions_array: string[]
}
```

---

### History Manager — `src/history.ts`

Manages the rolling conversation summary stored in PostgreSQL.

- **`getHistory(chat_id)`** — fetches the current summary (returns `"No history found"` if none exists).
- **`updateHistory(message, response, chat_id)`** — generates a new summary by passing the old summary + latest exchange to the summariser agent (Cohere command-a-03-2025), then upserts it and increments the message counter.

The summariser agent is instructed to:
- Produce a **monolingual** summary matching the user's language.
- Preserve key legal facts (dates, names, article numbers, monetary amounts).
- Keep the summary concise while never losing critical context.

---

### Answer Prompts — `src/answerPrompts.ts`

Defines the two system prompts used by the answer agents:

| Constant | Used by | Purpose |
|---|---|---|
| `ANSWER_SYSTEM_CHATTING_PROMPT` | `chatAgent` | General conversation with Sudanese law awareness |
| `RAG_ANSWER_SYSTEM_PROMPT` | `ragAnswerAgent` | Strict RAG — must cite article numbers, only use retrieved context |

Both prompts are written in Arabic and enforce monolingual Arabic output.

---

### RAG Subsystem — `src/rag/`

See [`RAG.md`](../RAG.md) for the full RAG documentation.

| File | Role |
|---|---|
| `chunker.ts` | Load + split legal documents |
| `embeddings.ts` | `BAAI/bge-m3` via HuggingFace Inference |
| `vdb.ts` | One-time index builder |
| `retriver.ts` | Runtime retriever (k=10, loaded at startup) |

---

### Database — `src/db.ts` + `src/schema.ts`

- **`db.ts`**: Creates a `postgres-js` connection pool and wraps it with Drizzle ORM. Requires `DATABASE_URL` environment variable.
- **`schema.ts`**: Defines the `user_memories` table (see [Database Schema](#database-schema) below).

Migrations are managed by Drizzle Kit (`bun run db:push` / `bun run db:generate`).

---

### Logger — `src/logger.ts`

Configures a Winston logger with:
- **Console transport** — colourised output.
- **Daily rotating file** — `logs/application-YYYY-MM-DD.log`, compressed, 14-day retention, 20 MB max per file.
- **Error file** — `logs/error.log` (error-level only).
- **Exception / rejection handlers** — `logs/exceptions.log`, `logs/rejections.log`.

Log level defaults to `info` and can be overridden via the `LOG_LEVEL` environment variable.

---

## LLM Agents and Fallback Strategy

All agents are created with LangChain's `createAgent()` and protected by `modelFallbackMiddleware()`. If the primary model fails (rate-limit, outage, etc.) the next model in the chain is tried automatically.

| Agent | Primary Model | Fallbacks |
|---|---|---|
| **Chat answer** | `together:Qwen/Qwen3.5-397B-A17B` | `together:moonshotai/Kimi-K2.5` → `groq:llama-3.3-70b-versatile` → `together:zai-org/GLM-5` |
| **RAG answer** | `groq:llama-3.3-70b-versatile` | (shared fallback middleware above) |
| **Classifier** | `google-genai:gemini-2.5-flash` | `google-genai:gemma-3-27b-it` → `groq:llama-3.1-8b-instant` → `together:openai/gpt-oss-120b` |
| **Summariser** | `cohere:command-a-03-2025` | `together:MiniMaxAI/MiniMax-M2.5` → `groq:openai/gpt-oss-120b` → `cohere:command-r-plus-08-2024` |

---

## Database Schema

**Table: `user_memories`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `chat_id` | `TEXT` | PRIMARY KEY | Telegram chat ID (as string) |
| `summary` | `TEXT` | NOT NULL, default `'No history found'` | Rolling conversation summary |
| `count` | `INTEGER` | default `0` | Total messages from this user |
| `updated_at` | `TIMESTAMP` | NOT NULL, default `NOW()` | Last update time |

The table is upserted (INSERT … ON CONFLICT DO UPDATE) on every `updateHistory()` call.

---

## Infrastructure

### Docker Compose Services

| Service | Image | Purpose |
|---|---|---|
| `db` | `postgres:18` | PostgreSQL database |
| `app` | Built from `Dockerfile` | Node/Bun application |

Key details:
- The `db` service is **not** exposed to the host network — only the `bot-network` bridge can reach it.
- The `app` service waits for `db` to be healthy before starting, and runs `bun db:push` with retry logic to ensure the schema is applied.
- `./vdb` is bind-mounted into `/app/vdb` so the vector index persists across container rebuilds.

### Dockerfile

```
FROM oven/bun:latest
RUN apt-get update && apt-get install -y build-essential python3 make g++
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "start"]
```

`build-essential`, `python3`, `make`, and `g++` are required to compile the native `hnswlib-node` bindings.
