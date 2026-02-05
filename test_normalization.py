#!/usr/bin/env python3
"""Test normalization functions without requiring LLM dependencies."""

import sys
import os

# Add api directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

# Import just the normalization functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api/_lib/evaluation/metrics'))

def normalize_unit(unit: str) -> str:
    """Normalize unit names for consistent aggregation."""
    unit = unit.lower().strip()
    unit_singular = unit.rstrip('s')
    unit_map = {
        'tbsp': 'tablespoon', 'tsp': 'teaspoon', 'oz': 'ounce',
        'lb': 'pound', 'qt': 'quart', 'pt': 'pint', 'gal': 'gallon',
        'ml': 'milliliter', 'l': 'liter', 'g': 'gram',
        'kg': 'kilogram', 'c': 'cup'
    }
    normalized = unit_map.get(unit_singular, unit_singular)
    if normalized == unit_singular and unit in unit_map:
        normalized = unit_map[unit]
    return normalized

def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient names for consistent aggregation."""
    name = name.lower().strip()
    name = name.replace('fresh ', '').replace('dried ', '')
    name = name.replace('chopped ', '').replace('diced ', '')
    name = name.replace('minced ', '').replace('sliced ', '')
    singular_map = {
        'eggs': 'egg', 'onions': 'onion', 'tomatoes': 'tomato',
        'potatoes': 'potato', 'carrots': 'carrot', 'cloves': 'clove',
        'bananas': 'banana', 'apples': 'apple'
    }
    name = singular_map.get(name, name)
    return name


def test_normalization():
    """Test normalization functions."""
    print("=" * 80)
    print("TESTING NORMALIZATION FUNCTIONS")
    print("=" * 80)

    test_cases = [
        # Ingredient name tests
        ("fresh basil", "basil"),
        ("basil", "basil"),
        ("Fresh Basil", "basil"),
        ("chopped onions", "onion"),
        ("onion", "onion"),
        ("eggs", "egg"),
        ("egg", "egg"),
        ("Eggs", "egg"),
        ("fresh chopped tomatoes", "tomato"),
    ]

    print("\nIngredient Name Normalization Tests:")
    passed = 0
    failed = 0
    for input_val, expected in test_cases:
        result = normalize_ingredient_name(input_val)
        status = "✅" if result == expected else "❌"
        if result == expected:
            passed += 1
        else:
            failed += 1
        print(f"  {status} '{input_val}' → '{result}' (expected: '{expected}')")

    unit_tests = [
        ("tbsp", "tablespoon"),
        ("tablespoon", "tablespoon"),
        ("tablespoons", "tablespoon"),
        ("tsp", "teaspoon"),
        ("teaspoon", "teaspoon"),
        ("cups", "cup"),
        ("cup", "cup"),
        ("oz", "ounce"),
        ("ounce", "ounce"),
        ("", ""),
        ("large", "large"),
    ]

    print("\nUnit Normalization Tests:")
    for input_val, expected in unit_tests:
        result = normalize_unit(input_val)
        status = "✅" if result == expected else "❌"
        if result == expected:
            passed += 1
        else:
            failed += 1
        print(f"  {status} '{input_val}' → '{result}' (expected: '{expected}')")

    print("\n" + "=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 80)

    # Test aggregation logic
    print("\n\nTesting Aggregation Logic:")
    print("=" * 80)

    # Simulate a meal plan with duplicate ingredients
    meal_ingredients = [
        {"name": "eggs", "amount": 2, "unit": "large"},
        {"name": "butter", "amount": 1, "unit": "tbsp"},
        {"name": "Eggs", "amount": 3, "unit": "large"},  # Should combine with first
        {"name": "butter", "amount": 2, "unit": "tablespoon"},  # Should combine
        {"name": "fresh basil", "amount": 1, "unit": "cup"},
        {"name": "basil", "amount": 0.5, "unit": "cup"},  # Should combine
    ]

    # Simulate aggregation
    aggregated = {}
    for ing in meal_ingredients:
        name_norm = normalize_ingredient_name(ing["name"])
        unit_norm = normalize_unit(ing["unit"])
        key = f"{name_norm}|{unit_norm}"

        if key in aggregated:
            aggregated[key]["amount"] += ing["amount"]
            print(f"  ✅ Combined: {ing['name']} ({ing['amount']} {ing['unit']}) added to existing {key}")
        else:
            aggregated[key] = {
                "name": ing["name"],
                "amount": ing["amount"],
                "unit": ing["unit"]
            }
            print(f"  ➕ New: {key} = {ing['amount']} {ing['unit']} {ing['name']}")

    print("\nFinal Aggregated List:")
    for key, item in aggregated.items():
        print(f"  - {item['amount']} {item['unit']} {item['name']}")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    test_normalization()
