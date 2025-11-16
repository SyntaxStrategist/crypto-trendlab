from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./forward_tests.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
	connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db() -> None:
	"""
	Initialize database schema. Safe to call multiple times.
	"""
	from .models import forward_test  # noqa: F401

	Base.metadata.create_all(bind=engine)


def get_db() -> Generator:
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


