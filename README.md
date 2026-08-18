# Mustashar (مستشار)

**Mustashar** is an AI-powered Telegram bot and REST API that provides legal guidance on Sudanese law. It combines Retrieval-Augmented Generation (RAG) over Arabic legal documents with a rolling-summary memory system so every conversation is context-aware.

---

## Table of Contents

- [Features](#features)
- [Answer Pipeline](#answer-pipeline)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Vector Database Setup](#vector-database-setup)
- [API Reference](#api-reference)
- [Commands](#commands)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## Features

| Feature | Description |
|---|---|
| **Telegram Bot** | Interactive chatbot for legal questions with per-user conversation memory |
| **REST API** | Express.js endpoints for the webhook and direct question answering |
| **RAG System** | Semantic search over Arabic legal documents using HNSWLib + HuggingFace embeddings |
| **Multi-LLM fallback** | Primary models with automatic fallback chains (Cerebras → Groq → Cohere) |
| **Rolling Memory** | Conversation summaries stored in PostgreSQL; updated after the bot reply is sent |
| **Arabic-first** | Fully optimised for Arabic legal text — MSA output enforced by system prompts |
| **Docker** | One-command deployment via Docker Compose with a managed PostgreSQL container |

---

## Answer Pipeline

The full answer flow lives in `src/answer.ts` and is called by `src/botService.ts` for every user message.

```
User message
     │
     ▼
┌─────────────────────────────┐
│  1. Load rolling summary    │  (src/history.ts → PostgreSQL)
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  2. Classify & decompose    │  (src/stand_alone.ts → Gemini 2.5 Flash)
│     • conversational?       │
│     • 3-5 standalone Qs?    │
└────────────┬────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
Conversational   Legal Question(s)
     │               │
     │               ▼
     │     ┌────────────────────┐
     │     │ 3. RAG retrieval   │  (src/rag/retriver.ts → HNSWLib)
     │     │   per question,    │
     │     │   de-duplicate,    │
     │     │   truncate context │  (src/utils/tokenCounter.ts)
     │     └─────────┬──────────┘
     │               │
     ▼               ▼
┌──────────────────────────────┐
│  4. Generate answer          │  (src/answer.ts → LLM agents)
│     • chat: agent_answer     │  (Cerebras → Groq → Cohere)
│     • legal: ragAnswerAgent  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  5. Send Telegram reply      │  (src/botService.ts → Telegram API)
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  6. Update rolling summary   │  (src/history.ts → Cohere summarizer)
└──────────────────────────────┘
```

---

## Architecture Overview

| Layer | Technology |
|---|---|
| **Bot interface** | Telegram Bot API (long polling) |
| **Web framework** | Express.js 5 + TypeScript (Bun runtime) |
| **Answer agents** | LangChain `createAgent` + `modelFallbackMiddleware` |
| **Primary LLMs** | Cerebras (Qwen 3-235B), Groq (Llama-3.3-70b), Cohere (command-a-03-2025), Gemini 2.5 Flash |
| **Embeddings** | HuggingFace Inference API — `BAAI/bge-m3` |
| **Vector store** | HNSWLib (file-based, lazy-loaded into memory) |
| **Database** | PostgreSQL via Drizzle ORM |
| **Logging** | Winston + daily-rotate-file |
| **Containerisation** | Docker & Docker Compose |

For a deeper dive see [`doc/ARCHITECTURE.md`](doc/ARCHITECTURE.md).

Every agent runs with an automatic fallback chain — if the primary provider fails, the next one in the list is tried:

| Agent (file) | Primary model | Fallback chain |
|---|---|---|
| `agent_stand_alone` (`src/stand_alone.ts`) | Google Gemini 2.5 Flash | Mistral Large → Groq Llama-3.3-70b → Google Gemma-4-31b |
| `agent_answer` (`src/answer.ts`) | Cerebras Qwen 3-235B | Groq Llama-3.3-70b → Cohere command-r-plus |
| `ragAnswerAgent` (`src/answer.ts`) | Groq Llama-3.3-70b | Cerebras Qwen 3-235B → Cohere command-r-plus |
| `agent_summrize` (`src/history.ts`) | Cohere command-a-03-2025 | Cerebras Qwen 3-235B → Groq GPT-OSS-120b → Cohere command-r-plus |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0 (or Node.js ≥ 18)
- Docker & Docker Compose
- API keys — see [Environment Variables](#environment-variables)

### Installation

```bash
bun install
```

### Environment Variables

Create a `.env` file at the project root:

```env
# Telegram (required)
BOT_TOKEN=your_telegram_bot_token

# LLM providers
CEREBRAS_API_KEY=your_cerebras_api_key
GROQ_API_KEY=your_groq_api_key
COHERE_API_KEY=your_cohere_api_key
GOOGLE_API_KEY=your_google_genai_key
MISTRAL_API_KEY=your_mistral_api_key

# Embeddings (required)
HF_API_KEY=your_huggingface_api_key

# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/mustashar_db

# Database SSL (optional, default: false)
DATABASE_SSL=false

# Logging (optional, default: info)
LOG_LEVEL=info

# Polling mode (true = long polling, no webhook/tunnel needed)
POLLING=true
```

> **Note:** The app fails to start if any required variable is missing. `BOT_TOKEN`, `DATABASE_URL`, `HF_API_KEY`, `GROQ_API_KEY` and `COHERE_API_KEY` are mandatory; the remaining LLM keys are used by the model fallback chains, so set them to keep every provider path available.

> **Tip:** When deploying with Docker Compose the `DATABASE_URL` is injected automatically; you do not need to set it in `.env`.

---

## Vector Database Setup

The RAG system needs a pre-built HNSWLib vector index.

1. Place Arabic legal documents (`.pdf`, `.txt`, `.md`) in the `./docs/` directory.
2. Build the index:

```bash
bun run src/rag/vdb.ts
```

3. The index is written to `./vdb/` (`hnswlib.index`, `docstore.json`, `args.json`).

See [`RAG.md`](RAG.md) for full details on the RAG pipeline.

---

## API Reference

The server listens on **port 3000**. Full request/response examples are in [`doc/API.md`](doc/API.md).

| Method | Path | Description |
|---|---|---|
| `GET` | `/check` | Health check — verifies DB connectivity |
| `POST` | `/webhook` | Telegram webhook receiver |
| `POST` | `/answer` | Direct question answering (REST clients) |
| `GET` | `/summary/:chatId` | Retrieve rolling summary for a chat |
| `GET` | `/stats/users` | Total number of unique users |
| `GET` | `/stats/messages` | Total messages across all users |
| `GET` | `/stats/messages/:chatId` | Message count for a specific chat |

---

## Commands

Users can send the following commands to the Telegram bot:

| Command | Description |
|---|---|
| `/clear` | Wipe conversation memory and start fresh |

---

## Development

```bash
# Start with hot-reload
bun run dev

# Push DB schema changes
bun run db:push

# Generate Drizzle migrations
bun run db:generate
```

---

## Deployment

### Docker (recommended)

```bash
docker compose up -d --build
```

This starts both the application and a PostgreSQL container. The bot uses long polling (no webhook or tunnel needed). The app is available at `http://localhost:3000`.

The vector database files in `./vdb` are bind-mounted into the container so the index persists across container restarts.

For a detailed deployment guide see [`doc/DEPLOYMENT.md`](doc/DEPLOYMENT.md).

---

## Documentation

| File | Contents |
|---|---|
| [`README.md`](README.md) | This file — overview & quick start |
| [`RAG.md`](RAG.md) | RAG pipeline deep-dive |
| [`doc/API.md`](doc/API.md) | Full API reference with examples |
| [`doc/ARCHITECTURE.md`](doc/ARCHITECTURE.md) | System architecture & component design |
| [`doc/DEPLOYMENT.md`](doc/DEPLOYMENT.md) | Step-by-step deployment guide |
| [`doc/CONTRIBUTING.md`](doc/CONTRIBUTING.md) | How to contribute |
