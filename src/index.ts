// ============================================================
// APEX TRADER PRO 2.0 — Main Entry Point (TypeScript)
// Real-Time Trading Platform with Live WebSocket Feeds,
// Order Engine, Margin/Liquidation, and IndexedDB Persistence
// ============================================================

import { dbRepo } from './db/repository';
import { accountService } from './services/account.service';
import { marketFeed } from './services/marketFeed.service';
import { orderEngine } from './services/orderEngine.service';

import { HeaderUI } from './ui/header.ui';
import { ChartRenderer } from './ui/chart.renderer';
import { OrderBookRenderer } from './ui/orderBook.renderer';
import { TerminalUI } from './ui/terminal.ui';
import { PositionsUI } from './ui/positions.ui';
import { HistoryUI } from './ui/history.ui';
import { AnalyticsUI } from './ui/analytics.ui';
import { WalletModalUI } from './ui/walletModal.ui';

async function bootstrap(): Promise<void> {
  console.log('[APEX TRADER PRO 2.0] Initializing...');

  // 1. Initialize DB layer first
  await dbRepo.init();

  // 2. Initialize Account Service (loads saved state from DB)
  await accountService.init();

  // 3. Initialize Order Engine (loads open positions from DB)
  await orderEngine.init();

  // 4. Start Market Data Feeds
  marketFeed.start();

  // ─── Initialize UI Modules ───────────────────────────────────
  const headerUI = new HeaderUI();
  const chartRenderer = new ChartRenderer('candlestickCanvas', 'rsiCanvas');
  const orderBookRenderer = new OrderBookRenderer('orderBookContainer');
  const terminalUI = new TerminalUI();
  const positionsUI = new PositionsUI();
  const historyUI = new HistoryUI();
  const analyticsUI = new AnalyticsUI(accountService.getState().initialDeposit);
  const walletModalUI = new WalletModalUI();

  // ─── Market Feed Subscriptions ────────────────────────────────

  // Tick: update header prices, chart, terminal quotes, order book
  marketFeed.onTick((quote) => {
    headerUI.updateLiveFeedStatus();
    headerUI.updateCarouselPrices();
    headerUI.updateActiveAssetUI();
    terminalUI.updateQuote();

    // Update chart OHLC bar
    const asset = marketFeed.getActiveAsset();
    const { current } = marketFeed.getCandles();
    const ohlcOpen = document.getElementById('barOpen');
    const ohlcHigh = document.getElementById('barHigh');
    const ohlcLow = document.getElementById('barLow');
    const ohlcClose = document.getElementById('barClose');
    if (ohlcOpen) ohlcOpen.textContent = current.open.toFixed(asset.decimals);
    if (ohlcHigh) ohlcHigh.textContent = current.high.toFixed(asset.decimals);
    if (ohlcLow) ohlcLow.textContent = current.low.toFixed(asset.decimals);
    if (ohlcClose) ohlcClose.textContent = current.close.toFixed(asset.decimals);

    // Active asset price display
    const priceEl = document.getElementById('activeAssetPrice');
    if (priceEl) priceEl.textContent = quote.price.toFixed(asset.decimals);

    // Live feed indicator dot
    const feedChip = document.getElementById('liveFeedChip');
    if (feedChip) {
      feedChip.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> ${quote.provider}`;
    }
  });

  // Candle update: re-render chart
  marketFeed.onCandle((history, current) => {
    chartRenderer.render();

    // Candle countdown timer
    const tfMs = getTFms(marketFeed.getTimeframe());
    const elapsed = Date.now() - current.time;
    const remaining = Math.max(0, Math.ceil((tfMs - elapsed) / 1000));
    const timerEl = document.getElementById('candleCountdown');
    if (timerEl) timerEl.textContent = `${remaining}s`;
  });

  // Order Book updates
  marketFeed.onOrderBook((depth) => {
    orderBookRenderer.render(depth);
  });

  // ─── Account Subscriptions ────────────────────────────────────
  accountService.subscribe((state) => {
    headerUI.updateAccountSummary(state);
    terminalUI.updateAccountFreeMargin();

    // Margin Call Alert Banner
    const mcBanner = document.getElementById('marginCallBanner');
    if (mcBanner) {
      mcBanner.style.display = state.isMarginCall ? 'flex' : 'none';
      if (state.isStopOut) {
        mcBanner.className = 'margin-call-banner stop-out';
        mcBanner.innerHTML = `<i class="fa-solid fa-skull-crossbones"></i> <strong>STOP OUT!</strong> Margin level ${state.marginLevel.toFixed(0)}% — Posisi sedang dilikuidasi otomatis!`;
      } else if (state.isMarginCall) {
        mcBanner.className = 'margin-call-banner margin-call';
        mcBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>MARGIN CALL!</strong> Margin level ${state.marginLevel.toFixed(0)}% — Tambah dana atau tutup posisi untuk menghindari likuidasi!`;
      }
    }

    // Margin Level Indicator in header
    const marginLevelEl = document.getElementById('headerMarginLevel');
    if (marginLevelEl && state.usedMargin > 0) {
      const lvl = state.marginLevel;
      let lvlClass = 'ml-safe';
      if (lvl < 100) lvlClass = 'ml-danger';
      else if (lvl < 200) lvlClass = 'ml-warning';
      marginLevelEl.innerHTML = `<span class="${lvlClass}">${lvl.toFixed(0)}%</span>`;
      marginLevelEl.style.display = 'block';
    } else if (marginLevelEl) {
      marginLevelEl.style.display = 'none';
    }
  });

  // ─── Order Engine Subscriptions ──────────────────────────────
  orderEngine.subscribePositions((positions) => {
    positionsUI.render(positions);
  });

  orderEngine.subscribeHistory((history) => {
    historyUI.render(history);
    const state = accountService.getState();
    analyticsUI.render(history, state.balance);
    const badgeEl = document.getElementById('badgeHistoryCount');
    if (badgeEl) badgeEl.textContent = history.length.toString();
  });

  // ─── Chart Indicator Toggles ─────────────────────────────────
  document.getElementById('btnToggleEMA')?.addEventListener('click', (e) => {
    const enabled = chartRenderer.toggleEMA();
    (e.currentTarget as HTMLElement).classList.toggle('active', enabled);
  });

  document.getElementById('btnToggleBB')?.addEventListener('click', (e) => {
    const enabled = chartRenderer.toggleBB();
    (e.currentTarget as HTMLElement).classList.toggle('active', enabled);
  });

  document.getElementById('btnToggleRSI')?.addEventListener('click', (e) => {
    const enabled = chartRenderer.toggleRSI();
    (e.currentTarget as HTMLElement).classList.toggle('active', enabled);
  });

  // ─── Timeframe Selector ──────────────────────────────────────
  document.querySelectorAll('#timeframeSelector .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#timeframeSelector .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tf = btn.getAttribute('data-tf');
      if (tf) marketFeed.setTimeframe(tf as any);
    });
  });

  // ─── Dock Tab Switching ──────────────────────────────────────
  document.querySelectorAll('.dock-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dock-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        document.getElementById(tabId)?.classList.add('active');
        if (tabId === 'tabStats') {
          const hist = orderEngine.getTradeHistory();
          analyticsUI.render(hist, accountService.getState().balance);
        }
      }
    });
  });

  // ─── Asset Selector (if separate asset panel exists) ─────────
  const assetSelectEl = document.getElementById('assetSelector') as HTMLSelectElement;
  if (assetSelectEl) {
    assetSelectEl.innerHTML = marketFeed.getAssets().map(a =>
      `<option value="${a.symbol}">${a.symbol} — ${a.name}</option>`
    ).join('');
    assetSelectEl.addEventListener('change', () => {
      marketFeed.setActiveAsset(assetSelectEl.value);
    });
  }

  // ─── Initial Render ──────────────────────────────────────────
  headerUI.updateActiveAssetUI();
  terminalUI.updateQuote();
  chartRenderer.resize();

  console.log('[APEX TRADER PRO 2.0] All systems online ✓');
}

function getTFms(tf: string): number {
  const map: Record<string, number> = {
    '1s': 1000, '5s': 5000, '15s': 15000, '1m': 60000, '5m': 300000
  };
  return map[tf] || 1000;
}

// Boot the application
bootstrap().catch(err => {
  console.error('[APEX TRADER] Fatal bootstrap error:', err);
});
