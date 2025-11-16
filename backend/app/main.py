from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .api.v1.router import api_router
from .db import init_db, SessionLocal
from .models.forward_test import ForwardTestRun
from .services.forward_test import step_run
import asyncio
import logging


def create_app() -> FastAPI:
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

	# Root health (no prefix)
	@app.get("/health", tags=["health"])
	def service_health():
		return {"status": "ok"}

	# API v1
	app.include_router(api_router, prefix=settings.api_v1_prefix)

	@app.on_event("startup")
	async def on_startup() -> None:
		# ensure DB schema exists
		init_db()

		logger = logging.getLogger(__name__)

		async def worker() -> None:
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

		asyncio.create_task(worker())

	return app


app = create_app()


