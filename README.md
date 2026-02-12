# Mustashar

A Telegram bot and web API that provides legal information using Retrieval-Augmented Generation (RAG) technology. The system uses Arabic legal documents to answer questions about Sudanese law and related topics.

## Features

- **Telegram Bot**: Interactive chatbot for legal questions with memory
- **Web API**: REST API endpoint for Telegram webhook
- **RAG System**: Prepared vector search with HNSWLib and Groq LLM for accurate answers (currently in development)
- **Arabic Support**: Specialized for Arabic legal text processing
- **Memory System**: Uses PostgreSQL to maintain conversation summaries

## Documentation

- **[RAG System Documentation](RAG.md)** - Detailed documentation for the Retrieval-Augmented Generation components

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or bun
- Cloudflare Workers account (for deployment)
- PostgreSQL database (for user memory)

### Installation

```bash
npm install
# or
bun install
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
GROQ_API_KEY=your_groq_api_key_here
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

For Cloudflare Workers deployment, add these to your `.dev.vars` file:

```env
GROQ_API_KEY="your_groq_api_key_here"
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL="postgresql://user:password@host:port/dbname"
```

### Vector Database Setup

The system uses HNSWLib for vector storage. The vector database is stored locally in the `./vdb/` directory and should be pre-indexed with Arabic legal documents.

To build the vector database:

```bash
bun run src/rag/vdb.ts
```

This will load documents from `./docs/`, chunk them, and create the vector index.

## Development

### Running Locally

```bash
npm run dev
# or
wrangler dev
```

### Testing the Retriever

```bash
bun run src/rag/retriver.ts
```

This will test the vector retrieval with sample queries.

### Type Generation

To generate/synchronize types based on your Worker configuration:

```bash
npm run cf-typegen
```

Then use `CloudflareBindings` as generics when instantiating Hono:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## API Endpoints

### Health Check

```
GET /check
```

### Telegram Webhook

```
POST /
Content-Type: application/json

{
  "message": {
    "chat": {
      "id": "123456789"
    },
    "text": "ما هو القانون الخاص بالعمل في السودان؟"
  }
}
```

The bot will process the message, update user memory, and respond via Telegram.

## Deployment

### Cloudflare Workers

```bash
npm run deploy
```

**Deployed URL**: https://mustashar.oovaa.workers.dev/

## Architecture

- **Frontend**: Telegram Bot API
- **Backend**: Hono.js on Cloudflare Workers
- **Vector Database**: HNSWLib (file-based)
- **User Memory**: PostgreSQL
- **LLM**: Groq API (Llama models)
- **Embeddings**: HuggingFace Inference API (multilingual-e5-small)
