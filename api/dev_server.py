"""Local development server for Python API functions."""

from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
import sys
import os

# Load environment variables from .env.local
from pathlib import Path
env_file = Path(__file__).parent.parent / '.env.local'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)

# Import handlers
from recipes.parse import handler as ParseHandler
from recipes.index import handler as RecipesHandler
from mealplans.generate import handler as GenerateHandler
from mealplans.regenerate import handler as RegenerateHandler
from mealplans.index import handler as MealPlansHandler
from shopping.index import handler as ShoppingHandler
from shopping.telegram import handler as ShoppingTelegramHandler
from mealplans.scores import handler as ScoresHandler


def run_handler(handler_class, method='POST'):
    """Adapter to run Vercel-style handlers in Flask."""
    from io import BytesIO
    from http.server import BaseHTTPRequestHandler

    class MockRequest:
        def __init__(self, data, headers):
            self.rfile = BytesIO(data)
            self.headers = headers
            self.response_code = 200
            self.response_headers = {}
            self.response_body = b''

        def read(self, size=-1):
            return self.rfile.read(size)

    class MockHandler(handler_class):
        def __init__(self, request_data, headers, path):
            self.headers = headers
            self.path = path  # Include path for query parameter parsing
            self.rfile = BytesIO(request_data)
            self.wfile = BytesIO()
            self._response_code = 200
            self._response_headers = {}

        def send_response(self, code):
            self._response_code = code

        def send_header(self, key, value):
            self._response_headers[key] = value

        def end_headers(self):
            pass

        def get_response(self):
            return self._response_code, self._response_headers, self.wfile.getvalue()

    data = request.get_data()
    headers = dict(request.headers)
    headers['Content-Length'] = str(len(data))

    # Include full path with query string for handlers that parse query params
    full_path = request.full_path.rstrip('?')
    handler = MockHandler(data, headers, full_path)

    if method == 'POST':
        handler.do_POST()
    elif method == 'GET':
        handler.do_GET()
    elif method == 'PUT':
        handler.do_PUT()
    elif method == 'DELETE':
        handler.do_DELETE()

    code, resp_headers, body = handler.get_response()

    # Log errors for debugging
    if code >= 400:
        print(f"Handler returned {code}: {body.decode('utf-8', errors='replace')}")

    # Debug: Log all responses
    print(f"DEBUG run_handler: code={code}, body_length={len(body)}")
    if len(body) < 500:  # Only print short responses
        print(f"DEBUG run_handler: body={body.decode('utf-8', errors='replace')[:200]}")

    response = app.make_response(body)
    response.status_code = code
    for k, v in resp_headers.items():
        if k.lower() != 'access-control-allow-origin':  # CORS handles this
            response.headers[k] = v
    return response


@app.route('/api/recipes', methods=['GET', 'DELETE', 'OPTIONS'])
def recipes():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(RecipesHandler, request.method)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recipes/parse', methods=['POST', 'OPTIONS'])
def recipes_parse():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(ParseHandler, 'POST')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping', methods=['GET', 'POST', 'PUT', 'OPTIONS'])
def shopping():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(ShoppingHandler, request.method)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shopping/telegram', methods=['POST', 'OPTIONS'])
def shopping_telegram():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(ShoppingTelegramHandler, 'POST')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/mealplans', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
def mealplans():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(MealPlansHandler, request.method)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/mealplans/generate', methods=['POST', 'OPTIONS'])
def mealplans_generate():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        print("DEBUG: Received request to /api/mealplans/generate")
        result = run_handler(GenerateHandler, 'POST')
        print(f"DEBUG: Handler returned status code: {result.status_code}")
        print(f"DEBUG: Response body length: {len(result.get_data())}")
        return result
    except Exception as e:
        import traceback
        print("ERROR: Exception in mealplans_generate:")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/mealplans/regenerate', methods=['POST', 'OPTIONS'])
def mealplans_regenerate():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(RegenerateHandler, 'POST')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/mealplans/scores', methods=['GET', 'OPTIONS'])
def mealplans_scores():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        return run_handler(ScoresHandler, 'GET')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("Starting local Python API server on http://localhost:5001")
    print("Make sure to update next.config.js to proxy /api/* to this server")
    app.run(port=5001, debug=True, use_reloader=False)
