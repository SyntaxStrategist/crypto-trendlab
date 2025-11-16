from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.post("", summary="Run backtest (placeholder)")
def run_backtest():
	# Placeholder: no logic implemented yet
	raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Backtesting endpoint not implemented yet")


