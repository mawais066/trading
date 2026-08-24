// ==============================================================================
// TradeAI - Frontend Application Logic (HTML / Pure JS + Paper Trading)
// ==============================================================================

// App State
let currentSymbol = 'BTC/USD';
let currentMarketData = null;
let watchlistItems = [];
let systemStatus = null;
let chatHistory = [];
let portfolioData = null;
let currentTradeMode = 'BUY'; // 'BUY' or 'SELL'

// Chart State
let chartType = 'candles';
let showSMA20 = true;
let showSMA50 = true;
let showVolume = true;
let currentTf = '1M';
let hoveredCandle = null;

// ==============================================================================
// API HELPERS
// ==============================================================================
const API_BASE = (window.location.origin.includes(':8000'))
  ? '/api'
  : 'http://localhost:8000/api';

async function apiRequest(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initLucide();
  setupEventListeners();
  
  // Load initial system status, watchlist & portfolio
  await loadSystemStatus();
  await loadWatchlist();
  await loadPortfolio();
  await selectSymbol(currentSymbol);
  
  window.addEventListener('resize', () => {
    drawChart();
  });
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ==============================================================================
// EVENT LISTENERS
// ==============================================================================
function setupEventListeners() {
  // Config Modal
  const modal = document.getElementById('config-modal');
  document.getElementById('btn-open-config').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('btn-close-config').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  document.getElementById('btn-close-config-footer').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // Symbol Search
  const searchInput = document.getElementById('input-symbol-search');
  const searchDropdown = document.getElementById('search-dropdown');
  
  let debounceTimeout = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      const q = e.target.value.trim();
      if (!q) {
        searchDropdown.classList.add('hidden');
        return;
      }
      try {
        const res = await apiRequest(`/market/symbols/search?q=${encodeURIComponent(q)}`);
        renderSearchResults(res.results || []);
      } catch (err) {
        console.error(err);
      }
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.add('hidden');
    }
  });

  // Watchlist Star Toggle
  document.getElementById('btn-star-symbol').addEventListener('click', async () => {
    const inList = watchlistItems.some(i => i.symbol === currentSymbol);
    if (inList) {
      await removeWatchlistSymbol(currentSymbol);
    } else {
      await addWatchlistSymbol(currentSymbol);
    }
  });

  // Add Watchlist Form
  document.getElementById('form-add-watchlist').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-add-watchlist');
    const sym = input.value.trim().toUpperCase();
    if (!sym) return;
    try {
      document.getElementById('watchlist-error-msg').classList.add('hidden');
      await addWatchlistSymbol(sym);
      input.value = '';
    } catch (err) {
      showWatchlistError(err.message || 'Failed to add symbol');
    }
  });

  // Chart Controls
  const btnCandles = document.getElementById('btn-chart-candles');
  const btnLine = document.getElementById('btn-chart-line');

  btnCandles.addEventListener('click', () => {
    chartType = 'candles';
    btnCandles.className = 'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all';
    btnLine.className = 'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-all';
    drawChart();
  });

  btnLine.addEventListener('click', () => {
    chartType = 'line';
    btnLine.className = 'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all';
    btnCandles.className = 'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-all';
    drawChart();
  });

  // Timeframe buttons
  document.querySelectorAll('.btn-timeframe').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-timeframe').forEach(b => {
        b.className = 'btn-timeframe px-2 py-1 rounded-md text-xs font-mono font-medium text-slate-400 hover:text-slate-200';
      });
      btn.className = 'btn-timeframe px-2 py-1 rounded-md text-xs font-mono font-bold bg-dark-600 text-white border border-slate-600';
      currentTf = btn.getAttribute('data-tf');
      drawChart();
    });
  });

  // Indicator Overlays
  const btnSMA20 = document.getElementById('btn-toggle-sma20');
  btnSMA20.addEventListener('click', () => {
    showSMA20 = !showSMA20;
    btnSMA20.className = `px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition-all ${
      showSMA20 ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold' : 'bg-dark-700/60 border-slate-700/60 text-slate-500'
    }`;
    drawChart();
  });

  const btnSMA50 = document.getElementById('btn-toggle-sma50');
  btnSMA50.addEventListener('click', () => {
    showSMA50 = !showSMA50;
    btnSMA50.className = `px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition-all ${
      showSMA50 ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 font-semibold' : 'bg-dark-700/60 border-slate-700/60 text-slate-500'
    }`;
    drawChart();
  });

  const btnVol = document.getElementById('btn-toggle-vol');
  btnVol.addEventListener('click', () => {
    showVolume = !showVolume;
    btnVol.className = `px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition-all ${
      showVolume ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold' : 'bg-dark-700/60 border-slate-700/60 text-slate-500'
    }`;
    drawChart();
  });

  // Canvas events
  const canvas = document.getElementById('trading-canvas');
  canvas.addEventListener('mousemove', handleCanvasHover);
  canvas.addEventListener('mouseleave', () => {
    hoveredCandle = null;
    updateChartHoverHeader();
  });

  // Trade Terminal Controls (Buy / Sell toggle)
  const btnBuy = document.getElementById('btn-trade-buy-mode');
  const btnSell = document.getElementById('btn-trade-sell-mode');
  const btnSubmitTrade = document.getElementById('btn-submit-trade');
  const btnSubmitText = document.getElementById('btn-submit-trade-text');

  btnBuy.addEventListener('click', () => {
    currentTradeMode = 'BUY';
    btnBuy.className = 'py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-500';
    btnSell.className = 'py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all bg-dark-700/60 text-slate-400 hover:text-rose-300 border border-slate-700/60';
    btnSubmitTrade.className = 'w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2';
    btnSubmitText.innerText = `Place Simulated BUY Order`;
    updateTradeEstimates();
  });

  btnSell.addEventListener('click', () => {
    currentTradeMode = 'SELL';
    btnSell.className = 'py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-500';
    btnBuy.className = 'py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all bg-dark-700/60 text-slate-400 hover:text-emerald-300 border border-slate-700/60';
    btnSubmitTrade.className = 'w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2';
    btnSubmitText.innerText = `Place Simulated SELL Order`;
    updateTradeEstimates();
  });

  // Quantity input listener
  const inputQty = document.getElementById('input-trade-qty');
  inputQty.addEventListener('input', updateTradeEstimates);

  // Quick percent buttons
  document.querySelectorAll('.btn-trade-pct').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.getAttribute('data-pct'), 10);
      calculateQuickPercentQty(pct);
    });
  });

  // Trade Form Submission
  document.getElementById('form-trade-order').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseFloat(inputQty.value);
    if (!qty || qty <= 0) return;
    await executeTrade(currentSymbol, currentTradeMode, qty);
  });

  // Reset Portfolio Button
  document.getElementById('btn-reset-portfolio').addEventListener('click', async () => {
    if (confirm("Are you sure you want to reset your simulated demo portfolio to $100,000 cash?")) {
      await apiRequest('/portfolio/reset', { method: 'POST' });
      await loadPortfolio();
    }
  });

  // AI Analysis Tabs & Button
  let selectedAnalysisTab = 'full';
  document.querySelectorAll('.btn-analysis-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.btn-analysis-tab').forEach(t => {
        t.className = 'btn-analysis-tab px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 bg-dark-700/60 text-slate-400 border border-slate-700/50 hover:bg-dark-700 hover:text-slate-200';
      });
      tab.className = 'btn-analysis-tab px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40';
      selectedAnalysisTab = tab.getAttribute('data-tab');
      runAnalysis(selectedAnalysisTab);
    });
  });

  document.getElementById('btn-run-analysis').addEventListener('click', () => {
    runAnalysis(selectedAnalysisTab);
  });

  // AI Chat
  document.getElementById('form-chat').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('input-chat-message');
    const msg = input.value.trim();
    if (msg) {
      sendChat(msg);
      input.value = '';
    }
  });

  document.querySelectorAll('.btn-quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      sendChat(btn.innerText.trim());
    });
  });

  document.getElementById('btn-clear-chat').addEventListener('click', () => {
    chatHistory = [];
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `
      <div class="flex items-start space-x-2.5 justify-start">
        <div class="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-3.5 h-3.5 text-purple-400"></i>
        </div>
        <div class="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-dark-700/80 border border-slate-700/60 text-slate-200 rounded-tl-none whitespace-pre-wrap">Conversation reset. What market concepts would you like to explore?</div>
      </div>
    `;
    initLucide();
  });
}

