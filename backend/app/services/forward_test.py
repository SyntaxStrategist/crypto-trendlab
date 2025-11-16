from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from ..models.forward_test import ForwardTestRun, ForwardTestTrade
from ..api.v1.endpoints.ohlcv import get_ohlcv  # type: ignore
from ..api.v1.endpoints.signals import get_signals  # type: ignore


def start_test_run(db: Session, symbol: str) -> ForwardTestRun:
	now = datetime.now(tz=timezone.utc)
	end_time = now + timedelta(days=5)
	run = ForwardTestRun(
		symbol=symbol,
		start_time=now,
		end_time=end_time,
		is_active=True,
		last_candle_ts=None,
		summary_json=None,
	)
	db.add(run)
	db.commit()
	db.refresh(run)
	return run


def _get_open_trade(db: Session, run_id: int) -> Optional[ForwardTestTrade]:
	return db.query(ForwardTestTrade).filter(
		ForwardTestTrade.test_run_id == run_id,
		ForwardTestTrade.exit_price.is_(None),
	).order_by(ForwardTestTrade.id.desc()).first()


def _compute_stats(db: Session, run: ForwardTestRun) -> Dict[str, Any]:
	trades: List[ForwardTestTrade] = db.query(ForwardTestTrade).filter(
		ForwardTestTrade.test_run_id == run.id
	).order_by(ForwardTestTrade.id.asc()).all()
	if not trades:
		return {
			"trades": 0,
			"wins": 0,
			"losses": 0,
			"win_rate": 0.0,
			"pl_pct": 0.0,
			"profit_factor": 0.0,
			"max_drawdown_pct": 0.0,
		}

	equity = 1.0
	peak = equity
	max_dd = 0.0
	wins = 0
	losses = 0
	gross_profit = 0.0
	gross_loss = 0.0

	for t in trades:
		if t.profit_loss is None:
			continue
		pl = t.profit_loss / 100.0
		equity *= (1.0 + pl)
		if pl >= 0:
			wins += 1
			gross_profit += pl
		else:
			losses += 1
			gross_loss += abs(pl)
		if equity > peak:
			peak = equity
		dd = (peak - equity) / peak if peak > 0 else 0.0
		max_dd = max(max_dd, dd)

	num_trades = wins + losses
	win_rate = (wins / num_trades * 100.0) if num_trades else 0.0
	pl_pct = (equity - 1.0) * 100.0
	if gross_loss > 0:
		profit_factor = gross_profit / gross_loss
	elif gross_profit > 0:
		profit_factor = float("inf")
	else:
		profit_factor = 0.0

	return {
		"trades": num_trades,
		"wins": wins,
		"losses": losses,
		"win_rate": round(win_rate, 2),
		"pl_pct": round(pl_pct, 2),
		"profit_factor": None if profit_factor == float("inf") else round(profit_factor, 2),
		"max_drawdown_pct": round(max_dd * 100.0, 2),
	}


