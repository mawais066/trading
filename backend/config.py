from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Look for .env in current directory or workspace root
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    # Trading Data API
    TRADING_API_KEY: str = Field(default="PASTE_YOUR_TRADING_API_KEY_HERE")
    TRADING_BASE_URL: str = Field(default="PASTE_TRADING_API_BASE_URL_HERE")
    
    # AI Model Settings
    MODEL_NAME: str = Field(default="deepseek-ai/DeepSeek-OCR")
    AI_API_KEY: str = Field(default="PASTE_YOUR_AI_API_KEY_HERE")
    AI_API_BASE_URL: str = Field(default="https://api.openai.com/v1")
    
    # Server Settings
    PORT: int = Field(default=8000)
    HOST: str = Field(default="0.0.0.0")
    CORS_ORIGINS: str = Field(default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_trading_api_configured(self) -> bool:
        return bool(
            self.TRADING_API_KEY
            and self.TRADING_API_KEY != "PASTE_YOUR_TRADING_API_KEY_HERE"
            and self.TRADING_BASE_URL
            and self.TRADING_BASE_URL != "PASTE_TRADING_API_BASE_URL_HERE"
            and not self.TRADING_API_KEY.startswith("PASTE_")
        )

    @property
    def is_ai_api_configured(self) -> bool:
        return bool(
            self.AI_API_KEY
            and self.AI_API_KEY != "PASTE_YOUR_AI_API_KEY_HERE"
            and not self.AI_API_KEY.startswith("PASTE_")
        )

settings = Settings()
