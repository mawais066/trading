from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from backend.services.market_data import market_data_service

router = APIRouter(prefix="/api/market", tags=["Market Data"])

@router.get("/symbols/popular")
async def get_popular_symbols():
    """Get curated list of popular crypto and equity symbols."""
    return {"symbols": market_data_service.get_supported_symbols()}

@router.get("/symbols/search")
async def search_symbols(q: str = Query(default="", description="Search query")):
    """Search for symbols by ticker or name."""
    results = market_data_service.search_symbols(q)
    return {"query": q, "results": results}

@router.get("/{symbol:path}")
async def get_market_data(symbol: str):
    """
    Fetch live market quote, 24h summary, historical candles, and calculated technical indicators.
    If credentials are missing or API fails, returns explicit structured status.
    """
    cleaned_symbol = symbol.strip().upper()
    if not cleaned_symbol:
        raise HTTPException(status_code=400, detail="Symbol cannot be empty.")

    result = await market_data_service.fetch_market_data(cleaned_symbol)
    return result
