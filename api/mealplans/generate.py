"""POST /api/mealplans/generate - Generate a weekly meal plan."""

from http.server import BaseHTTPRequestHandler
import json
import re
import asyncio
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import opik
from _lib.firebase_admin_client import (
    get_family_members, get_family_preferences,
    get_family_recipes, save_meal_plan, save_evaluation_result
)
from _lib.gemini_client import get_llm
from _lib.opik_client import init_opik, get_opik_api_client
from _lib.evaluation.metrics.dietary_compliance import check_meal_plan_compliance
from _lib.evaluation.metrics.variety import evaluate_meal_variety
from _lib.evaluation.metrics.nutrition import evaluate_nutrition


# Detailed restriction descriptions to help LLM avoid violations
RESTRICTION_DETAILS = {
    "nut-free": "NO almonds, walnuts, cashews, pecans, pistachios, hazelnuts, macadamia, peanuts, pine nuts, or ANY nut-derived products (no almond milk, almond flour, almond butter, cashew cream, peanut butter, nut oils). Use oat milk, coconut milk, or regular milk instead of almond milk. Use regular flour, oat flour, or coconut flour instead of almond flour.",
    "dairy-free": "NO milk, butter, cheese, cream, yogurt, whey, casein, ghee, sour cream, ice cream, or ANY dairy product. Coconut milk, oat milk, and almond milk ARE allowed as substitutes. Coconut cream IS allowed.",
    "gluten-free": "NO wheat, flour, bread, pasta, barley, rye, couscous, regular soy sauce, breadcrumbs, tortillas (wheat), or ANY gluten-containing grains. Use gluten-free alternatives: rice, quinoa, corn tortillas, gluten-free pasta, tamari (gluten-free soy sauce).",
    "egg-free": "NO eggs, mayonnaise, aioli, meringue, quiche, frittata, or egg-based sauces.",
    "shellfish-free": "NO shrimp, crab, lobster, clams, mussels, oysters, scallops, or any shellfish.",
    "soy-free": "NO soy sauce, tofu, tempeh, edamame, miso, soy milk, or any soy-derived products.",
    "vegetarian": "NO meat, poultry, fish, or seafood of any kind. Eggs and dairy ARE allowed.",
    "vegan": "NO animal products at all: no meat, fish, dairy, eggs, honey, or any animal-derived ingredients.",
    "diabetic-friendly": "Minimize added sugars, use whole grains instead of refined carbs, include protein with every meal, avoid sugary sauces and dressings.",
    "low-sodium": "Avoid soy sauce, fish sauce, cured meats, pickled foods, bouillon cubes. Use fresh herbs and spices for flavor."
}


MEAL_PLAN_PROMPT = """You are a meal planning assistant creating a personalized weekly meal plan.

## REQUIREMENTS
- Days to plan: {days}
- Meals per day: {meals_per_day}
- CRITICAL - Dietary Restrictions (MUST follow 100%): {restrictions}
- Favorite ingredients (try to include): {favorites}
- Disliked ingredients (NEVER include): {dislikes}
- Cuisine preferences: {cuisines}
- Cooking time preference: {cooking_time}
- Language for recipe names/instructions: {language}

## AVAILABLE SAVED RECIPES (prioritize these when they fit)
{saved_recipes}

## DIETARY RESTRICTION DETAILS (CRITICAL - violating these is dangerous!)
{restriction_details}
{previous_feedback}
## INSTRUCTIONS
1. Create a {days}-day meal plan starting from {start_date}
2. STRICTLY avoid any ingredients that violate dietary restrictions - this is critical for health/safety
3. Double-check EVERY ingredient against the restrictions above before including it
4. Prioritize saved recipes when they fit the requirements
5. Ensure variety - don't repeat the same meal within the week
6. Balance cuisines - mix different cuisines throughout the week
7. Balance nutrition across the day (protein, vegetables, carbs)
8. For breakfast, prefer quicker meals (<30 min total time)
9. Generate detailed new recipes when saved recipes don't fit

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no explanation):
{{
    "days": [
        {{
            "date": "YYYY-MM-DD",
            "dayName": "Monday",
            "meals": [
                {{
                    "mealType": "breakfast",
                    "recipeName": "Recipe Name",
                    "recipeDescription": "Brief 1-2 sentence description",
                    "prepTimeMinutes": 15,
                    "cookTimeMinutes": 10,
                    "servings": 4,
                    "cuisine": "American",
                    "ingredients": [
                        {{"name": "eggs", "amount": 4, "unit": "large", "category": "dairy"}},
                        {{"name": "butter", "amount": 2, "unit": "tbsp", "category": "dairy"}}
                    ],
                    "instructions": [
                        "Step 1: Do this",
                        "Step 2: Then do this"
                    ]
                }}
            ]
        }}
    ]
}}

Categories for ingredients: produce, dairy, meat, pantry, spices, frozen, other"""


