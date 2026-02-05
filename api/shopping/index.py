"""GET/POST/PUT /api/shopping - Shopping list operations."""

from http.server import BaseHTTPRequestHandler
import json
import asyncio
from urllib.parse import urlparse, parse_qs

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import (
    get_meal_plan, get_shopping_list, save_shopping_list,
    update_shopping_item, save_evaluation_result
)
from _lib.opik_client import track_operation
from _lib.evaluation.metrics.shopping_completeness import (
    evaluate_shopping_completeness, aggregate_ingredients
)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            meal_plan_id = params.get('mealPlanId', [None])[0]

            if not meal_plan_id:
                raise ValueError("mealPlanId is required")

            shopping_list = get_shopping_list(meal_plan_id)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'shoppingList': shopping_list
            }, default=str).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e)
            }).encode())

    def do_POST(self):
        """Create shopping list from meal plan."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            meal_plan_id = body.get('mealPlanId')

            if not meal_plan_id:
                raise ValueError("mealPlanId is required")

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(self.create_shopping_list(meal_plan_id))
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
            self.wfile.write(json.dumps(result, default=str).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e)
            }).encode())

    def do_PUT(self):
        """Update shopping item status."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            list_id = body.get('listId')
            item_id = body.get('itemId')
            checked = body.get('checked', False)

            if not list_id or not item_id:
                raise ValueError("listId and itemId are required")

            update_shopping_item(list_id, item_id, checked)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode())

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
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    async def create_shopping_list(self, meal_plan_id: str) -> dict:
        """Create shopping list from meal plan with evaluation."""

        with track_operation(
            name="create_shopping_list",
            input_data={"mealPlanId": meal_plan_id},
            metadata={"operation": "shopping_list_generation"}
        ) as op:
            try:
                # Get meal plan
                meal_plan = get_meal_plan(meal_plan_id)
                if not meal_plan:
                    raise ValueError("Meal plan not found")

                family_id = meal_plan.get('familyId')
                week_start = meal_plan.get('weekStartDate')

                # Aggregate ingredients
                items = aggregate_ingredients(meal_plan)

                # Create shopping list object for evaluation
                shopping_list_data = {
                    'items': items
                }

                # Evaluate completeness
                evaluation = await evaluate_shopping_completeness(meal_plan, shopping_list_data)

                # Log score
                op.log_score('completeness', evaluation['score'])

                # Save shopping list
                list_id = save_shopping_list(meal_plan_id, family_id, week_start, items)

                # Save evaluation result
                save_evaluation_result(
                    trace_id=op.trace_id,
                    operation_type='shopping_list',
                    family_id=family_id,
                    scores={'completeness': evaluation['score']},
                    passed=evaluation['passed'],
                    metadata={
                        'shoppingListId': list_id,
                        'mealPlanId': meal_plan_id,
                        'itemCount': len(items),
                        'evaluationDetails': evaluation
                    }
                )

                return {
                    'success': True,
                    'shoppingList': {
                        'id': list_id,
                        'mealPlanId': meal_plan_id,
                        'familyId': family_id,
                        'weekStartDate': week_start,
                        'items': items,
                        'status': 'active'
                    },
                    'evaluation': {
                        'completeness': evaluation['score'],
                        'passed': evaluation['passed'],
                        'missingItems': evaluation.get('missingItems', [])
                    },
                    'traceId': op.trace_id
                }

            except Exception as e:
                return {
                    'success': False,
                    'error': str(e),
                    'traceId': op.trace_id if op else None
                }
