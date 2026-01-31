#!/bin/bash

# MealMind - Telegram Webhook Setup Script
# This script sets up the Telegram webhook to point to your Vercel deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}MealMind - Telegram Webhook Setup${NC}"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found${NC}"
  echo "Please create a .env file with your TELEGRAM_BOT_TOKEN"
  exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check for required variables
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo -e "${RED}Error: TELEGRAM_BOT_TOKEN not set in .env${NC}"
  exit 1
fi

# Get webhook URL from user
echo -e "${YELLOW}What is your Vercel deployment URL?${NC}"
echo "Example: https://mealmind.vercel.app"
read -p "URL: " VERCEL_URL

# Remove trailing slash if present
VERCEL_URL=${VERCEL_URL%/}

# Construct webhook URL
WEBHOOK_URL="${VERCEL_URL}/api/telegram/webhook"

echo ""
echo "Setting webhook to: $WEBHOOK_URL"
echo ""

# Set the webhook
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}")

# Check if successful
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ Webhook set successfully!${NC}"
else
  echo -e "${RED}✗ Failed to set webhook${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

echo ""
echo "Checking webhook status..."
echo ""

# Get webhook info
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
echo "$WEBHOOK_INFO" | grep -E '(url|pending_update_count|last_error)' || echo "$WEBHOOK_INFO"

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Make sure your app is deployed to Vercel at: $VERCEL_URL"
echo "2. Go to Settings in the web app and click 'Open Telegram & Connect'"
echo "3. Start chatting with your bot!"
echo ""
