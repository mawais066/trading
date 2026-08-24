from fastapi import APIRouter
from backend.config import settings

router = APIRouter(prefix="/api/status", tags=["System Status"])

@router.get("")
async def get_system_status():
    """
    Check backend health and configuration status without exposing sensitive credentials.
    Helps the frontend display setup assistants and warnings if keys are missing.
    """
    return {
        "status": "online",
        "model_name": settings.MODEL_NAME,
        "ai_configured": settings.is_ai_api_configured,
        "trading_api_configured": settings.is_trading_api_configured,
        "ai_base_url": settings.AI_API_BASE_URL,
        "trading_base_url_set": bool(settings.TRADING_BASE_URL and settings.TRADING_BASE_URL != "PASTE_TRADING_API_BASE_URL_HERE"),
        "disclaimer": "This is not financial advice. The system provides educational analysis only."
    }
