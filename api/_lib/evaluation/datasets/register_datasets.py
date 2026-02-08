#!/usr/bin/env python3
"""Register MealMind evaluation datasets in Opik Cloud.

Reads test_cases.json and creates Opik datasets for use with opik.evaluate().
Also creates end-to-end generation and Telegram chat datasets.

Usage:
    OPIK_API_KEY=<key> OPIK_WORKSPACE=<ws> python -m _lib.evaluation.datasets.register_datasets
"""

import json
import os
import sys

import opik


def register_all():
    """Register all evaluation datasets in Opik."""
    api_key = os.environ.get("OPIK_API_KEY")
    workspace = os.environ.get("OPIK_WORKSPACE")
    if not api_key or not workspace:
        sys.exit("OPIK_API_KEY and OPIK_WORKSPACE must be set.")

    opik.configure(api_key=api_key, workspace=workspace)
    client = opik.Opik()

    datasets_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(datasets_dir, "test_cases.json")) as f:
        test_cases = json.load(f)

    # --- dietary_compliance ---
    ds = client.get_or_create_dataset(
        name="mealmind-dietary-compliance",
        description="Dietary restriction compliance test cases for meal recipes",
    )
    ds.clear()
    items = []
    for tc in test_cases["dietary_compliance"]:
        items.append({
            "input": {
                "recipe": tc["recipe"],
                "restrictions": tc["restrictions"],
            },
            "expected_output": tc["expected"],
            "metadata": {"test_name": tc["name"]},
        })
    ds.insert(items)
    print(f"[dietary_compliance] {len(items)} items registered")

    # --- recipe_extraction ---
    ds = client.get_or_create_dataset(
        name="mealmind-recipe-extraction",
        description="Recipe extraction accuracy from text/URL/PDF sources",
    )
    ds.clear()
    items = []
    for tc in test_cases["recipe_extraction"]:
        items.append({
            "input": {
                "source": tc["source"],
                "source_type": tc["sourceType"],
            },
            "expected_output": tc["expectedFields"],
            "metadata": {"test_name": tc["name"]},
        })
    ds.insert(items)
    print(f"[recipe_extraction] {len(items)} items registered")

    # --- meal_variety ---
    ds = client.get_or_create_dataset(
        name="mealmind-meal-variety",
        description="Meal plan variety and diversity evaluation",
    )
    ds.clear()
    items = []
    for tc in test_cases["meal_variety"]:
        items.append({
            "input": {"meal_plan": tc["mealPlan"]},
            "expected_output": {
                "min_score": tc.get("expectedMinScore"),
                "max_score": tc.get("expectedMaxScore"),
            },
            "metadata": {"test_name": tc["name"]},
        })
    ds.insert(items)
    print(f"[meal_variety] {len(items)} items registered")

    # --- shopping_completeness ---
    ds = client.get_or_create_dataset(
        name="mealmind-shopping-completeness",
        description="Shopping list completeness verification",
    )
    ds.clear()
    items = []
    for tc in test_cases["shopping_completeness"]:
        items.append({
            "input": {
                "meal_plan": tc["mealPlan"],
                "shopping_list": tc["shoppingList"],
            },
            "expected_output": {
                "passed": tc["expectedPassed"],
                "missing": tc.get("expectedMissing", []),
            },
            "metadata": {"test_name": tc["name"]},
        })
    ds.insert(items)
    print(f"[shopping_completeness] {len(items)} items registered")

    # --- meal_generation (end-to-end) ---
    ds = client.get_or_create_dataset(
        name="mealmind-meal-generation",
        description="End-to-end meal plan generation test scenarios",
    )
    ds.clear()
    items = _build_generation_dataset()
    ds.insert(items)
    print(f"[meal_generation] {len(items)} items registered")

    # --- telegram_chat ---
    ds = client.get_or_create_dataset(
        name="mealmind-telegram-chat",
        description="Telegram AI chat quality evaluation",
    )
    ds.clear()
    items = _build_telegram_dataset()
    ds.insert(items)
    print(f"[telegram_chat] {len(items)} items registered")

    print("\nAll datasets registered in Opik Cloud.")


def _build_generation_dataset():
    """Build test scenarios for full meal plan generation experiments.

    Kept small (2 items, 3-day plans) to minimize Gemini API quota usage.
    """
    return [
        {
            "input": {
                "days": 3,
                "meals_per_day": ["breakfast", "dinner"],
                "restrictions": ["gluten-free", "dairy-free"],
                "favorites": ["chicken", "rice"],
                "dislikes": ["mushrooms"],
                "cuisines": ["Italian", "Mexican"],
                "cooking_time": "any",
            },
            "expected_output": {
                "min_compliance": 1.0,
                "min_variety": 0.5,
                "min_overall": 0.65,
            },
            "metadata": {"test_name": "GF+DF 3-day plan"},
        },
        {
            "input": {
                "days": 3,
                "meals_per_day": ["breakfast", "dinner"],
                "restrictions": ["vegan"],
                "favorites": ["tofu", "lentils"],
                "dislikes": [],
                "cuisines": ["Indian", "Thai"],
                "cooking_time": "any",
            },
            "expected_output": {
                "min_compliance": 1.0,
                "min_variety": 0.5,
                "min_overall": 0.65,
            },
            "metadata": {"test_name": "Vegan 3-day plan"},
        },
    ]


def _build_telegram_dataset():
    """Build test scenarios for Telegram chat quality evaluation."""
    return [
        {
            "input": {
                "user_message": "What's for dinner tonight?",
                "today_meals": "breakfast: Oatmeal, lunch: Caesar Salad, dinner: Pasta Primavera",
                "week_meals": "Full week plan available",
            },
            "expected_output": {
                "should_mention": "Pasta Primavera",
                "should_be_helpful": True,
            },
            "metadata": {"test_name": "Dinner query with plan"},
        },
        {
            "input": {
                "user_message": "What ingredients do I need for lunch?",
                "today_meals": "lunch: Chicken Tacos (chicken breast, tortillas, lettuce, salsa, cheese)",
                "week_meals": "Full week plan available",
            },
            "expected_output": {
                "should_mention": "chicken",
                "should_be_helpful": True,
            },
            "metadata": {"test_name": "Ingredients query"},
        },
    ]


if __name__ == "__main__":
    register_all()
