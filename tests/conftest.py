"""Shared pytest fixtures for MealMind tests."""

import sys
import os

# Ensure api/ is on the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
