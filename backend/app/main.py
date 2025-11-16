from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .api.v1.router import api_router


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

	return app


app = create_app()


