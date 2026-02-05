"""GET /api/mealplans/scores - Fetch Opik online-evaluation scores for a trace."""

from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from _lib.opik_client import get_opik_api_client


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            trace_id = params.get('traceId', [None])[0]

            if not trace_id:
                self._json(400, {'success': False, 'error': 'traceId is required'})
                return

            client = get_opik_api_client()
            if not client:
                self._json(503, {'success': False, 'error': 'Opik not configured'})
                return

            trace = client.traces.get_trace_by_id(id=trace_id)

            scores = {}
            if trace.feedback_scores:
                for s in trace.feedback_scores:
                    if s.source == 'online_scoring':
                        scores[s.name] = {
                            'value': s.value,
                            'reason': s.reason,
                        }

            self._json(200, {'success': True, 'scores': scores})

        except Exception as e:
            self._json(500, {'success': False, 'error': str(e)})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
