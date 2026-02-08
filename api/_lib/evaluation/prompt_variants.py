"""Prompt variants for A/B experiment comparison.

Each variant is a template string with the same format placeholders so the
experiment runner can swap them interchangeably.

Meal plan placeholders: {days}, {meals_per_day}, {restrictions}, {favorites},
    {dislikes}, {cuisines}, {cooking_time}, {start_date}, {restriction_details},
    {saved_recipes}, {previous_feedback}, {recipe_instruction}, {language}

Recipe extraction placeholders: {content}
"""

# ── Meal Plan Generation Variants ────────────────────────────────────

MEAL_PLAN_VARIANTS = {
    "baseline": """You are a meal planning assistant creating a personalized weekly meal plan.

## REQUIREMENTS
- Days to plan: {days}
- Meals per day: {meals_per_day}
- CRITICAL - Dietary Restrictions (MUST follow 100%): {restrictions}
- Favorite ingredients (try to include): {favorites}
- Disliked ingredients (NEVER include): {dislikes}
- Cuisine preferences: {cuisines}
- COOKING TIME LIMIT: {cooking_time} (total prep + cook time per recipe MUST NOT exceed this)
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
4. {recipe_instruction}
5. COOKING TIME IS STRICT: prepTimeMinutes + cookTimeMinutes MUST stay within the cooking time limit above. If the limit is "any", there is no limit.
6. For breakfast, ALWAYS keep total time under 30 minutes regardless of the cooking time preference
7. Ensure variety - don't repeat the same meal within the week
8. Balance cuisines - mix different cuisines throughout the week
9. Balance nutrition across the day (protein, vegetables, carbs)
10. Generate detailed new recipes when saved recipes don't fit

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

Categories for ingredients: produce, dairy, meat, pantry, spices, frozen, other""",


    "concise": """Create a {days}-day meal plan starting {start_date}.

Meals per day: {meals_per_day}
Dietary restrictions (MUST FOLLOW): {restrictions}
Likes: {favorites} | Dislikes: {dislikes}
Cuisines: {cuisines} | COOKING TIME LIMIT: {cooking_time} (STRICT — total prep+cook must not exceed this)
Language: {language}

{restriction_details}
{previous_feedback}
{recipe_instruction}

Rules: Follow ALL restrictions strictly. No repeated meals. Balance nutrition.
Vary cuisines and proteins. Breakfast MUST be under 30 min total.
EVERY recipe's prepTimeMinutes + cookTimeMinutes MUST respect the cooking time limit.

Saved recipes to prioritize: {saved_recipes}

Return ONLY valid JSON (no markdown):
{{"days": [{{"date": "YYYY-MM-DD", "dayName": "Monday", "meals": [{{"mealType": "breakfast", "recipeName": "Name", "recipeDescription": "Brief desc", "prepTimeMinutes": 15, "cookTimeMinutes": 10, "servings": 4, "cuisine": "Italian", "ingredients": [{{"name": "item", "amount": 1, "unit": "cup", "category": "produce"}}], "instructions": ["Step 1"]}}]}}]}}""",


    "safety_first": """CRITICAL SAFETY REQUIREMENTS — READ FIRST:

Dietary restrictions that MUST be followed 100%: {restrictions}

{restriction_details}

VIOLATING THESE RESTRICTIONS IS DANGEROUS FOR HEALTH/SAFETY.
You MUST check EVERY SINGLE INGREDIENT against every restriction above.

---

Now create a {days}-day meal plan starting from {start_date}.
- Meals per day: {meals_per_day}
- Favorite ingredients: {favorites}
- Disliked ingredients (NEVER use): {dislikes}
- Preferred cuisines: {cuisines}
- COOKING TIME LIMIT: {cooking_time} (STRICT — every recipe's prep+cook MUST NOT exceed this)
- Language: {language}

Saved recipes: {saved_recipes}
{previous_feedback}
{recipe_instruction}

Requirements:
1. BEFORE adding any ingredient, verify it doesn't violate the restrictions above
2. EVERY recipe's prepTimeMinutes + cookTimeMinutes MUST stay within the cooking time limit. If "any", no limit.
3. Breakfast MUST be under 30 minutes total regardless of cooking time preference
4. Ensure variety — different recipes, cuisines, and proteins each day
5. Balance nutrition (protein + vegetables + carbs at each meal)

BEFORE OUTPUTTING YOUR RESPONSE:
- Re-read the restrictions at the top
- Check every ingredient in every recipe one final time
- Remove any ingredient that could violate a restriction

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
                    "recipeDescription": "Brief description",
                    "prepTimeMinutes": 15,
                    "cookTimeMinutes": 10,
                    "servings": 4,
                    "cuisine": "American",
                    "ingredients": [
                        {{"name": "eggs", "amount": 4, "unit": "large", "category": "dairy"}}
                    ],
                    "instructions": [
                        "Step 1: Do this"
                    ]
                }}
            ]
        }}
    ]
}}

Categories for ingredients: produce, dairy, meat, pantry, spices, frozen, other""",
}


