#!/usr/bin/env python3
"""MealMind Opik Experiment Runner.

Runs batch evaluations across registered Opik datasets, comparing prompt
variants, temperatures, and model configurations.  Every run creates an
Opik experiment visible in the dashboard leaderboard.

Usage:
    # Run all experiment suites (baseline only)
    python -m _lib.evaluation.run_experiments

    # Run a specific suite
    python -m _lib.evaluation.run_experiments --suite dietary_compliance

    # Compare prompt variants for meal generation (1 sample each to save quota)
    python -m _lib.evaluation.run_experiments --suite meal_generation --compare-variants --samples 1

    # Run with a specific variant / temperature / model
    python -m _lib.evaluation.run_experiments --suite meal_generation --variant safety_first
    python -m _lib.evaluation.run_experiments --suite recipe_extraction --temperature 0.1

    # Temperature sweep (2 temps instead of 4 to save quota)
    python -m _lib.evaluation.run_experiments --suite meal_generation --compare-temps --samples 1
"""

import argparse
import json
import os
import sys
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

import opik
from opik.evaluation import evaluate

from _lib.opik_client import init_opik
from _lib.gemini_client import get_llm
from _lib.evaluation.metrics.opik_metrics import (
    DietaryComplianceMetric,
    MealPlanComplianceMetric,
    VarietyMetric,
    RecipeExtractionMetric,
    ShoppingCompletenessMetric,
    TelegramChatMetric,
)
from _lib.evaluation.prompt_variants import (
    MEAL_PLAN_VARIANTS,
    RECIPE_EXTRACT_VARIANTS,
)


# ── Rate Limit Helper ────────────────────────────────────────────────

RATE_LIMIT_DELAY = 6  # seconds between LLM calls (free tier: 15 RPM)


