"""GET/PUT /api/mealplans - Get or update meal plans."""

from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import get_meal_plan, get_current_meal_plan, get_firestore, delete_meal_plan
from google.cloud.firestore_v1 import FieldFilter
from google.cloud import firestore


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            meal_plan_id = params.get('id', [None])[0]
            family_id = params.get('familyId', ['demo-family'])[0]
            week_start = params.get('weekStart', [None])[0]

            if meal_plan_id:
                # Get specific meal plan by ID
                meal_plan = get_meal_plan(meal_plan_id)
                if meal_plan:
                    result = {'success': True, 'mealPlan': meal_plan}
                else:
                    result = {'success': False, 'error': 'Meal plan not found'}
            elif week_start:
                # Get meal plan for specific week
                meal_plan = get_current_meal_plan(family_id, week_start)
                result = {'success': True, 'mealPlan': meal_plan}
            else:
                # Get current week's meal plan
                from datetime import datetime, timedelta
                today = datetime.now()
                monday = today - timedelta(days=today.weekday())
                current_week = monday.strftime('%Y-%m-%d')
                meal_plan = get_current_meal_plan(family_id, current_week)
                result = {'success': True, 'mealPlan': meal_plan}

            self.send_response(200)
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
        """Update meal plan status (approve/complete)."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            meal_plan_id = body.get('id')
            status = body.get('status')

            if not meal_plan_id:
                raise ValueError("Meal plan ID is required")

            if status not in ['draft', 'approved', 'completed']:
                raise ValueError("Invalid status")

            db = get_firestore()
            doc_ref = db.collection('mealPlans').document(meal_plan_id)
            doc_ref.update({
                'status': status,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })

            result = {'success': True, 'status': status}

            self.send_response(200)
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

    def do_DELETE(self):
        """Delete a meal plan."""
        try:
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            meal_plan_id = params.get('id', [None])[0]

            if not meal_plan_id:
                raise ValueError("Meal plan ID is required")

            success = delete_meal_plan(meal_plan_id)

            if success:
                result = {'success': True, 'message': 'Meal plan deleted'}
            else:
                result = {'success': False, 'error': 'Failed to delete meal plan'}

            self.send_response(200 if success else 500)
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
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
