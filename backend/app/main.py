from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .api.v1.router import api_router
from .db import init_db, SessionLocal
import asyncio
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cryptotrendlab.main")

# Load settings and create the FastAPI app at module import time so
# `backend.app.main:app` works exactly as Railway expects.
settings = get_settings()

app = FastAPI(
	title="CryptoTrendLab API",
	version="0.1.0",
	openapi_url=f"{settings.api_v1_prefix}/openapi.json",
	docs_url="/docs",
	redoc_url="/redoc",
)

# CORS
app.add_middleware(
	CORSMiddleware,
	allow_origins=settings.allowed_origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def service_health() -> dict:
	"""
	Simple healthcheck used by Railway. Must be lightweight and not depend
	on external services or the database being available.
	"""
	return {"status": "ok"}


# API v1 router (includes all feature endpoints under the configured prefix)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
async def on_startup() -> None:
	"""
	Startup hook: initialize the database schema (best-effort) and launch
	the forward-test worker. Logs a clear message so we can see when the
	API boots successfully inside Docker/Railway.
	"""
	logger.info("API startup: initializing CryptoTrendLab backend")

	# Initialize DB but don't crash the app if it fails; log instead.
	try:
		init_db()
	except Exception:
		logger.exception("Startup: init_db failed")

	async def worker() -> None:
		# Import inside worker to avoid impacting app startup or /health if something goes wrong.
		from .models.forward_test import ForwardTestRun  # type: ignore
		from .services.forward_test import step_run  # type: ignore

		while True:
			try:
				db = SessionLocal()
				active_runs = db.query(ForwardTestRun).filter(ForwardTestRun.is_active.is_(True)).all()
				for run in active_runs:
					try:
						step_run(run, db)
					except Exception:
						logger.exception("Forward test worker: error in step_run", extra={"run_id": run.id})
				db.close()
			except Exception:
				logger.exception("Forward test worker: unexpected error")
			await asyncio.sleep(300)  # 5 minutes

	try:
		asyncio.create_task(worker())
	except Exception:
		logger.exception("Startup: failed to schedule forward test worker")

	logger.info("API startup: CryptoTrendLab backend is ready to serve requests")

