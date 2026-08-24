from fastapi import APIRouter, HTTPException
from backend.services.portfolio_service import portfolio_service, TradeOrderRequest

router = APIRouter(prefix="/api", tags=["Paper Trading & Portfolio"])

@router.get("/portfolio")
async def get_portfolio_status():
    """Get paper trading portfolio summary, holdings, and order history."""
    return await portfolio_service.get_portfolio()

@router.post("/trade/order")
async def place_trade_order(req: TradeOrderRequest):
    """Execute simulated buy or sell paper trading order."""
    result = await portfolio_service.execute_order(req)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/portfolio/reset")
async def reset_paper_portfolio():
    """Reset virtual cash balance back to $100,000.00."""
    return portfolio_service.reset_portfolio()
