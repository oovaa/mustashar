# Contributing to Mustashar

Thank you for your interest in contributing! This guide explains how to set up a development environment, understand the codebase, and submit changes.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Adding Legal Documents](#adding-legal-documents)
- [Working with LLM Agents](#working-with-llm-agents)
- [Database Changes](#database-changes)
- [Logging](#logging)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Environment Variables](#environment-variables)

---

## Code of Conduct

Be respectful and constructive. This project provides legal information to Arabic-speaking users — accuracy, reliability, and cultural sensitivity matter.

---

## Getting Started

### 1. Fork and clone

```bash
git clone https://github.com/your-username/mustashar.git
cd mustashar
```

### 2. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 3. Install system dependencies (for HNSWLib native bindings)

```bash
# Ubuntu/Debian
sudo apt-get install -y build-essential python3 make g++

# macOS
xcode-select --install
```

### 4. Install project dependencies

```bash
bun install
```

### 5. Set up environment variables

```bash
cp .env.example .env  # or create .env manually
```

See [Environment Variables](#environment-variables) for the full list.

### 6. Start a local PostgreSQL instance

Using Docker:
```bash
docker run -d \
  --name mustashar-db \
  -e POSTGRES_DB=mustashar_db \
  -e POSTGRES_USER=mustashar_admin \
  -e POSTGRES_PASSWORD=somepass \
  -p 5432:5432 \
  postgres:18
```

Set `DATABASE_URL=postgresql://mustashar_admin:somepass@localhost:5432/mustashar_db` in `.env`.

### 7. Apply the database schema

```bash
bun run db:push
```

### 8. Build the vector database (first time)

Place Arabic legal documents in `./docs/` then run:

```bash
bun run src/rag/vdb.ts
```

### 9. Start the development server

```bash
bun run dev
```

This starts the server with hot-reload (`--watch` flag). The server listens on port 3000.

---

## Project Structure

```
src/
├── index.ts            # Express app entry point — all route definitions
├── botService.ts       # Telegram webhook handler
├── answer.ts           # Core answer pipeline (RAG + chat routing)
├── stand_alone.ts      # Message classifier & query decomposer
├── history.ts          # Rolling summary management (read/write)
├── answerPrompts.ts    # System prompt strings for answer LLM agents
├── db.ts               # Drizzle ORM + postgres-js connection
├── schema.ts           # Database table definitions
├── logger.ts           # Winston logger
└── rag/
    ├── chunker.ts      # Document loader & splitter
    ├── embeddings.ts   # HuggingFace embedding client
    ├── vdb.ts          # One-time index builder
    └── retriver.ts     # Runtime retriever
```

See [`doc/ARCHITECTURE.md`](ARCHITECTURE.md) for a detailed breakdown of every module.

---

## Development Workflow

### Running locally without Telegram

Use the `/answer` REST endpoint to test the pipeline without needing a real Telegram bot:

```bash
curl -X POST http://localhost:3000/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "ما هي حقوق المستأجر في السودان؟", "chatId": "dev-test-1"}'
```

### Testing retrieval

```bash
bun -e "
import { retriver } from './src/rag/retriver';
const docs = await retriver.invoke('عقود الإيجار');
console.log(\`Retrieved \${docs.length} chunks\`);
docs.forEach((d, i) => console.log(\`\n--- Chunk \${i+1} ---\n\${d.pageContent.slice(0, 300)}\`));
"
```

### Testing the classifier

```bash
bun -e "
import { analyzeUserMessage } from './src/rag/stand_alone';
const result = await analyzeUserMessage('هل يحق للمؤجر زيادة الإيجار؟');
console.log(JSON.stringify(result, null, 2));
"
```

### Checking conversation history

```bash
curl http://localhost:3000/summary/dev-test-1
```

### Enabling debug logs

Set `LOG_LEVEL=debug` in `.env` to see full model inputs, outputs, and retrieval results in the console.

---

## Adding Legal Documents

1. Place PDF or text files in the `./docs/` directory.
2. Rebuild the vector index:
   ```bash
   bun run src/rag/vdb.ts
   ```
3. Verify chunk count in the log output.
4. Test retrieval with a sample query from the new document.

**Chunking parameters** (in `src/rag/chunker.ts`):
- `chunkSize: 1500` — characters per chunk
- `chunkOverlap: 200` — overlap between adjacent chunks

Adjust these if documents have very long or very short articles.

---

## Working with LLM Agents

All agents are created with LangChain's `createAgent()` and `modelFallbackMiddleware()`.

### Adding a new agent

```typescript
import { createAgent, modelFallbackMiddleware } from 'langchain'

const myFallback = modelFallbackMiddleware(
  'groq:llama-3.3-70b-versatile',
  'together:Qwen/Qwen3.5-397B-A17B',
)

const myAgent = createAgent({
  model: 'google-genai:gemini-2.5-flash',
  middleware: [myFallback],
  systemPrompt: 'Your system prompt here',
})

const response = await myAgent.invoke({ messages: 'User input here' })
const text = String(response.messages.at(-1)?.content ?? '').trim()
```

### Changing models

Models are specified in the format `provider:model-name`. Available providers:
- `groq:` — Groq API (`GROQ_API_KEY`)
- `together:` — Together AI (`TOGETHER_API_KEY`)
- `cohere:` — Cohere (`COHERE_API_KEY`)
- `google-genai:` — Google GenAI (`GOOGLE_API_KEY`)

### System prompts

Add or modify system prompts in `src/answerPrompts.ts`. Both existing prompts (`ANSWER_SYSTEM_CHATTING_PROMPT` and `RAG_ANSWER_SYSTEM_PROMPT`) are written in Arabic and enforce Arabic-only output. Maintain this convention for any new legal-domain prompts.

---

## Database Changes

The database schema is managed by [Drizzle ORM](https://orm.drizzle.team/).

### Modifying the schema

1. Edit `src/schema.ts`.
2. Generate a migration:
   ```bash
   bun run db:generate
   ```
3. Push the migration to the database:
   ```bash
   bun run db:push
   ```

### Current schema

See [`doc/ARCHITECTURE.md#database-schema`](ARCHITECTURE.md#database-schema) for the full table definition.

---

## Logging

Use the shared `logger` instance from `src/logger.ts` — do not use `console.log` in production code.

```typescript
import { logger } from './logger'

logger.info('Starting something...')
logger.debug(`Detail: ${someValue}`)
logger.warn('Something unexpected happened')
logger.error(`Failed: ${error}`)
```

Log levels (in ascending severity): `debug` → `info` → `warn` → `error`

The `LOG_LEVEL` environment variable controls the minimum level logged (default: `info`). Set it to `debug` during development.

---

## Pull Request Guidelines

1. **Branch naming**: `feat/short-description`, `fix/short-description`, `docs/short-description`
2. **Commits**: Use clear, present-tense messages (`Add retriever caching`, `Fix history upsert race condition`)
3. **Scope**: Keep PRs focused. One feature or fix per PR.
4. **Prompts**: If you modify system prompts, explain the change and test against both Arabic and English inputs.
5. **Documents**: If you add new legal documents, describe them in the PR (law name, year, source).
6. **No secrets**: Never commit API keys, `.env` files, or database credentials.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | **Yes** | Telegram Bot token |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `HF_API_KEY` | **Yes** | HuggingFace Inference API key (embeddings) |
| `GROQ_API_KEY` | **Yes** | Groq API key |
| `TOGETHER_API_KEY` | **Yes** | Together AI key |
| `COHERE_API_KEY` | **Yes** | Cohere API key |
| `GOOGLE_API_KEY` | **Yes** | Google GenAI key |
| `LOG_LEVEL` | No | `error` / `warn` / `info` / `debug` (default: `info`) |
