# Mustashar Project Initialization Guide

> **Purpose**: Complete, AI-executable runbook to initialize and deploy the Mustashar Telegram bot from scratch using Docker. No domain, no Cloudflare tunnel, no webhook configuration needed.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Clone Repository](#step-1-clone-repository)
4. [Step 2: Get API Keys](#step-2-get-api-keys)
5. [Step 3: Create Environment File](#step-3-create-environment-file)
6. [Step 4: Prepare Vector Database](#step-4-prepare-vector-database)
7. [Step 5: Start Services](#step-5-start-services)
8. [Step 6: Test the Bot](#step-6-test-the-bot)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## Overview

**Mustashar** (مستشار) is an AI-powered Telegram bot for Sudanese legal guidance. It uses **long polling** (not webhooks), so no public URL, no Cloudflare tunnel, and no domain are required.

**Architecture**:
```
Telegram ← Express polls getUpdates → Express app → PostgreSQL
                                              ↓
                                         HNSWLib (vector DB)
```

**Key points**:
- Long polling via Telegram `getUpdates` API — no webhook setup
- No public URL, no Cloudflare tunnel, no SSL certificate needed
- The bot works behind NAT, VPN, or on a local machine
- `docker compose up` = everything works instantly

---

## Prerequisites

### Required Software

- **Docker Engine ≥ 24.0** and **Docker Compose v2**
  - Install: https://docs.docker.com/engine/install/
  - Verify: `docker --version && docker compose version`

- **Bun ≥ 1.0** (for local vector DB building only)
  - Install: `curl -fsSL https://bun.sh/install | bash`
  - Verify: `bun --version`

- **Git**
  - Verify: `git --version`

### Required Accounts & API Keys

You need **at least one LLM provider** and the following:

1. **Telegram Bot Token** (required)
   - Talk to [@BotFather](https://t.me/BotFather) on Telegram
   - Send `/newbot` and follow prompts
   - Save the token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **HuggingFace API Key** (required for embeddings)
   - Sign up: https://huggingface.co/join
   - Get token: https://huggingface.co/settings/tokens
   - Free tier sufficient

3. **At least one LLM provider** (required):
   - **Cerebras** (recommended, fast, free tier): https://cloud.cerebras.ai/
   - **Groq** (recommended, fast, free tier): https://console.groq.com/keys
   - **Google GenAI** (for classification): https://aistudio.google.com/apikey
   - **Cohere** (for summarization): https://dashboard.cohere.com/api-keys
   - **Together AI** (optional): https://api.together.xyz/settings/api-keys
   - **Mistral** (optional): https://console.mistral.ai/

### Legal Documents (for RAG)

Place Arabic legal documents (`.pdf`, `.txt`, `.md`) in `./docs/` directory before building the vector database. Without documents, the bot will work but only answer conversational queries.

---

## Step 1: Clone Repository

```bash
git clone https://github.com/oovaa/mustashar.git
cd mustashar
```

Verify you're in the project directory:
```bash
ls Dockerfile docker-compose.yml package.json
# All three files should be listed
```

---

## Step 2: Get API Keys

Before proceeding, ensure you have obtained all required API keys from the [Prerequisites](#prerequisites) section.

**Minimum required keys**:
- `BOT_TOKEN` (Telegram)
- `HF_API_KEY` (HuggingFace)
- At least 2 LLM providers (one for answering, one for classification/summarization)

**Recommended keys** (for full functionality):
- `CEREBRAS_API_KEY` (primary LLM)
- `GROQ_API_KEY` (fallback LLM)
- `GOOGLE_API_KEY` (classification)
- `COHERE_API_KEY` (summarization)

---

## Step 3: Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and fill in all API keys:

```env
# Telegram Bot Token (required)
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# LLM Provider Keys (fill at least one)
CEREBRAS_API_KEY=csk-xxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxxx

# Embeddings (required)
HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxx

# Logging level (optional)
LOG_LEVEL=info

# PostgreSQL password (change for production)
POSTGRES_PASSWORD=somepass

# Polling mode (true = long polling, default)
POLLING=true
```

**Save and exit**: `Ctrl+O`, `Enter`, `Ctrl+X`

### Verify .env file

```bash
cat .env | grep -v '^#' | grep -v '^$'
# Should show all your keys
```

---

## Step 4: Prepare Vector Database

The RAG system needs a pre-built HNSWLib vector index.

### Option A: Use pre-built index (if available)

If you have a `./vdb/` directory with `hnswlib.index`, `docstore.json`, and `args.json`, skip to Step 5.

### Option B: Build from documents

1. **Place legal documents** in `./docs/` directory:
```bash
ls docs/
# Should show your .pdf, .txt, or .md files
```

2. **Build the vector index**:
```bash
bun run src/rag/vdb.ts
```

3. **Verify the index was created**:
```bash
ls -lh vdb/
# Should show: args.json, docstore.json, hnswlib.index
```

**Note**: Building the index requires API keys to be set in `.env` and may take several minutes depending on document count.

---

## Step 5: Start Services

```bash
docker compose up -d --build
```

**What this does**:
1. Builds the app container
2. Starts PostgreSQL
3. Pushes database schema
4. Starts the bot in long polling mode (connects to Telegram automatically)

### Verify services are running

```bash
docker compose ps
# Expected output:
# NAME              SERVICE     STATUS
# mustashar-app-1   app         running
# mustashar-db-1    db          running (healthy)
```

### Check application health

```bash
curl http://localhost:3000/check
# Expected: "Server and database are healthy!"
```

### View logs

```bash
# All services
docker compose logs -f

# Application only
docker compose logs -f app
```

**Expected log output**:
```
Bot is running on port 3000
Mode: long polling (no webhook needed)
Webhook deleted successfully
Starting Telegram long polling...
```

---

## Step 6: Test the Bot

### Test 1: Send a message

1. Open Telegram
2. Search for your bot (the username you set with @BotFather)
3. Send `/start` or any question
4. Wait for a response (may take 10-30 seconds for first message)

### Test 2: Check bot is receiving messages

```bash
docker compose logs app | grep "Processing user request"
# Should show log lines when you send messages
```

### Test 3: Test API endpoints

```bash
# Health check
curl http://localhost:3000/check

# Get user count
curl http://localhost:3000/stats/users

# Get total messages
curl http://localhost:3000/stats/messages

# Test answer endpoint
curl -X POST http://localhost:3000/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "ما هو القانون؟", "chatId": "test123"}'
```

### Test 4: Check logs for errors

```bash
docker compose logs app | grep -i error
# Should be empty or only show historical errors
```

---

## Troubleshooting

### Issue: Bot doesn't respond

**Symptoms**: Bot is running but doesn't reply in Telegram

**Solution**:
```bash
# Check if polling is active
docker compose logs app | grep "polling"

# Check for Telegram API errors
docker compose logs app | grep -i "polling\|telegram\|error"

# Restart the app
docker compose restart app
```

### Issue: Database connection failed

**Symptoms**: `/check` endpoint returns "Database connection failed"

**Solution**:
```bash
# Check database is running
docker compose ps db

# Check database logs
docker compose logs db

# Restart services
docker compose restart
```

### Issue: Vector database not loading

**Symptoms**: Application crashes on startup with "vdb files not found"

**Solution**:
```bash
# Check vdb files exist
ls -lh vdb/

# If missing, rebuild
bun run src/rag/vdb.ts

# Restart app
docker compose restart app
```

### Issue: Bot responds slowly (>30 seconds)

**Possible causes**:
1. First message is always slow (model loading)
2. LLM API rate limits
3. Large vector index loading

**Solution**:
```bash
# Check app logs for bottlenecks
docker compose logs app | grep -i "loading\|fetching\|calling"

# Set LOG_LEVEL=debug in .env for more details
# Restart after changing
docker compose restart app
```

---

## Maintenance

### Update application code

```bash
git pull
docker compose up -d --build
```

### Update dependencies

```bash
bun install
docker compose up -d --build
```

### Rebuild vector database (after adding documents)

```bash
# Add new documents to ./docs/
cp new-documents/*.pdf docs/

# Rebuild index
bun run src/rag/vdb.ts

# Restart app to reload index
docker compose restart app
```

### View application logs

```bash
# Real-time logs
docker compose logs -f app

# Last 100 lines
docker compose logs --tail=100 app

# Logs from specific time
docker compose logs --since "2024-01-01T00:00:00" app
```

### Backup database

```bash
docker compose exec db pg_dump -U mustashar_admin mustashar_db > backup_$(date +%Y%m%d).sql
```

### Restore database

```bash
cat backup_20240101.sql | docker compose exec -T db psql -U mustashar_admin mustashar_db
```

### Stop services

```bash
# Stop but keep data
docker compose stop

# Stop and remove containers (keeps volumes)
docker compose down

# Stop and remove everything (DELETES DATA)
docker compose down -v
```

---

## Quick Reference

### Essential Commands

```bash
# Start everything
docker compose up -d --build

# Stop everything
docker compose down

# View logs
docker compose logs -f

# Restart app
docker compose restart app

# Health check
curl http://localhost:3000/check

# Rebuild vector DB
bun run src/rag/vdb.ts && docker compose restart app

# Backup database
docker compose exec db pg_dump -U mustashar_admin mustashar_db > backup.sql
```

### File Structure

```
mustashar/
├── .env                          # Your secrets (gitignored)
├── .env.example                  # Template for .env
├── docker-compose.yml            # Docker services definition
├── Dockerfile                    # App container build
├── docs/                         # Legal documents for RAG
├── vdb/                          # Vector database files
│   ├── hnswlib.index
│   ├── docstore.json
│   └── args.json
├── src/                          # Application source code
│   ├── index.ts                  # Express server entry + polling loop
│   ├── botService.ts             # Telegram message handler
│   ├── answer.ts                 # Answer pipeline
│   └── ...
└── INIT.md                       # This file
```

### Service Ports

- **3000** - Express app (health check, answer API)

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | - | Telegram bot token from @BotFather |
| `HF_API_KEY` | Yes | - | HuggingFace API key for embeddings |
| `CEREBRAS_API_KEY` | Recommended | - | Cerebras LLM (primary) |
| `GROQ_API_KEY` | Recommended | - | Groq LLM (fallback) |
| `GOOGLE_API_KEY` | Recommended | - | Gemini for classification |
| `COHERE_API_KEY` | Recommended | - | Cohere for summarization |
| `TOGETHER_AI_API_KEY` | Optional | - | Together AI LLM |
| `MISTRAL_API_KEY` | Optional | - | Mistral LLM |
| `DATABASE_URL` | Auto (Docker) | - | PostgreSQL connection string |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info`, `debug` |
| `POSTGRES_PASSWORD` | Yes | `somepass` | PostgreSQL password |
| `POLLING` | No | `true` | Use long polling (true) or webhook (false) |

---

## Support

- **Project README**: `./README.md`
- **Architecture Details**: `./doc/ARCHITECTURE.md`
- **RAG Pipeline**: `./RAG.md`
- **API Reference**: `./doc/API.md`
- **Issues**: https://github.com/oovaa/mustashar/issues

---

## Checklist for AI Execution

Use this checklist to verify successful setup:

- [ ] Docker and Docker Compose installed
- [ ] Bun installed (for vector DB building)
- [ ] Repository cloned
- [ ] All API keys obtained
- [ ] `.env` file created with all keys
- [ ] Legal documents placed in `./docs/` (if building RAG)
- [ ] Vector database built (`./vdb/` contains 3 files)
- [ ] Docker services started successfully
- [ ] Health check endpoint returns "Server and database are healthy!"
- [ ] Bot responds to test message in Telegram
- [ ] No errors in `docker compose logs app`

**If all items are checked, the setup is complete and operational.**

---

**Last Updated**: 2026-06-19
**Compatible with**: Mustashar v1.0+, Docker Compose v2, Telegram long polling
