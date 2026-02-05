"""Meal plan variety evaluation metric.

Evaluates diversity of meal plans using deterministic metrics.
LLM-based excitement/balance scoring runs asynchronously via Opik
online evaluation rules — see setup_opik_rules.py.
"""

from typing import Dict, Any, List
from collections import Counter

# Common protein keywords for diversity checking
PROTEIN_KEYWORDS = [
    "chicken", "beef", "pork", "fish", "tofu", "lamb", "shrimp",
    "turkey", "salmon", "tuna", "eggs", "beans", "lentils", "tempeh"
]


async def evaluate_meal_variety(meal_plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate diversity and excitement of meal plans.
    Combines deterministic metrics with LLM judgment.
    """

    days = meal_plan.get('days', [])

    # Collect data for deterministic metrics
    all_recipes: List[str] = []
    cuisines: List[str] = []
    proteins: List[str] = []
    meal_types_count: Dict[str, int] = Counter()

    for day in days:
        for meal in day.get('meals', []):
            recipe_name = meal.get('recipeName', '')
            all_recipes.append(recipe_name.lower())

            cuisine = meal.get('cuisine', 'unknown')
            cuisines.append(cuisine.lower())

            meal_types_count[meal.get('mealType', 'unknown')] += 1

            # Extract proteins from ingredients
            for ing in meal.get('ingredients', []):
                name = ing.get('name', '').lower()
                for protein in PROTEIN_KEYWORDS:
                    if protein in name:
                        proteins.append(protein)
                        break

    # Calculate deterministic scores
    total_recipes = len(all_recipes) or 1
    unique_recipes = len(set(all_recipes))
    recipe_uniqueness = unique_recipes / total_recipes

    unique_cuisines = len(set(cuisines))
    cuisine_diversity = min(unique_cuisines / 3, 1.0)  # 3+ cuisines = perfect (more realistic)

    unique_proteins = len(set(proteins))
    protein_diversity = min(unique_proteins / 3, 1.0)  # 3+ proteins = perfect (more realistic)

    # Check for repetition (same meal on consecutive days)
    repetition_penalty = 0
    for i in range(len(all_recipes) - 1):
        if all_recipes[i] == all_recipes[i + 1]:
            repetition_penalty += 0.1

    # Deterministic score (LLM refinement runs async via Opik online rules)
    deterministic_score = (
        recipe_uniqueness * 0.4 +
        cuisine_diversity * 0.3 +
        protein_diversity * 0.3
    ) - repetition_penalty

    final_score = max(0, min(1, deterministic_score))

    return {
        "score": round(final_score, 3),
        "passed": final_score >= 0.55,
        "deterministic": {
            "recipeUniqueness": round(recipe_uniqueness, 3),
            "cuisineDiversity": round(cuisine_diversity, 3),
            "proteinDiversity": round(protein_diversity, 3),
            "uniqueRecipes": unique_recipes,
            "totalRecipes": total_recipes,
            "uniqueCuisines": unique_cuisines,
            "uniqueProteins": unique_proteins,
            "repetitionPenalty": round(repetition_penalty, 3)
        }
    }
