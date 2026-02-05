"""GET/DELETE /api/recipes - Recipe CRUD operations."""

from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.firebase_admin_client import get_family_recipes, get_recipe, delete_recipe


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            recipe_id = params.get('id', [None])[0]
            family_id = params.get('familyId', ['demo-family'])[0]

            if recipe_id:
                recipe = get_recipe(recipe_id)
                if recipe:
                    result = {'success': True, 'recipe': recipe}
                else:
                    result = {'success': False, 'error': 'Recipe not found'}
            else:
                recipes = get_family_recipes(family_id)
                result = {'success': True, 'recipes': recipes}

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

    def do_DELETE(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            recipe_id = params.get('id', [None])[0]

            if not recipe_id:
                raise ValueError("Recipe ID is required")

            delete_recipe(recipe_id)

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
        self.send_header('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
