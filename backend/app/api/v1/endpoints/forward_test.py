from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import csv
import io
from typing import Optional

from ...db import get_db
from ...models.forward_test import ForwardTestRun, ForwardTestTrade
from ...services.forward_test import start_test_run

router = APIRouter()


@router.post("/start", summary="Start a 5-day forward test run")
def start_forward_test(symbol: str, db: Session = Depends(get_db)):
	run = start_test_run(db, symbol=symbol)
	return {
		"id": run.id,
		"symbol": run.symbol,
		"start_time": run.start_time,
		"end_time": run.end_time,
		"is_active": run.is_active,
	}


@router.get("/status", summary="Get forward test status")
def get_forward_test_status(
	test_run_id: int = Query(..., description="ID of the forward test run"),
	db: Session = Depends(get_db),
):
	run: Optional[ForwardTestRun] = db.query(ForwardTestRun).filter(ForwardTestRun.id == test_run_id).first()
	if not run:
		raise HTTPException(status_code=404, detail="Forward test run not found")

	open_trades = db.query(ForwardTestTrade).filter(
		ForwardTestTrade.test_run_id == run.id,
		ForwardTestTrade.exit_price.is_(None),
	).order_by(ForwardTestTrade.id.desc()).all()

	closed_trades = db.query(ForwardTestTrade).filter(
		ForwardTestTrade.test_run_id == run.id,
		ForwardTestTrade.exit_price.is_not(None),
	).order_by(ForwardTestTrade.id.desc()).limit(20).all()

	return {
		"run": {
			"id": run.id,
			"symbol": run.symbol,
			"start_time": run.start_time,
			"end_time": run.end_time,
			"is_active": run.is_active,
			"summary": run.summary_json,
		},
		"open_trades": [
			{
				"id": t.id,
				"direction": t.direction,
				"entry_price": t.entry_price,
				"stop_loss": t.stop_loss,
				"take_profit": t.take_profit,
				"candle_time": t.candle_time,
			}
			for t in open_trades
		],
		"recent_trades": [
			{
				"id": t.id,
				"direction": t.direction,
				"entry_price": t.entry_price,
				"stop_loss": t.stop_loss,
				"take_profit": t.take_profit,
				"exit_price": t.exit_price,
				"exit_reason": t.exit_reason,
				"r_multiple": t.r_multiple,
				"profit_loss": t.profit_loss,
				"drawdown": t.drawdown,
				"candle_time": t.candle_time,
			}
			for t in closed_trades
		],
	}


@router.get("/trades", summary="Get all trades for a forward test run")
def get_forward_test_trades(
	test_run_id: int = Query(..., description="ID of the forward test run"),
	db: Session = Depends(get_db),
):
	run: Optional[ForwardTestRun] = db.query(ForwardTestRun).filter(ForwardTestRun.id == test_run_id).first()
	if not run:
		raise HTTPException(status_code=404, detail="Forward test run not found")

	trades = db.query(ForwardTestTrade).filter(
		ForwardTestTrade.test_run_id == run.id
	).order_by(ForwardTestTrade.id.asc()).all()

	return {
		"trades": [
			{
				"id": t.id,
				"direction": t.direction,
				"entry_price": t.entry_price,
				"stop_loss": t.stop_loss,
				"take_profit": t.take_profit,
				"exit_price": t.exit_price,
				"exit_reason": t.exit_reason,
				"r_multiple": t.r_multiple,
				"profit_loss": t.profit_loss,
				"drawdown": t.drawdown,
				"candle_time": t.candle_time,
			}
			for t in trades
		]
	}


@router.get("/export", summary="Export forward test trades as CSV")
def export_forward_test(
	test_run_id: int = Query(..., description="ID of the forward test run"),
	db: Session = Depends(get_db),
):
	run: Optional[ForwardTestRun] = db.query(ForwardTestRun).filter(ForwardTestRun.id == test_run_id).first()
	if not run:
		raise HTTPException(status_code=404, detail="Forward test run not found")

	trades = db.query(ForwardTestTrade).filter(
		ForwardTestTrade.test_run_id == run.id
	).order_by(ForwardTestTrade.id.asc()).all()

	output = io.StringIO()
	writer = csv.writer(output)
	writer.writerow([
		"id",
		"timestamp",
		"symbol",
		"direction",
		"entry_price",
		"stop_loss",
		"take_profit",
		"exit_price",
		"exit_reason",
		"r_multiple",
		"profit_loss",
		"drawdown",
		"candle_time",
		"test_run_id",
	])
	for t in trades:
		writer.writerow([
			t.id,
			t.created_at.isoformat() if t.created_at else "",
			t.symbol,
			t.direction,
			t.entry_price,
			t.stop_loss,
			t.take_profit,
			t.exit_price if t.exit_price is not None else "",
			t.exit_reason or "",
			t.r_multiple if t.r_multiple is not None else "",
			t.profit_loss if t.profit_loss is not None else "",
			t.drawdown if t.drawdown is not None else "",
			t.candle_time.isoformat() if t.candle_time else "",
			t.test_run_id,
		])

	output.seek(0)
	filename = f"forward_test_{run.id}_{datetime.now(tz=timezone.utc).date()}.csv"
	return StreamingResponse(
		iter([output.getvalue().encode("utf-8")]),
		media_type="text/csv",
		headers={"Content-Disposition": f'attachment; filename="{filename}"'},
	)


