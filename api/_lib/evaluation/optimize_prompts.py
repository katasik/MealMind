#!/usr/bin/env python3
"""Automated prompt optimization for MealMind using Opik Agent Optimizer.

Uses MetaPromptOptimizer or FewShotBayesianOptimizer to automatically
improve the meal plan generation prompt.  Every trial is logged to Opik
so you can review the optimization trajectory in the dashboard.

Usage:
    python -m _lib.evaluation.optimize_prompts
    python -m _lib.evaluation.optimize_prompts --optimizer meta_prompt
    python -m _lib.evaluation.optimize_prompts --optimizer few_shot_bayesian
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Any, Dict

import opik
from opik.evaluation.metrics import base_metric, score_result

from _lib.opik_client import init_opik
from _lib.evaluation.metrics.dietary_compliance import check_meal_plan_compliance
from _lib.evaluation.metrics.variety import evaluate_meal_variety


# ── Combined Quality Metric ──────────────────────────────────────────

class MealPlanQualityMetric(base_metric.BaseMetric):
    """Combined quality metric for the optimizer to maximize.

    Scores: 60% dietary compliance + 40% variety.
    """

    def __init__(self, name: str = "meal_plan_quality"):
        super().__init__(name=name)

    def score(self, output: str, input: Any = None,
              **kwargs) -> score_result.ScoreResult:
        input = input or {}

        # Parse the LLM output as JSON
        try:
            start_idx = output.find("{")
            end_idx = output.rfind("}") + 1
            if start_idx == -1:
                raise ValueError("No JSON found")
            meal_plan = json.loads(output[start_idx:end_idx])
        except (json.JSONDecodeError, ValueError) as e:
            return score_result.ScoreResult(
                value=0.0, name=self.name, reason=f"Invalid JSON: {e}"
            )

        restrictions_str = input.get("restrictions", "")
        restrictions = (
            [r.strip() for r in restrictions_str.split(",") if r.strip()]
            if isinstance(restrictions_str, str) else restrictions_str
        )

        loop = asyncio.new_event_loop()
        try:
            compliance = loop.run_until_complete(
                check_meal_plan_compliance(meal_plan, restrictions)
            )
            variety = loop.run_until_complete(evaluate_meal_variety(meal_plan))
        finally:
            loop.close()

        combined = compliance["score"] * 0.6 + variety["score"] * 0.4
        return score_result.ScoreResult(
            value=round(combined, 3),
            name=self.name,
            reason=(
                f"Compliance: {compliance['score']:.2f}, "
                f"Variety: {variety['score']:.2f}"
            ),
        )


# ── Optimization Runner ──────────────────────────────────────────────

def run_meta_prompt_optimization():
    """Use MetaPromptOptimizer to iteratively refine the system prompt."""
    from opik_optimizer import MetaPromptOptimizer, ChatPrompt

    init_opik()
    client = opik.Opik()
    dataset = client.get_dataset(name="mealmind-meal-generation")

    prompt = ChatPrompt(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a meal planning assistant. Create personalized "
                    "weekly meal plans that strictly follow dietary restrictions, "
                    "maximize variety, and balance nutrition. Return ONLY valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create a {days}-day meal plan.\n"
                    "Meals per day: {meals_per_day}\n"
                    "Dietary restrictions (CRITICAL): {restrictions}\n"
                    "Favorite ingredients: {favorites}\n"
                    "Disliked ingredients: {dislikes}\n"
                    "Preferred cuisines: {cuisines}\n"
                ),
            },
        ]
    )

    metric = MealPlanQualityMetric()

    optimizer = MetaPromptOptimizer(
        model="gpt-4o-mini",
        project_name="mealmind-optimization",
        n_threads=1,  # Sequential to avoid rate limits
    )

    result = optimizer.optimize_prompt(
        prompt=prompt,
        dataset=dataset,
        scoring_metrics=[metric],
        n_samples=10,
    )

    result.display()
    print("\nOptimized prompt saved to Opik. View trials in the dashboard.")
    return result


def run_few_shot_bayesian_optimization():
    """Use FewShotBayesianOptimizer for few-shot example selection."""
    from opik_optimizer import FewShotBayesianOptimizer, ChatPrompt

    init_opik()
    client = opik.Opik()
    dataset = client.get_dataset(name="mealmind-meal-generation")

    prompt = ChatPrompt(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a meal planning assistant. Create personalized "
                    "weekly meal plans that strictly follow dietary restrictions, "
                    "maximize variety, and balance nutrition. Return ONLY valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create a {days}-day meal plan.\n"
                    "Meals per day: {meals_per_day}\n"
                    "Dietary restrictions (CRITICAL): {restrictions}\n"
                    "Favorite ingredients: {favorites}\n"
                    "Disliked ingredients: {dislikes}\n"
                    "Preferred cuisines: {cuisines}\n"
                ),
            },
        ]
    )

    metric = MealPlanQualityMetric()

    optimizer = FewShotBayesianOptimizer(
        model="gpt-4o-mini",
        min_examples=1,
        max_examples=3,
        n_threads=1,
        project_name="mealmind-optimization",
        seed=42,
    )

    result = optimizer.optimize_prompt(
        prompt=prompt,
        dataset=dataset,
        scoring_metrics=[metric],
        n_samples=10,
    )

    result.display()
    print("\nOptimized prompt saved to Opik. View trials in the dashboard.")
    return result


# ── CLI ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="MealMind Prompt Optimizer")
    parser.add_argument(
        "--optimizer",
        choices=["meta_prompt", "few_shot_bayesian"],
        default="meta_prompt",
        help="Optimizer algorithm to use (default: meta_prompt)",
    )
    args = parser.parse_args()

    if args.optimizer == "meta_prompt":
        run_meta_prompt_optimization()
    else:
        run_few_shot_bayesian_optimization()


if __name__ == "__main__":
    main()
