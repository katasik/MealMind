"""Shopping list completeness evaluation metric.

Ensures NO ingredients are missed in the shopping list.
This is critical — missing items means the user can't make the meal.
"""

import json
from typing import Dict, Any, List
from _lib.gemini_client import get_judge_llm


def normalize_unit(unit: str) -> str:
    """Normalize unit names for consistent aggregation."""
    unit = unit.lower().strip()

    # Remove trailing 's' for singular/plural consistency
    unit_singular = unit.rstrip('s')

    # Map common abbreviations to full names
    unit_map = {
        'tbsp': 'tablespoon',
        'tsp': 'teaspoon',
        'oz': 'ounce',
        'lb': 'pound',
        'qt': 'quart',
        'pt': 'pint',
        'gal': 'gallon',
        'ml': 'milliliter',
        'l': 'liter',
        'g': 'gram',
        'kg': 'kilogram',
        'c': 'cup'
    }

    # Try singular form first
    normalized = unit_map.get(unit_singular, unit_singular)

    # If not found, try original
    if normalized == unit_singular and unit in unit_map:
        normalized = unit_map[unit]

    return normalized


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient names for consistent aggregation."""
    name = name.lower().strip()

    # Remove common modifiers and preparation terms
    modifiers_to_remove = [
        'fresh ', 'frozen ', 'dried ', 'canned ',
        'chopped ', 'diced ', 'minced ', 'sliced ', 'grated ', 'shredded ',
        'peeled ', 'unpeeled ', 'whole ', 'halved ', 'quartered ',
        'cooked ', 'uncooked ', 'raw ', 'roasted ',
        'boneless ', 'skinless ', 'bone-in ',
        'organic ', 'free-range ', 'grass-fed ',
        'unsalted ', 'salted ', 'sweetened ', 'unsweetened ',
        'extra virgin ', 'virgin ', 'refined ',
        'large ', 'medium ', 'small ', 'baby '
    ]

    for modifier in modifiers_to_remove:
        name = name.replace(modifier, '')

    # Clean up extra spaces
    name = ' '.join(name.split())

    # Handle singular/plural for common items
    # Expanded list to cover more ingredients
    singular_map = {
        'eggs': 'egg',
        'onions': 'onion',
        'tomatoes': 'tomato',
        'potatoes': 'potato',
        'sweet potatoes': 'sweet potato',
        'carrots': 'carrot',
        'cloves': 'clove',
        'bananas': 'banana',
        'apples': 'apple',
        'berries': 'berry',
        'beans': 'bean',
        'green beans': 'green bean',
        'chickpeas': 'chickpea',
        'lentils': 'lentil',
        'peppers': 'pepper',
        'bell peppers': 'bell pepper',
        'mushrooms': 'mushroom',
        'zucchinis': 'zucchini',
        'cucumbers': 'cucumber',
        'avocados': 'avocado',
        'lemons': 'lemon',
        'limes': 'lime',
        'oranges': 'orange',
        'strawberries': 'strawberry',
        'blueberries': 'blueberry',
        'raspberries': 'raspberry'
    }

    name = singular_map.get(name, name)

    return name


def infer_category(ingredient_name: str) -> str:
    """Infer category from ingredient name if not provided."""
    name = ingredient_name.lower()

    # Produce
    produce_keywords = ['lettuce', 'tomato', 'onion', 'garlic', 'carrot', 'celery',
                        'pepper', 'cucumber', 'zucchini', 'broccoli', 'spinach',
                        'kale', 'cabbage', 'mushroom', 'potato', 'avocado', 'lemon',
                        'lime', 'orange', 'apple', 'banana', 'berry', 'basil', 'cilantro',
                        'parsley', 'lettuce', 'arugula']

    # Dairy
    dairy_keywords = ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'sour cream',
                      'parmesan', 'mozzarella', 'cheddar', 'feta']

    # Meat
    meat_keywords = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon',
                     'tuna', 'shrimp', 'bacon', 'sausage', 'ham']

    # Pantry
    pantry_keywords = ['flour', 'sugar', 'rice', 'pasta', 'bread', 'oil', 'vinegar',
                       'sauce', 'stock', 'broth', 'beans', 'chickpea', 'lentil',
                       'honey', 'maple', 'peanut butter', 'jam']

    # Spices
    spice_keywords = ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'thyme',
                      'cinnamon', 'nutmeg', 'ginger', 'curry', 'chili', 'cayenne',
                      'turmeric', 'coriander', 'bay leaf', 'vanilla']

    # Frozen
    frozen_keywords = ['frozen', 'ice cream', 'popsicle']

    # Check each category
    for keyword in produce_keywords:
        if keyword in name:
            return 'produce'

    for keyword in dairy_keywords:
        if keyword in name:
            return 'dairy'

    for keyword in meat_keywords:
        if keyword in name:
            return 'meat'

    for keyword in spice_keywords:
        if keyword in name:
            return 'spices'

    for keyword in frozen_keywords:
        if keyword in name:
            return 'frozen'

    for keyword in pantry_keywords:
        if keyword in name:
            return 'pantry'

    return 'other'


def deterministic_completeness_check(
    meal_ingredients: List[Dict],
    shopping_items: List[Dict]
) -> Dict[str, Any]:
    """
    Deterministic pre-check to catch obvious missing ingredients.
    Returns early detection of missing items without LLM variability.
    """

    # Normalize all ingredient names from meal plan
    meal_ingredient_names = set()
    for ing in meal_ingredients:
        name = ing['name']
        normalized = normalize_ingredient_name(name)
        meal_ingredient_names.add(normalized)

    # Normalize all shopping list item names
    shopping_item_names = set()
    for item in shopping_items:
        name = item['name']
        normalized = normalize_ingredient_name(name)
        shopping_item_names.add(normalized)

    # Find missing items
    missing = meal_ingredient_names - shopping_item_names

    return {
        'has_missing': len(missing) > 0,
        'missing_normalized': list(missing),
        'meal_count': len(meal_ingredient_names),
        'shopping_count': len(shopping_item_names)
    }


async def evaluate_shopping_completeness(
    meal_plan: Dict[str, Any],
    shopping_list: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Ensure NO ingredients are missed in the shopping list.
    This is critical — missing items means the user can't make the meal.

    Uses two-layer approach:
    1. Deterministic pre-check for obvious missing items
    2. LLM evaluation for nuanced checking (combining, quantities)
    """

    # Extract all ingredients from meal plan
    all_meal_ingredients: List[str] = []
    ingredient_details: List[Dict] = []

    for day in meal_plan.get('days', []):
        for meal in day.get('meals', []):
            recipe_name = meal.get('recipeName', 'Unknown')
            for ing in meal.get('ingredients', []):
                amount = ing.get('amount') or ''
                unit = ing.get('unit') or ''
                name = ing.get('name') or ''

                # Normalize unit for consistent display
                unit_normalized = normalize_unit(unit) if unit else unit

                all_meal_ingredients.append(f"{amount} {unit_normalized} {name}".strip())
                ingredient_details.append({
                    'name': name,
                    'amount': amount,
                    'unit': unit,
                    'recipe': recipe_name
                })

    # Extract shopping list items
    shopping_items: List[str] = []
    shopping_details: List[Dict] = []

    for item in shopping_list.get('items', []):
        amount = item.get('amount') or ''
        unit = item.get('unit') or ''
        name = item.get('name') or ''
        category = item.get('category') or ''
        shopping_items.append(f"{amount} {unit} {name} [{category}]".strip())
        shopping_details.append({
            'name': name,
            'amount': amount,
            'unit': unit,
            'category': category
        })

    # Deterministic pre-check (informational only - don't fail fast)
    # This helps catch obvious issues but we still do LLM evaluation for nuanced checking
    precheck = deterministic_completeness_check(ingredient_details, shopping_details)

    llm = get_judge_llm()

    # Format all ingredients (removed truncation - process all items)
    meal_ingredients_text = '\n'.join(all_meal_ingredients)
    shopping_items_text = '\n'.join(shopping_items)

    prompt = f"""Check if the shopping list contains ALL ingredients needed for the meal plan.

INGREDIENTS NEEDED (from all meals):
{meal_ingredients_text}

SHOPPING LIST:
{shopping_items_text}

EVALUATE:
1. Are ALL ingredients present? (Similar items should be combined, e.g., "2 eggs" + "3 eggs" = "5 eggs")
2. Are quantities correctly combined?
3. Are there phantom items not needed?

Return ONLY valid JSON:
{{
    "completeness_score": 0.0-1.0,
    "combination_score": 0.0-1.0,
    "precision_score": 0.0-1.0,
    "missing_items": ["items NOT in shopping list"],
    "incorrectly_combined": ["items with wrong totals"],
    "phantom_items": ["items not in any recipe"],
    "reasoning": "explanation"
}}"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content
        start = content.find('{')
        end = content.rfind('}') + 1

        if start == -1:
            raise ValueError("No JSON found in LLM response")

        result = json.loads(content[start:end])

        # Validate required fields
        required_fields = ['completeness_score', 'combination_score', 'precision_score']
        for field in required_fields:
            if field not in result:
                result[field] = 0.5  # Default to middle score if missing

    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse LLM JSON response: {e}")
        print(f"Response content: {content if 'content' in locals() else 'N/A'}")
        result = {
            "completeness_score": 0.0,
            "combination_score": 0.0,
            "precision_score": 0.0,
            "missing_items": ["ERROR: Failed to parse evaluation"],
            "error": str(e)
        }
    except Exception as e:
        print(f"ERROR: Shopping completeness evaluation failed: {e}")
        result = {
            "completeness_score": 0.0,
            "combination_score": 0.0,
            "precision_score": 0.0,
            "missing_items": ["ERROR: Evaluation failed"],
            "error": str(e)
        }

    missing_count = len(result.get("missing_items", []))

    # Completeness is CRITICAL - any missing item is a failure
    if missing_count > 0:
        final_score = 0.0
        passed = False
    else:
        final_score = (
            result.get("completeness_score", 0) * 0.6 +
            result.get("combination_score", 0) * 0.3 +
            result.get("precision_score", 0) * 0.1
        )
        passed = final_score >= 0.8

    return {
        "score": round(final_score, 3),
        "passed": passed,
        "missingItems": result.get("missing_items", []),
        "incorrectlyCombined": result.get("incorrectly_combined", []),
        "phantomItems": result.get("phantom_items", []),
        "totalIngredientsNeeded": len(all_meal_ingredients),
        "totalShoppingItems": len(shopping_items),
        "reasoning": result.get("reasoning", "")
    }


def aggregate_ingredients(meal_plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Aggregate ingredients from all meals in a plan.
    Combines similar ingredients and sums quantities.
    Uses normalized names and units for better combining.
    """

    # Dictionary to store aggregated ingredients
    # Key: normalized ingredient name + normalized unit, Value: aggregated data
    aggregated: Dict[str, Dict[str, Any]] = {}

    for day in meal_plan.get('days', []):
        for meal in day.get('meals', []):
            recipe_name = meal.get('recipeName', 'Unknown')

            for ing in meal.get('ingredients', []):
                original_name = ing.get('name', '')
                name_normalized = normalize_ingredient_name(original_name)
                amount = ing.get('amount') or 0
                original_unit = ing.get('unit') or ''
                unit_normalized = normalize_unit(original_unit)
                category = ing.get('category', '')

                # Infer category if missing or 'other'
                if not category or category == 'other':
                    category = infer_category(original_name)

                # Create a key for grouping (normalized name + normalized unit)
                key = f"{name_normalized}|{unit_normalized}"

                if key in aggregated:
                    aggregated[key]['amount'] += amount
                    aggregated[key]['fromRecipes'].append(recipe_name)
                else:
                    # Use normalized unit for consistency with LLM evaluation
                    # If unit is empty or just whitespace, keep it empty
                    display_unit = unit_normalized if unit_normalized.strip() else original_unit

                    aggregated[key] = {
                        'name': original_name,  # Keep original casing for display
                        'amount': amount,
                        'unit': display_unit,  # Use normalized unit for consistency
                        'category': category,
                        'fromRecipes': [recipe_name],
                        'checked': False
                    }

    # Convert to list and add IDs
    result = []
    for i, (_, item) in enumerate(aggregated.items()):
        item['id'] = f"item-{i}"
        # Remove duplicate recipe names
        item['fromRecipes'] = list(set(item['fromRecipes']))
        result.append(item)

    # Sort by category
    category_order = ['produce', 'dairy', 'meat', 'pantry', 'spices', 'frozen', 'other']
    result.sort(key=lambda x: (
        category_order.index(x['category']) if x['category'] in category_order else 999,
        x['name']
    ))

    return result
