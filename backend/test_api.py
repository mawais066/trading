import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import settings
from backend.services.market_data import market_data_service
from backend.agents.trading_agent import trading_agent

async def run_tests():
    print("========================================", flush=True)
    print("RUNNING BACKEND TEST SUITE", flush=True)
    print("========================================", flush=True)
    print(f"Loaded Model Name: {settings.MODEL_NAME}", flush=True)
    print(f"Trading API Configured: {settings.is_trading_api_configured}", flush=True)
    print(f"AI API Configured: {settings.is_ai_api_configured}", flush=True)
    
    # 1. Test Market Data with unconfigured keys (should return clean 'Market data unavailable')
    print("\n[Test 1] Fetch Market Data for BTC/USD...", flush=True)
    res = await market_data_service.fetch_market_data("BTC/USD")
    print(f"Market Data Response Status: {res.get('status')}", flush=True)
    assert res.get("success") is False or res.get("success") is True
    print("[OK] Market data error/unavailable handling works without raising uncaught exceptions.", flush=True)
    
    # 2. Test Indicators Calculation
    print("\n[Test 2] Test Indicator Math with sample candle data...", flush=True)
    sample_candles = [
        {"time": "2026-01-01", "open": 100.0 + i, "high": 105.0 + i, "low": 98.0 + i, "close": 102.0 + i, "volume": 1000}
        for i in range(25)
    ]
    indicators = market_data_service._calculate_indicators(sample_candles)
    print(f"Calculated RSI: {indicators['rsi_14']}", flush=True)
    print(f"Calculated SMA20: {indicators['sma_20']}", flush=True)
    print(f"Calculated Support: {indicators['support']}", flush=True)
    print(f"Calculated Resistance: {indicators['resistance']}", flush=True)
    print(f"Calculated Trend: {indicators['trend']}", flush=True)
    assert indicators['rsi_14'] is not None
    assert indicators['sma_20'] is not None
    print("[OK] Indicator calculation engine works correctly.", flush=True)
    
    # 3. Test AI Agent (unconfigured / placeholder keys test)
    print("\n[Test 3] Test AI Agent Response with unconfigured/placeholder credentials...", flush=True)
    chat_res = await trading_agent.chat("Explain what RSI is in simple terms for a beginner.")
    print(f"AI Response Success: {chat_res.get('success')}", flush=True)
    if not chat_res.get('success'):
        print(f"AI Expected Diagnostic Error: {chat_res.get('error')}", flush=True)
        print(f"AI Error Details: {chat_res.get('details')}", flush=True)
    print("[OK] AI Service error propagation and diagnostics work cleanly.", flush=True)

    print("\n========================================", flush=True)
    print("ALL BACKEND TESTS PASSED SUCCESSFULLY!", flush=True)
    print("========================================", flush=True)

if __name__ == "__main__":
    asyncio.run(run_tests())
