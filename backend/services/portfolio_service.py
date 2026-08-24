import json
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from backend.services.market_data import market_data_service

PORTFOLIO_FILE = Path(__file__).resolve().parent.parent / "portfolio.json"

DEFAULT_PORTFOLIO = {
    "cash_balance": 100000.0,  # $100,000 default virtual demo cash
    "initial_capital": 100000.0,
    "holdings": {},  # symbol -> {"quantity": float, "avg_price": float, "total_invested": float}
    "order_history": []
}

class TradeOrderRequest(BaseModel):
    symbol: str = Field(..., description="Symbol, e.g. BTC/USD, AAPL")
    order_type: str = Field(..., description="'BUY' or 'SELL'")
    quantity: float = Field(..., gt=0, description="Number of units to trade")

class PortfolioService:
    def __init__(self):
        self._ensure_file()

    def _ensure_file(self):
        if not PORTFOLIO_FILE.exists():
            self._save(DEFAULT_PORTFOLIO)

    def _load(self) -> Dict[str, Any]:
        try:
            if PORTFOLIO_FILE.exists():
                with open(PORTFOLIO_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return DEFAULT_PORTFOLIO.copy()

    def _save(self, data: Dict[str, Any]):
        try:
            with open(PORTFOLIO_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving portfolio: {e}")

    async def get_portfolio(self) -> Dict[str, Any]:
        data = self._load()
        cash = data.get("cash_balance", 100000.0)
        holdings_raw = data.get("holdings", {})
        
        holdings_list = []
        total_holdings_value = 0.0
        total_invested = 0.0

        for sym, h in holdings_raw.items():
            qty = float(h.get("quantity", 0))
            if qty <= 0.000001:
                continue

            avg_price = float(h.get("avg_price", 0))
            invested = float(h.get("total_invested", qty * avg_price))
            total_invested += invested

            # Fetch live current price
            market_res = await market_data_service.fetch_market_data(sym)
            if market_res.get("success") and market_res.get("data"):
                cur_price = float(market_res["data"]["price"])
            else:
                cur_price = avg_price  # fallback to entry price if market offline

            cur_value = round(qty * cur_price, 2)
            total_holdings_value += cur_value

            pnl = round(cur_value - invested, 2)
            pnl_pct = round((pnl / invested) * 100, 2) if invested > 0 else 0.0

            holdings_list.append({
                "symbol": sym,
                "quantity": qty,
                "avg_price": avg_price,
                "current_price": cur_price,
                "total_invested": invested,
                "current_value": cur_value,
                "pnl": pnl,
                "pnl_percent": pnl_pct
            })

        total_portfolio_value = round(cash + total_holdings_value, 2)
        total_pnl = round(total_portfolio_value - data.get("initial_capital", 100000.0), 2)
        total_pnl_pct = round((total_pnl / data.get("initial_capital", 100000.0)) * 100, 2)

        return {
            "cash_balance": round(cash, 2),
            "initial_capital": data.get("initial_capital", 100000.0),
            "total_holdings_value": round(total_holdings_value, 2),
            "total_portfolio_value": total_portfolio_value,
            "total_pnl": total_pnl,
            "total_pnl_percent": total_pnl_pct,
            "holdings": holdings_list,
            "order_history": data.get("order_history", [])[-20:]  # last 20 orders
        }

    async def execute_order(self, req: TradeOrderRequest) -> Dict[str, Any]:
        clean_sym = req.symbol.strip().upper()
        order_type = req.order_type.strip().upper()
        qty = float(req.quantity)

        if qty <= 0:
            return {"success": False, "error": "Quantity must be greater than 0"}

        if order_type not in ["BUY", "SELL"]:
            return {"success": False, "error": "Order type must be BUY or SELL"}

        # Get current execution price from market service
        market_res = await market_data_service.fetch_market_data(clean_sym)
        if market_res.get("success") and market_res.get("data"):
            exec_price = float(market_res["data"]["price"])
        else:
            # Fallback baseline prices for paper simulation if API is rate limited
            fallback_prices = {"BTC/USD": 67450.0, "ETH/USD": 3480.0, "AAPL": 309.35, "TSLA": 182.50, "NVDA": 885.0, "MSFT": 420.0, "SOL/USD": 145.0}
            exec_price = fallback_prices.get(clean_sym, 100.0)

        total_cost = round(qty * exec_price, 2)
        data = self._load()
        cash = float(data.get("cash_balance", 100000.0))
        holdings = data.get("holdings", {})

        if order_type == "BUY":
            if cash < total_cost:
                return {
                    "success": False,
                    "error": f"Insufficient Virtual Cash. Order requires ${total_cost:,.2f} but available balance is ${cash:,.2f}."
                }

            # Deduct cash
            cash = round(cash - total_cost, 2)
            data["cash_balance"] = cash

            # Update holdings
            if clean_sym in holdings:
                prev_qty = float(holdings[clean_sym]["quantity"])
                prev_invested = float(holdings[clean_sym]["total_invested"])
                new_qty = prev_qty + qty
                new_invested = prev_invested + total_cost
                new_avg = round(new_invested / new_qty, 2)

                holdings[clean_sym] = {
                    "quantity": new_qty,
                    "avg_price": new_avg,
                    "total_invested": new_invested
                }
            else:
                holdings[clean_sym] = {
                    "quantity": qty,
                    "avg_price": exec_price,
                    "total_invested": total_cost
                }

        elif order_type == "SELL":
            if clean_sym not in holdings or float(holdings[clean_sym]["quantity"]) < qty:
                available_qty = float(holdings.get(clean_sym, {}).get("quantity", 0))
                return {
                    "success": False,
                    "error": f"Insufficient Holdings. You have {available_qty} {clean_sym} available to sell."
                }

            # Add cash
            cash = round(cash + total_cost, 2)
            data["cash_balance"] = cash

            # Reduce holdings
            prev_qty = float(holdings[clean_sym]["quantity"])
            prev_invested = float(holdings[clean_sym]["total_invested"])
            new_qty = prev_qty - qty

            if new_qty <= 0.000001:
                del holdings[clean_sym]
            else:
                ratio = new_qty / prev_qty
                holdings[clean_sym] = {
                    "quantity": new_qty,
                    "avg_price": holdings[clean_sym]["avg_price"],
                    "total_invested": round(prev_invested * ratio, 2)
                }

        # Log order transaction
        order_record = {
            "id": f"ORD-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "symbol": clean_sym,
            "order_type": order_type,
            "quantity": qty,
            "price": exec_price,
            "total_value": total_cost,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        }

        if "order_history" not in data:
            data["order_history"] = []
        data["order_history"].append(order_record)
        data["holdings"] = holdings

        self._save(data)

        return {
            "success": True,
            "message": f"Successfully executed {order_type} order for {qty} {clean_sym} at ${exec_price:,.2f}",
            "order": order_record,
            "cash_balance": cash
        }

    def reset_portfolio(self) -> Dict[str, Any]:
        self._save(DEFAULT_PORTFOLIO.copy())
        return {"success": True, "message": "Simulated Paper Trading Portfolio reset to $100,000.00 virtual cash."}

portfolio_service = PortfolioService()
