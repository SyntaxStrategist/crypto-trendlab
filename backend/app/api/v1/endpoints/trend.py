from fastapi import APIRouter, Query, HTTPException, status
from typing import Dict, Any, List, Tuple
from datetime import datetime, timezone
import ccxt
import pandas as pd

router = APIRouter()


def compute_emas(df: pd.DataFrame, periods: List[int]) -> pd.DataFrame:
	for p in periods:
		df[f"ema{p}"] = df["close"].ewm(span=p, adjust=False, min_periods=p).mean()
	return df


def detect_trend_and_signals(df5: pd.DataFrame, df15: pd.DataFrame) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
	signals: List[Dict[str, Any]] = []
	summary: Dict[str, Any] = {}

	# Determine trend direction by EMA alignment on 15m, fallback to 5m
	def direction_from(df: pd.DataFrame) -> str:
		row = df.iloc[-1]
		if row["ema20"] > row["ema50"] > row["ema200"]:
			return "uptrend"
		if row["ema20"] < row["ema50"] < row["ema200"]:
			return "downtrend"
		return "sideways"

	trend_15 = direction_from(df15) if len(df15) else "unknown"
	trend_5 = direction_from(df5) if len(df5) else "unknown"
	trend = trend_15 if trend_15 != "unknown" else trend_5

	# EMA crosses (last two candles on 5m and 15m)
	def ema_crosses(df: pd.DataFrame, tf: str):
		if len(df) < 2:
			return
		prev = df.iloc[-2]
		curr = df.iloc[-1]
		pairs = [(20, 50), (50, 200), (20, 200)]
		for a, b in pairs:
			prev_diff = prev[f"ema{a}"] - prev[f"ema{b}"]
			curr_diff = curr[f"ema{a}"] - curr[f"ema{b}"]
			if pd.notna(prev_diff) and pd.notna(curr_diff):
				if prev_diff <= 0 and curr_diff > 0:
					signals.append({"type": "ema_cross_up", "a": a, "b": b, "timeframe": tf})
				if prev_diff >= 0 and curr_diff < 0:
					signals.append({"type": "ema_cross_down", "a": a, "b": b, "timeframe": tf})

	ema_crosses(df5, "5m")
	ema_crosses(df15, "15m")

	# Basic break of structure: last close breaks previous swing high/low (lookback N)
	def break_of_structure(df: pd.DataFrame, tf: str, lookback: int = 20):
		if len(df) < lookback + 2:
			return
		window = df.iloc[-(lookback + 1):-1]  # exclude last
		last = df.iloc[-1]
		swing_high = window["high"].max()
		swing_low = window["low"].min()
		if last["close"] > swing_high:
			signals.append({"type": "bos_up", "timeframe": tf})
		if last["close"] < swing_low:
			signals.append({"type": "bos_down", "timeframe": tf})

	break_of_structure(df5, "5m")
	break_of_structure(df15, "15m")

	# Summary
	def last_ts(df: pd.DataFrame) -> int:
		return int(df.iloc[-1]["timestamp"]) if len(df) else 0

	summary = {
		"trend": trend,
		"trend_5m": trend_5,
		"trend_15m": trend_15,
		"last_ts_5m": last_ts(df5),
		"last_ts_15m": last_ts(df15),
	}

	return summary, signals


@router.get("", summary="Compute trend and signals from Coinbase OHLCV (5m & 15m)")
def get_trend(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	limit: int = Query(200, ge=50, le=500, description="Candles per timeframe"),
):
	try:
		exchange = ccxt.coinbase({
			"enableRateLimit": True,
		})
		markets = exchange.load_markets()
		if symbol not in markets:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Symbol not available on Coinbase: {symbol}")

		data5 = exchange.fetch_ohlcv(symbol, timeframe="5m", limit=limit)
		data15 = exchange.fetch_ohlcv(symbol, timeframe="15m", limit=limit)

		def to_df(rows: List[List[float]]) -> pd.DataFrame:
			if not rows:
				return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
			df = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
			return df

		df5 = to_df(data5)
		df15 = to_df(data15)

		df5 = compute_emas(df5, [20, 50, 200])
		df15 = compute_emas(df15, [20, 50, 200])

		summary, signals = detect_trend_and_signals(df5, df15)

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"summary": summary,
			"signals": signals,
			"meta": {
				"generated_at": datetime.now(tz=timezone.utc).isoformat(),
				"count_5m": int(len(df5)),
				"count_15m": int(len(df15)),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to compute trend: {e}")


