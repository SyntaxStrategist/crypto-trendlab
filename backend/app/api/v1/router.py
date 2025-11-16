from fastapi import APIRouter
from .endpoints import health, ohlcv, signals, backtesting, learning

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(ohlcv.router, prefix="/ohlcv", tags=["ohlcv"])
api_router.include_router(signals.router, prefix="/signals", tags=["signals"])
api_router.include_router(backtesting.router, prefix="/backtesting", tags=["backtesting"])
api_router.include_router(learning.router, prefix="/learning", tags=["learning"])


