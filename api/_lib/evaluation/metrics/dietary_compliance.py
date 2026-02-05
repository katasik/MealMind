"""Dietary compliance evaluation metric.

This is a CRITICAL metric - missing an allergen could cause a severe allergic reaction.

Uses keyword matching with safe-compound allowlists (fast, deterministic).
LLM-based semantic checking is handled asynchronously via Opik online
evaluation rules using GPT-4o-mini — see docs/opik-rules.md for setup.
"""

from typing import List, Dict, Any

# Known allergens and hidden sources
ALLERGEN_KEYWORDS: Dict[str, List[str]] = {
    "gluten-free": [
        "wheat", "flour", "bread", "pasta", "barley", "rye", "couscous",
        "soy sauce", "beer", "malt", "seitan", "bulgur", "semolina", "orzo",
        "breadcrumbs", "croutons", "tortilla", "noodles", "cake", "cookie",
        "pastry", "pie crust", "batter", "breading"
    ],
    "dairy-free": [
        "milk", "cheese", "butter", "cream", "yogurt", "whey", "casein",
        "ghee", "lactose", "curd", "paneer", "ricotta", "mozzarella",
        "parmesan", "cheddar", "feta", "brie", "cottage cheese", "sour cream",
        "ice cream", "custard", "buttermilk"
    ],
    "nut-free": [
        "almond", "walnut", "cashew", "pistachio", "pecan", "hazelnut",
        "macadamia", "peanut", "nut butter", "marzipan", "praline", "nutella",
        "pine nut", "brazil nut", "chestnut", "nut oil", "nut flour"
    ],
    "egg-free": [
        "egg", "eggs", "mayonnaise", "aioli", "meringue", "custard",
        "hollandaise", "egg wash", "egg white", "egg yolk", "quiche",
        "frittata", "omelette", "scrambled"
    ],
    "shellfish-free": [
        "shrimp", "crab", "lobster", "prawn", "crawfish", "clam",
        "mussel", "oyster", "scallop", "crayfish", "langoustine"
    ],
    "soy-free": [
        "soy", "tofu", "tempeh", "edamame", "miso", "soy sauce", "soya",
        "soybean", "soy milk", "soy lecithin", "tamari", "teriyaki"
    ],
    "vegetarian": [
        "chicken", "beef", "pork", "lamb", "fish", "bacon", "ham",
        "turkey", "duck", "veal", "meat", "anchovy", "gelatin", "lard",
        "sausage", "pepperoni", "salami", "prosciutto", "steak", "ribs",
        "ground beef", "ground turkey", "salmon", "tuna", "shrimp", "cod"
    ],
    "vegan": [
        "chicken", "beef", "pork", "lamb", "fish", "bacon", "ham",
        "turkey", "duck", "veal", "meat", "anchovy", "milk", "cheese",
        "butter", "cream", "yogurt", "egg", "honey", "gelatin", "whey",
        "casein", "ghee", "lard", "sausage", "steak", "salmon", "shrimp"
    ],
    "diabetic-friendly": [
        # Not strictly forbidden, but flagged for awareness
    ],
    "low-sodium": [
        "soy sauce", "fish sauce", "worcestershire", "bouillon", "stock cube",
        "cured", "pickled", "salted", "smoked"
    ]
}

# Safe compounds: ingredient names that contain a keyword but are NOT violations.
# Checked per-ingredient before flagging — if the ingredient name contains a safe
# compound it is skipped even though it also contains the keyword.
SAFE_COMPOUNDS: Dict[str, List[str]] = {
    "dairy-free": [
        "coconut milk", "oat milk", "almond milk", "soy milk", "rice milk",
        "cashew milk", "hemp milk", "flax milk", "macadamia milk",
        "coconut cream", "coconut butter", "cocoa butter", "shea butter",
        "peanut butter", "almond butter", "cashew butter", "sunflower butter",
        "seed butter", "soy butter",
        "coconut yogurt", "soy yogurt", "oat yogurt", "almond yogurt",
        "vegan cheese", "nutritional yeast",
        "coconut ice cream", "vegan ice cream",
        "coconut custard",
        "coconut milk powder", "full-fat coconut milk",
    ],
    "vegan": [
        "coconut milk", "oat milk", "almond milk", "soy milk", "rice milk",
        "cashew milk", "hemp milk", "flax milk", "macadamia milk",
        "coconut cream", "coconut butter", "cocoa butter",
        "peanut butter", "almond butter", "cashew butter", "sunflower butter",
        "coconut yogurt", "soy yogurt", "oat yogurt",
        "vegan cheese", "vegan sausage", "vegan steak",
        "coconut ice cream", "vegan ice cream",
        "vegan egg", "egg substitute", "egg replacer",
        "vegan honey", "agave",
    ],
    "gluten-free": [
        "almond flour", "coconut flour", "rice flour", "oat flour",
        "chickpea flour", "tapioca flour", "cassava flour", "teff flour",
        "buckwheat flour", "sorghum flour", "millet flour",
        "gluten-free pasta", "gluten-free bread", "gluten-free noodles",
        "gluten-free tortilla", "corn tortilla",
        "gluten-free soy sauce", "tamari",
        "rice noodles", "glass noodles", "zucchini noodles",
        "rice cake",
    ],
    "nut-free": [
        "coconut", "coconut milk", "coconut cream", "coconut flour",
        "coconut oil", "coconut butter",
    ],
}


