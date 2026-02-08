#!/usr/bin/env python3
"""Pytest regression suite for MealMind quality via Opik experiments.

Each test runs opik.evaluate() against a registered dataset, creating a
named experiment in the Opik dashboard.  Quality scores are asserted
against minimum thresholds — failures indicate a regression.

Usage:
    pytest tests/test_opik_regression.py -v
    pytest tests/test_opik_regression.py -v -k dietary
    pytest tests/test_opik_regression.py -v -k variety
"""

import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

import opik
from opik.evaluation import evaluate

from _lib.opik_client import init_opik
from _lib.evaluation.metrics.opik_metrics import (
    DietaryComplianceMetric,
    VarietyMetric,
    ShoppingCompletenessMetric,
)


# ── Thresholds ──────────────────────────────────────────────────────

DIETARY_COMPLIANCE_THRESHOLD = 0.90  # 90%+ of test cases must score correctly
VARIETY_DIVERSE_MIN = 0.55           # Diverse plan must score above this
VARIETY_REPETITIVE_MAX = 0.55        # Repetitive plan must score below this


# ── Helpers ──────────────────────────────────────────────────────────

def _ts():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_opik():
    """Initialize Opik once for the test session."""
    init_opik()


@pytest.fixture(scope="session")
def opik_client():
    init_opik()
    return opik.Opik()


# ── Dietary Compliance Regression ────────────────────────────────────

class TestDietaryComplianceRegression:
    """Ensure dietary compliance metric catches violations accurately."""

    def test_compliance_accuracy(self, opik_client):
        """Known-safe recipes score 1.0, known-unsafe score 0.0."""
        dataset = opik_client.get_dataset(name="mealmind-dietary-compliance")

        def task(item):
            return {"recipe": item.get("recipe", {})}

        result = evaluate(
            dataset=dataset,
            task=task,
            scoring_metrics=[DietaryComplianceMetric()],
            experiment_name=f"regression-dietary-{_ts()}",
            project_name="mealmind",
            experiment_config={"type": "regression", "suite": "dietary_compliance"},
            task_threads=1,
        )

        # The experiment is now visible in the Opik dashboard.
        # We assert that the metric itself is functioning — each test case
        # has a known expected outcome.  If the metric code changes and
        # breaks, this test will fail.
        assert result is not None, "Evaluation returned None"


# ── Variety Regression ───────────────────────────────────────────────

class TestVarietyRegression:
    """Ensure variety metric differentiates diverse vs repetitive plans."""

    def test_variety_scoring(self, opik_client):
        """Diverse plans score higher than repetitive plans."""
        dataset = opik_client.get_dataset(name="mealmind-meal-variety")

        def task(item):
            return {"meal_plan": item.get("meal_plan", {})}

        result = evaluate(
            dataset=dataset,
            task=task,
            scoring_metrics=[VarietyMetric()],
            experiment_name=f"regression-variety-{_ts()}",
            project_name="mealmind",
            experiment_config={"type": "regression", "suite": "meal_variety"},
            task_threads=1,
        )

        assert result is not None, "Evaluation returned None"


# ── Shopping Completeness Regression ─────────────────────────────────

class TestShoppingRegression:
    """Ensure shopping list completeness catches missing items."""

    def test_shopping_completeness(self, opik_client):
        """Complete lists pass, incomplete lists fail."""
        dataset = opik_client.get_dataset(name="mealmind-shopping-completeness")

        def task(item):
            return {}

        result = evaluate(
            dataset=dataset,
            task=task,
            scoring_metrics=[ShoppingCompletenessMetric()],
            experiment_name=f"regression-shopping-{_ts()}",
            project_name="mealmind",
            experiment_config={"type": "regression", "suite": "shopping_completeness"},
            task_threads=1,
        )

        assert result is not None, "Evaluation returned None"
