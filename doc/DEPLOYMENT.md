# Deployment Guide

This guide covers deploying Mustashar in production using Docker Compose (recommended) or manually on a VPS.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
- [Option B: Manual Deployment](#option-b-manual-deployment)
- [Registering the Telegram Webhook](#registering-the-telegram-webhook)
- [Reverse Proxy with Nginx](#reverse-proxy-with-nginx)
- [SSL/TLS with Certbot](#ssltls-with-certbot)
- [Environment Variables Reference](#environment-variables-reference)
- [Vector Database](#vector-database)
- [Monitoring and Logs](#monitoring-and-logs)
- [Updating the Application](#updating-the-application)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Linux VPS (Ubuntu 22.04 LTS recommended)
- **Domain name** pointing to your server's IP address (required for Telegram HTTPS webhook)
- Docker Engine ≥ 24 and Docker Compose v2
- API keys for all required services (see [Environment Variables Reference](#environment-variables-reference))
- Pre-built vector database in `./src/rag/vdb/` (see [Vector Database](#vector-database))

---

## Option A: Docker Compose (Recommended)

### 1. Clone the repository

```bash
git clone https://github.com/oovaa/mustashar.git
cd mustashar
```

### 2. Create the environment file

```bash
cp .env.example .env   # if example exists, otherwise create from scratch
nano .env
```

Fill in all required values (see [Environment Variables Reference](#environment-variables-reference)).

> **Note:** `DATABASE_URL` is automatically injected by Docker Compose. You do not need to set it in `.env` when using Docker.

### 3. Prepare the vector database

The `./src/rag/vdb/` directory must contain the HNSWLib index files before starting. If you have already built the index locally, copy it to the server:

```bash
scp -r ./src/rag/vdb/ user@your-server:/path/to/mustashar/src/rag/vdb/
```

Or build it on the server (requires API keys to be set):

```bash
# On the server, inside the project directory
bun run src/rag/vdb.ts
```

### 4. Start the services

```bash
docker compose up -d --build
```

This will:
1. Build the application image.
2. Start a PostgreSQL 18 container on the internal `bot-network`.
3. Wait for the database to be healthy.
4. Run `bun db:push` to apply the schema.
5. Start the application on port 3000.

### 5. Verify

```bash
curl http://localhost:3000/check
# Expected: Server and database are healthy!
```

---

## Option B: Manual Deployment

Use this approach if you prefer not to use Docker, or if you are deploying to a PaaS (Railway, Render, Fly.io, etc.).

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install system dependencies for HNSWLib

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 make g++
```

### 3. Install project dependencies

```bash
cd mustashar
bun install
```

### 4. Set environment variables

Create a `.env` file with all required variables (see [Environment Variables Reference](#environment-variables-reference)). Include `DATABASE_URL` pointing to your PostgreSQL instance.

### 5. Apply the database schema

```bash
bun run db:push
```

### 6. Build the vector database (first time only)

```bash
bun run src/rag/vdb.ts
```

### 7. Start the application

**Foreground (for testing):**
```bash
bun run start
```

**Background with systemd (recommended for production):**

Create `/etc/systemd/system/mustashar.service`:

```ini
[Unit]
Description=Mustashar Legal Bot
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/mustashar
EnvironmentFile=/home/ubuntu/mustashar/.env
ExecStart=/home/ubuntu/.bun/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mustashar
sudo systemctl start mustashar
sudo systemctl status mustashar
```

---

## Registering the Telegram Webhook

Telegram requires your webhook endpoint to be publicly accessible over HTTPS. After setting up SSL (see below), register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook"}'
```

**Verify the webhook:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## Reverse Proxy with Nginx

Place the application behind Nginx to handle HTTPS and port forwarding.

Install Nginx:
```bash
sudo apt-get install -y nginx
```

Create `/etc/nginx/sites-available/mustashar`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/mustashar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL/TLS with Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically update the Nginx config for HTTPS and set up auto-renewal.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | **Yes** | Telegram Bot token from [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (auto-set by Docker Compose) |
| `HF_API_KEY` | **Yes** | HuggingFace Inference API key (for embeddings) |
| `GROQ_API_KEY` | **Yes** | Groq API key |
| `TOGETHER_API_KEY` | **Yes** | Together AI API key |
| `COHERE_API_KEY` | **Yes** | Cohere API key (for summariser) |
| `GOOGLE_API_KEY` | **Yes** | Google GenAI key (for classifier — Gemini) |
| `LOG_LEVEL` | No | Winston log level: `error`, `warn`, `info`, `debug` (default: `info`) |

> **Security:** Never commit `.env` to version control. The `.gitignore` already excludes it.

---

## Vector Database

The vector database (`./src/rag/vdb/`) must be present before the application starts. It contains three files:

| File | Description |
|---|---|
| `hnswlib.index` | Binary HNSW graph — the main search index |
| `docstore.json` | Document text and metadata |
| `args.json` | Index parameters (dimensions, space type) |

When using Docker Compose, these files are bind-mounted via:
```yaml
volumes:
  - ./src/rag/vdb:/app/src/rag/vdb
```

This means the index persists across container rebuilds. To rebuild the index after adding new documents:

```bash
# If using Docker
docker compose exec app bun run src/rag/vdb.ts

# If running manually
bun run src/rag/vdb.ts
```

---

## Monitoring and Logs

### Docker Compose logs

```bash
# Follow all logs
docker compose logs -f

# Follow application logs only
docker compose logs -f app

# Follow database logs
docker compose logs -f db
```

### Log files (manual or Docker volume)

Winston writes structured logs to the `logs/` directory:

| File | Contents |
|---|---|
| `logs/application-YYYY-MM-DD.log` | All logs (info+), rotated daily, compressed, 14-day retention |
| `logs/error.log` | Error-level logs only |
| `logs/exceptions.log` | Uncaught exceptions |
| `logs/rejections.log` | Unhandled promise rejections |

Set `LOG_LEVEL=debug` in `.env` to capture verbose pipeline logs (model inputs/outputs, retrieval results, DB operations).

### Health check endpoint

```bash
curl https://your-domain.com/check
```

Use this with uptime monitors (UptimeRobot, Better Uptime, etc.) to get alerted on outages.

---

## Updating the Application

### Docker Compose

```bash
git pull
docker compose up -d --build
```

Docker Compose will rebuild only the changed image layers.

### Manual / systemd

```bash
git pull
bun install           # update dependencies if package.json changed
bun run db:push       # apply schema changes if schema.ts changed
sudo systemctl restart mustashar
```

---

## Troubleshooting

### Application won't start — `hnswlib-node` native build error

Ensure C++ build tools are installed:
```bash
sudo apt-get install -y build-essential python3 make g++
bun install
```

### `DATABASE_URL is not set`

Make sure the `.env` file exists and contains `DATABASE_URL`. When using Docker Compose this variable is injected automatically and you do not need it in `.env`.

### `vdb/` files missing — retriever fails to load

The vector database must be built before starting the application:
```bash
bun run src/rag/vdb.ts
```

Verify the files exist:
```bash
ls -lh src/rag/vdb/
```

### Telegram webhook not receiving messages

1. Confirm the webhook is registered: `getWebhookInfo`
2. Confirm your domain has a valid SSL certificate
3. Check Nginx is forwarding `/webhook` correctly
4. Check `docker compose logs app` for incoming request logs

### High memory usage

The HNSWLib index is loaded entirely into memory. For large document corpora, increase the VPS memory or reduce `chunkSize` in `src/rag/chunker.ts` before rebuilding the index.