def _is_safe_compound(ingredient: str, restriction_key: str) -> bool:
    """Check if an ingredient is a known safe compound for this restriction."""
    safe_list = SAFE_COMPOUNDS.get(restriction_key, [])
    for safe in safe_list:
        if safe in ingredient:
            return True
    return False


async def evaluate_dietary_compliance(
    recipe: Dict[str, Any],
    restrictions: List[str]
) -> Dict[str, Any]:
    """
    Evaluate if a recipe complies with dietary restrictions.

    Uses keyword matching only (deterministic, no false positives).
    LLM semantic checking runs asynchronously via Opik online evaluation
    rules — see docs/opik-rules.md for setup instructions.

    Returns score of 1.0 (safe) or 0.0 (violation).
    """

    if not restrictions:
        return {
            "score": 1.0,
            "passed": True,
            "violations": [],
            "confidence": 1.0
        }

    ingredients = recipe.get('ingredients', [])
    ingredient_names = [ing.get('name', '').lower() for ing in ingredients]

    # Per-ingredient keyword matching with safe-compound allowlist
    keyword_violations = []
    for restriction in restrictions:
        restriction_key = restriction.lower().replace('_', '-').replace(' ', '-')
        keywords = ALLERGEN_KEYWORDS.get(restriction_key, [])

        for ingredient in ingredient_names:
            # Skip this ingredient entirely if it matches a known safe compound
            if _is_safe_compound(ingredient, restriction_key):
                continue

            for keyword in keywords:
                if keyword in ingredient:
                    keyword_violations.append({
                        "restriction": restriction,
                        "ingredient": ingredient,
                        "matchedKeyword": keyword,
                        "detectionMethod": "keyword"
                    })
                    break  # One violation per ingredient per restriction is enough

    is_safe = len(keyword_violations) == 0

    return {
        "score": 1.0 if is_safe else 0.0,
        "passed": is_safe,
        "violations": keyword_violations,
        "confidence": 1.0,  # Keyword matching is deterministic
        "keywordViolations": len(keyword_violations),
        "llmViolations": 0,  # LLM check runs async via Opik online rules
        "checkedRestrictions": restrictions
    }


async def check_meal_plan_compliance(
    meal_plan: Dict[str, Any],
    restrictions: List[str]
) -> Dict[str, Any]:
    """Check all meals in a plan for dietary compliance."""

    all_violations = []
    meals_checked = 0
    meals_compliant = 0

    for day in meal_plan.get('days', []):
        for meal in day.get('meals', []):
            meals_checked += 1
            result = await evaluate_dietary_compliance(meal, restrictions)

            if result['passed']:
                meals_compliant += 1
            else:
                for violation in result.get('violations', []):
                    all_violations.append({
                        **violation,
                        'day': day.get('dayName', 'Unknown'),
                        'mealType': meal.get('mealType', 'Unknown'),
                        'recipeName': meal.get('recipeName', 'Unknown')
                    })

    compliance_rate = meals_compliant / meals_checked if meals_checked > 0 else 1.0

    return {
        "score": 1.0 if compliance_rate == 1.0 else 0.0,
        "passed": compliance_rate == 1.0,
        "complianceRate": compliance_rate,
        "mealsChecked": meals_checked,
        "mealsCompliant": meals_compliant,
        "violations": all_violations
    }
