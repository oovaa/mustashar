# Mustashar

A Telegram bot and web API that provides legal information using Retrieval-Augmented Generation (RAG) technology. The system uses Arabic legal documents to answer questions about Sudanese law and related topics.

## Features

- **Telegram Bot**: Interactive chatbot for legal questions with memory
- **Web API**: REST API endpoint for Telegram webhook
- **RAG System**: Vector search with HNSWLib and Groq LLM for accurate answers
- **Arabic Support**: Specialized for Arabic legal text processing
- **Memory System**: Uses PostgreSQL to maintain conversation summaries
- **Error Handling**: Rate limit detection with user-friendly Arabic error messages
- **Enhanced Logging**: Comprehensive logging for debugging and monitoring
- **Docker Support**: Easy deployment with Docker Compose

## Documentation

- **[RAG System Documentation](RAG.md)** - Detailed documentation for the Retrieval-Augmented Generation components

## Setup

### Prerequisites

- Node.js (v18 or higher) or Bun
- Docker and Docker Compose
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
HF_API_KEY=your_huggingface_api_key_here
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
bun run dev
```

### Running with Docker

```bash
docker-compose up --build
```

### Testing the Chain

```bash
bun run src/rag/test-chain.ts
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

### Docker Deployment

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:3000`.

### Cloudflare Workers (Alternative)

If you prefer serverless deployment:

```bash
npm run deploy
```

## Architecture

- **Frontend**: Telegram Bot API
- **Backend**: Express.js with TypeScript
- **Vector Database**: HNSWLib (file-based)
- **User Memory**: PostgreSQL
- **LLM**: Groq API (Llama models)
- **Embeddings**: HuggingFace Inference API (Arabic BERT model)
- **Containerization**: Docker & Docker Compose

## Error Handling

The bot includes robust error handling with fallback mechanisms:

### Rate Limit Handling

When both primary and fallback LLM models hit rate limits, users receive a clear Arabic error message:

```
عذراً، لقد وصلنا إلى الحد الأقصى لعدد الطلبات. يرجى المحاولة مرة أخرى بعد قليل.
```
*"Sorry, we have reached the maximum number of requests. Please try again later."*

The system uses fallback model chains:
- **Summarizer**: `llama-3.1-8b-instant` → `openai/gpt-oss-20b`
- **Answer Generator**: `llama-3.3-70b-versatile` → `openai/gpt-oss-120b`

Rate limit detection checks:
- Error messages containing "rate limit" or "rate_limit"
- HTTP status code 429
- Error code `rate_limit_exceeded`

### Logging

The system provides comprehensive logging for debugging and monitoring:

- **User Questions**: Logs all incoming user queries
- **Conversation Summaries**: Logs both old and updated conversation summaries
- **Model Usage**: Tracks which LLM models are being used for each request
- **Errors**: Detailed error logging with error messages and stack traces

This helps with:
- Debugging issues in production
- Monitoring model performance and usage
- Understanding user conversation patterns
- Tracking rate limit occurrences
