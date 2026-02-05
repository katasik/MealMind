#!/usr/bin/env python3
"""Test shopping list evaluation with the test cases."""

import asyncio
import json
import sys
import os

# Add api directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

from _lib.evaluation.metrics.shopping_completeness import (
    evaluate_shopping_completeness,
    aggregate_ingredients,
    normalize_ingredient_name,
    normalize_unit,
    deterministic_completeness_check
)


async def test_shopping_completeness():
    """Test shopping completeness evaluation with test cases."""

    # Load test cases
    with open('api/_lib/evaluation/datasets/test_cases.json', 'r') as f:
        test_cases = json.load(f)

    shopping_tests = test_cases.get('shopping_completeness', [])

    print("=" * 80)
    print("TESTING SHOPPING LIST COMPLETENESS EVALUATION")
    print("=" * 80)

    for i, test in enumerate(shopping_tests, 1):
        print(f"\n--- Test {i}: {test['name']} ---")
        print(f"Expected to pass: {test.get('expectedPassed', 'N/A')}")

        meal_plan = test['mealPlan']
        shopping_list = test['shoppingList']

        # Show what we're testing
        print("\nMeal ingredients:")
        for day in meal_plan.get('days', []):
            for meal in day.get('meals', []):
                print(f"  {meal['recipeName']}:")
                for ing in meal.get('ingredients', []):
                    print(f"    - {ing.get('amount', '')} {ing.get('unit', '')} {ing.get('name', '')}")

        print("\nShopping list:")
        for item in shopping_list.get('items', []):
            print(f"  - {item.get('amount', '')} {item.get('unit', '')} {item.get('name', '')}")

        # Test aggregation
        print("\n[Testing aggregation...]")
        aggregated = aggregate_ingredients(meal_plan)
        print(f"Aggregated items ({len(aggregated)}):")
        for item in aggregated:
            print(f"  - {item['amount']} {item['unit']} {item['name']} [{item['category']}]")

        # Test evaluation
        print("\n[Testing evaluation...]")
        try:
            result = await evaluate_shopping_completeness(meal_plan, shopping_list)

            print(f"\nRESULTS:")
            print(f"  Score: {result['score']}")
            print(f"  Passed: {result['passed']}")
            print(f"  Missing items: {result.get('missingItems', [])}")
            print(f"  Incorrectly combined: {result.get('incorrectlyCombined', [])}")
            print(f"  Phantom items: {result.get('phantomItems', [])}")
            print(f"  Reasoning: {result.get('reasoning', 'N/A')}")

            # Check if result matches expectation
            expected_pass = test.get('expectedPassed', None)
            if expected_pass is not None:
                if result['passed'] == expected_pass:
                    print(f"\n✅ TEST PASSED (matched expectation: {expected_pass})")
                else:
                    print(f"\n❌ TEST FAILED (expected: {expected_pass}, got: {result['passed']})")

        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 80)


def test_normalization():
    """Test normalization functions."""
    print("\n" + "=" * 80)
    print("TESTING NORMALIZATION FUNCTIONS")
    print("=" * 80)

    test_ingredients = [
        "fresh basil",
        "basil",
        "Fresh Basil",
        "chopped onions",
        "onion",
        "eggs",
        "egg",
        "2 eggs"
    ]

    print("\nIngredient name normalization:")
    for ing in test_ingredients:
        normalized = normalize_ingredient_name(ing)
        print(f"  '{ing}' → '{normalized}'")

    test_units = [
        "tbsp",
        "tablespoon",
        "tablespoons",
        "tsp",
        "teaspoon",
        "cups",
        "cup",
        "oz",
        "ounce",
        ""
    ]

    print("\nUnit normalization:")
    for unit in test_units:
        normalized = normalize_unit(unit)
        print(f"  '{unit}' → '{normalized}'")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    # Test normalization first
    test_normalization()

    # Then test shopping completeness
    asyncio.run(test_shopping_completeness())
