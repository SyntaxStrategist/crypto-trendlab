from fastapi import APIRouter, Query, HTTPException, status
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import ccxt
import pandas as pd

# Reuse helpers
from .trend import compute_emas, detect_trend_and_signals  # type: ignore
from .volume import compute_volume_features, detect_volume_signals  # type: ignore
from .fusion import score_setup  # type: ignore

router = APIRouter()


def _latest_15(df15: pd.DataFrame, ts_ms: int) -> Optional[pd.Series]:
	row = df15[df15["timestamp"] <= ts_ms].tail(1)
	return row.iloc[0] if len(row) else None


@router.get("", summary="Realtime signal combining trend, volume, EMA/BOS, and learned weights")
def get_signals(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	limit: int = Query(600, ge=200, le=3000, description="Number of 5m candles for learning context"),
) -> Dict[str, Any]:
	try:
		exchange = ccxt.coinbase({ "enableRateLimit": True })
		markets = exchange.load_markets()
		if symbol not in markets:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Symbol not available on Coinbase: {symbol}")

		# Fetch OHLCV
		df5 = pd.DataFrame(exchange.fetch_ohlcv(symbol, timeframe="5m", limit=limit),
			columns=["timestamp", "open", "high", "low", "close", "volume"])
		df15 = pd.DataFrame(exchange.fetch_ohlcv(symbol, timeframe="15m", limit=max(200, limit // 3)),
			columns=["timestamp", "open", "high", "low", "close", "volume"])

		# Indicators and signals
		df5_tr = compute_emas(df5.copy(), [20, 50, 200])
		df15_tr = compute_emas(df15.copy(), [20, 50, 200])
		trend_summary, trend_signals = detect_trend_and_signals(df5_tr, df15_tr)

		df5_vol = compute_volume_features(df5.copy())
		df15_vol = compute_volume_features(df15.copy())
		vol_signals = detect_volume_signals(df5_vol, "5m") + detect_volume_signals(df15_vol, "15m")

		# Simple on-the-fly "learning": reuse learning method to derive weights quickly
		# We'll approximate by counting last N occurrences effectiveness with 12-bar forward return.
		horizon = 12
		def eff_weights() -> Dict[str, float]:
			features = [
				"trend_up", "trend_down", "confirm_5m",
				"ema_cross_up", "ema_cross_down",
				"bos_up", "bos_down",
				"ignition_up", "ignition_down",
				"climax", "accumulation", "distribution",
			]
			stats = {f: {"hits": 0, "wins": 0} for f in features}
			def direction_from_alignment(row: pd.Series) -> str:
				if row["ema20"] > row["ema50"] > row["ema200"]:
					return "uptrend"
				if row["ema20"] < row["ema50"] < row["ema200"]:
					return "downtrend"
				return "sideways"
			def flags(i: int) -> Dict[str, int]:
				row5 = df5_tr.iloc[i]
				row15 = _latest_15(df15_tr, int(row5["timestamp"]))
				fl = {f: 0 for f in features}
				if row15 is not None:
					t15 = direction_from_alignment(row15)
					if t15 == "uptrend": fl["trend_up"] = 1
					elif t15 == "downtrend": fl["trend_down"] = 1
				t5 = direction_from_alignment(row5)
				if t5 in ["uptrend", "downtrend"]:
					fl["confirm_5m"] = 1
				# ema crosses
				if i >= 1:
					prev = df5_tr.iloc[i-1]; curr = row5
					for a, b in [(20,50),(50,200),(20,200)]:
						prev_diff = prev[f"ema{a}"] - prev[f"ema{b}"]
						curr_diff = curr[f"ema{a}"] - curr[f"ema{b}"]
						if pd.notna(prev_diff) and pd.notna(curr_diff):
							if prev_diff <= 0 and curr_diff > 0: fl["ema_cross_up"] = 1
							if prev_diff >= 0 and curr_diff < 0: fl["ema_cross_down"] = 1
				# BOS
				if i >= 21:
					window = df5_tr.iloc[i-21:i-1]
					last = row5
					if last["close"] > window["high"].max(): fl["bos_up"] = 1
					if last["close"] < window["low"].min(): fl["bos_down"] = 1
				# volume
				row5v = df5_vol.iloc[i]
				rv = row5v.get("rv"); body_pct = row5v.get("body_pct")
				if pd.notna(rv) and rv is not None:
					if rv >= 3.0: fl["climax"] = 1
					if rv >= 2.0 and pd.notna(body_pct) and body_pct is not None and body_pct >= 0.6:
						if row5v["close"] > row5v["open"]: fl["ignition_up"] = 1
						elif row5v["close"] < row5v["open"]: fl["ignition_down"] = 1
				win50 = df5_vol.iloc[max(0, i-50): i+1]
				active = win50[win50["rv"] >= 1.5] if "rv" in win50 else pd.DataFrame()
				if len(active) >= 5:
					score = int((active["close"] > active["open"]).sum() - (active["close"] < active["open"]).sum())
					if score > 0: fl["accumulation"] = 1
					elif score < 0: fl["distribution"] = 1
				return fl
			for i in range(250, len(df5_tr) - horizon):
				fl = flags(i)
				entry = float(df5_tr.iloc[i]["close"])
				exit = float(df5_tr.iloc[i + horizon]["close"])
				win = 1 if (exit / entry - 1.0) >= 0 else 0
				for k,v in fl.items():
					if v:
						stats[k]["hits"] += 1
						stats[k]["wins"] += win
			baseline = 0.5
			eff = {k: ((s["wins"]/s["hits"]) - baseline) if s["hits"] > 20 else 0.0 for k,s in stats.items()}
			max_abs = max((abs(v) for v in eff.values()), default=1.0) or 1.0
			w = {k: (v / max_abs) for k,v in eff.items()}
			weights = {
				"trend_base": max(w.get("trend_up",0), w.get("trend_down",0)) * 30,
				"confirm_5m": w.get("confirm_5m",0) * 15,
				"ema_cross": max(w.get("ema_cross_up",0), w.get("ema_cross_down",0)) * 20,
				"bos": max(w.get("bos_up",0), w.get("bos_down",0)) * 15,
				"ignition": max(w.get("ignition_up",0), w.get("ignition_down",0)) * 12,
				"climax": w.get("climax",0) * 6,
				"accumulation": w.get("accumulation",0) * 10,
				"distribution": w.get("distribution",0) * 10,
			}
			# Clamp non-negative
			return {k: float(max(0.0, min(100.0, v))) for k,v in weights.items()}

		weights = eff_weights()

		# Fusion score (baseline)
		fused = score_setup(trend_summary, trend_signals, vol_signals)

		# Adjust fusion score using learned weights by emphasizing presence of signals in recent window
		adj = fused["score"]
		reasons = [fused.get("reasoning","")]
		# Trend
		adj += weights.get("trend_base", 0) * (1 if trend_summary.get("trend") in ["uptrend","downtrend"] else 0)
		# 5m confirm
		adj += weights.get("confirm_5m", 0) * (1 if trend_summary.get("trend_5m") in ["uptrend","downtrend"] else 0)
		# EMA/BOS
		last_trend_signals = trend_signals[-3:]
		if any(s["type"] == "ema_cross_up" for s in last_trend_signals): adj += weights.get("ema_cross", 0)
		if any(s["type"] == "ema_cross_down" for s in last_trend_signals): adj += weights.get("ema_cross", 0)
		if any(s["type"] in ["bos_up","bos_down"] for s in last_trend_signals): adj += weights.get("bos", 0)
		# Volume
		last_vol = vol_signals[-3:]
		if any(s["type"] == "ignition" for s in last_vol): adj += weights.get("ignition", 0)
		if any(s["type"] == "climax" for s in last_vol): adj += weights.get("climax", 0)
		if any(s["type"] == "accumulation" for s in last_vol): adj += weights.get("accumulation", 0)
		if any(s["type"] == "distribution" for s in last_vol): adj += weights.get("distribution", 0)

		adj = max(0, min(100, int(adj)))
		grade = "A+" if adj >= 80 else "A" if adj >= 65 else "B" if adj >= 50 else "C" if adj >= 35 else "none"
		direction = fused.get("direction","none")
		confidence = min(100, int(60 + (adj / 5))) if direction in ["long","short"] else min(100, int(adj / 2))

		# Map to actionable decision
		if direction == "long" and grade in ["A+","A","B"]:
			action = "buy"
			reasons.append("Trend supports long and fusion grade is tradable")
		elif direction == "short" and grade in ["A+","A","B"]:
			action = "sell"
			reasons.append("Trend supports short and fusion grade is tradable")
		else:
			action = "hold"
			reasons.append("No clear edge or grade too low")

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"action": action,
			"confidence": confidence,
			"fusion_grade": grade,
			"fusion_score": adj,
			"direction": direction,
			"reasoning": "; ".join([r for r in reasons if r]).strip(),
			"weights": weights,
			"meta": {
				"generated_at": datetime.now(tz=timezone.utc).isoformat(),
				"count_5m": int(len(df5)),
				"count_15m": int(len(df15)),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to generate signal: {e}")


