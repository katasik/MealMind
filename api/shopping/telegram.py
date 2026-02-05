"""POST /api/shopping/telegram - Send shopping list to Telegram."""

from http.server import BaseHTTPRequestHandler
import json
import os

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import get_shopping_list, get_meal_plan

try:
    import httpx
except ImportError:
    httpx = None


def format_shopping_list_message(shopping_list: dict, meal_plan: dict) -> str:
    """Format shopping list as Telegram message."""

    week_start = shopping_list.get('weekStartDate', 'Unknown')
    items = shopping_list.get('items', [])

    # Group by category
    categories = {}
    for item in items:
        cat = item.get('category', 'other')
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)

    # Category emojis
    cat_emojis = {
        'produce': '🥬',
        'dairy': '🧀',
        'meat': '🥩',
        'pantry': '🥫',
        'spices': '🧂',
        'frozen': '🧊',
        'other': '📦'
    }

    # Build message
    lines = [
        f"🛒 *Shopping List*",
        f"📅 Week of {week_start}",
        ""
    ]

    category_order = ['produce', 'dairy', 'meat', 'pantry', 'spices', 'frozen', 'other']

    for cat in category_order:
        if cat in categories:
            emoji = cat_emojis.get(cat, '📦')
            lines.append(f"{emoji} *{cat.title()}*")

            for item in categories[cat]:
                amount = item.get('amount', '')
                unit = item.get('unit', '')
                name = item.get('name', '')
                checked = '✅' if item.get('checked') else '⬜'

                amount_str = f"{amount} {unit}" if amount else ""
                lines.append(f"  {checked} {amount_str} {name}".strip())

            lines.append("")

    # Add summary
    total = len(items)
    checked = sum(1 for i in items if i.get('checked'))
    lines.append(f"📊 {checked}/{total} items checked")

    return '\n'.join(lines)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            list_id = body.get('listId')
            chat_id = body.get('chatId')
            meal_plan_id = body.get('mealPlanId')

            if not chat_id:
                raise ValueError("chatId is required")

            if not list_id and not meal_plan_id:
                raise ValueError("Either listId or mealPlanId is required")

            # Get shopping list
            if list_id:
                # Would need to implement get_shopping_list_by_id
                raise ValueError("Direct list_id lookup not implemented")
            else:
                shopping_list = get_shopping_list(meal_plan_id)

            if not shopping_list:
                raise ValueError("Shopping list not found")

            # Get meal plan for context
            mp_id = shopping_list.get('mealPlanId') or meal_plan_id
            meal_plan = get_meal_plan(mp_id) if mp_id else {}

            # Format message
            message = format_shopping_list_message(shopping_list, meal_plan)

            # Send to Telegram
            bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
            if not bot_token:
                raise ValueError("Telegram bot not configured")

            if not httpx:
                raise ImportError("httpx not installed")

            with httpx.Client() as client:
                response = client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={
                        'chat_id': chat_id,
                        'text': message,
                        'parse_mode': 'Markdown'
                    }
                )
                response.raise_for_status()
                result = response.json()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'messageId': result.get('result', {}).get('message_id')
            }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e)
            }).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
