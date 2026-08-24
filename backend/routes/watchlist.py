import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from backend.services.market_data import market_data_service

router = APIRouter(prefix="/api/watchlist", tags=["Watchlist"])

WATCHLIST_FILE = Path(__file__).resolve().parent.parent / "watchlist.json"

DEFAULT_WATCHLIST = [
    "BTC/USD",
    "ETH/USD",
    "SOL/USD",
    "BNB/USD",
    "XRP/USD",
    "DOGE/USD",
    "ADA/USD",
    "AVAX/USD",
    "LINK/USD",
    "DOT/USD",
    "SHIB/USD",
    "NEAR/USD",
    "PEPE/USD",
    "SUI/USD",
    "RENDER/USD",
    "AAPL",
    "NVDA",
    "TSLA"
]

def load_watchlist_symbols() -> List[str]:
    if WATCHLIST_FILE.exists():
        try:
            with open(WATCHLIST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            pass
    return DEFAULT_WATCHLIST.copy()

def save_watchlist_symbols(symbols: List[str]):
    try:
        with open(WATCHLIST_FILE, "w", encoding="utf-8") as f:
            json.dump(symbols, f, indent=2)
    except Exception:
        pass

class AddWatchlistRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Symbol to add to watchlist")

@router.get("")
async def get_watchlist():
    """Retrieve all symbols in the watchlist along with their current status."""
    symbols = load_watchlist_symbols()
    watchlist_items = []
    
    for sym in symbols:
        market_res = await market_data_service.fetch_market_data(sym)
        item = {
            "symbol": sym,
            "status": market_res.get("status", "Live Data"),
            "data": market_res.get("data"),
            "error": market_res.get("error") if not market_res.get("success") else None
        }
        watchlist_items.append(item)
        
    return {"symbols": symbols, "items": watchlist_items}

@router.post("")
async def add_to_watchlist(req: AddWatchlistRequest):
    """Add a new symbol to the user watchlist."""
    clean_sym = req.symbol.strip().upper()
    symbols = load_watchlist_symbols()
    
    if clean_sym in symbols:
        return {"message": f"Symbol '{clean_sym}' is already in your watchlist.", "symbols": symbols}
    
    symbols.append(clean_sym)
    save_watchlist_symbols(symbols)
    return {"message": f"Symbol '{clean_sym}' added successfully.", "symbols": symbols}

@router.delete("/{symbol:path}")
async def remove_from_watchlist(symbol: str):
    """Remove a symbol from the user watchlist."""
    clean_sym = symbol.strip().upper()
    symbols = load_watchlist_symbols()
    
    if clean_sym not in symbols:
        raise HTTPException(status_code=404, detail=f"Symbol '{clean_sym}' not found in watchlist.")
    
    symbols = [s for s in symbols if s != clean_sym]
    save_watchlist_symbols(symbols)
    return {"message": f"Symbol '{clean_sym}' removed.", "symbols": symbols}
