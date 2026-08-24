import json
from typing import Dict, Any, List, Optional
from backend.services.ai_service import ai_service

SYSTEM_PROMPT = """You are a professional, beginner-friendly Educational Trading AI Assistant.

CORE MANDATES & SAFETY RULES:
1. EDUCATIONAL ANALYSIS ONLY: You provide educational market commentary and technical analysis only.
2. NO TRADE EXECUTION: You CANNOT and MUST NOT execute trades, place buy/sell orders, or manage user funds.
3. NO FINANCIAL ADVICE: You do not provide personalized financial advice. Every analysis must emphasize learning and risk awareness.
4. NO GUARANTEES: Never present predictions as guaranteed or certain outcomes. Markets are inherently uncertain.
5. CLEAR SEPARATION: You MUST structure every market analysis into the following 4 distinct sections:
   - Section 1: Market Data Summary (Key prices, changes, and detected metrics)
   - Section 2: Technical & Educational Analysis (Trend breakdown, indicator readings, support/resistance concepts)
   - Section 3: Possible Scenarios (Objective Bullish, Bearish, and Sideways/Neutral scenarios)
   - Section 4: Risk Factors & Risk Management (Volatility considerations, capital preservation, risk-to-reward principles)
6. MANDATORY DISCLAIMER: Always conclude with the exact text:
   "⚠️ Disclaimer: This analysis is for educational and informational purposes only and is not financial advice."

When answering user questions, maintain a clear, encouraging, beginner-friendly, and rigorous tone. Explain complex terms (like RSI, moving averages, support/resistance, breakouts) in simple terms so beginners can learn and understand.
"""

class TradingAgent:
    def __init__(self):
        self.system_prompt = SYSTEM_PROMPT

    async def analyze_market(self, symbol: str, market_info: Dict[str, Any], custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a structured educational analysis for a symbol using live market data context.
        """
        symbol_upper = symbol.strip().upper()
        
        # Prepare context payload for the AI
        if market_info.get("success") and market_info.get("data"):
            data = market_info["data"]
            indicators = data.get("indicators", {})
            market_context = (
                f"LIVE MARKET DATA FOR {symbol_upper}:\n"
                f"- Current Price: ${data.get('price', 'N/A'):,.2f} USD\n"
                f"- 24h Change: {data.get('change', 0):+.2f} ({data.get('change_percent', 0):+.2f}%)\n"
                f"- 24h High: ${data.get('high_24h', 'N/A'):,.2f} | 24h Low: ${data.get('low_24h', 'N/A'):,.2f}\n"
                f"- 24h Volume: ${data.get('volume_24h', 0):,.2f}\n"
                f"- Calculated 14-period RSI: {indicators.get('rsi_14', 'N/A')}\n"
                f"- Calculated SMA 20: ${indicators.get('sma_20', 'N/A')} | SMA 50: ${indicators.get('sma_50', 'N/A')}\n"
                f"- Estimated Support Level: ${indicators.get('support', 'N/A')}\n"
                f"- Estimated Resistance Level: ${indicators.get('resistance', 'N/A')}\n"
                f"- General Algorithmic Trend: {indicators.get('trend', 'Neutral')}\n"
                f"- Est. Volatility: {indicators.get('volatility_pct', 'N/A')}%\n"
            )
        else:
            market_context = (
                f"LIVE MARKET DATA STATUS FOR {symbol_upper}:\n"
                f"Status: Market data is currently unavailable from the configured trading API.\n"
                f"Please provide an educational overview explaining how a trader would technically analyze {symbol_upper}, "
                f"key macro factors, typical support/resistance dynamics for this asset, and foundational risk management."
            )

        user_instruction = custom_prompt or (
            f"Please provide a comprehensive beginner-friendly educational breakdown of {symbol_upper}. "
            f"Analyze the trend, explain the indicators, outline plausible scenarios, and highlight key risk management principles."
        )

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": f"{market_context}\n\nUser Request: {user_instruction}\n\nPlease format your response cleanly with clear section headings."
            }
        ]

        result = await ai_service.generate_response(messages)
        return result

    async def chat(self, user_message: str, symbol: Optional[str] = None, market_info: Optional[Dict[str, Any]] = None, conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Handle interactive chat queries with optional symbol context and past conversation messages.
        """
        messages = [{"role": "system", "content": self.system_prompt}]

        # Inject market context if available
        if symbol and market_info and market_info.get("success") and market_info.get("data"):
            data = market_info["data"]
            ind = data.get("indicators", {})
            context_summary = (
                f"[SYSTEM CONTEXT: The user is currently viewing {symbol.upper()}. "
                f"Current Price: ${data.get('price')}, 24h Change: {data.get('change_percent')}%, "
                f"RSI(14): {ind.get('rsi_14')}, SMA(20): {ind.get('sma_20')}, SMA(50): {ind.get('sma_50')}, "
                f"Support: {ind.get('support')}, Resistance: {ind.get('resistance')}, Trend: {ind.get('trend')}]"
            )
            messages.append({"role": "system", "content": context_summary})

        # Append previous conversation history (up to last 10 turns)
        if conversation_history:
            for msg in conversation_history[-10:]:
                if msg.get("role") in ["user", "assistant"] and msg.get("content"):
                    messages.append({"role": msg["role"], "content": msg["content"]})

        # Add the new user message
        messages.append({"role": "user", "content": user_message})

        result = await ai_service.generate_response(messages)
        return result

trading_agent = TradingAgent()