# ── Recipe Extraction Variants ───────────────────────────────────────

RECIPE_EXTRACT_VARIANTS = {
    "baseline": """Extract the recipe from this content into a structured format.

SOURCE CONTENT:
{content}

CRITICAL: Extract ONLY information that is explicitly stated in the source.
- Do NOT make up, infer, or hallucinate any data
- If a field is NOT explicitly stated in the source, use null for that field
- For ingredients: only include unit if explicitly specified (e.g., "3 bananas" has no unit, so unit should be null)
- For times: extract if mentioned ANYWHERE in the source (including within instructions like "cook for 20 minutes")
- For servings: only include if explicitly stated
- The source may be in any language - extract times/amounts regardless of language

Return ONLY valid JSON:
{{
    "name": "Recipe Name",
    "description": "Brief description from the source, or null if not provided",
    "ingredients": [
        {{"name": "ingredient name", "amount": 1, "unit": "cup (or null if not specified)", "category": "produce|dairy|meat|pantry|spices|frozen|other (or null if unclear)"}}
    ],
    "instructions": [
        "Step 1: Exact instruction from source",
        "Step 2: Next step from source"
    ],
    "prepTimeMinutes": null,
    "cookTimeMinutes": null,
    "servings": null,
    "cuisine": null,
    "difficulty": "easy|medium|hard (or null if not stated)",
    "tags": [],
    "mealTypes": []
}}

IMPORTANT: It is better to return null than to guess. Only include values that are explicitly in the source.""",


    "strict_json": """Extract ONLY explicitly stated information from this recipe source. Return valid JSON.

SOURCE:
{content}

RULES:
- Missing info = null (NEVER guess or infer)
- "3 bananas" -> {{"name": "bananas", "amount": 3, "unit": null}}
- "1 cup flour" -> {{"name": "flour", "amount": 1, "unit": "cup"}}
- Times: extract only if explicitly stated (e.g., "Prep: 10 min" or "bake for 30 minutes")
- Servings: extract only if explicitly stated
- null is always correct for missing data — it is NOT an error

Required JSON structure:
{{
    "name": "string",
    "description": "string or null",
    "ingredients": [{{"name": "string", "amount": "number", "unit": "string or null", "category": "string or null"}}],
    "instructions": ["string"],
    "prepTimeMinutes": "number or null",
    "cookTimeMinutes": "number or null",
    "servings": "number or null",
    "cuisine": "string or null",
    "difficulty": "easy|medium|hard or null",
    "tags": [],
    "mealTypes": []
}}

Return ONLY the JSON object. No markdown, no explanation, no commentary.""",


    "minimal": """Extract this recipe as JSON. Use null for any missing fields.

Source:
{content}

Return only valid JSON with these fields: name, description, ingredients (name/amount/unit/category), instructions, prepTimeMinutes, cookTimeMinutes, servings, cuisine, difficulty, tags, mealTypes.""",
}
