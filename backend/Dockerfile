FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

WORKDIR /app

# Install build tooling (often needed for Python wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential \
	&& rm -rf /var/lib/apt/lists/*

# Install backend dependencies (context is the backend/ directory)
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . /app/backend

# Expose port (informational; Railway routes to $PORT dynamically)
EXPOSE 8000

# Start FastAPI via uvicorn on Railway-assigned $PORT
# Use shell form to allow $PORT environment variable expansion
# Default to 8000 if $PORT is not set (for local development)
CMD uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}


