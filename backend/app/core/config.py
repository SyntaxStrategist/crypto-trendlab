from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
	environment: str = "production"
	api_v1_prefix: str = "/api/v1"
	allowed_origins: List[str] = ["*"]

	class Config:
		env_file = ".env"
		env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
	return Settings()


