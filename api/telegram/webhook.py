"""POST /api/telegram/webhook - Handle Telegram bot webhooks."""

from http.server import BaseHTTPRequestHandler
import json
import os

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import (
    save_telegram_chat, get_telegram_chat, get_shopping_list,
    get_current_meal_plan
)

try:
    import httpx
except ImportError:
    httpx = None


def send_telegram_message(chat_id: int, text: str, parse_mode: str = 'Markdown'):
    """Send a message via Telegram Bot API."""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token or not httpx:
        return

    with httpx.Client() as client:
        client.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={
                'chat_id': chat_id,
                'text': text,
                'parse_mode': parse_mode
            }
        )


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            # Handle different update types
            if 'message' in body:
                self.handle_message(body['message'])
            elif 'callback_query' in body:
                self.handle_callback(body['callback_query'])

            # Always respond 200 to Telegram
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True}).encode())

        except Exception as e:
            # Still respond 200 to avoid Telegram retries
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'error': str(e)}).encode())

    def handle_message(self, message: dict):
        """Handle incoming Telegram message."""
        chat_id = message.get('chat', {}).get('id')
        text = message.get('text', '').strip()
        chat_type = message.get('chat', {}).get('type', 'private')

        if not chat_id or not text:
            return

        # Handle commands
        if text.startswith('/start'):
            self.handle_start_command(chat_id, text, chat_type)
        elif text.startswith('/list'):
            self.handle_list_command(chat_id)
        elif text.startswith('/meals'):
            self.handle_meals_command(chat_id)
        elif text.startswith('/help'):
            self.handle_help_command(chat_id)
        else:
            # Echo or handle natural language
            send_telegram_message(
                chat_id,
                "I didn't understand that command. Use /help to see available commands."
            )

    def handle_start_command(self, chat_id: int, text: str, chat_type: str):
        """Handle /start command - link chat to family."""
        # Extract family ID from deep link if provided
        parts = text.split()
        family_id = parts[1] if len(parts) > 1 else 'demo-family'

        # Save chat linkage
        save_telegram_chat(chat_id, family_id, chat_type)

        send_telegram_message(
            chat_id,
            f"👋 *Welcome to MealMind!*\n\n"
            f"I'm now linked to your family account.\n\n"
            f"*Available commands:*\n"
            f"/list - Get your shopping list\n"
            f"/meals - See this week's meal plan\n"
            f"/help - Show help\n\n"
            f"You'll also receive your shopping list here when you generate it in the app!"
        )

    def handle_list_command(self, chat_id: int):
        """Handle /list command - send shopping list."""
        # Get linked family
        chat_data = get_telegram_chat_by_id(chat_id)
        if not chat_data:
            send_telegram_message(
                chat_id,
                "❌ This chat is not linked to a MealMind account.\n"
                "Use /start to link your account."
            )
            return

        family_id = chat_data.get('familyId')

        # Get current meal plan
        from datetime import datetime, timedelta
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime('%Y-%m-%d')

        meal_plan = get_current_meal_plan(family_id, week_start)
        if not meal_plan:
            send_telegram_message(
                chat_id,
                "📭 No meal plan found for this week.\n"
                "Generate one in the MealMind app first!"
            )
            return

        shopping_list = get_shopping_list(meal_plan.get('id'))
        if not shopping_list:
            send_telegram_message(
                chat_id,
                "📭 No shopping list found.\n"
                "Generate one from your meal plan in the app!"
            )
            return

        # Format and send
        from shopping.telegram import format_shopping_list_message
        message = format_shopping_list_message(shopping_list, meal_plan)
        send_telegram_message(chat_id, message)

    def handle_meals_command(self, chat_id: int):
        """Handle /meals command - show meal plan summary."""
        chat_data = get_telegram_chat_by_id(chat_id)
        if not chat_data:
            send_telegram_message(
                chat_id,
                "❌ This chat is not linked. Use /start first."
            )
            return

        family_id = chat_data.get('familyId')

        from datetime import datetime, timedelta
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime('%Y-%m-%d')

        meal_plan = get_current_meal_plan(family_id, week_start)
        if not meal_plan:
            send_telegram_message(
                chat_id,
                "📭 No meal plan for this week. Generate one in the app!"
            )
            return

        # Format meal plan summary
        lines = ["🍽️ *This Week's Meals*\n"]

        for day in meal_plan.get('days', [])[:7]:
            day_name = day.get('dayName', 'Day')
            lines.append(f"\n*{day_name}*")

            for meal in day.get('meals', []):
                meal_type = meal.get('mealType', '')
                recipe = meal.get('recipeName', 'Unknown')
                emoji = {'breakfast': '🌅', 'lunch': '☀️', 'dinner': '🌙', 'snack': '🍎'}.get(meal_type, '🍽️')
                lines.append(f"  {emoji} {recipe}")

        send_telegram_message(chat_id, '\n'.join(lines))

    def handle_help_command(self, chat_id: int):
        """Handle /help command."""
        send_telegram_message(
            chat_id,
            "🤖 *MealMind Bot Help*\n\n"
            "*Commands:*\n"
            "/start - Link this chat to your account\n"
            "/list - Get your shopping list\n"
            "/meals - See this week's meals\n"
            "/help - Show this help\n\n"
            "*Tips:*\n"
            "• Generate meal plans in the web app\n"
            "• Shopping lists are sent here automatically\n"
            "• Check off items in the app as you shop"
        )

    def handle_callback(self, callback_query: dict):
        """Handle callback queries from inline buttons."""
        # For future: handle item check-off via inline buttons
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def get_telegram_chat_by_id(chat_id: int) -> dict:
    """Get telegram chat document by chat ID."""
    from _lib.firebase_admin_client import get_firestore
    db = get_firestore()
    doc = db.collection('telegramChats').document(str(chat_id)).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None
