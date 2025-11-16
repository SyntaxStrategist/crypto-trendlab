from fastapi import APIRouter, Query, HTTPException, status

router = APIRouter()


@router.get("", summary="Generate trading signals (placeholder)")
def get_signals(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	strategy: str = Query("rsi", description="Strategy key (e.g., rsi, macd)"),
):
	# Placeholder: no logic implemented yet
	raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Signals endpoint not implemented yet")