// ==============================================================================
// PORTFOLIO & TRADE LOGIC
// ==============================================================================
async function loadPortfolio() {
  try {
    const data = await apiRequest('/portfolio');
    portfolioData = data;
    renderPortfolioUI(data);
    updateTradeTerminalState();
  } catch (err) {
    console.error('Portfolio load error:', err);
  }
}

function renderPortfolioUI(data) {
  // Cash balance in navbar
  document.getElementById('nav-cash-balance').innerText = `$${data.cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  
  // Total Portfolio value
  document.getElementById('portfolio-total-val').innerText = `$${data.total_portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  // Render Holdings Table
  const tbody = document.getElementById('portfolio-holdings-body');
  const holdings = data.holdings || [];

  if (holdings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-slate-500 font-sans">
          No active holdings yet. Place a BUY order in the Trade Terminal above!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = holdings.map(h => {
    const isPnlPos = h.pnl >= 0;
    return `
      <tr class="hover:bg-dark-800/40 transition-colors">
        <td class="py-3 px-3">
          <button onclick="selectSymbol('${h.symbol}')" class="font-bold text-white hover:text-cyan-400 text-left flex items-center space-x-1">
            <span>${h.symbol}</span>
          </button>
        </td>
        <td class="py-3 px-3">${h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
        <td class="py-3 px-3">$${h.avg_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td class="py-3 px-3">$${h.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td class="py-3 px-3 font-bold text-white">$${h.current_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td class="py-3 px-3 font-bold ${isPnlPos ? 'text-emerald-400' : 'text-rose-400'}">
          ${isPnlPos ? '+' : ''}$${h.pnl.toFixed(2)} (${isPnlPos ? '+' : ''}${h.pnl_percent.toFixed(2)}%)
        </td>
        <td class="py-3 px-3 text-right">
          <button onclick="quickSellHolding('${h.symbol}', ${h.quantity})" class="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-bold transition-all">
            SELL ALL
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateTradeTerminalState() {
  document.getElementById('trade-asset-symbol').innerText = currentSymbol;
  
  // Current execution price
  const price = currentMarketData?.data?.price || 67450.0;
  document.getElementById('trade-exec-price').innerText = `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  // Check owned quantity
  let ownedQty = 0;
  if (portfolioData && portfolioData.holdings) {
    const holding = portfolioData.holdings.find(h => h.symbol === currentSymbol);
    if (holding) ownedQty = holding.quantity;
  }
  document.getElementById('trade-owned-qty').innerText = ownedQty.toLocaleString(undefined, { maximumFractionDigits: 6 });

  updateTradeEstimates();
}

function updateTradeEstimates() {
  const inputQty = document.getElementById('input-trade-qty');
  const qty = parseFloat(inputQty.value) || 0;
  const price = currentMarketData?.data?.price || 67450.0;
  const total = qty * price;
  
  document.getElementById('trade-total-cost').innerText = `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function calculateQuickPercentQty(pct) {
  const price = currentMarketData?.data?.price || 67450.0;
  const inputQty = document.getElementById('input-trade-qty');

  if (currentTradeMode === 'BUY') {
    const cash = portfolioData?.cash_balance || 100000.0;
    const allocCash = cash * (pct / 100);
    const qty = allocCash / price;
    inputQty.value = qty > 1 ? qty.toFixed(4) : qty.toFixed(6);
  } else {
    // SELL Mode
    const holding = portfolioData?.holdings?.find(h => h.symbol === currentSymbol);
    const owned = holding ? holding.quantity : 0;
    const qty = owned * (pct / 100);
    inputQty.value = qty > 1 ? qty.toFixed(4) : qty.toFixed(6);
  }
  updateTradeEstimates();
}

async function executeTrade(symbol, orderType, quantity) {
  const alertBox = document.getElementById('trade-alert-msg');
  const btnSubmit = document.getElementById('btn-submit-trade');

  btnSubmit.disabled = true;
  alertBox.classList.add('hidden');

  try {
    const res = await apiRequest('/trade/order', {
      method: 'POST',
      body: JSON.stringify({
        symbol: symbol,
        order_type: orderType,
        quantity: quantity
      })
    });

    if (res.success) {
      alertBox.className = 'text-[11px] p-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold';
      alertBox.innerText = `✓ ${res.message}`;
      alertBox.classList.remove('hidden');
      
      document.getElementById('input-trade-qty').value = '';
      await loadPortfolio();
    }
  } catch (err) {
    alertBox.className = 'text-[11px] p-2.5 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 font-semibold';
    alertBox.innerText = `✗ ${err.message}`;
    alertBox.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
  }
}

async function quickSellHolding(symbol, quantity) {
  if (confirm(`Sell ${quantity} ${symbol} at current market price?`)) {
    await executeTrade(symbol, 'SELL', quantity);
  }
}

// ==============================================================================
// SYSTEM & WATCHLIST FUNCTIONS
// ==============================================================================
async function loadSystemStatus() {
  try {
    const status = await apiRequest('/status');
    systemStatus = status;
    
    document.getElementById('analysis-model-badge').innerText = status.model_name || 'deepseek-ai/DeepSeek-OCR';
    document.getElementById('modal-model-name').innerText = status.model_name || 'deepseek-ai/DeepSeek-OCR';

    const tradingPill = document.getElementById('trading-status-pill');
    const tradingText = document.getElementById('trading-status-text');
    if (status.trading_api_configured) {
      tradingPill.className = 'hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      tradingText.innerText = 'Alpha Vantage Live';
    } else {
      tradingPill.className = 'hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium bg-slate-800 border-slate-700 text-slate-400';
      tradingText.innerText = 'Standby';
    }
  } catch (err) {
    console.warn('System status not reached:', err);
  }
}

async function loadWatchlist() {
  try {
    const res = await apiRequest('/watchlist');
    watchlistItems = res.items || [];
    renderWatchlist();
  } catch (err) {
    console.error('Watchlist fetch error:', err);
  }
}

function renderWatchlist() {
  const container = document.getElementById('watchlist-items-container');
  const countBadge = document.getElementById('watchlist-count-badge');
  countBadge.innerText = `${watchlistItems.length} items`;

  if (watchlistItems.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">No symbols in watchlist yet.</div>`;
    return;
  }

  container.innerHTML = watchlistItems.map(item => {
    const isSelected = item.symbol === currentSymbol;
    const hasData = item.data;
    const isUp = hasData && item.data.change >= 0;

    return `
      <div onclick="selectSymbol('${item.symbol}')" class="p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
        isSelected ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/50' : 'bg-dark-700/40 border-dark-600/40 hover:bg-dark-700/80 hover:border-slate-600'
      }">
        <div>
          <div class="flex items-center space-x-1.5">
            <span class="font-mono font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">${item.symbol}</span>
            ${isSelected ? `<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>` : ''}
          </div>
          <span class="text-[10px] text-slate-400 block font-mono">
            ${hasData ? `$${item.data.price.toLocaleString()}` : item.status}
          </span>
        </div>
        <div class="flex items-center space-x-2">
          ${hasData ? `
            <div class="text-xs font-mono font-bold flex items-center space-x-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}">
              <span>${isUp ? '+' : ''}${item.data.change_percent.toFixed(2)}%</span>
            </div>
          ` : `<span class="text-[10px] text-slate-500 font-mono">--</span>`}
          <button onclick="event.stopPropagation(); removeWatchlistSymbol('${item.symbol}')" class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Remove">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateStarIcon();
  initLucide();
}

async function addWatchlistSymbol(symbol) {
  await apiRequest('/watchlist', {
    method: 'POST',
    body: JSON.stringify({ symbol })
  });
  await loadWatchlist();
}

async function removeWatchlistSymbol(symbol) {
  await apiRequest(`/watchlist/${encodeURIComponent(symbol)}`, {
    method: 'DELETE'
  });
  await loadWatchlist();
}

function showWatchlistError(msg) {
  const errBox = document.getElementById('watchlist-error-msg');
  document.getElementById('watchlist-error-text').innerText = msg;
  errBox.classList.remove('hidden');
}

function updateStarIcon() {
  const starIcon = document.getElementById('star-icon');
  const btnStar = document.getElementById('btn-star-symbol');
  const inList = watchlistItems.some(i => i.symbol === currentSymbol);
  
  if (inList) {
    btnStar.className = 'p-2 rounded-xl transition-all border bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20';
    starIcon.setAttribute('class', 'w-5 h-5 fill-amber-400 text-amber-400');
  } else {
    btnStar.className = 'p-2 rounded-xl transition-all border bg-dark-700/60 border-slate-700/60 text-slate-400 hover:text-slate-200';
    starIcon.setAttribute('class', 'w-5 h-5');
  }
}

// ==============================================================================
// SEARCH DROPDOWN
// ==============================================================================
function renderSearchResults(results) {
  const dropdown = document.getElementById('search-dropdown');
  const list = document.getElementById('search-results-list');

  if (results.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  list.innerHTML = results.map(item => `
    <button onclick="selectSymbol('${item.symbol}'); document.getElementById('search-dropdown').classList.add('hidden'); document.getElementById('input-symbol-search').value='';" class="w-full px-3 py-2.5 text-left hover:bg-dark-700/80 flex items-center justify-between border-b border-dark-700/50 last:border-0 transition-colors">
      <div>
        <span class="font-mono font-bold text-sm text-cyan-400">${item.symbol}</span>
        <span class="text-xs text-slate-400 ml-2">${item.name}</span>
      </div>
      <span class="text-[10px] bg-dark-600 text-slate-300 px-2 py-0.5 rounded font-mono">${item.category}</span>
    </button>
  `).join('');

  dropdown.classList.remove('hidden');
}

// ==============================================================================
// MARKET DATA & SYMBOL SELECTION
// ==============================================================================
async function selectSymbol(symbol) {
  currentSymbol = symbol;
  document.getElementById('overview-symbol').innerText = symbol;
  document.getElementById('chat-active-symbol').innerText = symbol;
  document.getElementById('btn-analysis-text').innerText = `Analyze ${symbol}`;
  
  updateStarIcon();
  renderWatchlist();

  try {
    const res = await apiRequest(`/market/${encodeURIComponent(symbol)}`);
    currentMarketData = res;
    updateMarketOverviewUI(res);
  } catch (err) {
    updateMarketOverviewUI({
      success: false,
      symbol: symbol,
      status: 'Market data unavailable',
      error: err.message
    });
  }

  updateTradeTerminalState();
  drawChart();
}

function updateMarketOverviewUI(res) {
  const isLive = res?.success && res?.data;
  const statusBadge = document.getElementById('overview-status-badge');
  const liveContainer = document.getElementById('metrics-live-container');
  const unavailableBanner = document.getElementById('metrics-unavailable-banner');

  if (isLive) {
    const d = res.data;
    statusBadge.className = 'text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    statusBadge.innerText = '• Live Data';
    
    unavailableBanner.classList.add('hidden');
    liveContainer.classList.remove('opacity-50');

    document.getElementById('metric-price').innerText = `$${d.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    
    const isUp = d.change >= 0;
    const changeElem = document.getElementById('metric-change');
    changeElem.className = `text-base sm:text-lg font-bold font-mono mt-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`;
    changeElem.innerText = `${isUp ? '+' : ''}${d.change.toFixed(2)} (${isUp ? '+' : ''}${d.change_percent.toFixed(2)}%)`;

    document.getElementById('metric-high').innerText = `$${d.high_24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('metric-low').innerText = `$${d.low_24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('metric-volume').innerText = d.volume_24h > 0 ? `$${(d.volume_24h).toLocaleString()}` : 'N/A';

    const ind = d.indicators || {};
    updateIndicatorsUI(ind);
  } else {
    statusBadge.className = 'text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/30';
    statusBadge.innerText = '• Market data unavailable';

    document.getElementById('unavailable-title').innerText = `Market data unavailable for ${currentSymbol}`;
    document.getElementById('unavailable-desc').innerText = res.error || 'Configure your TRADING_API_KEY in .env to view live feeds.';
    unavailableBanner.classList.remove('hidden');

    updateIndicatorsUI({
      rsi_14: 52.4,
      trend: 'Neutral / Range',
      support: 62100,
      resistance: 68500,
      volatility_pct: 2.4
    });
  }
}

function updateIndicatorsUI(ind) {
  const rsi = ind.rsi_14 !== null && ind.rsi_14 !== undefined ? ind.rsi_14 : 50.0;
  const trend = ind.trend || 'Neutral / Range';
  const support = ind.support;
  const resistance = ind.resistance;
  const vol = ind.volatility_pct || 2.1;

  const rsiValElem = document.getElementById('ind-rsi-value');
  const rsiBadgeElem = document.getElementById('ind-rsi-badge');
  const rsiBarElem = document.getElementById('ind-rsi-bar');

  rsiValElem.innerText = rsi.toFixed(1);
  rsiBarElem.style.width = `${Math.min(100, Math.max(0, rsi))}%`;
  
  if (rsi >= 70) {
    rsiBadgeElem.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400';
    rsiBadgeElem.innerText = 'Overbought (>70)';
    rsiBarElem.className = 'h-full bg-rose-500 transition-all duration-500';
  } else if (rsi <= 30) {
    rsiBadgeElem.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400';
    rsiBadgeElem.innerText = 'Oversold (<30)';
    rsiBarElem.className = 'h-full bg-emerald-500 transition-all duration-500';
  } else {
    rsiBadgeElem.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400';
    rsiBadgeElem.innerText = `Neutral (${rsi.toFixed(1)})`;
    rsiBarElem.className = 'h-full bg-cyan-500 transition-all duration-500';
  }

  const trendBadge = document.getElementById('ind-trend-badge');
  const trendText = document.getElementById('ind-trend-text');
  const trendIcon = document.getElementById('ind-trend-icon');

  trendText.innerText = trend;
  if (trend.includes('Bullish')) {
    trendBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400';
    trendIcon.setAttribute('data-lucide', 'trending-up');
    trendIcon.setAttribute('class', 'w-7 h-7 text-emerald-400');
  } else if (trend.includes('Bearish')) {
    trendBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400';
    trendIcon.setAttribute('data-lucide', 'trending-down');
    trendIcon.setAttribute('class', 'w-7 h-7 text-rose-400');
  } else {
    trendBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300';
    trendIcon.setAttribute('data-lucide', 'minus');
    trendIcon.setAttribute('class', 'w-7 h-7 text-amber-400');
  }

  document.getElementById('ind-resistance-val').innerText = resistance ? `$${resistance.toLocaleString()}` : 'N/A';
  document.getElementById('ind-support-val').innerText = support ? `$${support.toLocaleString()}` : 'N/A';

  document.getElementById('ind-vol-val').innerText = `${vol.toFixed(1)}%`;
  const volBadge = document.getElementById('ind-vol-badge');
  volBadge.innerText = vol > 3 ? 'High Volatility' : 'Normal Range';

  initLucide();
}

// ==============================================================================
// CHART ENGINE
// ==============================================================================
function getDisplayCandles() {
  const candles = currentMarketData?.data?.candles || [];
  if (candles.length > 0) return candles;

  const count = currentTf === '1D' ? 24 : currentTf === '1W' ? 35 : currentTf === '1M' ? 50 : 80;
  const basePrice = currentSymbol.includes('BTC') ? 67450 : currentSymbol.includes('ETH') ? 3480 : currentSymbol.includes('NVDA') ? 885 : currentSymbol.includes('AAPL') ? 309 : 182;
  
  const generated = [];
  let current = basePrice;
  const now = Date.now();
  const step = currentTf === '1D' ? 3600000 : 86400000;

  for (let i = count; i >= 0; i--) {
    const timeStr = new Date(now - i * step).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const changePct = (Math.sin(i * 0.4) * 0.015) + (Math.cos(i * 0.2) * 0.01);
    const open = current;
    const close = open * (1 + changePct);
    const high = Math.max(open, close) * (1 + Math.abs(Math.sin(i)) * 0.008);
    const low = Math.min(open, close) * (1 - Math.abs(Math.cos(i)) * 0.008);
    const volume = Math.floor(500000 + Math.abs(Math.sin(i * 0.5)) * 1200000);
    
    generated.push({
      time: timeStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: volume
    });
    current = close;
  }
  return generated;
}

function drawChart() {
  const canvas = document.getElementById('trading-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.parentElement.clientWidth;
  const height = 360;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, width, height);

  const displayCandles = getDisplayCandles();
  if (displayCandles.length === 0) return;

  const padding = { top: 25, right: 65, bottom: showVolume ? 75 : 35, left: 15 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let maxVol = 0;

  displayCandles.forEach(c => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    if (c.volume > maxVol) maxVol = c.volume;
  });

  const pricePadding = (maxPrice - minPrice) * 0.08 || 1;
  minPrice -= pricePadding;
  maxPrice += pricePadding;
  const priceRange = maxPrice - minPrice;

  // Grid
  const gridRows = 5;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillStyle = '#64748b';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let r = 0; r <= gridRows; r++) {
    const y = padding.top + (chartH / gridRows) * r;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const priceVal = maxPrice - (priceRange / gridRows) * r;
    ctx.fillText(`$${priceVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, width - 8, y);
  }

  const n = displayCandles.length;
  const candleWidth = Math.max(2, (chartW / n) * 0.65);
  const spacing = chartW / n;

  // SMAs
  const sma20Points = [];
  const sma50Points = [];

  for (let i = 0; i < n; i++) {
    if (i >= 19) {
      const slice = displayCandles.slice(i - 19, i + 1);
      const avg = slice.reduce((s, c) => s + c.close, 0) / 20;
      sma20Points.push({ x: padding.left + i * spacing + spacing / 2, y: padding.top + (1 - (avg - minPrice) / priceRange) * chartH });
    }
    if (i >= 49) {
      const slice = displayCandles.slice(i - 49, i + 1);
      const avg = slice.reduce((s, c) => s + c.close, 0) / 50;
      sma50Points.push({ x: padding.left + i * spacing + spacing / 2, y: padding.top + (1 - (avg - minPrice) / priceRange) * chartH });
    }
  }

  // Volume Bars
  if (showVolume && maxVol > 0) {
    const volHeight = 45;
    const volBaseY = height - 25;

    displayCandles.forEach((c, i) => {
      const x = padding.left + i * spacing + (spacing - candleWidth) / 2;
      const vH = (c.volume / maxVol) * volHeight;
      const isUp = c.close >= c.open;
      ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(x, volBaseY - vH, candleWidth, vH);
    });
  }

  if (chartType === 'candles') {
    displayCandles.forEach((c, i) => {
      const x = padding.left + i * spacing + spacing / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? '#10b981' : '#ef4444';

      const openY = padding.top + (1 - (c.open - minPrice) / priceRange) * chartH;
      const closeY = padding.top + (1 - (c.close - minPrice) / priceRange) * chartH;
      const highY = padding.top + (1 - (c.high - minPrice) / priceRange) * chartH;
      const lowY = padding.top + (1 - (c.low - minPrice) / priceRange) * chartH;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      ctx.fillStyle = color;
      const bodyY = Math.min(openY, closeY);
      const bodyH = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyH);
    });
  } else {
    ctx.beginPath();
    displayCandles.forEach((c, i) => {
      const x = padding.left + i * spacing + spacing / 2;
      const y = padding.top + (1 - (c.close - minPrice) / priceRange) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const lastX = padding.left + (n - 1) * spacing + spacing / 2;
    const firstX = padding.left + spacing / 2;
    ctx.lineTo(lastX, padding.top + chartH);
    ctx.lineTo(firstX, padding.top + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  if (showSMA20 && sma20Points.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    sma20Points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  if (showSMA50 && sma50Points.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 1.5;
    sma50Points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) {
    const x = padding.left + i * spacing + spacing / 2;
    ctx.fillText(displayCandles[i].time, x, height - 18);
  }
}

function handleCanvasHover(e) {
  const canvas = document.getElementById('trading-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  const padding = { left: 15, right: 65 };
  const chartW = width - padding.left - padding.right;

  const displayCandles = getDisplayCandles();
  if (displayCandles.length === 0) return;

  if (x >= padding.left && x <= width - padding.right) {
    const relX = x - padding.left;
    const idx = Math.min(
      displayCandles.length - 1,
      Math.max(0, Math.floor((relX / chartW) * displayCandles.length))
    );
    hoveredCandle = displayCandles[idx];
    updateChartHoverHeader();
  }
}

function updateChartHoverHeader() {
  const header = document.getElementById('chart-hover-header');
  if (hoveredCandle) {
    header.innerHTML = `
      <div class="flex items-center space-x-3 text-[11px]">
        <span class="text-slate-300 font-semibold">${hoveredCandle.time}</span>
        <span>O: <strong class="text-white">$${hoveredCandle.open}</strong></span>
        <span>H: <strong class="text-emerald-400">$${hoveredCandle.high}</strong></span>
        <span>L: <strong class="text-rose-400">$${hoveredCandle.low}</strong></span>
        <span>C: <strong class="text-cyan-400">$${hoveredCandle.close}</strong></span>
        <span>Vol: <strong class="text-slate-300">${hoveredCandle.volume?.toLocaleString()}</strong></span>
      </div>
      <span class="text-[10px] text-cyan-400 font-mono">Candlestick Inspection</span>
    `;
  } else {
    header.innerHTML = `
      <span class="text-[11px] text-slate-500 flex items-center space-x-1.5">
        <i data-lucide="info" class="w-3.5 h-3.5"></i>
        <span>Hover over candlestick data to inspect OHLC values</span>
      </span>
      <span class="text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
        Interactive Chart Active
      </span>
    `;
    initLucide();
  }
}

// ==============================================================================
// AI ANALYSIS MODULE
// ==============================================================================
async function runAnalysis(type = 'full') {
  const area = document.getElementById('analysis-content-area');
  const btn = document.getElementById('btn-run-analysis');
  
  btn.disabled = true;
  btn.classList.add('opacity-50');
  
  area.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 space-y-3 text-slate-400">
      <div class="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs font-medium">Generating educational market breakdown for ${currentSymbol}...</p>
      <p class="text-[11px] text-slate-500">Retrieving indicators, identifying trends, and framing risk scenarios</p>
    </div>
  `;

  try {
    const res = await apiRequest('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        symbol: currentSymbol,
        analysis_type: type
      })
    });

    if (res.analysis?.success) {
      area.innerHTML = `
        <div class="space-y-4">
          <div class="bg-dark-900/80 rounded-xl p-5 border border-slate-800 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">${res.analysis.content}</div>
          <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-300">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"></i>
            <div>
              <span class="font-bold">Educational Disclaimer:</span> All analysis is generated by AI for educational context only and does not constitute financial advice.
            </div>
          </div>
        </div>
      `;
      initLucide();
    } else {
      area.innerHTML = `
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
          <div class="flex items-center space-x-2 font-bold text-sm">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i>
            <span>${res.analysis?.error || 'AI Analysis Service Unavailable'}</span>
          </div>
          <p class="text-xs text-rose-200/90 whitespace-pre-wrap leading-relaxed">${res.analysis?.details || 'Please verify your AI_API_KEY and MODEL_NAME in .env file.'}</p>
        </div>
      `;
      initLucide();
    }
  } catch (err) {
    area.innerHTML = `
      <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
        <div class="flex items-center space-x-2 font-bold text-sm">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i>
          <span>Analysis Request Error</span>
        </div>
        <p class="text-xs">${err.message}</p>
      </div>
    `;
    initLucide();
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50');
  }
}

// ==============================================================================
// AI CHAT MODULE
// ==============================================================================
async function sendChat(message) {
  const container = document.getElementById('chat-messages-container');
  const btnSend = document.getElementById('btn-chat-send');

  chatHistory.push({ role: 'user', content: message });
  
  const userBubble = document.createElement('div');
  userBubble.className = 'flex items-start space-x-2.5 justify-end';
  userBubble.innerHTML = `
    <div class="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-cyan-600 text-white rounded-tr-none shadow-md shadow-cyan-600/20 whitespace-pre-wrap">${message}</div>
    <div class="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
      <i data-lucide="user" class="w-3.5 h-3.5 text-cyan-400"></i>
    </div>
  `;
  container.appendChild(userBubble);
  initLucide();

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'flex items-start space-x-2.5 justify-start';
  loadingBubble.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
      <i data-lucide="bot" class="w-3.5 h-3.5 text-purple-400"></i>
    </div>
    <div class="bg-dark-700/80 border border-slate-700/60 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-400 flex items-center space-x-2">
      <div class="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
      <span>Thinking & analyzing context...</span>
    </div>
  `;
  container.appendChild(loadingBubble);
  container.scrollTop = container.scrollHeight;
  initLucide();

  btnSend.disabled = true;

  try {
    const res = await apiRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: message,
        symbol: currentSymbol,
        history: chatHistory
      })
    });

    loadingBubble.remove();

    const botBubble = document.createElement('div');
    botBubble.className = 'flex items-start space-x-2.5 justify-start';

    if (res.reply?.success) {
      chatHistory.push({ role: 'assistant', content: res.reply.content });
      botBubble.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-3.5 h-3.5 text-purple-400"></i>
        </div>
        <div class="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-dark-700/80 border border-slate-700/60 text-slate-200 rounded-tl-none whitespace-pre-wrap">${res.reply.content}</div>
      `;
    } else {
      botBubble.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-3.5 h-3.5 text-purple-400"></i>
        </div>
        <div class="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-tl-none whitespace-pre-wrap">⚠️ ${res.reply?.error || 'AI Service Error'}\n\n${res.reply?.details || 'Please verify your AI_API_KEY in .env file.'}</div>
      `;
    }

    container.appendChild(botBubble);
    initLucide();
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    loadingBubble.remove();
    const errBubble = document.createElement('div');
    errBubble.className = 'flex items-start space-x-2.5 justify-start';
    errBubble.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-400"></i>
      </div>
      <div class="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-tl-none whitespace-pre-wrap">⚠️ Network Error: ${err.message}</div>
    `;
    container.appendChild(errBubble);
    initLucide();
    container.scrollTop = container.scrollHeight;
  } finally {
    btnSend.disabled = false;
  }
}
