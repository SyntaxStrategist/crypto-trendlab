from fastapi import APIRouter, Query, HTTPException, status
from typing import Dict, Any, List
from datetime import datetime, timezone
import ccxt
import pandas as pd

router = APIRouter()


def to_df(rows: List[List[float]]) -> pd.DataFrame:
	if not rows:
		return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
	df = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
	return df


def compute_volume_features(df: pd.DataFrame) -> pd.DataFrame:
	if df.empty:
		return df
	df["sma20_vol"] = df["volume"].rolling(window=20, min_periods=20).mean()
	df["rv"] = df["volume"] / df["sma20_vol"]
	df["body"] = (df["close"] - df["open"]).abs()
	df["range"] = df["high"] - df["low"]
	df["body_pct"] = df["body"] / df["range"].replace(0, pd.NA)
	df["dir"] = (df["close"] > df["open"]).astype(int) - (df["close"] < df["open"]).astype(int)  # 1 up, -1 down, 0 flat
	return df


def detect_volume_signals(df: pd.DataFrame, tf: str) -> List[Dict[str, Any]]:
	signals: List[Dict[str, Any]] = []
	if df.empty:
		return signals

	# Climax candles: relative volume >= 3.0
	climax = df[(df["rv"] >= 3.0)]
	for _, row in climax.tail(30).iterrows():
		signals.append({
			"type": "climax",
			"timeframe": tf,
			"ts": int(row["timestamp"]),
			"rv": float(row["rv"]) if pd.notna(row["rv"]) else None,
			"dir": "up" if row["dir"] > 0 else "down" if row["dir"] < 0 else "flat",
		})

	# Ignition candles: large body, high body_pct, rv >= 2.0
	ignition = df[(df["rv"] >= 2.0) & (df["body_pct"] >= 0.6)]
	for _, row in ignition.tail(30).iterrows():
		signals.append({
			"type": "ignition",
			"timeframe": tf,
			"ts": int(row["timestamp"]),
			"rv": float(row["rv"]) if pd.notna(row["rv"]) else None,
			"dir": "up" if row["dir"] > 0 else "down" if row["dir"] < 0 else "flat",
		})

	# Sustained accumulation/distribution over recent 50 bars where rv > 1.5
	window = df.tail(50)
	active = window[window["rv"] >= 1.5]
	if len(active) >= 5:
		score = (active["dir"]).sum()  # positive means more up closes
		event_type = "accumulation" if score > 0 else "distribution" if score < 0 else "indeterminate"
		if event_type != "indeterminate":
			signals.append({
				"type": event_type,
				"timeframe": tf,
				"ts": int(window.iloc[-1]["timestamp"]),
				"count": int(len(active)),
				"score": int(score),
			})

	return signals


@router.get("", summary="Analyze volume spikes and events from Coinbase OHLCV (5m & 15m)")
def get_volume(
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

		df5 = compute_volume_features(to_df(data5))
		df15 = compute_volume_features(to_df(data15))

		signals5 = detect_volume_signals(df5, "5m")
		signals15 = detect_volume_signals(df15, "15m")

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"signals": signals5 + signals15,
			"meta": {
				"generated_at": datetime.now(tz=timezone.utc).isoformat(),
				"count_5m": int(len(df5)),
				"count_15m": int(len(df15)),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to analyze volume: {e}")


