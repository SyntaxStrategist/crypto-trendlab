from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
	app = FastAPI(
		title="CryptoTrendLab Minimal API",
		version="0.0.1",
		docs_url="/docs",
		redoc_url="/redoc",
	)

	# Very permissive CORS for debugging; tighten later if needed.
	app.add_middleware(
		CORSMiddleware,
		allow_origins=["*"],
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)

	@app.get("/health", tags=["health"])
	def health() -> dict:
		return {"status": "ok"}

	return app


app = create_app()


