"""
Entry point module for Railway/Nixpacks.

Nixpacks detects a Python project at the repo root and runs:

    uvicorn app.main:app --host 0.0.0.0 --port ${PORT}

This thin wrapper simply re-exports the FastAPI app defined in
`backend/app/main.py` so that the same command works without
changing Railway's default start command.
"""

from backend.app.main import app  # noqa: F401


