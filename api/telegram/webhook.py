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
        elif text.startswith('/today'):
            self.handle_today_command(chat_id)
        elif text.startswith('/help'):
            self.handle_help_command(chat_id)
        else:
            # AI-powered natural language chat
            self.handle_ai_chat(chat_id, text)

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

    def handle_today_command(self, chat_id: int):
        """Handle /today command - show today's meals only."""
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
        today_str = today.strftime('%Y-%m-%d')

        meal_plan = get_current_meal_plan(family_id, week_start)
        if not meal_plan:
            send_telegram_message(
                chat_id,
                "📭 No meal plan for this week. Generate one in the app!"
            )
            return

        # Find today's meals
        today_day = None
        for day in meal_plan.get('days', []):
            if day.get('date') == today_str:
                today_day = day
                break

        if not today_day:
            send_telegram_message(
                chat_id,
                f"📭 No meals planned for today ({today.strftime('%A')})."
            )
            return

        lines = [f"🍽️ *Today's Meals — {today_day.get('dayName', today.strftime('%A'))}*\n"]
        for meal in today_day.get('meals', []):
            meal_type = meal.get('mealType', '')
            recipe = meal.get('recipeName', 'Unknown')
            emoji = {'breakfast': '🌅', 'lunch': '☀️', 'dinner': '🌙', 'snack': '🍎'}.get(meal_type, '🍽️')
            desc = meal.get('recipeDescription', '')
            time_total = (meal.get('prepTimeMinutes', 0) or 0) + (meal.get('cookTimeMinutes', 0) or 0)

            lines.append(f"\n{emoji} *{meal_type.capitalize()}*")
            lines.append(f"  {recipe}")
            if desc:
                lines.append(f"  _{desc[:80]}_")
            if time_total > 0:
                lines.append(f"  ⏱ {time_total} min")

        send_telegram_message(chat_id, '\n'.join(lines))

    def handle_ai_chat(self, chat_id: int, user_message: str):
        """Handle natural language messages using Gemini AI with Opik tracing."""
        import asyncio
        from _lib.opik_client import track_operation, init_opik

        init_opik()

        chat_data = get_telegram_chat_by_id(chat_id)
        if not chat_data:
            send_telegram_message(
                chat_id,
                "💬 I'd love to help! Please link this chat first with /start"
            )
            return

        family_id = chat_data.get('familyId')

        from datetime import datetime, timedelta
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime('%Y-%m-%d')
        today_str = today.strftime('%Y-%m-%d')

        meal_plan = get_current_meal_plan(family_id, week_start)

        # Build context
        today_meals_text = "No meals planned for today."
        week_meals_text = "No meal plan for this week."
        shopping_text = "No shopping list available."

        if meal_plan:
            # Today's meals
            for day in meal_plan.get('days', []):
                if day.get('date') == today_str:
                    meals = []
                    for m in day.get('meals', []):
                        meal_info = f"{m.get('mealType', '')}: {m.get('recipeName', '')}"
                        if m.get('ingredients'):
                            ingredients = [i.get('name', '') for i in m['ingredients'][:10]]
                            meal_info += f" (ingredients: {', '.join(ingredients)})"
                        if m.get('instructions'):
                            meal_info += f" | Instructions: {'; '.join(m['instructions'][:5])}"
                        meals.append(meal_info)
                    if meals:
                        today_meals_text = "\n".join(meals)
                    break

            # Week summary
            week_lines = []
            for day in meal_plan.get('days', [])[:7]:
                day_meals = [f"{m.get('mealType')}: {m.get('recipeName')}" for m in day.get('meals', [])]
                week_lines.append(f"{day.get('dayName', 'Day')}: {', '.join(day_meals)}")
            if week_lines:
                week_meals_text = "\n".join(week_lines)

            # Shopping list
            shopping_data = get_shopping_list(meal_plan.get('id'))
            if shopping_data:
                items = [f"{i.get('name')} ({i.get('amount', '')} {i.get('unit', '')})" for i in shopping_data.get('items', [])[:20]]
                if items:
                    shopping_text = ", ".join(items)

        prompt = f"""You are MealMind, a friendly and helpful meal planning assistant in a family Telegram group chat.

TODAY'S DATE: {today.strftime('%A, %B %d')}

TODAY'S MEALS:
{today_meals_text}

FULL WEEK PLAN:
{week_meals_text}

SHOPPING LIST:
{shopping_text}

Answer the user's question helpfully and concisely. You can help with:
- What's for dinner/lunch/breakfast today or any day this week
- Ingredient questions (what's needed, substitutions, quantities)
- Recipe instructions or cooking tips for planned meals
- Shopping list questions (what to buy, missing items)
- General meal planning advice

Keep responses SHORT and Telegram-friendly (under 200 words). Use emojis sparingly.
If asked about a meal not in the plan, say so clearly.

User's message: {user_message}"""

        with track_operation(
            name="telegram_ai_chat",
            input_data={
                "user_message": user_message,
                "chat_id": str(chat_id),
                "has_meal_plan": bool(meal_plan),
            },
            metadata={"operation": "telegram_chat", "family_id": family_id},
        ) as op:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    from _lib.gemini_client import get_llm
                    llm = get_llm(temperature=0.7)
                    response = loop.run_until_complete(llm.ainvoke(prompt))
                    ai_response = response.content

                    op.set_output({"response": ai_response})

                    # Deterministic quality heuristic (no extra LLM call)
                    relevance_score = _score_chat_relevance(
                        user_message, ai_response, meal_plan
                    )
                    op.log_score("chat_relevance", relevance_score)

                    # Send response (plain text to avoid Markdown parsing issues)
                    send_telegram_message(chat_id, ai_response, parse_mode=None)
                finally:
                    loop.close()
            except Exception as e:
                print(f"[Telegram AI] Error: {e}")
                op.log_score("chat_relevance", 0.0)
                send_telegram_message(
                    chat_id,
                    "Sorry, I couldn't process that right now. Try /help to see available commands."
                )

    def handle_help_command(self, chat_id: int):
        """Handle /help command."""
        send_telegram_message(
            chat_id,
            "🤖 *MealMind Bot Help*\n\n"
            "*Commands:*\n"
            "/start - Link this chat to your account\n"
            "/today - See today's meals\n"
            "/meals - See this week's meals\n"
            "/list - Get your shopping list\n"
            "/help - Show this help\n\n"
            "*Or just ask me anything!*\n"
            "\"What's for dinner?\"\n"
            "\"What ingredients do I need for lunch?\"\n"
            "\"How do I make today's breakfast?\"\n\n"
            "*Tips:*\n"
            "• Generate meal plans in the web app\n"
            "• Shopping lists are sent here automatically\n"
            "• Ask me about recipes, ingredients, or substitutions"
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


def _score_chat_relevance(user_message: str, response: str, meal_plan: dict) -> float:
    """Deterministic relevance scoring for Telegram chat responses."""
    score = 0.5  # Base score

    # Check response length (not too short, not too long)
    word_count = len(response.split())
    if 10 <= word_count <= 200:
        score += 0.2
    elif word_count < 5:
        score -= 0.3

    # Check if response mentions relevant food terms when asking about meals
    food_keywords = ["dinner", "lunch", "breakfast", "recipe", "ingredient", "cook"]
    msg_lower = user_message.lower()
    resp_lower = response.lower()

    if any(kw in msg_lower for kw in food_keywords):
        if any(kw in resp_lower for kw in food_keywords):
            score += 0.2

    # Check if it references actual recipes from the plan
    if meal_plan:
        for day in meal_plan.get("days", []):
            for meal in day.get("meals", []):
                name = (meal.get("recipeName") or "").lower()
                if name and name in resp_lower:
                    score += 0.1
                    break

    return min(1.0, max(0.0, score))


def get_telegram_chat_by_id(chat_id: int) -> dict:
    """Get telegram chat document by chat ID."""
    from _lib.firebase_admin_client import get_firestore
    db = get_firestore()
    doc = db.collection('telegramChats').document(str(chat_id)).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None
