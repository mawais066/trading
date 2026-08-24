from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from backend.services.market_data import market_data_service
from backend.agents.trading_agent import trading_agent

router = APIRouter(prefix="/api/analyze", tags=["AI Analysis"])

class AnalyzeRequest(BaseModel):
    symbol: str = Field(..., min_length=1, description="Ticker symbol, e.g. BTC/USD, AAPL")
    analysis_type: Optional[str] = Field(default="full", description="Type of analysis: 'full', 'technical', 'support_resistance', 'risk', 'trend'")
    custom_query: Optional[str] = Field(default=None, description="Optional custom question or focus")

@router.post("")
async def analyze_symbol(req: AnalyzeRequest):
    """
    Generate structured educational trading analysis for a given symbol.
    Sections:
    1. Market Data Summary
    2. Educational Analysis & Trend
    3. Possible Scenarios
    4. Risks & Risk Management
    5. Disclaimer
    """
    clean_sym = req.symbol.strip().upper()
    
    # Fetch live market data
    market_info = await market_data_service.fetch_market_data(clean_sym)
    
    prompt_map = {
        "full": f"Provide a complete beginner-friendly market analysis of {clean_sym}. Explain the trend, key support/resistance levels, indicators, 3 distinct scenarios (bullish/bearish/neutral), and risk management.",
        "technical": f"Focus on technical indicators (RSI, Moving Averages, Momentum) for {clean_sym} and explain what each indicator suggests.",
        "support_resistance": f"Explain support and resistance levels for {clean_sym}. How are these levels identified and what do they mean for beginner traders?",
        "trend": f"Explain the current trend conditions (bullish/bearish/consolidation) for {clean_sym} and how traders identify trend changes.",
        "risk": f"Provide a thorough risk assessment and risk management educational guide for {clean_sym}, including volatility, stop losses, and position sizing."
    }
    
    selected_prompt = req.custom_query if req.custom_query else prompt_map.get(req.analysis_type, prompt_map["full"])
    
    result = await trading_agent.analyze_market(clean_sym, market_info, custom_prompt=selected_prompt)
    
    return {
        "symbol": clean_sym,
        "market_status": market_info.get("status"),
        "market_data": market_info.get("data"),
        "analysis": result
    }
