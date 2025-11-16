from fastapi import APIRouter, Query, HTTPException, status

router = APIRouter()


@router.get("", summary="Get OHLCV data (placeholder)")
def get_ohlcv(
	exchange: str = Query(..., description="Exchange id (e.g., binance)"),
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	timeframe: str = Query("1h", description="Timeframe (e.g., 1m, 1h, 1d)"),
	limit: int = Query(100, ge=1, le=5000, description="Number of candles"),
):
	# Placeholder: no logic implemented yet
	raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="OHLCV endpoint not implemented yet")


