"""Create Opik online evaluation rules for MealMind.

Run once after initial deployment to register the LLM-as-Judge rules
that score every meal-generation trace automatically:

    OPIK_API_KEY=<key> OPIK_WORKSPACE=<workspace> python -m _lib.setup_opik_rules

Rules created (all use opik-free-model, 100 % sampling):
    dietary_compliance  – flags real allergen violations in the meal plan
    variety             – evaluates recipe / cuisine / protein diversity
    nutrition           – evaluates nutritional balance across the week
"""

import os
import sys
import json

import opik
from opik.rest_api.client import OpikApi
from opik.rest_api.types import (
    AutomationRuleEvaluatorWrite_LlmAsJudge,
    LlmAsJudgeCodeWrite,
    LlmAsJudgeModelParametersWrite,
    LlmAsJudgeMessageWrite,
    LlmAsJudgeOutputSchemaWrite,
    TraceFilterWrite,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _client() -> OpikApi:
    api_key = os.environ.get("OPIK_API_KEY")
    workspace = os.environ.get("OPIK_WORKSPACE")
    if not api_key or not workspace:
        sys.exit("OPIK_API_KEY and OPIK_WORKSPACE must be set.")
    # OpikApiEnvironment.DEFAULT points to localhost (self-hosted).
    # Override to Opik Cloud unless a custom URL is set.
    base_url = os.environ.get("OPIK_URL", "https://www.comet.com/opik/api")
    return OpikApi(api_key=api_key, workspace_name=workspace, base_url=base_url)


def _project_id(client: OpikApi, name: str = "mealmind") -> str:
    """Look up the project ID by name."""
    page = client.projects.find_projects(name=name)
    projects = page.content if hasattr(page, "content") else []
    for p in projects:
        if (getattr(p, "name", "") or "").lower() == name.lower():
            return p.id
    sys.exit(f"Project '{name}' not found in workspace. "
             "Create it in the Opik dashboard first.")


def _model() -> LlmAsJudgeModelParametersWrite:
    return LlmAsJudgeModelParametersWrite(name="opik-free-model", temperature=0)


def _delete_existing(client: OpikApi, project_id: str, name: str) -> bool:
    """Delete an existing rule by name. Returns True if one was deleted."""
    page = client.automation_rule_evaluators.find_evaluators(
        project_id=project_id, name=name
    )
    items = page.content if hasattr(page, "content") else []
    ids = [e.id for e in items if (getattr(e, "name", "") or "") == name]
    if ids:
        client.automation_rule_evaluators.delete_automation_rule_evaluator_batch(
            ids=ids, project_id=project_id
        )
        return True
    return False


# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------

DIETARY_COMPLIANCE_PROMPT = """\
You are a food safety checker. Your ONLY job is to find REAL allergen violations.

DIETARY RESTRICTIONS: {{restrictions}}

MEAL PLAN (JSON):
{{meal_plan}}

Go through every recipe and every ingredient. Flag an ingredient ONLY if it \
genuinely violates a listed restriction. Common mistakes to avoid:
- Eggs are NOT dairy.  They are safe for dairy-free diets.
- Eggs ARE safe for diabetic-friendly diets (high protein, low carb).
- ANY plant-based milk is NOT dairy. This includes: almond milk, coconut milk, \
oat milk, soy milk, rice milk, cashew milk, hemp milk — with ANY modifier \
(unsweetened, full-fat, light, vanilla, etc.). These are ALL dairy-free.
- Coconut cream and coconut yogurt are NOT dairy.
- Plant-based butters (peanut butter, almond butter, coconut butter) are NOT dairy.
- Olive oil and coconut oil are fine for diabetic-friendly diets.
- "Diabetic-friendly" only restricts added sugar and refined carbs; whole foods are fine.
- Hidden allergens to watch: worcestershire sauce (fish), regular soy sauce (gluten).

Score the meal plan:
- 1.0 if fully compliant with all dietary restrictions (no real violations)
- 0.0 if any real allergen violation is found

List any violations you find as part of your reasoning.
"""

VARIETY_PROMPT = """\
Evaluate this weekly meal plan for variety and diversity.

MEAL PLAN (JSON):
{{meal_plan}}

CRITICAL: Base your evaluation ONLY on what is ACTUALLY present in the JSON above. \
Do NOT assume or guess about ingredients or recipes. Read the meal plan carefully.

Analyze these dimensions (0.0 – 1.0):
- protein_diversity:  Count ONLY the distinct protein sources you ACTUALLY FIND in the ingredients list. \
  Examples: chicken, beef, tofu, eggs, chickpeas. DO NOT count "absence of X" or "lack of Y" as proteins. \
  Only count what is present. (3+ actual proteins = 0.8+)
- cuisine_diversity:  Count ACTUAL cuisines listed in the recipes (3+ = 0.8+)
- recipe_uniqueness:  Calculate ACTUAL fraction of unique recipe names (90%+ = 0.9+)
- cooking_methods:    Infer from ACTUAL cooking instructions (4+ methods = 0.8+)

Leftovers used at lunch are normal — do NOT penalize them.

In your reasoning, CITE SPECIFIC EXAMPLES from the meal plan with counts: \
"Found 3 distinct proteins: chicken (appears in 2 recipes), chickpeas (1 recipe), eggs (1 recipe)". \
DO NOT include negatives like "no beef" in your protein count.

Provide an overall variety score (0.0-1.0) where 0.7+ means good diversity.
"""

NUTRITION_PROMPT = """\
You are a nutritionist evaluating a weekly meal plan.

MEAL PLAN (JSON):
{{meal_plan}}

CRITICAL: Base your evaluation ONLY on what is ACTUALLY present in the JSON above. \
Read the ingredients and recipes carefully. Do NOT assume or hallucinate content.

Analyze these dimensions (0.0 – 1.0) based on healthy-eating guidelines:
- protein_adequacy:     50-100 g/day target. Count ACTUAL protein sources in ingredients.
- vegetable_adequacy:   3-5 servings/day. Count ACTUAL vegetables in ingredients.
- fruit_adequacy:       2-3 servings/day. Count ACTUAL fruits in ingredients.
- fiber_adequacy:       Look for ACTUAL whole grains, legumes, vegetables in ingredients.

Be fair — do not penalise whole foods or normal home cooking.

In your reasoning, CITE SPECIFIC INGREDIENTS you found (e.g., "broccoli appears 3 times"). \
Provide an overall nutrition score (0.0-1.0) where 0.7+ means a healthy varied plan.
"""


def _make_rule(
    name: str,
    project_id: str,
    system_prompt: str,
    user_prompt: str,
    variables: dict,
    schema: list,
) -> AutomationRuleEvaluatorWrite_LlmAsJudge:
    """Build an LlmAsJudge evaluator write object."""
    return AutomationRuleEvaluatorWrite_LlmAsJudge(
        name=name,
        project_id=project_id,
        action="evaluator",
        sampling_rate=1.0,
        enabled=True,
        filters=None,  # Run on all traces in the project
        code=LlmAsJudgeCodeWrite(
            model=_model(),
            messages=[
                LlmAsJudgeMessageWrite(role="SYSTEM", content=system_prompt),
                LlmAsJudgeMessageWrite(role="USER", content=user_prompt),
            ],
            variables=variables,
            schema_=schema,
        ),
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    client = _client()
    project_id = _project_id(client)
    print(f"Project ID: {project_id}")

    # --- Dietary compliance ---
    _delete_existing(client, project_id, "dietary_compliance")
    rule = _make_rule(
        name="dietary_compliance",
        project_id=project_id,
        system_prompt="You are a food safety checker. Only flag REAL allergen violations — never guess.",
        user_prompt=DIETARY_COMPLIANCE_PROMPT,
        variables={
            "restrictions": "output.restrictions",
            "meal_plan": "output.meal_plan",
        },
        schema=[
            LlmAsJudgeOutputSchemaWrite(
                name="dietary_compliance",
                type="DOUBLE",
                description="1.0 if the meal plan is fully compliant with all dietary restrictions, 0.0 if any real violation is found.",
            ),
        ],
    )
    client.automation_rule_evaluators.create_automation_rule_evaluator(request=rule)
    print("[dietary_compliance] created")

    # --- Variety ---
    _delete_existing(client, project_id, "variety")
    rule = _make_rule(
        name="variety",
        project_id=project_id,
        system_prompt="You are a meal planning expert evaluating variety. Be fair and recognise diversity when it is present.",
        user_prompt=VARIETY_PROMPT,
        variables={
            "meal_plan": "output.meal_plan",
        },
        schema=[
            LlmAsJudgeOutputSchemaWrite(
                name="variety",
                type="DOUBLE",
                description="Overall variety score 0.0-1.0. 0.7+ means good diversity across proteins, cuisines, and recipes.",
            ),
        ],
    )
    client.automation_rule_evaluators.create_automation_rule_evaluator(request=rule)
    print("[variety] created")

    # --- Nutrition ---
    _delete_existing(client, project_id, "nutrition")
    rule = _make_rule(
        name="nutrition",
        project_id=project_id,
        system_prompt="You are a nutritionist. Score the meal plan fairly based on healthy-eating guidelines.",
        user_prompt=NUTRITION_PROMPT,
        variables={
            "meal_plan": "output.meal_plan",
        },
        schema=[
            LlmAsJudgeOutputSchemaWrite(
                name="nutrition",
                type="DOUBLE",
                description="Overall nutrition score 0.0-1.0 based on protein, vegetables, fruits, fiber adequacy.",
            ),
        ],
    )
    client.automation_rule_evaluators.create_automation_rule_evaluator(request=rule)
    print("[nutrition] created")

    print("\nDone. All rules are active — scores will appear on every new trace in Opik.")


if __name__ == "__main__":
    main()
