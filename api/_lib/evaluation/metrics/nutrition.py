"""Nutritional balance evaluation metric.

No deterministic proxy exists for nutrition — scoring runs asynchronously
via Opik online evaluation rules using GPT-4o-mini.  See setup_opik_rules.py.

The synchronous check returns a neutral pass so that meal plans are not
blocked on an async metric.  The real score appears in the Opik dashboard.
"""

from typing import Dict, Any


async def evaluate_nutrition(meal_plan: Dict[str, Any]) -> Dict[str, Any]:
    """Return a neutral placeholder; real scoring runs via Opik online rules."""
    return {
        "score": 1.0,
        "passed": True,
        "note": "Nutrition scoring runs asynchronously via Opik online evaluation rules"
    }
