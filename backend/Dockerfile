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

EXPOSE 8000
ENV PORT=8000

# Start FastAPI via uvicorn
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]