def _repair_json(text: str) -> str:
    """Attempt to fix common LLM JSON errors before parsing."""
    # Remove trailing commas before } or ]
    text = re.sub(r',\s*([}\]])', r'\1', text)
    # Remove single-line // comments
    text = re.sub(r'//[^\n]*', '', text)
    # Remove control characters that break JSON (except newlines/tabs)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    return text


def get_week_start() -> str:
    """Get Monday of current week as YYYY-MM-DD."""
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    return monday.strftime('%Y-%m-%d')


@opik.track(name="generate_meal_plan", project_name="mealmind", flush=True)
async def _tracked_generate_meal_plan(
    family_id: str, days: int, meals_per_day: list, previous_feedback: dict = None
) -> dict:
    """Core meal plan generation with Opik tracing via @track decorator.

    The return value becomes the trace output, so Opik online evaluation rules
    can bind to output.meal_plan and output.restrictions.
    """
    # Fetch family data
    members = get_family_members(family_id)
    preferences = get_family_preferences(family_id)
    saved_recipes = get_family_recipes(family_id)

    # Combine all dietary restrictions from all family members
    all_restrictions = set()
    for member in members:
        all_restrictions.update(member.get('dietaryRestrictions', []))
    restrictions = list(all_restrictions)

    # Generate meal plan via LLM
    # Use higher temperature when regenerating to encourage diversity
    temperature = 0.9 if previous_feedback else 0.7
    llm = get_llm(temperature=temperature)
    print(f"[DEBUG] Using temperature={temperature}")

    # Format saved recipes for prompt
    if saved_recipes:
        recipes_text = "\n".join([
            f"- {r.get('name', 'Unknown')}: {r.get('description', '')[:100]} "
            f"[{', '.join(r.get('mealTypes', []))}]"
            for r in saved_recipes[:15]
        ])
    else:
        recipes_text = "No saved recipes yet - generate all new recipes."

    week_start = get_week_start()

    # Build detailed restriction descriptions
    restriction_details_text = "None - no dietary restrictions."
    if restrictions:
        details = []
        for r in restrictions:
            r_key = r.lower().replace('_', '-').replace(' ', '-')
            detail = RESTRICTION_DETAILS.get(r_key, f"Avoid anything not compatible with {r}.")
            details.append(f"- **{r}**: {detail}")
        restriction_details_text = "\n".join(details)

    # Build feedback section from previous iteration (if regenerating)
    feedback_section = ""
    if previous_feedback:
        print(f"[DEBUG] Regenerating with feedback: {previous_feedback}")

        feedback_section = "\n## PREVIOUS ITERATION FEEDBACK\n"
        feedback_section += "You are REGENERATING a meal plan because the previous one had quality issues.\n"
        feedback_section += "You MUST create a COMPLETELY DIFFERENT meal plan that addresses these issues:\n\n"

        metric_names = {
            'dietary_compliance': 'Dietary Compliance',
            'variety': 'Variety & Diversity',
            'nutrition': 'Nutritional Balance'
        }

        for metric_key, data in previous_feedback.items():
            if isinstance(data, dict):
                score = data.get('value', 0)
                reason = data.get('reason', 'No details provided')
                metric_name = metric_names.get(metric_key, metric_key)

                feedback_section += f"**{metric_name}**: {score:.0%}\n"
                feedback_section += f"Issue: {reason}\n\n"

        feedback_section += "CRITICAL: Create a DIFFERENT meal plan with different recipes, cuisines, and ingredients.\n"
        feedback_section += "Do NOT repeat the same meals from the previous iteration.\n"

        print(f"[DEBUG] Feedback section:\n{feedback_section}")
    else:
        print("[DEBUG] No previous feedback - generating fresh meal plan")

    # Add timestamp to prevent caching
    timestamp = datetime.now().isoformat()

    prompt = MEAL_PLAN_PROMPT.format(
        days=days,
        meals_per_day=", ".join(meals_per_day),
        restrictions=", ".join(restrictions) if restrictions else "None",
        favorites=", ".join(preferences.get('favoriteIngredients', [])) or "None specified",
        dislikes=", ".join(preferences.get('dislikedIngredients', [])) or "None specified",
        cuisines=", ".join(preferences.get('cuisinePreferences', [])) or "Any cuisine",
        cooking_time=preferences.get('cookingTimePreference', 'any'),
        language=preferences.get('targetLanguage', 'en'),
        saved_recipes=recipes_text,
        start_date=week_start,
        restriction_details=restriction_details_text,
        previous_feedback=feedback_section
    )

    # Append timestamp as a comment to break caching
    prompt += f"\n\n(Generated at: {timestamp})"

    # Generate with one retry on JSON parse failure
    meal_plan = None
    last_parse_error = None

    for attempt in range(2):
        response = await llm.ainvoke(prompt)
        content = response.content

        start_idx = content.find('{')
        end_idx = content.rfind('}') + 1

        if start_idx == -1:
            last_parse_error = ValueError("No JSON found in LLM response")
            print(f"[DEBUG] Attempt {attempt+1}: no JSON found, retrying")
            continue

        raw_json = content[start_idx:end_idx]

        try:
            meal_plan = json.loads(raw_json)
            break
        except json.JSONDecodeError:
            # Try repairing common LLM JSON mistakes
            try:
                meal_plan = json.loads(_repair_json(raw_json))
                print(f"[DEBUG] JSON repaired successfully on attempt {attempt+1}")
                break
            except json.JSONDecodeError as e:
                last_parse_error = e
                print(f"[DEBUG] Attempt {attempt+1}: JSON parse failed: {e}")
                continue

    if meal_plan is None:
        raise ValueError(f"Failed to parse meal plan JSON after retries: {last_parse_error}")

    # Run evaluations
    compliance_result = await check_meal_plan_compliance(meal_plan, restrictions)
    variety_result = await evaluate_meal_variety(meal_plan)
    nutrition_result = await evaluate_nutrition(meal_plan)

    # Calculate overall score
    overall_score = (
        compliance_result['score'] * 0.5 +  # Compliance is critical
        variety_result['score'] * 0.3 +
        nutrition_result['score'] * 0.2
    )

    evaluation_scores = {
        'dietaryCompliance': compliance_result['score'],
        'variety': variety_result['score'],
        'nutrition': nutrition_result['score'],
        'overall': round(overall_score, 3),
        'passed': compliance_result['passed'] and overall_score >= 0.6
    }

    # Log compliance violation details for debugging
    if compliance_result.get('violations'):
        violation_summary = "; ".join([
            f"{v.get('recipeName', '?')}: {v.get('ingredient', '?')} violates {v.get('restriction', '?')}"
            for v in compliance_result['violations'][:5]
        ])
        print(f"DIETARY VIOLATIONS: {violation_summary}")

    # Get trace ID from the @opik.track decorator context
    trace_data = opik.opik_context.get_current_trace_data()
    opik_trace_id = trace_data.id if trace_data else f"local-generate_meal_plan"
    print(f"[DEBUG] Using trace {opik_trace_id}")

    # Log SDK scores to the trace via REST API
    api_client = get_opik_api_client()
    if api_client and trace_data:
        try:
            score_entries = [
                ('dietary_compliance', compliance_result['score']),
                ('variety', variety_result['score']),
                ('nutrition', nutrition_result['score']),
                ('overall', overall_score),
            ]
            for score_name, score_value in score_entries:
                api_client.traces.add_trace_feedback_score(
                    id=opik_trace_id,
                    name=score_name,
                    value=score_value,
                    source="sdk",
                )
        except Exception as e:
            print(f"[DEBUG] Failed to log scores via REST API: {e}")

    # Save to database
    meal_plan_id = save_meal_plan(
        family_id, week_start, meal_plan, evaluation_scores, opik_trace_id
    )

    # Save evaluation result
    save_evaluation_result(
        trace_id=opik_trace_id,
        operation_type='meal_generation',
        family_id=family_id,
        scores=evaluation_scores,
        passed=evaluation_scores['passed'],
        metadata={
            'mealPlanId': meal_plan_id,
            'days': days,
            'restrictions': restrictions,
            'complianceDetails': compliance_result,
            'varietyDetails': variety_result,
            'nutritionDetails': nutrition_result
        }
    )

    # Return value becomes the trace output — online rules read output.meal_plan
    # and output.restrictions from this dict
    return {
        "meal_plan": meal_plan,
        "restrictions": restrictions,
        "evaluation_scores": evaluation_scores,
        "meal_plan_id": meal_plan_id,
        "family_id": family_id,
        "week_start_date": week_start,
        "opik_trace_id": opik_trace_id,
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            family_id = body.get('familyId', 'demo-family')
            days = body.get('days', 7)
            meals_per_day = body.get('mealsPerDay', ['breakfast', 'lunch', 'dinner'])
            previous_feedback = body.get('previousFeedback')

            # Run async code
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    self.generate_meal_plan(family_id, days, meals_per_day, previous_feedback)
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

            # Send response
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

    async def generate_meal_plan(self, family_id: str, days: int, meals_per_day: list, previous_feedback: dict = None) -> dict:
        """Thin wrapper that calls the @opik.track-decorated function
        and transforms its output to the HTTP response format."""

        opik_trace_id = None

        try:
            # Must configure Opik BEFORE calling the @opik.track-decorated
            # function — the decorator creates the trace in its wrapper,
            # before the function body runs.
            init_opik()

            result = await _tracked_generate_meal_plan(
                family_id=family_id,
                days=days,
                meals_per_day=meals_per_day,
                previous_feedback=previous_feedback,
            )

            opik_trace_id = result.get('opik_trace_id')

            return {
                'success': True,
                'mealPlan': {
                    'id': result['meal_plan_id'],
                    'familyId': result['family_id'],
                    'weekStartDate': result['week_start_date'],
                    'status': 'draft',
                    'days': result['meal_plan'].get('days', []),
                    'evaluationScores': result['evaluation_scores'],
                    'opikTraceId': opik_trace_id
                },
                'evaluation': result['evaluation_scores'],
                'traceId': opik_trace_id
            }

        except Exception as e:
            error_msg = str(e)

            # Extract user-friendly error message from nested exceptions
            if 'RESOURCE_EXHAUSTED' in error_msg or 'quota' in error_msg.lower():
                error_msg = "Daily API quota exceeded. Please try again tomorrow or upgrade your Gemini API plan."
            elif 'Error calling model' in error_msg and 'RESOURCE_EXHAUSTED' in error_msg:
                error_msg = "Gemini API quota exceeded. The free tier allows 20 requests per day. Please wait or upgrade your plan."

            return {
                'success': False,
                'error': error_msg,
                'traceId': opik_trace_id
            }
