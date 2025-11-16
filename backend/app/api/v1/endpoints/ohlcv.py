from fastapi import APIRouter, Query, HTTPException, status
from typing import List, Dict, Any
from datetime import datetime, timezone
import ccxt
import math

router = APIRouter()


def _map_ohlcv_rows(rows: List[List[float]]) -> List[Dict[str, Any]]:
	mapped: List[Dict[str, Any]] = []
	for r in rows:
		# r: [ timestamp(ms), open, high, low, close, volume ]
		ts_ms = int(r[0])
		mapped.append({
			"t": ts_ms,
			"iso": datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat(),
			"o": float(r[1]),
			"h": float(r[2]),
			"l": float(r[3]),
			"c": float(r[4]),
			"v": float(r[5]) if len(r) > 5 and not (r[5] is None or (isinstance(r[5], float) and math.isnan(r[5]))) else 0.0,
		})
	return mapped


@router.get("", summary="Get OHLCV data from Coinbase (5m & 15m)")
def get_ohlcv(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	limit: int = Query(200, ge=1, le=500, description="Number of candles to fetch"),
):
	"""
	Returns both 5m and 15m OHLCV candles for the requested symbol from Coinbase.
	Response shape:
	{
		"exchange": "coinbase",
		"symbol": "BTC/USDT",
		"timeframes": {
			"5m": [...],
			"15m": [...]
		}
	}
	"""
	try:
		exchange = ccxt.coinbase({
			"enableRateLimit": True,
		})
		if symbol not in exchange.load_markets():
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Symbol not available on Coinbase: {symbol}")

		tf_5 = exchange.fetch_ohlcv(symbol, timeframe="5m", limit=limit)
		tf_15 = exchange.fetch_ohlcv(symbol, timeframe="15m", limit=limit)

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"timeframes": {
				"5m": _map_ohlcv_rows(tf_5),
				"15m": _map_ohlcv_rows(tf_15),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch OHLCV: {e}")


