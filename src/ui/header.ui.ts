import { AccountState } from '../interfaces/account.types';
import { ASSETS, marketFeed } from '../services/marketFeed.service';
import { soundEngine } from '../services/sound.service';
import { accountService } from '../services/account.service';

export class HeaderUI {
  private carouselEl: HTMLElement | null = null;
  private syncTextEl: HTMLElement | null = null;
  private headerBalanceEl: HTMLElement | null = null;
  private headerEquityEl: HTMLElement | null = null;
  private headerFloatingPnLEl: HTMLElement | null = null;
  private headerFreeMarginEl: HTMLElement | null = null;
  private btnSoundEl: HTMLElement | null = null;
  private btnFullscreenEl: HTMLElement | null = null;

  constructor() {
    this.cacheDOMElements();
    this.renderAssetCarousel();
    this.bindEvents();
  }

  public updateAccountSummary(state: AccountState): void {
    if (this.headerBalanceEl) {
      this.headerBalanceEl.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (this.headerEquityEl) {
      this.headerEquityEl.textContent = `$${state.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (this.headerFloatingPnLEl) {
      const pnl = state.floatingPnL;
      const sign = pnl >= 0 ? '+' : '';
      this.headerFloatingPnLEl.textContent = `${sign}$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      this.headerFloatingPnLEl.className = `value ${pnl >= 0 ? 'text-bull' : 'text-bear'}`;
    }
    if (this.headerFreeMarginEl) {
      this.headerFreeMarginEl.textContent = `$${state.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Dynamic margin level badge if in danger / margin call
    const freeMarginPill = this.headerFreeMarginEl?.parentElement;
    if (freeMarginPill) {
      if (state.isMarginCall) {
        freeMarginPill.classList.add('margin-call-alert');
      } else {
        freeMarginPill.classList.remove('margin-call-alert');
      }
    }
  }

  public updateLiveFeedStatus(): void {
    const quote = marketFeed.getQuote();
    if (this.syncTextEl) {
      this.syncTextEl.textContent = `${quote.provider}: ${quote.symbol} = ${quote.price.toFixed(4)}`;
    }
  }

  public updateCarouselPrices(): void {
    if (!this.carouselEl) return;
    ASSETS.forEach(asset => {
      const quote = marketFeed.getQuote(asset.symbol);
      const itemEl = this.carouselEl?.querySelector(`[data-symbol="${asset.symbol}"]`);
      if (itemEl) {
        const priceEl = itemEl.querySelector('.ticker-price');
        const changeEl = itemEl.querySelector('.ticker-change');
        if (priceEl) priceEl.textContent = quote.price.toFixed(asset.decimals);
        if (changeEl) {
          const sign = quote.change24h >= 0 ? '+' : '';
          changeEl.textContent = `${sign}${quote.change24h.toFixed(2)}%`;
          changeEl.className = `ticker-change ${quote.change24h >= 0 ? 'up' : 'down'}`;
        }
      }
    });
  }

  private cacheDOMElements(): void {
    this.carouselEl = document.getElementById('assetTickerCarousel');
    this.syncTextEl = document.getElementById('syncText');
    this.headerBalanceEl = document.getElementById('headerBalance');
    this.headerEquityEl = document.getElementById('headerEquity');
    this.headerFloatingPnLEl = document.getElementById('headerFloatingPnL');
    this.headerFreeMarginEl = document.getElementById('headerFreeMargin');
    this.btnSoundEl = document.getElementById('btnToggleSound');
    this.btnFullscreenEl = document.getElementById('btnToggleFullscreen');
  }

  private renderAssetCarousel(): void {
    if (!this.carouselEl) return;
    const active = marketFeed.getActiveAsset();

    this.carouselEl.innerHTML = ASSETS.map(asset => {
      const isActive = asset.symbol === active.symbol;
      return `
        <div class="ticker-pill ${isActive ? 'active' : ''}" data-symbol="${asset.symbol}">
          <span class="ticker-sym"><i class="fa-solid ${asset.icon || 'fa-chart-simple'}"></i> ${asset.symbol}</span>
          <span class="ticker-price">${asset.basePrice.toFixed(asset.decimals)}</span>
          <span class="ticker-change up">+0.00%</span>
        </div>
      `;
    }).join('');

    // Click handler to switch active asset
    const pills = this.carouselEl.querySelectorAll('.ticker-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const sym = pill.getAttribute('data-symbol');
        if (sym) {
          marketFeed.setActiveAsset(sym);
          this.updateActiveAssetUI();
        }
      });
    });
  }

  public updateActiveAssetUI(): void {
    const asset = marketFeed.getActiveAsset();
    const quote = marketFeed.getQuote();

    const symEl = document.getElementById('activeAssetSymbol');
    const catEl = document.getElementById('activeAssetCategory');
    const priceEl = document.getElementById('activeAssetPrice');
    const changeEl = document.getElementById('activeAssetChange');

    if (symEl) symEl.textContent = asset.symbol;
    if (catEl) catEl.textContent = asset.category;
    if (priceEl) priceEl.textContent = quote.price.toFixed(asset.decimals);
    if (changeEl) {
      const sign = quote.change24h >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${quote.change24h.toFixed(2)}%`;
      changeEl.className = `current-market-change ${quote.change24h >= 0 ? 'up' : 'down'}`;
    }
  }

  private bindEvents(): void {
    // Sound Toggle
    if (this.btnSoundEl) {
      this.btnSoundEl.addEventListener('click', () => {
        const enabled = soundEngine.toggle();
        const icon = this.btnSoundEl?.querySelector('i');
        if (icon) {
          icon.className = `fa-solid ${enabled ? 'fa-volume-high' : 'fa-volume-xmark'}`;
        }
      });
    }

    // Fullscreen Toggle
    if (this.btnFullscreenEl) {
      this.btnFullscreenEl.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        } else {
          document.exitFullscreen().catch(() => { });
        }
      });
    }

    // Reset Account confirmation modal
    const resetModal = document.getElementById('resetModal');
    const btnOpenReset = document.getElementById('btnOpenResetModal');
    const btnCancelReset = document.getElementById('btnCancelReset');
    const btnConfirmReset = document.getElementById('btnConfirmReset');

    if (btnOpenReset && resetModal) {
      btnOpenReset.addEventListener('click', () => {
        resetModal.classList.add('active');
      });
    }

    if (btnCancelReset && resetModal) {
      btnCancelReset.addEventListener('click', () => {
        resetModal.classList.remove('active');
      });
    }

    if (btnConfirmReset && resetModal) {
      btnConfirmReset.addEventListener('click', async () => {
        await accountService.resetAccount();
        resetModal.classList.remove('active');
        window.location.reload();
      });
    }
  }
}
