import { CreateOrderParams, OrderSide } from '../interfaces/trading.types';
import { marketFeed } from '../services/marketFeed.service';
import { orderEngine } from '../services/orderEngine.service';
import { accountService } from '../services/account.service';
import { ToastUI } from './toast.ui';

export class TerminalUI {
  private currentLeverage: number = 10;
  private currentMargin: number = 100;

  // DOM Elements
  private quoteBidEl: HTMLElement | null = null;
  private quoteAskEl: HTMLElement | null = null;
  private quoteSpreadEl: HTMLElement | null = null;
  private displayLeverageEl: HTMLElement | null = null;
  private displayMaxMarginEl: HTMLElement | null = null;
  private inputMarginEl: HTMLInputElement | null = null;
  private inputTPEl: HTMLInputElement | null = null;
  private inputSLEl: HTMLInputElement | null = null;
  private calcPosValEl: HTMLElement | null = null;
  private calcLiqBuyEl: HTMLElement | null = null;
  private calcLiqSellEl: HTMLElement | null = null;
  private btnBuyEl: HTMLElement | null = null;
  private btnSellEl: HTMLElement | null = null;
  private btnBuySubPrice: HTMLElement | null = null;
  private btnSellSubPrice: HTMLElement | null = null;

  constructor() {
    this.cacheDOMElements();
    this.bindEvents();
    this.updateCalculations();
  }

  public updateQuote(): void {
    const quote = marketFeed.getQuote();
    const asset = marketFeed.getActiveAsset();
    const decimals = asset.decimals;

    if (this.quoteBidEl) this.quoteBidEl.textContent = quote.bid.toFixed(decimals);
    if (this.quoteAskEl) this.quoteAskEl.textContent = quote.ask.toFixed(decimals);
    if (this.quoteSpreadEl) this.quoteSpreadEl.textContent = `Spread: ${quote.spread} Pips`;

    if (this.btnBuySubPrice) this.btnBuySubPrice.textContent = `Long ${quote.ask.toFixed(decimals)}`;
    if (this.btnSellSubPrice) this.btnSellSubPrice.textContent = `Short ${quote.bid.toFixed(decimals)}`;

    this.updateCalculations();
  }

  public updateAccountFreeMargin(): void {
    const state = accountService.getState();
    if (this.displayMaxMarginEl) {
      this.displayMaxMarginEl.textContent = `$${state.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  private cacheDOMElements(): void {
    this.quoteBidEl = document.getElementById('quoteBidPrice');
    this.quoteAskEl = document.getElementById('quoteAskPrice');
    this.quoteSpreadEl = document.getElementById('quoteSpreadTag');
    this.displayLeverageEl = document.getElementById('displayLeverageVal');
    this.displayMaxMarginEl = document.getElementById('displayMaxMargin');
    this.inputMarginEl = document.getElementById('inputOrderMargin') as HTMLInputElement;
    this.inputTPEl = document.getElementById('inputTakeProfit') as HTMLInputElement;
    this.inputSLEl = document.getElementById('inputStopLoss') as HTMLInputElement;
    this.calcPosValEl = document.getElementById('calcPositionValue');
    this.calcLiqBuyEl = document.getElementById('calcEstLiqBuy');
    this.calcLiqSellEl = document.getElementById('calcEstLiqSell');
    this.btnBuyEl = document.getElementById('btnExecuteBuy');
    this.btnSellEl = document.getElementById('btnExecuteSell');
    this.btnBuySubPrice = document.getElementById('btnBuySubPrice');
    this.btnSellSubPrice = document.getElementById('btnSellSubPrice');
  }

  private bindEvents(): void {
    // Leverage pills
    const levPills = document.querySelectorAll('#leveragePills .lev-btn');
    levPills.forEach(btn => {
      btn.addEventListener('click', () => {
        levPills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lev = parseInt(btn.getAttribute('data-lev') || '10', 10);
        this.currentLeverage = lev;
        if (this.displayLeverageEl) this.displayLeverageEl.textContent = `${lev}x`;
        this.updateCalculations();
      });
    });

    // Margin input change
    if (this.inputMarginEl) {
      this.inputMarginEl.addEventListener('input', () => {
        const val = parseFloat(this.inputMarginEl?.value || '0');
        this.currentMargin = isNaN(val) ? 0 : val;
        this.updateCalculations();
      });
    }

    // Quick % buttons
    const pctBtns = document.querySelectorAll('.quick-pct-row .pct-btn');
    pctBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const pct = parseInt(btn.getAttribute('data-pct') || '10', 10);
        const freeMargin = accountService.getState().freeMargin;
        let amount = Math.floor(freeMargin * (pct / 100));
        if (amount < 1 && freeMargin >= 1) amount = 1;
        this.currentMargin = amount;
        if (this.inputMarginEl) this.inputMarginEl.value = amount.toString();
        this.updateCalculations();
      });
    });

    // BUY Button
    if (this.btnBuyEl) {
      this.btnBuyEl.addEventListener('click', () => this.handleOrderSubmit('BUY'));
    }

    // SELL Button
    if (this.btnSellEl) {
      this.btnSellEl.addEventListener('click', () => this.handleOrderSubmit('SELL'));
    }
  }

  private updateCalculations(): void {
    const asset = marketFeed.getActiveAsset();
    const quote = marketFeed.getQuote();
    const posValue = this.currentMargin * this.currentLeverage;

    if (this.calcPosValEl) {
      this.calcPosValEl.textContent = `$${posValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Est Liquidation prices
    const buyLiq = quote.ask * (1 - 0.9 / this.currentLeverage);
    const sellLiq = quote.bid * (1 + 0.9 / this.currentLeverage);

    if (this.calcLiqBuyEl) {
      this.calcLiqBuyEl.textContent = `${buyLiq.toFixed(asset.decimals)} (-${((1 - buyLiq / quote.ask) * 100).toFixed(1)}%)`;
    }
    if (this.calcLiqSellEl) {
      this.calcLiqSellEl.textContent = `${sellLiq.toFixed(asset.decimals)} (+${((sellLiq / quote.bid - 1) * 100).toFixed(1)}%)`;
    }
  }

  private async handleOrderSubmit(side: OrderSide): Promise<void> {
    const asset = marketFeed.getActiveAsset();
    const margin = parseFloat(this.inputMarginEl?.value || '0');
    const tpVal = this.inputTPEl?.value ? parseFloat(this.inputTPEl.value) : null;
    const slVal = this.inputSLEl?.value ? parseFloat(this.inputSLEl.value) : null;

    if (isNaN(margin) || margin <= 0) {
      ToastUI.show('Input Tidak Valid', 'Silakan masukkan jumlah margin / modal yang valid.', 'warning');
      return;
    }

    const params: CreateOrderParams = {
      symbol: asset.symbol,
      side,
      margin,
      leverage: this.currentLeverage,
      takeProfit: tpVal,
      stopLoss: slVal
    };

    const result = await orderEngine.executeMarketOrder(params);
    if (result.success) {
      ToastUI.show(`Order ${side} Berhasil`, result.message, 'success');
      // Clear TP/SL optional inputs
      if (this.inputTPEl) this.inputTPEl.value = '';
      if (this.inputSLEl) this.inputSLEl.value = '';
    } else {
      ToastUI.show('Eksekusi Gagal', result.message, 'danger');
    }
  }
}
