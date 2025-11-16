from fastapi import APIRouter, Query, HTTPException, status
from typing import Dict, Any, List, Tuple
from datetime import datetime, timezone
import ccxt
import pandas as pd

# Reuse helpers from existing endpoints
from .trend import compute_emas, detect_trend_and_signals  # type: ignore
from .volume import to_df, compute_volume_features, detect_volume_signals  # type: ignore

router = APIRouter()


def score_setup(
	trend_summary: Dict[str, Any],
	trend_signals: List[Dict[str, Any]],
	volume_signals: List[Dict[str, Any]],
) -> Dict[str, Any]:
	"""
	Scoring heuristic (0-100), grade, direction, and reasoning summary.
	"""
	score = 0
	reasons: List[str] = []

	# Direction from trend
	trend_dir = trend_summary.get("trend", "unknown")
	if trend_dir == "uptrend":
		direction = "long"
		score += 30
		reasons.append("15m EMA alignment uptrend (+30)")
	elif trend_dir == "downtrend":
		direction = "short"
		score += 30
		reasons.append("15m EMA alignment downtrend (+30)")
	else:
		direction = "none"
		reasons.append("No clear 15m trend (0)")

	# 5m confirmation
	if trend_summary.get("trend_5m") == "uptrend" and direction == "long":
		score += 15
		reasons.append("5m alignment confirms long (+15)")
	elif trend_summary.get("trend_5m") == "downtrend" and direction == "short":
		score += 15
		reasons.append("5m alignment confirms short (+15)")

	# Recent signals weight: consider last 12 signals combined
	recent_trend = trend_signals[-12:]
	recent_vol = volume_signals[-12:]

	for s in recent_trend:
		if s["type"] == "ema_cross_up":
			score += 20 if direction == "long" else -10
			reasons.append(f"EMA cross up ({s['timeframe']}) (+20/-10)")
		elif s["type"] == "ema_cross_down":
			score += 20 if direction == "short" else -10
			reasons.append(f"EMA cross down ({s['timeframe']}) (+20/-10)")
		elif s["type"] == "bos_up":
			score += 15 if direction == "long" else -5
			reasons.append(f"BOS up ({s['timeframe']}) (+15/-5)")
		elif s["type"] == "bos_down":
			score += 15 if direction == "short" else -5
			reasons.append(f"BOS down ({s['timeframe']}) (+15/-5)")

	for s in recent_vol:
		if s["type"] == "ignition":
			if direction == "long" and s.get("dir") == "up":
				score += 12
				reasons.append(f"Ignition up ({s['timeframe']}) (+12)")
			elif direction == "short" and s.get("dir") == "down":
				score += 12
				reasons.append(f"Ignition down ({s['timeframe']}) (+12)")
			else:
				score -= 5
				reasons.append(f"Ignition contra-trend ({s['timeframe']}) (-5)")
		elif s["type"] == "climax":
			if s.get("dir") in ["up", "down"]:
				score += 6
				reasons.append(f"Climax volume ({s['timeframe']}) (+6)")
		elif s["type"] == "accumulation":
			score += 10 if direction == "long" else 3
			reasons.append(f"Accumulation ({s['timeframe']}) (+10/+3)")
		elif s["type"] == "distribution":
			score += 10 if direction == "short" else 3
			reasons.append(f"Distribution ({s['timeframe']}) (+10/+3)")

	# Normalize and clamp
	score = max(0, min(100, score))

	# Grade
	if score >= 80:
		grade = "A+"
	elif score >= 65:
		grade = "A"
	elif score >= 50:
		grade = "B"
	elif score >= 35:
		grade = "C"
	else:
		grade = "none"

	# Confidence based on clarity of direction and presence of signals
	conf = 40
	if direction in ["long", "short"]:
		conf += 20
	if recent_trend:
		conf += 15
	if recent_vol:
		conf += 15
	conf = max(0, min(100, conf))

	return {
		"score": int(score),
		"grade": grade,
		"direction": direction,
		"confidence": int(conf),
		"reasoning": "; ".join(reasons[:8]),
	}


@router.get("", summary="Fusion score combining trend, volume, and structure signals")
def get_fusion(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	limit: int = Query(200, ge=50, le=500, description="Candles per timeframe"),
) -> Dict[str, Any]:
	try:
		exchange = ccxt.coinbase({
			"enableRateLimit": True,
		})
		markets = exchange.load_markets()
		if symbol not in markets:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Symbol not available on Coinbase: {symbol}")

		# Fetch OHLCV
		data5 = exchange.fetch_ohlcv(symbol, timeframe="5m", limit=limit)
		data15 = exchange.fetch_ohlcv(symbol, timeframe="15m", limit=limit)

		df5 = pd.DataFrame(data5, columns=["timestamp", "open", "high", "low", "close", "volume"])
		df15 = pd.DataFrame(data15, columns=["timestamp", "open", "high", "low", "close", "volume"])

		# Trend + structure
		df5_trend = compute_emas(df5.copy(), [20, 50, 200])
		df15_trend = compute_emas(df15.copy(), [20, 50, 200])
		trend_summary, trend_signals = detect_trend_and_signals(df5_trend, df15_trend)

		# Volume
		df5_vol = compute_volume_features(df5.copy())
		df15_vol = compute_volume_features(df15.copy())
		vol_signals_5 = detect_volume_signals(df5_vol, "5m")
		vol_signals_15 = detect_volume_signals(df15_vol, "15m")
		volume_signals = vol_signals_5 + vol_signals_15

		# Fusion score
		fused = score_setup(trend_summary, trend_signals, volume_signals)

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"fusion": fused,
			"summary": trend_summary,
			"meta": {
				"generated_at": datetime.now(tz=timezone.utc).isoformat(),
				"count_5m": int(len(df5)),
				"count_15m": int(len(df15)),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to compute fusion: {e}")


