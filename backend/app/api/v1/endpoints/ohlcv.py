from fastapi import APIRouter, Query, HTTPException, status
from typing import List, Dict, Any
from datetime import datetime, timezone
import logging
import ccxt
import math

router = APIRouter()
logger = logging.getLogger(__name__)


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


def _normalize_coinbase_symbol(symbol: str, markets: Dict[str, Any]) -> str:
	"""
	Normalize user symbol (e.g. BTC/USDT) to a Coinbase-supported one (e.g. BTC/USD).
	"""
	raw = symbol.upper()
	# Prefer USD mapping for USDT pairs on Coinbase if available
	if raw.endswith("/USDT"):
		alt = raw.replace("/USDT", "/USD")
		if alt in markets:
			return alt
		# if no USD alt, fall back to raw and let validation handle it
		return raw
	# otherwise, keep as-is if supported
	if raw in markets:
		return raw
	# fall back to raw; validation will handle unsupported ones
	return raw


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
			"timeout": 7000,  # 7s network timeout
		})

		logger.info("OHLCV: instantiated exchange", extra={"exchange_id": getattr(exchange, "id", None)})

		logger.info("OHLCV: loading markets for Coinbase")
		try:
			markets = exchange.load_markets()
		except Exception as e:
			logger.exception("OHLCV: failed to load markets from Coinbase", extra={"symbol": symbol, "limit": limit})
			raise HTTPException(
				status_code=status.HTTP_502_BAD_GATEWAY,
				detail=f"Failed to load markets from Coinbase: {type(e).__name__}: {e}",
			)

		internal_symbol = _normalize_coinbase_symbol(symbol, markets)
		# If caller used USDT, enforce a normalized mapping when possible
		if symbol.upper().endswith("/USDT") and internal_symbol == symbol.upper():
			alt = symbol.upper().replace("/USDT", "/USD")
			if alt in markets:
				logger.warning(
					"OHLCV: forcing USDT -> USD normalization",
					extra={"requested": symbol, "normalized": alt},
				)
				internal_symbol = alt
		if internal_symbol not in markets:
			logger.warning("OHLCV: symbol not available on Coinbase", extra={"requested": symbol, "normalized": internal_symbol})
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"Symbol not available on Coinbase: {symbol} (normalized: {internal_symbol})",
			)

		logger.info(
			"OHLCV: fetching candles",
			extra={"symbol": symbol, "normalized": internal_symbol, "limit": limit},
		)
		try:
			tf_5 = exchange.fetch_ohlcv(internal_symbol, timeframe="5m", limit=limit)
			tf_15 = exchange.fetch_ohlcv(internal_symbol, timeframe="15m", limit=limit)
		except ccxt.NetworkError as e:
			logger.exception(
				"OHLCV: network error fetching OHLCV",
				extra={"symbol": symbol, "normalized": internal_symbol, "limit": limit},
			)
			raise HTTPException(
				status_code=status.HTTP_502_BAD_GATEWAY,
				detail=f"Network error fetching OHLCV from Coinbase: {type(e).__name__}: {e}",
			)
		except ccxt.ExchangeError as e:
			logger.exception(
				"OHLCV: exchange error fetching OHLCV",
				extra={"symbol": symbol, "normalized": internal_symbol, "limit": limit},
			)
			raise HTTPException(
				status_code=status.HTTP_502_BAD_GATEWAY,
				detail=f"Exchange error fetching OHLCV from Coinbase: {type(e).__name__}: {e}",
			)
		except Exception as e:
			logger.exception(
				"OHLCV: unexpected error fetching OHLCV",
				extra={"symbol": symbol, "normalized": internal_symbol, "limit": limit},
			)
			raise HTTPException(
				status_code=status.HTTP_502_BAD_GATEWAY,
				detail=f"Failed to fetch OHLCV from Coinbase: {type(e).__name__}: {e}",
			)

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"normalized_symbol": internal_symbol,
			"timeframes": {
				"5m": _map_ohlcv_rows(tf_5),
				"15m": _map_ohlcv_rows(tf_15),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		logger.exception(
			"OHLCV: unhandled error in get_ohlcv",
			extra={"symbol": symbol, "limit": limit},
		)
		raise HTTPException(
			status_code=status.HTTP_502_BAD_GATEWAY,
			detail=f"Failed to fetch OHLCV: {type(e).__name__}: {e}",
		)


