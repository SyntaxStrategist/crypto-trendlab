from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..db import Base


class ForwardTestRun(Base):
	__tablename__ = "test_runs"

	id = Column(Integer, primary_key=True, index=True)
	symbol = Column(String, nullable=False, index=True)
	start_time = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=timezone.utc))
	end_time = Column(DateTime(timezone=True), nullable=True)
	is_active = Column(Boolean, default=True, index=True)
	summary_json = Column(Text, nullable=True)
	last_candle_ts = Column(BigInteger, nullable=True)  # ms since epoch

	trades = relationship("ForwardTestTrade", back_populates="run", cascade="all, delete-orphan")


class ForwardTestTrade(Base):
	__tablename__ = "forward_tests"

	id = Column(Integer, primary_key=True, index=True)
	test_run_id = Column(Integer, ForeignKey("test_runs.id"), nullable=False, index=True)
	symbol = Column(String, nullable=False, index=True)
	direction = Column(String, nullable=False)  # long / short
	entry_price = Column(Float, nullable=False)
	stop_loss = Column(Float, nullable=False)
	take_profit = Column(Float, nullable=False)
	exit_price = Column(Float, nullable=True)
	exit_reason = Column(String, nullable=True)  # take_profit / stop_loss / signal_flip / session_end / manual
	r_multiple = Column(Float, nullable=True)
	profit_loss = Column(Float, nullable=True)  # percent or absolute, depending on convention
	drawdown = Column(Float, nullable=True)  # drawdown at close in percent
	candle_time = Column(DateTime(timezone=True), nullable=False)  # entry candle time
	created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=timezone.utc))

	run = relationship("ForwardTestRun", back_populates="trades")


