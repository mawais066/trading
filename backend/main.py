import uvicorn
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging

from backend.config import settings
from backend.routes.market import router as market_router
from backend.routes.watchlist import router as watchlist_router
from backend.routes.analysis import router as analysis_router
from backend.routes.chat import router as chat_router
from backend.routes.status import router as status_router
from backend.routes.portfolio import router as portfolio_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("trading_backend")

app = FastAPI(
    title="Trading AI Agent API",
    description="Educational AI Market Analysis and Assistant Service. (Not Financial Advice - Educational Only)",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routes
app.include_router(status_router)
app.include_router(market_router)
app.include_router(watchlist_router)
app.include_router(analysis_router)
app.include_router(chat_router)
app.include_router(portfolio_router)

# Mount Static Frontend (Pure HTML, CSS, JS)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global Exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "details": str(exc),
            "hint": "Check your .env settings or server logs for more details."
        }
    )

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
