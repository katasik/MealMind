"""Recipe extraction evaluation metric.

Uses dual LLM-as-judge evaluation for recipe extraction quality.
Judge 1: Evaluates completeness and accuracy
Judge 2: Independent verification for hallucinations
"""

import json
from typing import Dict, Any
from _lib.gemini_client import get_judge_llm


async def evaluate_recipe_extraction(
    source_content: str,
    extracted_recipe: Dict[str, Any],
    source_type: str
) -> Dict[str, Any]:
    """
    Dual LLM-as-judge evaluation for recipe extraction.

    Judge 1: Evaluates completeness and accuracy
    Judge 2: Independent verification for hallucinations
    """

    llm = get_judge_llm()

    # Truncate source for context limits
    source_truncated = source_content[:6000]

    # Format extracted recipe for evaluation
    recipe_summary = {
        'name': extracted_recipe.get('name', 'N/A'),
        'description': extracted_recipe.get('description', 'N/A'),
        'ingredients': extracted_recipe.get('ingredients', []),
        'instructions': extracted_recipe.get('instructions', []),
        'prepTimeMinutes': extracted_recipe.get('prepTimeMinutes', 'N/A'),
        'cookTimeMinutes': extracted_recipe.get('cookTimeMinutes', 'N/A'),
        'servings': extracted_recipe.get('servings', 'N/A')
    }

    # Judge 1: Completeness check
    judge1_prompt = f"""You are evaluating recipe extraction accuracy.

SOURCE CONTENT:
{source_truncated}

EXTRACTED RECIPE:
- Name: {recipe_summary['name']}
- Description: {recipe_summary['description']}
- Ingredients: {json.dumps(recipe_summary['ingredients'], indent=2)}
- Instructions: {json.dumps(recipe_summary['instructions'], indent=2)}
- Prep Time: {recipe_summary['prepTimeMinutes']} min
- Cook Time: {recipe_summary['cookTimeMinutes']} min
- Servings: {recipe_summary['servings']}

IMPORTANT: null values are CORRECT when information is not explicitly stated in the source.
- "3 bananas" should have unit: null (not "whole", "pieces", etc.)
- If servings/times are not mentioned, null is correct
- Using null for missing data is NOT a hallucination - it's accurate

EVALUATE (0.0 to 1.0):
1. name_accuracy: Is the recipe name correct?
2. ingredients_completeness: Are ALL ingredients captured?
3. ingredients_accuracy: Are amounts/units correct? (null is correct if not specified in source)
4. instructions_completeness: Are ALL steps captured?
5. instructions_order: Are steps in correct order?
6. times_accuracy: Are prep/cook times correct or correctly null if not in source?
7. hallucination_free: Is all data actually from the source? (1.0 = no fabrication, null for missing is OK)

Return ONLY valid JSON:
{{
    "name_accuracy": 0.0-1.0,
    "ingredients_completeness": 0.0-1.0,
    "ingredients_accuracy": 0.0-1.0,
    "instructions_completeness": 0.0-1.0,
    "instructions_order": 0.0-1.0,
    "times_accuracy": 0.0-1.0,
    "hallucination_free": 0.0-1.0,
    "reasoning": "brief explanation"
}}"""

    try:
        judge1_response = await llm.ainvoke(judge1_prompt)
        content = judge1_response.content
        start = content.find('{')
        end = content.rfind('}') + 1
        judge1_scores = json.loads(content[start:end]) if start != -1 else {}
    except Exception:
        judge1_scores = {"error": "parse_failed"}

    # Judge 2: Independent verification
    judge2_prompt = f"""Compare the extracted recipe to the source. Identify discrepancies.

SOURCE (first 3000 chars):
{source_content[:3000]}

EXTRACTED:
{json.dumps(recipe_summary, indent=2, default=str)[:2000]}

IMPORTANT: null values for unit, category, times, servings are CORRECT when not in source.
- Do NOT flag null units as hallucinations
- Do NOT flag null categories as hallucinations
- Only flag actual fabricated content (ingredients/steps that don't exist in source)

Return ONLY valid JSON:
{{
    "missing_ingredients": ["ingredients in source but not extracted"],
    "extra_ingredients": ["ingredient NAMES extracted but NOT in source (hallucinations) - ignore null units/categories"],
    "missing_instructions": ["steps in source but not extracted"],
    "extra_instructions": ["steps extracted but NOT in source (hallucinations)"],
    "overall_match": true/false,
    "confidence": 0.0-1.0
}}"""

    try:
        judge2_response = await llm.ainvoke(judge2_prompt)
        content = judge2_response.content
        start = content.find('{')
        end = content.rfind('}') + 1
        judge2_result = json.loads(content[start:end]) if start != -1 else {}
    except Exception:
        judge2_result = {"error": "parse_failed"}

    # Calculate final score
    if "error" not in judge1_scores:
        primary_scores = [
            judge1_scores.get("ingredients_completeness", 0),
            judge1_scores.get("ingredients_accuracy", 0),
            judge1_scores.get("instructions_completeness", 0),
            judge1_scores.get("hallucination_free", 0),
        ]
        primary_score = sum(primary_scores) / len(primary_scores)
    else:
        primary_score = 0.5

    # Hallucination detection requires BOTH judges to agree
    judge1_says_hallucinations = judge1_scores.get("hallucination_free", 1.0) < 0.8
    judge2_says_hallucinations = (
        "error" not in judge2_result and
        (len(judge2_result.get("extra_ingredients", [])) > 0 or
         len(judge2_result.get("extra_instructions", [])) > 0)
    )

    # Only flag hallucinations if both judges agree
    has_hallucinations = judge1_says_hallucinations and judge2_says_hallucinations

    if has_hallucinations:
        primary_score *= 0.5  # Severe penalty for confirmed hallucinations

    judges_agree = (
        "error" not in judge1_scores and
        "error" not in judge2_result and
        judge1_says_hallucinations == judge2_says_hallucinations
    )

    return {
        "score": round(primary_score, 3),
        "passed": primary_score >= 0.7 and not has_hallucinations,
        "judgesAgree": judges_agree,
        "hallucinationsDetected": has_hallucinations,
        "judge1Scores": judge1_scores,
        "judge2Verification": judge2_result,
        "reasoning": judge1_scores.get("reasoning", ""),
        "sourceType": source_type
    }
