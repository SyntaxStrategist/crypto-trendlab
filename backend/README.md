# CryptoTrendLab Backend (FastAPI)

FastAPI backend scaffold for Railway deployment. Routes are placeholders (no business logic yet).

## Structure

- `app/main.py` — FastAPI app factory and router includes
- `app/core/config.py` — settings and CORS
- `app/api/v1/endpoints/` — placeholder route modules
- `requirements.txt` — pinned dependencies
- `Procfile` / `railway.toml` — Railway run config

## Local development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit:
- http: //127.0.0.1:8000/health
- http: //127.0.0.1:8000/docs

## Deployment (Railway)

- Connect this repo to Railway as a service using the `backend/` folder as root or add a monorepo setting pointing to `backend`.
- Railway will use `Procfile` (`web`) or `railway.toml` to start `uvicorn` on `${PORT}`.


