"""POST /api/mealplans/regenerate - Regenerate a single meal in a plan."""

from http.server import BaseHTTPRequestHandler
import json
import asyncio

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import (
    get_meal_plan, get_family_members, get_family_preferences,
    update_meal_in_plan, save_evaluation_result
)
from _lib.gemini_client import get_llm
from _lib.opik_client import track_operation
from _lib.evaluation.metrics.dietary_compliance import evaluate_dietary_compliance


REGENERATE_PROMPT = """Generate a NEW {meal_type} recipe that is different from the current one.

CURRENT MEAL TO REPLACE: {current_meal}

REQUIREMENTS:
- Dietary Restrictions (MUST follow 100%): {restrictions}
- Disliked ingredients (NEVER include): {dislikes}
- Cuisine preferences: {cuisines}
- Must be DIFFERENT from the current meal
- Should fit the {meal_type} meal type

Return ONLY valid JSON (no markdown):
{{
    "mealType": "{meal_type}",
    "recipeName": "New Recipe Name",
    "recipeDescription": "Brief description",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 20,
    "servings": 4,
    "cuisine": "Italian",
    "ingredients": [
        {{"name": "ingredient", "amount": 1, "unit": "cup", "category": "produce"}}
    ],
    "instructions": [
        "Step 1",
        "Step 2"
    ]
}}"""


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            meal_plan_id = body.get('mealPlanId')
            day_index = body.get('dayIndex', 0)
            meal_type = body.get('mealType', 'dinner')

            if not meal_plan_id:
                raise ValueError("mealPlanId is required")

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    self.regenerate_meal(meal_plan_id, day_index, meal_type)
                )
            finally:
                # Clean shutdown of event loop
                try:
                    # Cancel any remaining tasks
                    pending = asyncio.all_tasks(loop)
                    if pending:
                        for task in pending:
                            task.cancel()
                        # Wait for cancellation to complete
                        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                except Exception:
                    pass
                finally:
                    loop.close()

            self.send_response(200 if result.get('success') else 500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

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

    async def regenerate_meal(self, meal_plan_id: str, day_index: int, meal_type: str) -> dict:
        """Regenerate a single meal with dietary compliance check."""

        with track_operation(
            name="regenerate_meal",
            input_data={"mealPlanId": meal_plan_id, "dayIndex": day_index, "mealType": meal_type},
            metadata={"operation": "meal_regeneration"}
        ) as op:
            try:
                # Get current meal plan
                meal_plan = get_meal_plan(meal_plan_id)
                if not meal_plan:
                    raise ValueError("Meal plan not found")

                family_id = meal_plan.get('familyId')
                days = meal_plan.get('days', [])

                if day_index >= len(days):
                    raise ValueError(f"Invalid day index: {day_index}")

                # Find current meal
                current_meal = None
                for meal in days[day_index].get('meals', []):
                    if meal.get('mealType') == meal_type:
                        current_meal = meal
                        break

                # Get family data
                members = get_family_members(family_id)
                preferences = get_family_preferences(family_id)

                all_restrictions = set()
                for member in members:
                    all_restrictions.update(member.get('dietaryRestrictions', []))
                restrictions = list(all_restrictions)

                # Generate new meal
                llm = get_llm(temperature=0.8)  # Slightly higher for more variety

                prompt = REGENERATE_PROMPT.format(
                    meal_type=meal_type,
                    current_meal=current_meal.get('recipeName', 'Unknown') if current_meal else 'None',
                    restrictions=", ".join(restrictions) if restrictions else "None",
                    dislikes=", ".join(preferences.get('dislikedIngredients', [])) or "None",
                    cuisines=", ".join(preferences.get('cuisinePreferences', [])) or "Any"
                )

                response = await llm.ainvoke(prompt)

                # Parse response
                content = response.content
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1

                if start_idx == -1:
                    raise ValueError("No JSON in response")

                new_meal = json.loads(content[start_idx:end_idx])

                # Evaluate dietary compliance
                compliance = await evaluate_dietary_compliance(new_meal, restrictions)

                if not compliance['passed']:
                    # Try once more if compliance fails
                    response = await llm.ainvoke(
                        prompt + "\n\nIMPORTANT: The previous attempt violated dietary restrictions. "
                        "Be EXTRA careful to avoid: " + ", ".join(restrictions)
                    )
                    content = response.content
                    start_idx = content.find('{')
                    end_idx = content.rfind('}') + 1
                    new_meal = json.loads(content[start_idx:end_idx])
                    compliance = await evaluate_dietary_compliance(new_meal, restrictions)

                # Log score
                op.log_score('dietary_compliance', compliance['score'])

                # Update meal plan in database
                update_meal_in_plan(meal_plan_id, day_index, meal_type, new_meal)

                # Save evaluation
                save_evaluation_result(
                    trace_id=op.trace_id,
                    operation_type='meal_regeneration',
                    family_id=family_id,
                    scores={'dietaryCompliance': compliance['score']},
                    passed=compliance['passed'],
                    metadata={
                        'mealPlanId': meal_plan_id,
                        'dayIndex': day_index,
                        'mealType': meal_type,
                        'previousMeal': current_meal.get('recipeName') if current_meal else None,
                        'newMeal': new_meal.get('recipeName'),
                        'complianceDetails': compliance
                    }
                )

                return {
                    'success': True,
                    'meal': new_meal,
                    'evaluation': {
                        'dietaryCompliance': compliance['score'],
                        'passed': compliance['passed'],
                        'violations': compliance.get('violations', [])
                    },
                    'traceId': op.trace_id
                }

            except Exception as e:
                error_msg = str(e)

                # Extract user-friendly error message from quota errors
                if 'RESOURCE_EXHAUSTED' in error_msg or 'quota' in error_msg.lower():
                    error_msg = "Daily API quota exceeded. Please try again tomorrow or upgrade your Gemini API plan."
                elif 'Error calling model' in error_msg and 'RESOURCE_EXHAUSTED' in error_msg:
                    error_msg = "Gemini API quota exceeded. The free tier allows 20 requests per day. Please wait or upgrade your plan."

                return {
                    'success': False,
                    'error': error_msg,
                    'traceId': op.trace_id if op else None
                }