def step_run(run: ForwardTestRun, db: Session) -> None:
	"""
	Process new closed 5m candles for a run using strictly forward-looking logic.
	"""
	if not run.is_active or run.end_time is None:
		return

	now = datetime.now(tz=timezone.utc)

	# Pull OHLCV via existing endpoint logic (Coinbase, normalized) without HTTP
	ohlcv = get_ohlcv(symbol=run.symbol, limit=500)  # type: ignore
	candles_5m = ohlcv["timeframes"]["5m"]

	if not candles_5m:
		return

	# Only process candles that are fully closed and newer than last_candle_ts
	last_ts = run.last_candle_ts or 0
	closed_cutoff_ms = int((now - timedelta(minutes=5)).timestamp() * 1000)
	new_candles = [c for c in candles_5m if c["t"] > last_ts and c["t"] <= closed_cutoff_ms]
	new_candles.sort(key=lambda c: c["t"])

	if not new_candles:
		return

	for c in new_candles:
		ts_ms = int(c["t"])
		candle_time = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
		close = float(c["c"])
		high = float(c["h"])
		low = float(c["l"])

		# Compute signal using existing endpoint logic (no HTTP)
		signal = get_signals(symbol=run.symbol, strategy="fusion", limit=600)  # type: ignore
		action = signal.get("action", "hold")

		open_trade = _get_open_trade(db, run.id)

		# Manage open position first
		if open_trade:
			exit_price: Optional[float] = None
			exit_reason: Optional[str] = None

			if open_trade.direction == "long":
				if low <= open_trade.stop_loss:
					exit_price = open_trade.stop_loss
					exit_reason = "stop_loss"
				elif high >= open_trade.take_profit:
					exit_price = open_trade.take_profit
					exit_reason = "take_profit"
			elif open_trade.direction == "short":
				if high >= open_trade.stop_loss:
					exit_price = open_trade.stop_loss
					exit_reason = "stop_loss"
				elif low <= open_trade.take_profit:
					exit_price = open_trade.take_profit
					exit_reason = "take_profit"

			# Signal flip exit
			if exit_price is None and action in ("buy", "sell"):
				if (open_trade.direction == "long" and action == "sell") or (
					open_trade.direction == "short" and action == "buy"
				):
					exit_price = close
					exit_reason = "signal_flip"

			if exit_price is not None:
				open_trade.exit_price = exit_price
				open_trade.exit_reason = exit_reason
				# Compute R multiple and P/L %
				if open_trade.direction == "long":
					risk = open_trade.entry_price - open_trade.stop_loss
					r = (exit_price - open_trade.entry_price) / risk if risk else 0.0
				else:
					risk = open_trade.stop_loss - open_trade.entry_price
					r = (open_trade.entry_price - exit_price) / risk if risk else 0.0
				open_trade.r_multiple = float(r)
				open_trade.profit_loss = float((exit_price / open_trade.entry_price - 1.0) * (100 if open_trade.direction == "long" else -100))
				open_trade.drawdown = None  # detailed per-trade DD optional; summary DD computed separately
				db.add(open_trade)

		# Decide on new entry using current action and only if no open trade
		open_trade = _get_open_trade(db, run.id)
		if not open_trade and action in ("buy", "sell"):
			direction = "long" if action == "buy" else "short"
			if direction == "long":
				sl = close * 0.99
				tp = close * 1.02
			else:
				sl = close * 1.01
				tp = close * 0.98
			new_trade = ForwardTestTrade(
				test_run_id=run.id,
				symbol=run.symbol,
				direction=direction,
				entry_price=close,
				stop_loss=sl,
				take_profit=tp,
				exit_price=None,
				exit_reason=None,
				r_multiple=None,
				profit_loss=None,
				drawdown=None,
				candle_time=candle_time,
			)
			db.add(new_trade)

		# update last processed candle timestamp
		run.last_candle_ts = ts_ms
		db.add(run)
		db.commit()

	# finalize run if end time passed
	if now >= run.end_time:
		open_trade = _get_open_trade(db, run.id)
		if open_trade:
			# close at last known close
			last_candle = new_candles[-1]
			exit_price = float(last_candle["c"])
			open_trade.exit_price = exit_price
			if open_trade.direction == "long":
				risk = open_trade.entry_price - open_trade.stop_loss
				r = (exit_price - open_trade.entry_price) / risk if risk else 0.0
			else:
				risk = open_trade.stop_loss - open_trade.entry_price
				r = (open_trade.entry_price - exit_price) / risk if risk else 0.0
			open_trade.r_multiple = float(r)
			open_trade.profit_loss = float(
				(exit_price / open_trade.entry_price - 1.0) * (100 if open_trade.direction == "long" else -100)
			)
			open_trade.exit_reason = "session_end"
			db.add(open_trade)

		stats = _compute_stats(db, run)
		run.summary_json = __import__("json").dumps(stats)
		run.is_active = False
		db.add(run)
		db.commit()


