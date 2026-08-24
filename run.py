import sys
import webbrowser
import threading
import time
import uvicorn
from pathlib import Path

# Add project root to python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.config import settings

def open_browser():
    time.sleep(1.2)
    url = f"http://localhost:{settings.PORT}"
    print(f"Opening browser at {url} ...", flush=True)
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Could not open browser automatically: {e}", flush=True)

if __name__ == "__main__":
    print("=" * 65, flush=True)
    print("🚀 STARTING TRADING AI AGENT PLATFORM", flush=True)
    print(f"📡 Web Application URL: http://localhost:{settings.PORT}", flush=True)
    print(f"🤖 AI Model Configured: {settings.MODEL_NAME}", flush=True)
    print(f"📈 Trading API: {'Configured' if settings.is_trading_api_configured else 'Standby (Configure in .env)'}", flush=True)
    print(f"🧠 AI Provider: {'Configured' if settings.is_ai_api_configured else 'Standby (Configure in .env)'}", flush=True)
    print("⚠️  Notice: Educational only. Not financial advice. No real trades executed.", flush=True)
    print("=" * 65, flush=True)

    # Launch browser in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start FastAPI server
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
