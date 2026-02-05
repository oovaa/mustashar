# Mustashar

A Telegram bot and web API that provides legal information using Retrieval-Augmented Generation (RAG) technology. The system uses Arabic legal documents to answer questions about Sudanese labor law and related topics.

## Features

- **Telegram Bot**: Interactive chatbot for legal questions
- **Web API**: REST API endpoint for programmatic access
- **RAG System**: Uses vector search with LanceDB and Groq LLM for accurate answers
- **Arabic Support**: Specialized for Arabic legal text processing

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or bun
- Cloudflare Workers account (for deployment)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
GROQ_API_KEY=your_groq_api_key_here
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=./rag/vectordb
```

For Cloudflare Workers deployment, add these to your `.dev.vars` file:

```env
GROQ_API_KEY="your_groq_api_key_here"
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL="./rag/vectordb"
```

### Database Setup

The system uses LanceDB for vector storage. The database should be located at the path specified in `DATABASE_URL`. Make sure the vector database is properly indexed with Arabic legal documents.

## Development

### Running Locally

```bash
npm run dev
```

### Testing the RAG System

```bash
npm run test-rag
```

This will test the RAG functionality with sample Arabic questions.

### Type Generation

To generate/synchronize types based on your Worker configuration:

```bash
npm run cf-typegen
```

Then use `CloudflareBindings` as generics when instantiating Hono:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## API Endpoints

### Health Check
```
GET /check
```

### Ask Question
```
POST /api/ask
Content-Type: application/json

{
  "question": "ما هي حقوق الموظف في القانون السوداني؟"
}
```

## Deployment

### Cloudflare Workers

```bash
npm run deploy
```

**Deployed URL**: https://mustashar.oovaa.workers.dev/

## Architecture

- **Frontend**: Telegram Bot API
- **Backend**: Hono.js on Cloudflare Workers
- **Database**: LanceDB for vector storage
- **LLM**: Groq API (Llama models)
- **Embeddings**: Xenova Transformers (local, multilingual-e5-small)