def _invoke_with_retry(llm, prompt, max_retries=3):
    """Invoke LLM with automatic retry on rate limit (429) errors."""
    for attempt in range(max_retries):
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(llm.ainvoke(prompt))
            time.sleep(RATE_LIMIT_DELAY)  # Pace requests
            return response
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                wait = 30 * (attempt + 1)
                print(f"  Rate limited. Waiting {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
            else:
                raise
        finally:
            loop.close()
    raise Exception("Rate limit exceeded after all retries. Try again later.")


# ── Task Functions ───────────────────────────────────────────────────
#
# Each task function receives a dict (the dataset item's flattened fields)
# and returns a dict that gets passed to the scoring metrics.
#


def make_dietary_compliance_task():
    """Pass-through: metric reads recipe & restrictions from input (no LLM call)."""
    def task(item: Dict[str, Any]) -> Dict[str, Any]:
        return {"recipe": item.get("recipe", {})}
    return task


def make_variety_task():
    """Pass-through: metric reads meal_plan from input (no LLM call)."""
    def task(item: Dict[str, Any]) -> Dict[str, Any]:
        return {"meal_plan": item.get("meal_plan", {})}
    return task


def make_shopping_task():
    """Pass-through for shopping completeness (no LLM call)."""
    def task(item: Dict[str, Any]) -> Dict[str, Any]:
        return {}
    return task


def make_recipe_extraction_task(
    prompt_variant: str = "baseline",
    temperature: float = 0.3,
    model: str = "gemini-2.5-flash",
):
    """Run recipe extraction LLM call with a configurable prompt variant."""
    def task(item: Dict[str, Any]) -> Dict[str, Any]:
        llm = get_llm(temperature=temperature, model=model)
        prompt_template = RECIPE_EXTRACT_VARIANTS.get(
            prompt_variant, RECIPE_EXTRACT_VARIANTS["baseline"]
        )
        prompt = prompt_template.format(content=item.get("source", "")[:8000])

        response = _invoke_with_retry(llm, prompt)

        content = response.content
        start_idx = content.find("{")
        end_idx = content.rfind("}") + 1
        if start_idx == -1:
            return {"recipe": {}, "error": "No JSON in LLM response"}

        try:
            recipe = json.loads(content[start_idx:end_idx])
        except json.JSONDecodeError:
            return {"recipe": {}, "error": "JSON parse failed"}

        return {"recipe": recipe}
    return task


def make_meal_generation_task(
    prompt_variant: str = "baseline",
    temperature: float = 0.7,
    model: str = "gemini-2.5-flash",
):
    """Run full meal plan generation with a configurable prompt variant."""
    def task(item: Dict[str, Any]) -> Dict[str, Any]:
        llm = get_llm(temperature=temperature, model=model)
        prompt_template = MEAL_PLAN_VARIANTS.get(
            prompt_variant, MEAL_PLAN_VARIANTS["baseline"]
        )

        restrictions = item.get("restrictions", [])
        restriction_details = ", ".join(restrictions) if restrictions else "None"

        prompt = prompt_template.format(
            days=item.get("days", 7),
            meals_per_day=", ".join(item.get("meals_per_day", ["breakfast", "lunch", "dinner"])),
            restrictions=", ".join(restrictions) if restrictions else "None",
            favorites=", ".join(item.get("favorites", [])) or "None specified",
            dislikes=", ".join(item.get("dislikes", [])) or "None specified",
            cuisines=", ".join(item.get("cuisines", [])) or "Any cuisine",
            cooking_time=item.get("cooking_time", "any"),
            language="en",
            saved_recipes="No saved recipes - generate all new recipes.",
            start_date=datetime.now().strftime("%Y-%m-%d"),
            restriction_details=restriction_details,
            previous_feedback="",
            recipe_instruction="Generate new creative recipes.",
        )

        response = _invoke_with_retry(llm, prompt)

        content = response.content
        start_idx = content.find("{")
        end_idx = content.rfind("}") + 1
        if start_idx == -1:
            return {"meal_plan": {}, "restrictions": restrictions, "error": "No JSON"}

        try:
            meal_plan = json.loads(content[start_idx:end_idx])
        except json.JSONDecodeError:
            return {"meal_plan": {}, "restrictions": restrictions, "error": "JSON parse failed"}

        return {"meal_plan": meal_plan, "restrictions": restrictions}
    return task


def make_telegram_chat_task(
    temperature: float = 0.7,
    model: str = "gemini-2.5-flash",
):
    """Run Telegram chat simulation with the MealMind assistant prompt."""
    def task(item: Dict[str, Any]) -> Dict[str, Any]:
        llm = get_llm(temperature=temperature, model=model)

        prompt = f"""You are MealMind, a friendly and helpful meal planning assistant in a family Telegram group chat.

TODAY'S MEALS:
{item.get("today_meals", "No meals planned.")}

FULL WEEK PLAN:
{item.get("week_meals", "No plan available.")}

Answer the user's question helpfully and concisely.
Keep responses SHORT and Telegram-friendly (under 200 words).

User's message: {item.get("user_message", "")}"""

        response = _invoke_with_retry(llm, prompt)

        return {"response": response.content}
    return task


# ── Experiment Suite Definitions ─────────────────────────────────────

EXPERIMENT_SUITES = {
    "dietary_compliance": {
        "dataset_name": "mealmind-dietary-compliance",
        "task_factory": make_dietary_compliance_task,
        "metrics": [DietaryComplianceMetric()],
        "supports_variants": False,
        "uses_llm": False,
    },
    "recipe_extraction": {
        "dataset_name": "mealmind-recipe-extraction",
        "task_factory": make_recipe_extraction_task,
        "metrics": [RecipeExtractionMetric()],
        "supports_variants": True,
        "variant_dict": RECIPE_EXTRACT_VARIANTS,
        "uses_llm": True,
    },
    "meal_variety": {
        "dataset_name": "mealmind-meal-variety",
        "task_factory": make_variety_task,
        "metrics": [VarietyMetric()],
        "supports_variants": False,
        "uses_llm": False,
    },
    "shopping_completeness": {
        "dataset_name": "mealmind-shopping-completeness",
        "task_factory": make_shopping_task,
        "metrics": [ShoppingCompletenessMetric()],
        "supports_variants": False,
        "uses_llm": False,
    },
    "meal_generation": {
        "dataset_name": "mealmind-meal-generation",
        "task_factory": make_meal_generation_task,
        "metrics": [MealPlanComplianceMetric(), VarietyMetric()],
        "supports_variants": True,
        "variant_dict": MEAL_PLAN_VARIANTS,
        "uses_llm": True,
    },
    "telegram_chat": {
        "dataset_name": "mealmind-telegram-chat",
        "task_factory": make_telegram_chat_task,
        "metrics": [TelegramChatMetric()],
        "supports_variants": False,
        "uses_llm": True,
    },
}


# ── Runner Functions ─────────────────────────────────────────────────

def run_experiment(
    suite_name: str,
    variant: str = "baseline",
    temperature: Optional[float] = None,
    model: str = "gemini-2.5-flash",
    nb_samples: Optional[int] = None,
):
    """Run a single experiment suite and return the result."""
    init_opik()
    client = opik.Opik()

    suite = EXPERIMENT_SUITES[suite_name]
    dataset = client.get_dataset(name=suite["dataset_name"])

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    experiment_name = f"mealmind-{suite_name}-{variant}-{ts}"

    config = {
        "suite": suite_name,
        "variant": variant,
        "temperature": temperature,
        "model": model,
        "nb_samples": nb_samples,
        "timestamp": ts,
    }

    # Build task function with parameters
    if suite["supports_variants"]:
        kwargs = {"prompt_variant": variant, "model": model}
        if temperature is not None:
            kwargs["temperature"] = temperature
        task_fn = suite["task_factory"](**kwargs)
    else:
        if hasattr(suite["task_factory"], "__code__") and suite["task_factory"].__code__.co_varnames:
            # Factory that accepts keyword args (telegram_chat)
            try:
                kwargs = {}
                if temperature is not None:
                    kwargs["temperature"] = temperature
                kwargs["model"] = model
                task_fn = suite["task_factory"](**kwargs)
            except TypeError:
                task_fn = suite["task_factory"]()
        else:
            task_fn = suite["task_factory"]()

    print(f"\nRunning experiment: {experiment_name}")
    print(f"  Dataset: {suite['dataset_name']}")
    print(f"  Variant: {variant} | Temp: {temperature} | Model: {model}")
    if nb_samples:
        print(f"  Samples: {nb_samples} (limited)")
    if suite.get("uses_llm"):
        print(f"  Note: This suite makes LLM calls (costs API quota)")

    eval_kwargs = dict(
        dataset=dataset,
        task=task_fn,
        scoring_metrics=suite["metrics"],
        experiment_name=experiment_name,
        project_name="mealmind",
        experiment_config=config,
        task_threads=1,  # Sequential to avoid rate limits
    )
    if nb_samples is not None:
        eval_kwargs["nb_samples"] = nb_samples

    result = evaluate(**eval_kwargs)

    print(f"  Done: {experiment_name}")
    return {
        "experiment_name": experiment_name,
        "suite": suite_name,
        "variant": variant,
        "config": config,
    }


def compare_variants(
    suite_name: str,
    variants: Optional[List[str]] = None,
    nb_samples: Optional[int] = None,
):
    """Run the same suite with multiple prompt variants for side-by-side comparison."""
    suite = EXPERIMENT_SUITES[suite_name]
    if not suite.get("supports_variants"):
        print(f"Suite '{suite_name}' does not support prompt variants.")
        return []

    if variants is None:
        all_variants = list(suite.get("variant_dict", {"baseline": ""}).keys())
        # Default to baseline + first alternative only (saves quota)
        variants = all_variants[:2] if len(all_variants) > 2 else all_variants

    # Warn about quota usage
    if suite.get("uses_llm"):
        total_calls = len(variants) * (nb_samples or 2)  # 2 = default dataset size
        print(f"\n  This will make ~{total_calls} LLM calls across {len(variants)} variants.")
        print(f"  Gemini free tier: 15 RPM / ~20 RPD. Use --samples to limit.\n")

    results = []
    for variant in variants:
        print(f"\n{'=' * 60}")
        print(f"  Variant: {variant}")
        print(f"{'=' * 60}")
        result = run_experiment(suite_name, variant=variant, nb_samples=nb_samples)
        results.append(result)

    print(f"\nCompared {len(results)} variants for '{suite_name}'.")
    print("View results in the Opik Experiment Leaderboard.")
    return results


def compare_temperatures(
    suite_name: str,
    temps: Optional[List[float]] = None,
    nb_samples: Optional[int] = None,
):
    """Run experiments at different temperatures to find the sweet spot."""
    if temps is None:
        temps = [0.3, 0.7]  # Just 2 temps by default to save quota

    results = []
    for temp in temps:
        print(f"\n--- Temperature: {temp} ---")
        result = run_experiment(suite_name, temperature=temp, nb_samples=nb_samples)
        results.append(result)

    print(f"\nCompared {len(results)} temperatures for '{suite_name}'.")
    return results


def run_all(nb_samples: Optional[int] = None):
    """Run all experiment suites with baseline settings."""
    for suite_name in EXPERIMENT_SUITES:
        print(f"\n{'=' * 60}")
        print(f"  Suite: {suite_name}")
        print(f"{'=' * 60}")
        run_experiment(suite_name, nb_samples=nb_samples)


# ── CLI ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="MealMind Opik Experiment Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  # No-LLM suites (free, no quota):
  python -m _lib.evaluation.run_experiments --suite dietary_compliance
  python -m _lib.evaluation.run_experiments --suite meal_variety
  python -m _lib.evaluation.run_experiments --suite shopping_completeness

  # LLM suites (uses Gemini quota — use --samples to limit):
  python -m _lib.evaluation.run_experiments --suite meal_generation --samples 1
  python -m _lib.evaluation.run_experiments --suite meal_generation --compare-variants --samples 1
  python -m _lib.evaluation.run_experiments --suite recipe_extraction --variant strict_json --samples 2
""",
    )
    parser.add_argument(
        "--suite",
        choices=list(EXPERIMENT_SUITES.keys()),
        help="Run a specific experiment suite (default: all)",
    )
    parser.add_argument(
        "--variant",
        default="baseline",
        help="Prompt variant to use (default: baseline)",
    )
    parser.add_argument(
        "--compare-variants",
        action="store_true",
        help="Run all prompt variants for the suite and compare",
    )
    parser.add_argument(
        "--compare-temps",
        action="store_true",
        help="Run at multiple temperatures (0.3, 0.7)",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        help="Override LLM temperature",
    )
    parser.add_argument(
        "--model",
        default="gemini-2.5-flash",
        help="Model to use (default: gemini-2.5-flash)",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=None,
        help="Max dataset items to evaluate (saves API quota)",
    )
    args = parser.parse_args()

    # Auto-limit LLM suites to 1 sample by default to protect free tier quota
    samples = args.samples
    if samples is None and args.suite and EXPERIMENT_SUITES.get(args.suite, {}).get("uses_llm"):
        samples = 1
        print(f"  Auto-limiting to 1 sample for LLM suite '{args.suite}' (use --samples N to override).")

    if args.compare_variants and args.suite:
        compare_variants(args.suite, nb_samples=samples)
    elif args.compare_temps and args.suite:
        compare_temperatures(args.suite, nb_samples=samples)
    elif args.suite:
        run_experiment(
            args.suite,
            variant=args.variant,
            temperature=args.temperature,
            model=args.model,
            nb_samples=samples,
        )
    else:
        run_all(nb_samples=samples)


if __name__ == "__main__":
    main()
