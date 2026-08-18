#!/bin/bash
# DEPRECATED: The bot now uses long polling instead of webhooks.
# No tunnel or webhook registration needed.
# Just run: docker compose up -d --build
#
# This script is kept for reference only.
# See INIT.md for the current setup instructions.

set -e

echo "=========================================="
echo "Mustashar — Long Polling Mode"
echo "=========================================="
echo ""
echo "This script is deprecated. The bot now uses long polling,"
echo "so no Cloudflare tunnel or webhook registration is needed."
echo ""
echo "To start the bot, simply run:"
echo ""
echo "  docker compose up -d --build"
echo ""
echo "The bot will automatically connect to Telegram via getUpdates polling."
echo ""
echo "To stop:  docker compose down"
echo "To view logs:  docker compose logs -f"
echo "Health check:  curl http://localhost:3000/check"
echo "=========================================="
