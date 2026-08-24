from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from backend.services.market_data import market_data_service
from backend.agents.trading_agent import trading_agent

router = APIRouter(prefix="/api/chat", tags=["AI Chat Assistant"])

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message text")

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User prompt or trading question")
    symbol: Optional[str] = Field(default=None, description="Optional active symbol being discussed")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Previous conversation turns")

@router.post("")
async def chat_with_agent(req: ChatRequest):
    """
    Interactive Q&A with the Educational Trading AI Agent.
    Retains conversational context and automatically grounds answers with live market data if a symbol is active.
    """
    clean_sym = req.symbol.strip().upper() if req.symbol else None
    market_info = None
    if clean_sym:
        market_info = await market_data_service.fetch_market_data(clean_sym)
        
    history_dicts = [{"role": m.role, "content": m.content} for m in req.history] if req.history else []
    
    result = await trading_agent.chat(
        user_message=req.message,
        symbol=clean_sym,
        market_info=market_info,
        conversation_history=history_dicts
    )
    
    return {
        "reply": result,
        "symbol": clean_sym,
        "market_status": market_info.get("status") if market_info else None
    }
