"""Opik BaseMetric wrappers for MealMind evaluation metrics.

These wrap the existing async evaluation functions into the opik.evaluate()
scoring_metrics interface, allowing them to be used in Opik experiments.
"""

import asyncio
from typing import Any, List

from opik.evaluation.metrics import base_metric, score_result

from .dietary_compliance import evaluate_dietary_compliance, check_meal_plan_compliance
from .variety import evaluate_meal_variety
from .recipe_extraction import evaluate_recipe_extraction
from .shopping_completeness import evaluate_shopping_completeness


def _run_async(coro):
    """Run an async coroutine from sync context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class DietaryComplianceMetric(base_metric.BaseMetric):
    """Single-recipe dietary compliance check."""

    def __init__(self, name: str = "dietary_compliance"):
        super().__init__(name=name)

    def score(self, output: Any = None, input: Any = None,
              **ignored_kwargs) -> score_result.ScoreResult:
        input = input or {}
        output = output or {}
        recipe = output.get("recipe") or input.get("recipe", {})
        restrictions = input.get("restrictions", [])

        result = _run_async(evaluate_dietary_compliance(recipe, restrictions))

        return score_result.ScoreResult(
            value=result["score"],
            name=self.name,
            reason=f"Violations: {result.get('violations', [])}",
        )


class MealPlanComplianceMetric(base_metric.BaseMetric):
    """Full meal plan dietary compliance check."""

    def __init__(self, name: str = "meal_plan_compliance"):
        super().__init__(name=name)

    def score(self, output: Any = None, input: Any = None,
              **ignored_kwargs) -> score_result.ScoreResult:
        output = output or {}
        input = input or {}
        meal_plan = output.get("meal_plan", {})
        restrictions = output.get("restrictions") or input.get("restrictions", [])

        result = _run_async(check_meal_plan_compliance(meal_plan, restrictions))

        return score_result.ScoreResult(
            value=result["score"],
            name=self.name,
            reason=(
                f"Compliance rate: {result.get('complianceRate', 0):.0%}, "
                f"violations: {len(result.get('violations', []))}"
            ),
        )


class VarietyMetric(base_metric.BaseMetric):
    """Meal plan variety and diversity evaluation."""

    def __init__(self, name: str = "variety"):
        super().__init__(name=name)

    def score(self, output: Any = None, input: Any = None,
              **ignored_kwargs) -> score_result.ScoreResult:
        output = output or {}
        input = input or {}
        meal_plan = output.get("meal_plan") or input.get("meal_plan", {})

        result = _run_async(evaluate_meal_variety(meal_plan))

        det = result.get("deterministic", {})
        return score_result.ScoreResult(
            value=result["score"],
            name=self.name,
            reason=(
                f"Unique recipes: {det.get('uniqueRecipes', '?')}/{det.get('totalRecipes', '?')}, "
                f"cuisines: {det.get('uniqueCuisines', '?')}, proteins: {det.get('uniqueProteins', '?')}"
            ),
        )


class RecipeExtractionMetric(base_metric.BaseMetric):
    """Recipe extraction quality via dual LLM-as-Judge."""

    def __init__(self, name: str = "recipe_extraction"):
        super().__init__(name=name)

    def score(self, output: Any = None, input: Any = None,
              **ignored_kwargs) -> List[score_result.ScoreResult]:
        input = input or {}
        output = output or {}
        source = input.get("source", "")
        source_type = input.get("source_type", "text")
        recipe = output.get("recipe", {})

        result = _run_async(
            evaluate_recipe_extraction(source, recipe, source_type)
        )

        return [
            score_result.ScoreResult(
                value=result["score"],
                name=self.name,
                reason=result.get("reasoning", ""),
            ),
            score_result.ScoreResult(
                value=0.0 if result.get("hallucinationsDetected") else 1.0,
                name="hallucination_free",
                reason=f"Judges agree: {result.get('judgesAgree', False)}",
            ),
        ]


class ShoppingCompletenessMetric(base_metric.BaseMetric):
    """Shopping list completeness verification."""

    def __init__(self, name: str = "shopping_completeness"):
        super().__init__(name=name)

    def score(self, input: Any = None,
              **ignored_kwargs) -> score_result.ScoreResult:
        input = input or {}
        meal_plan = input.get("meal_plan", {})
        shopping_list = input.get("shopping_list", {})

        result = _run_async(
            evaluate_shopping_completeness(meal_plan, shopping_list)
        )

        return score_result.ScoreResult(
            value=result["score"],
            name=self.name,
            reason=f"Missing: {result.get('missingItems', [])}",
        )


class TelegramChatMetric(base_metric.BaseMetric):
    """Deterministic quality scorer for Telegram chat responses."""

    def __init__(self, name: str = "chat_quality"):
        super().__init__(name=name)

    def score(self, output: Any = None, input: Any = None,
              expected_output: Any = None,
              **ignored_kwargs) -> List[score_result.ScoreResult]:
        output = output or {}
        input = input or {}
        expected_output = expected_output or {}

        response = output.get("response", "")
        should_mention = expected_output.get("should_mention", "")

        scores = []

        # Relevance: does the response mention expected content?
        relevance = 1.0 if should_mention and should_mention.lower() in response.lower() else 0.0
        scores.append(score_result.ScoreResult(
            value=relevance,
            name="chat_relevance",
            reason=f"Expected '{should_mention}' in response",
        ))

        # Helpfulness: length and structure check
        word_count = len(response.split())
        helpfulness = 1.0 if 10 <= word_count <= 200 else 0.5
        scores.append(score_result.ScoreResult(
            value=helpfulness,
            name="chat_helpfulness",
            reason=f"Response length: {word_count} words",
        ))

        return scores
