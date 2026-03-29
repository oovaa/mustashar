# API Reference

Mustashar exposes a REST API built with **Express.js 5**. The server runs on **port 3000** by default.

All request and response bodies use `Content-Type: application/json` unless otherwise noted.

---

## Table of Contents

- [Health Check](#1-health-check)
- [Telegram Webhook](#2-telegram-webhook)
- [Direct Answer](#3-direct-answer)
- [Conversation Summary](#4-conversation-summary)
- [User Statistics](#5-user-statistics)
- [Total Message Statistics](#6-total-message-statistics)
- [Per-Chat Message Count](#7-per-chat-message-count)
- [Error Responses](#error-responses)

---

## 1. Health Check

Verifies that the server is running and that the database connection is healthy.

```
GET /check
```

**Response — 200 OK**
```
Server and database are healthy!
```

**Response — 500 Internal Server Error**
```
Database connection failed
```

---

## 2. Telegram Webhook

Receives Telegram Update objects. Register this URL with the Telegram Bot API using `setWebhook`.

```
POST /webhook
Content-Type: application/json
```

**Request body** (standard Telegram Update):

```json
{
  "message": {
    "chat": {
      "id": 123456789
    },
    "text": "ما هو القانون الخاص بالإيجار في السودان؟"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `message.chat.id` | integer | Yes | Telegram chat ID used as the user key |
| `message.text` | string | Yes | The user's message text |

**Behaviour:**
- If `text` is `/clear` — clears the conversation memory for that `chat_id` and sends a confirmation message via Telegram.
- Otherwise — runs the full answer pipeline and sends the result back via Telegram's `sendMessage` API.

**Response — 200 OK** (normal message)
```json
{
  "answer": "وفقاً للمادة 42 من قانون الإيجارات..."
}
```

**Response — 200 OK** (`/clear` command)
```
Ok
```

**Response — 200 OK** (missing fields)
```json
{
  "message": "chat id and message are required"
}
```

---

## 3. Direct Answer

Allows REST clients (not Telegram) to submit a question and receive an answer directly.

```
POST /answer
Content-Type: application/json
```

**Request body:**

```json
{
  "question": "هل يحق للمستأجر رفض زيادة الإيجار قبل انتهاء العقد؟",
  "chatId": "user-session-001"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | Yes | The user's question (Arabic or other language) |
| `chatId` | string | Yes | Unique session identifier; used to load and update rolling memory |

**Response — 200 OK**
```json
{
  "answer": "نعم، وفقاً للمادة 15 من قانون الإيجارات..."
}
```

**Response — 400 Bad Request** (missing fields)
```
Missing question or chatId
```

**Response — 500 Internal Server Error**
```json
{
  "error": "Failed to answer question"
}
```

---

## 4. Conversation Summary

Returns the current rolling summary stored for a given chat session.

```
GET /summary/:chatId
```

| Parameter | Type | Description |
|---|---|---|
| `chatId` | string | The chat/session identifier |

**Response — 200 OK**
```json
{
  "history": "المستخدم يستشير في موضوع إيجار بيت بدون عقد مكتوب..."
}
```

If no history exists yet, `history` will be `"No history found"`.

**Response — 500 Internal Server Error**
```json
{
  "error": "Failed to fetch summary"
}
```

---

## 5. User Statistics

Returns the total number of unique users (chat IDs) that have interacted with the bot.

```
GET /stats/users
```

**Response — 200 OK**
```json
{
  "users": 142
}
```

**Response — 500 Internal Server Error**
```json
{
  "error": "Failed to fetch user count"
}
```

---

## 6. Total Message Statistics

Returns the total number of messages processed across all users.

```
GET /stats/messages
```

**Response — 200 OK**
```json
{
  "messages": 3897
}
```

**Response — 500 Internal Server Error**
```json
{
  "error": "Failed to fetch total message count"
}
```

---

## 7. Per-Chat Message Count

Returns the number of messages exchanged in a specific chat session.

```
GET /stats/messages/:chatId
```

| Parameter | Type | Description |
|---|---|---|
| `chatId` | string | The chat/session identifier |

**Response — 200 OK**
```json
{
  "chatId": "123456789",
  "messages": 27
}
```

**Response — 404 Not Found** (unknown chatId)
```json
{
  "error": "Chat not found"
}
```

**Response — 500 Internal Server Error**
```json
{
  "error": "Failed to fetch message count"
}
```

---

## Error Responses

All endpoints return `500` with a JSON body on unexpected server errors:

```json
{
  "error": "حدث خطأ داخلي في الخادم."
}
```

---

## Registering the Telegram Webhook

Use the Telegram Bot API to point Telegram at your server:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook"}'
```

The endpoint must be publicly accessible over HTTPS. For local development, use a tunnel such as [ngrok](https://ngrok.com/).
