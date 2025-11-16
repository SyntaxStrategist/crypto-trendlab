from fastapi import APIRouter, HTTPException, status, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import ccxt
import pandas as pd
import math

# Reuse helpers
from .trend import compute_emas  # type: ignore
from .fusion import score_setup  # type: ignore
from .volume import compute_volume_features  # type: ignore

router = APIRouter()


def _direction_from_alignment(row: pd.Series) -> str:
	if row["ema20"] > row["ema50"] > row["ema200"]:
		return "uptrend"
	if row["ema20"] < row["ema50"] < row["ema200"]:
		return "downtrend"
	return "sideways"


def _align_to_15m(ts_ms: int, df15: pd.DataFrame) -> Optional[pd.Series]:
	if df15.empty:
		return None
	# pick last 15m bar with timestamp <= ts_ms
	row = df15[df15["timestamp"] <= ts_ms].tail(1)
	return row.iloc[0] if len(row) else None


@router.get("", summary="Run fusion-based backtest over historical OHLCV (5m/15m)")
def run_backtest(
	symbol: str = Query(..., description="Trading pair (e.g., BTC/USDT)"),
	limit: int = Query(1500, ge=300, le=5000, description="Number of 5m candles"),
) -> Dict[str, Any]:
	try:
		exchange = ccxt.coinbase({
			"enableRateLimit": True,
		})
		markets = exchange.load_markets()
		if symbol not in markets:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Symbol not available on Coinbase: {symbol}")

		# Fetch historical
		df5 = pd.DataFrame(exchange.fetch_ohlcv(symbol, timeframe="5m", limit=limit),
			columns=["timestamp", "open", "high", "low", "close", "volume"])
		df15 = pd.DataFrame(exchange.fetch_ohlcv(symbol, timeframe="15m", limit=max(300, limit // 3)),
			columns=["timestamp", "open", "high", "low", "close", "volume"])

		# Indicators
		df5 = compute_emas(df5, [20, 50, 200])
		df15 = compute_emas(df15, [20, 50, 200])
		df5 = compute_volume_features(df5)
		df15 = compute_volume_features(df15)

		# Simulate
		trades: List[Dict[str, Any]] = []
		position: Optional[Dict[str, Any]] = None
		equity = 1.0
		highwater = equity
		equity_curve: List[float] = [equity]
		gross_profit = 0.0
		gross_loss = 0.0

		def fusion_at_idx(i: int) -> Dict[str, Any]:
			row5 = df5.iloc[i]
			row15 = _align_to_15m(int(row5["timestamp"]), df15)
			if row15 is None:
				return {"score": 0, "grade": "none", "direction": "none", "confidence": 0, "reasoning": ""}
			# Trend summaries
			trend_5 = _direction_from_alignment(row5)
			trend_15 = _direction_from_alignment(row15)
			trend = trend_15 if trend_15 != "sideways" else trend_5
			trend_summary = {
				"trend": trend,
				"trend_5m": trend_5,
				"trend_15m": trend_15,
				"last_ts_5m": int(row5["timestamp"]),
				"last_ts_15m": int(row15["timestamp"]),
			}
			# Trend signals (local, last 20 bars)
			win5 = df5.iloc[max(0, i - 20): i + 1]
			def ema_crosses_local(df: pd.DataFrame, tf: str) -> List[Dict[str, Any]]:
				signals: List[Dict[str, Any]] = []
				if len(df) >= 2:
					prev = df.iloc[-2]; curr = df.iloc[-1]
					for a, b in [(20, 50), (50, 200), (20, 200)]:
						prev_diff = prev[f"ema{a}"] - prev[f"ema{b}"]
						curr_diff = curr[f"ema{a}"] - curr[f"ema{b}"]
						if pd.notna(prev_diff) and pd.notna(curr_diff):
							if prev_diff <= 0 and curr_diff > 0:
								signals.append({"type": "ema_cross_up", "timeframe": tf})
							if prev_diff >= 0 and curr_diff < 0:
								signals.append({"type": "ema_cross_down", "timeframe": tf})
				# BOS
				if len(df) >= 21:
					window = df.iloc[-21:-1]
					last = df.iloc[-1]
					if last["close"] > window["high"].max():
						signals.append({"type": "bos_up", "timeframe": tf})
					if last["close"] < window["low"].min():
						signals.append({"type": "bos_down", "timeframe": tf})
				return signals
			trend_signals = ema_crosses_local(win5, "5m")
			# Volume signals at i (and accumulation window)
			vol_signals: List[Dict[str, Any]] = []
			rv = row5.get("rv")
			body_pct = row5.get("body_pct")
			dir = "up" if row5["close"] > row5["open"] else "down" if row5["close"] < row5["open"] else "flat"
			if pd.notna(rv) and rv is not None:
				if rv >= 3.0:
					vol_signals.append({"type": "climax", "timeframe": "5m", "dir": dir})
				if rv >= 2.0 and pd.notna(body_pct) and body_pct is not None and body_pct >= 0.6:
					vol_signals.append({"type": "ignition", "timeframe": "5m", "dir": dir})
			win50 = df5.iloc[max(0, i - 50): i + 1]
			active = win50[win50["rv"] >= 1.5] if "rv" in win50 else pd.DataFrame()
			if len(active) >= 5:
				score = int((active["close"] > active["open"]).sum() - (active["close"] < active["open"]).sum())
				if score > 0:
					vol_signals.append({"type": "accumulation", "timeframe": "5m"})
				elif score < 0:
					vol_signals.append({"type": "distribution", "timeframe": "5m"})
			# Score
			return score_setup(trend_summary, trend_signals, vol_signals)

		def grade_from_score(score: int) -> str:
			if score >= 80:
				return "A+"
			if score >= 65:
				return "A"
			if score >= 50:
				return "B"
			if score >= 35:
				return "C"
			return "none"

		for i in range(250, len(df5)):  # ensure indicators warmed up
			close = float(df5.iloc[i]["close"])
			ts = int(df5.iloc[i]["timestamp"])
			fused = fusion_at_idx(i)
			grade = grade_from_score(int(fused.get("score", 0)))
			direction = fused.get("direction", "none")

			# Manage open position
			if position:
				# update floating pl
				pct_chg = (close / position["entry_price"] - 1.0) * (1 if position["side"] == "long" else -1)
				# exits: TP 2%, SL 1%, or direction flip/grade deterioration
				take_profit = pct_chg >= 0.02
				stop_loss = pct_chg <= -0.01
				direction_flip = (direction == "short" and position["side"] == "long") or (direction == "long" and position["side"] == "short")
				grade_bad = grade in ["none", "C"]
				max_bars = (i - position["entry_index"]) >= 288
				if take_profit or stop_loss or direction_flip or grade_bad or max_bars:
					exit_price = close
					pl_pct = (exit_price / position["entry_price"] - 1.0) * (1 if position["side"] == "long" else -1)
					equity *= (1.0 + pl_pct)
					equity_curve.append(equity)
					if pl_pct >= 0:
						gross_profit += pl_pct
					else:
						gross_loss += abs(pl_pct)
					trades.append({
						"side": position["side"],
						"entry_ts": position["entry_ts"],
						"exit_ts": ts,
						"entry": position["entry_price"],
						"exit": exit_price,
						"pl_pct": round(pl_pct * 100, 2),
					})
					position = None
					highwater = max(highwater, equity)
					continue

			# Entry logic: grades A+, A, B in direction
			if not position and grade in ["A+", "A", "B"]:
				if direction in ["long", "short"]:
					position = {
						"side": direction,
						"entry_price": close,
						"entry_ts": ts,
						"entry_index": i,
					}

			# track drawdown
			highwater = max(highwater, equity)
			equity_curve.append(equity)

		# finalize open position (close at last price)
		if position:
			close = float(df5.iloc[-1]["close"])
			ts = int(df5.iloc[-1]["timestamp"])
			pl_pct = (close / position["entry_price"] - 1.0) * (1 if position["side"] == "long" else -1)
			equity *= (1.0 + pl_pct)
			equity_curve.append(equity)
			if pl_pct >= 0:
				gross_profit += pl_pct
			else:
				gross_loss += abs(pl_pct)
			trades.append({
				"side": position["side"],
				"entry_ts": position["entry_ts"],
				"exit_ts": ts,
				"entry": position["entry_price"],
				"exit": close,
				"pl_pct": round(pl_pct * 100, 2),
			})
			position = None

		# Stats
		num_trades = len(trades)
		wins = sum(1 for t in trades if t["pl_pct"] > 0)
		losses = num_trades - wins
		win_rate = (wins / num_trades * 100) if num_trades else 0.0
		total_pl_pct = (equity - 1.0) * 100
		profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float("inf") if gross_profit > 0 else 0.0
		# max drawdown from equity curve
		peak = -math.inf
		max_dd = 0.0
		for v in equity_curve:
			if v > peak:
				peak = v
			dd = (peak - v) / peak if peak > 0 else 0
			max_dd = max(max_dd, dd)

		return {
			"exchange": "coinbase",
			"symbol": symbol,
			"stats": {
				"trades": num_trades,
				"wins": wins,
				"losses": losses,
				"win_rate": round(win_rate, 2),
				"pl_pct": round(total_pl_pct, 2),
				"profit_factor": None if math.isinf(profit_factor) else round(profit_factor, 2),
				"max_drawdown_pct": round(max_dd * 100, 2),
			},
			"trades": trades[-100:],  # last 100 trades
			"meta": {
				"generated_at": datetime.now(tz=timezone.utc).isoformat(),
				"count_5m": int(len(df5)),
				"count_15m": int(len(df15)),
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to run backtest: {e}")


