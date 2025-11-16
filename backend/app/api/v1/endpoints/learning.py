from fastapi import APIRouter, HTTPException, status, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import ccxt
import pandas as pd
import math

# Reuse helpers
from .trend import compute_emas  # type: ignore
from .volume import compute_volume_features  # type: ignore
from .fusion import score_setup  # type: ignore

router = APIRouter()


def _direction_from_alignment(row: pd.Series) -> str:
	if row["ema20"] > row["ema50"] > row["ema200"]:
		return "uptrend"
	if row["ema20"] < row["ema50"] < row["ema200"]:
		return "downtrend"
	return "sideways"


@router.get("", summary="Analyze backtest features to optimize fusion weights")
def learning_task(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	limit: int = Query(1200, ge=400, le=5000, description="Number of 5m candles"),
) -> Dict[str, Any]:
	try:
		exchange = ccxt.coinbase({
			"enableRateLimit": True,
		})
		markets = exchange.load_markets()
		if symbol not in markets:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Symbol not available on Coinbase: {symbol}")

		# Fetch data
		df5 = pd.DataFrame(exchange.fetch_ohlcv(symbol, timeframe="5m", limit=limit),
			columns=["timestamp", "open", "high", "low", "close", "volume"])
		df15 = pd.DataFrame(exchange.fetch_ohlcv(symbol, timeframe="15m", limit=max(300, limit // 3)),
			columns=["timestamp", "open", "high", "low", "close", "volume"])

		# Indicators
		df5 = compute_emas(df5, [20, 50, 200])
		df15 = compute_emas(df15, [20, 50, 200])
		df5 = compute_volume_features(df5)
		df15 = compute_volume_features(df15)

		# Collect feature occurrences and outcomes over rolling window
		features = [
			"trend_up", "trend_down", "confirm_5m",
			"ema_cross_up", "ema_cross_down",
			"bos_up", "bos_down",
			"ignition_up", "ignition_down",
			"climax", "accumulation", "distribution",
		]
		stats = {f: {"hits": 0, "wins": 0} for f in features}

		def last_15(ts_ms: int) -> Optional[pd.Series]:
			row = df15[df15["timestamp"] <= ts_ms].tail(1)
			return row.iloc[0] if len(row) else None

		def feature_flags(i: int) -> Dict[str, int]:
			row5 = df5.iloc[i]
			row15 = last_15(int(row5["timestamp"]))
			flags = {f: 0 for f in features}
			if row15 is not None:
				trend_15 = _direction_from_alignment(row15)
				if trend_15 == "uptrend":
					flags["trend_up"] = 1
				elif trend_15 == "downtrend":
					flags["trend_down"] = 1
			# 5m confirm
			trend_5 = _direction_from_alignment(row5)
			if trend_5 in ["uptrend", "downtrend"]:
				flags["confirm_5m"] = 1
			# EMA crosses
			if i >= 1:
				prev = df5.iloc[i - 1]; curr = row5
				for a, b, up_key, down_key in [(20, 50, "ema_cross_up", "ema_cross_down"), (50, 200, "ema_cross_up", "ema_cross_down"), (20, 200, "ema_cross_up", "ema_cross_down")]:
					prev_diff = prev[f"ema{a}"] - prev[f"ema{b}"]
					curr_diff = curr[f"ema{a}"] - curr[f"ema{b}"]
					if pd.notna(prev_diff) and pd.notna(curr_diff):
						if prev_diff <= 0 and curr_diff > 0:
							flags[up_key] = 1
						if prev_diff >= 0 and curr_diff < 0:
							flags[down_key] = 1
			# BOS
			if i >= 21:
				window = df5.iloc[i - 21: i - 1]
				last = row5
				if last["close"] > window["high"].max():
					flags["bos_up"] = 1
				if last["close"] < window["low"].min():
					flags["bos_down"] = 1
			# Volume features
			rv = row5.get("rv"); body_pct = row5.get("body_pct")
			if pd.notna(rv) and rv is not None:
				if rv >= 3.0:
					flags["climax"] = 1
				if rv >= 2.0 and pd.notna(body_pct) and body_pct is not None and body_pct >= 0.6:
					if row5["close"] > row5["open"]:
						flags["ignition_up"] = 1
					elif row5["close"] < row5["open"]:
						flags["ignition_down"] = 1
			win50 = df5.iloc[max(0, i - 50): i + 1]
			active = win50[win50["rv"] >= 1.5] if "rv" in win50 else pd.DataFrame()
			if len(active) >= 5:
				score = int((active["close"] > active["open"]).sum() - (active["close"] < active["open"]).sum())
				if score > 0:
					flags["accumulation"] = 1
				elif score < 0:
					flags["distribution"] = 1
			return flags

		# Evaluate outcomes using forward return next N bars (e.g., 12 bars ~ 1 hour)
		horizon = 12
		for i in range(250, len(df5) - horizon):
			flags = feature_flags(i)
			entry = float(df5.iloc[i]["close"])
			exit = float(df5.iloc[i + horizon]["close"])
			ret = (exit / entry - 1.0)
			win = 1 if ret >= 0 else 0
			for k, v in flags.items():
				if v:
					stats[k]["hits"] += 1
					stats[k]["wins"] += win

		# Effectiveness: win rate minus baseline
		total = sum(s["hits"] for s in stats.values())
		baseline = 0.5  # assume 50% unless data-rich (we could compute overall)
		effectiveness = {k: ((s["wins"] / s["hits"]) - baseline) if s["hits"] > 20 else 0.0 for k, s in stats.items()}

		# Normalize to weights (0..1), preserve sign preference
		max_abs = max((abs(v) for v in effectiveness.values()), default=1.0) or 1.0
		weights = {k: round((v / max_abs + 0.0), 3) for k, v in effectiveness.items()}

		# Map to fusion components
		updated_weights = {
			"trend_base": round(max(weights["trend_up"], weights["trend_down"]) * 30, 1),
			"confirm_5m": round(weights["confirm_5m"] * 15, 1),
			"ema_cross": round(max(weights["ema_cross_up"], weights["ema_cross_down"]) * 20, 1),
			"bos": round(max(weights["bos_up"], weights["bos_down"]) * 15, 1),
			"ignition": round(max(weights["ignition_up"], weights["ignition_down"]) * 12, 1),
			"climax": round(weights["climax"] * 6, 1),
			"accumulation": round(weights["accumulation"] * 10, 1),
			"distribution": round(weights["distribution"] * 10, 1),
		}

		ranking = sorted([{ "feature": k, "effectiveness": round(v, 3), "hits": stats[k]["hits"] } for k, v in effectiveness.items()], key=lambda x: x["effectiveness"], reverse=True)

		formula_preview = (
			"score = trend_base"
			" + confirm_5m*w1"
			" + ema_cross*w2"
			" + bos*w3"
			" + ignition*w4"
			" + climax*w5"
			" + accumulation*w6"
			" + distribution*w7"
		)

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"updated_weights": updated_weights,
			"feature_ranking": ranking,
			"formula_preview": formula_preview,
			"meta": {
				"generated_at": datetime.now(tz=timezone.utc).isoformat(),
				"horizon_bars": horizon,
				"samples": total,
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to learn weights: {e}")


