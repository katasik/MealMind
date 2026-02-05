"""Opik observability client for tracing and evaluation."""

import os
import opik
from opik.integrations.langchain import OpikTracer
from typing import Optional, Any

_initialized = False
_tracer = None


def init_opik():
    """Initialize Opik client."""
    global _initialized

    if _initialized:
        return

    api_key = os.environ.get('OPIK_API_KEY')
    workspace = os.environ.get('OPIK_WORKSPACE')

    if api_key and workspace:
        opik.configure(
            api_key=api_key,
            workspace=workspace
        )
        _initialized = True


def get_opik_tracer() -> OpikTracer:
    """Get OpikTracer for LangChain integration."""
    global _tracer

    init_opik()

    if _tracer is None:
        # Create tracer with explicit project name to ensure traces go to the right place
        _tracer = OpikTracer(project_name="mealmind")

    return _tracer


def start_trace(name: str, input_data: dict = None, metadata: dict = None):
    """Start a new Opik trace."""
    init_opik()

    try:
        return opik.track(
            name=name,
            input=input_data,
            metadata=metadata
        )
    except Exception:
        # Return a dummy context manager if Opik is not configured
        return DummyTrace(name)


def log_score(trace_id: str, name: str, value: float, reason: str = None):
    """Log a score to the current trace."""
    init_opik()

    try:
        opik.log_score(
            trace_id=trace_id,
            name=name,
            value=value,
            reason=reason
        )
    except Exception:
        pass


class DummyTrace:
    """Dummy trace context manager for when Opik is not configured."""

    def __init__(self, name: str):
        self.name = name
        self.id = f"dummy-{name}"

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def end(self, output: Any = None):
        pass


class TrackedOperation:
    """Context manager for tracking operations with Opik."""

    def __init__(self, name: str, input_data: dict = None, metadata: dict = None):
        self.name = name
        self.input_data = input_data or {}
        self.metadata = metadata or {}
        self.trace = None
        self.trace_id = None

    def __enter__(self):
        init_opik()
        try:
            self.trace = opik.start_trace(
                name=self.name,
                input=self.input_data,
                metadata=self.metadata
            )
            self.trace_id = self.trace.id if self.trace else f"local-{self.name}"
        except Exception:
            self.trace_id = f"local-{self.name}"
        return self

    def set_output(self, output):
        """Set the trace output (logged when the context manager exits)."""
        self._output = output

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.trace:
            try:
                self.trace.end(output=getattr(self, '_output', None))
            except Exception:
                pass

    def log_score(self, name: str, value: float, reason: str = None):
        """Log a score for this operation."""
        if self.trace_id:
            log_score(self.trace_id, name, value, reason)

    def add_span(self, name: str, input_data: dict = None):
        """Add a span to the trace."""
        try:
            return opik.start_span(name=name, input=input_data)
        except Exception:
            return DummyTrace(name)


def track_operation(name: str, input_data: dict = None, metadata: dict = None) -> TrackedOperation:
    """Create a tracked operation context manager."""
    return TrackedOperation(name, input_data, metadata)


def get_opik_api_client():
    """Get OpikApi REST client for direct API calls (trace updates, score reads)."""
    api_key = os.environ.get('OPIK_API_KEY')
    workspace = os.environ.get('OPIK_WORKSPACE')
    if not api_key or not workspace:
        return None
    from opik.rest_api.client import OpikApi
    base_url = os.environ.get('OPIK_URL', 'https://www.comet.com/opik/api')
    return OpikApi(api_key=api_key, workspace_name=workspace, base_url=base_url)
