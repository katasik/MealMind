"""Google Gemini LLM client with Opik tracing."""

import os
from langchain_google_genai import ChatGoogleGenerativeAI
from _lib.opik_client import get_opik_tracer


def get_llm(temperature: float = 0.7, model: str = "gemini-2.5-flash"):
    """Get Gemini LLM with Opik tracing enabled."""
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=os.environ.get('GOOGLE_API_KEY'),
        temperature=temperature,
        callbacks=[get_opik_tracer()]
    )


def get_judge_llm():
    """Get Gemini Flash at temperature 0 for deterministic evaluation.

    Used by shopping_completeness and recipe_extraction.
    Meal-plan metrics (dietary compliance, variety, nutrition) are evaluated
    asynchronously via Opik online rules using GPT-4o-mini.
    """
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ.get('GOOGLE_API_KEY'),
        temperature=0,
        callbacks=[get_opik_tracer()]
    )


async def generate_with_retry(llm, prompt: str, max_retries: int = 3) -> str:
    """Generate response with automatic retry on failure."""
    last_error = None

    for attempt in range(max_retries):
        try:
            response = await llm.ainvoke(prompt)
            return response.content
        except Exception as e:
            error_msg = str(e)

            # Check for quota exceeded errors
            if 'RESOURCE_EXHAUSTED' in error_msg or '429' in error_msg or 'quota' in error_msg.lower():
                raise Exception(
                    "Daily API quota exceeded. Please try again tomorrow or upgrade your Gemini API plan at https://aistudio.google.com/"
                )

            last_error = e
            if attempt < max_retries - 1:
                continue

    raise last_error
