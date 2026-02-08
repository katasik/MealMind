"""POST /api/recipes/parse - Parse recipe from URL, PDF, or text."""

from http.server import BaseHTTPRequestHandler
import json
import asyncio
import re

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import save_recipe, save_evaluation_result
from _lib.gemini_client import get_llm
from _lib.opik_client import track_operation
from _lib.evaluation.metrics.recipe_extraction import evaluate_recipe_extraction

try:
    import httpx
    from bs4 import BeautifulSoup
except ImportError:
    httpx = None
    BeautifulSoup = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


RECIPE_PARSE_PROMPT = """Extract the recipe from this content into a structured format.

SOURCE CONTENT:
{content}

CRITICAL: Extract ONLY information that is explicitly stated in the source.
- Do NOT make up, infer, or hallucinate any data
- If a field is NOT explicitly stated in the source, use null for that field
- For ingredients: only include unit if explicitly specified (e.g., "3 bananas" has no unit, so unit should be null)
- For times: extract if mentioned ANYWHERE in the source (including within instructions like "cook for 20 minutes")
- For servings: only include if explicitly stated
- The source may be in any language - extract times/amounts regardless of language

Return ONLY valid JSON:
{{
    "name": "Recipe Name",
    "description": "Brief description from the source, or null if not provided",
    "ingredients": [
        {{"name": "ingredient name", "amount": 1, "unit": "cup (or null if not specified)", "category": "produce|dairy|meat|pantry|spices|frozen|other (or null if unclear)"}}
    ],
    "instructions": [
        "Step 1: Exact instruction from source",
        "Step 2: Next step from source"
    ],
    "prepTimeMinutes": null,
    "cookTimeMinutes": null,
    "servings": null,
    "cuisine": null,
    "difficulty": "easy|medium|hard (or null if not stated)",
    "tags": [],
    "mealTypes": []
}}

IMPORTANT: It is better to return null than to guess. Only include values that are explicitly in the source."""


def extract_pdf_text(pdf_base64: str) -> str:
    """Extract text from a base64-encoded PDF file."""
    import base64
    import io

    if not pdfplumber:
        raise ImportError("pdfplumber is not installed. Install it with: pip install pdfplumber")

    # Remove data URL prefix if present (e.g., "data:application/pdf;base64,...")
    if ',' in pdf_base64:
        pdf_base64 = pdf_base64.split(',', 1)[1]

    pdf_bytes = base64.b64decode(pdf_base64)
    pdf_file = io.BytesIO(pdf_bytes)

    text_parts = []
    with pdfplumber.open(pdf_file) as pdf:
        for i, page in enumerate(pdf.pages[:20]):  # Limit to 20 pages
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    full_text = '\n\n'.join(text_parts)
    # Limit to 10000 chars for LLM context
    return full_text[:10000]


async def fetch_url_content(url: str) -> str:
    """Fetch and parse content from a URL."""
    if not httpx:
        raise ImportError("httpx not installed")

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        response = await client.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; MealMind/1.0)'
        })
        response.raise_for_status()

        if BeautifulSoup:
            soup = BeautifulSoup(response.text, 'html.parser')

            # Remove script and style elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                element.decompose()

            # Try to find recipe-specific content
            recipe_content = soup.find(['article', 'main', 'div'], class_=re.compile(r'recipe', re.I))
            if recipe_content:
                text = recipe_content.get_text(separator='\n', strip=True)
            else:
                text = soup.get_text(separator='\n', strip=True)

            # Clean up whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines[:200])  # Limit lines

        return response.text[:10000]


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            source = body.get('source', '')
            source_type = body.get('sourceType', 'text')
            family_id = body.get('familyId', 'demo-family')

            if not source:
                raise ValueError("Source is required")

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    self.parse_recipe(source, source_type, family_id)
                )
            finally:
                # Properly shutdown: cancel pending tasks and let them complete
                pending = asyncio.all_tasks(loop)
                for task in pending:
                    task.cancel()
                if pending:
                    loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                loop.close()

            self.send_response(200 if result.get('success') else 500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e)
            }).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    async def parse_recipe(self, source: str, source_type: str, family_id: str) -> dict:
        """Parse recipe from various sources with evaluation."""

        with track_operation(
            name="parse_recipe",
            input_data={"sourceType": source_type, "familyId": family_id},
            metadata={"operation": "recipe_extraction"}
        ) as op:
            try:
                # Get content based on source type
                if source_type == 'url':
                    content = await fetch_url_content(source)
                    source_url = source
                elif source_type == 'pdf':
                    content = extract_pdf_text(source)
                    source_url = None
                else:
                    content = source
                    source_url = None

                # Parse with LLM
                llm = get_llm(temperature=0.3)  # Lower temp for accuracy

                prompt = RECIPE_PARSE_PROMPT.format(content=content[:8000])
                response = await llm.ainvoke(prompt)

                # Extract JSON — use raw_decode to handle extra trailing data
                response_content = response.content
                start_idx = response_content.find('{')

                if start_idx == -1:
                    raise ValueError("Could not extract recipe from content")

                decoder = json.JSONDecoder()
                recipe, _ = decoder.raw_decode(response_content, start_idx)

                # Evaluate extraction quality
                evaluation = await evaluate_recipe_extraction(content, recipe, source_type)

                # Log scores
                op.log_score('extraction_quality', evaluation['score'])
                op.log_score('hallucination_free', 0.0 if evaluation['hallucinationsDetected'] else 1.0)

                # Always save the recipe (evaluation is informational, not blocking)
                recipe['sourceType'] = source_type
                if source_url:
                    recipe['sourceUrl'] = source_url

                recipe_id = save_recipe(family_id, recipe)
                recipe['id'] = recipe_id

                # Save evaluation result for observability
                save_evaluation_result(
                    trace_id=op.trace_id,
                    operation_type='recipe_extraction',
                    family_id=family_id,
                    scores={'extractionQuality': evaluation['score']},
                    passed=evaluation['passed'],
                    metadata={
                        'recipeId': recipe_id,
                        'recipeName': recipe.get('name'),
                        'sourceType': source_type,
                        'evaluationDetails': evaluation
                    }
                )

                return {
                    'success': True,
                    'recipe': recipe,
                    'evaluation': {
                        'score': evaluation['score'],
                        'passed': evaluation['passed'],
                        'judgesAgree': evaluation['judgesAgree'],
                        'hallucinationsDetected': evaluation['hallucinationsDetected'],
                        'reasoning': evaluation.get('reasoning', '')
                    },
                    'traceId': op.trace_id
                }

            except Exception as e:
                return {
                    'success': False,
                    'error': str(e),
                    'traceId': op.trace_id if op else None
                }
