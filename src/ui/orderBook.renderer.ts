import { OrderBookDepth } from '../interfaces/market.types';
import { marketFeed } from '../services/marketFeed.service';

export class OrderBookRenderer {
  private container: HTMLElement | null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId);
  }

  public render(depth: OrderBookDepth): void {
    if (!this.container) return;

    const asset = marketFeed.getActiveAsset();
    const decimals = asset.decimals;

    // Asks are rendered in reverse order (highest ask on top down to closest ask)
    const reversedAsks = [...depth.asks].reverse();

    const asksHtml = reversedAsks.map(a => `
      <div class="ob-row ask-row">
        <div class="ob-depth-bar ask-depth" style="width: ${a.depthPct}%"></div>
        <span class="ob-col ob-price text-bear">${a.price.toFixed(decimals)}</span>
        <span class="ob-col ob-size">${a.amount.toFixed(asset.category === 'Crypto' ? 3 : 2)}</span>
        <span class="ob-col ob-total">${a.total.toFixed(asset.category === 'Crypto' ? 3 : 2)}</span>
      </div>
    `).join('');

    const bidsHtml = depth.bids.map(b => `
      <div class="ob-row bid-row">
        <div class="ob-depth-bar bid-depth" style="width: ${b.depthPct}%"></div>
        <span class="ob-col ob-price text-bull">${b.price.toFixed(decimals)}</span>
        <span class="ob-col ob-size">${b.amount.toFixed(asset.category === 'Crypto' ? 3 : 2)}</span>
        <span class="ob-col ob-total">${b.total.toFixed(asset.category === 'Crypto' ? 3 : 2)}</span>
      </div>
    `).join('');

    const quote = marketFeed.getQuote();

    this.container.innerHTML = `
      <div class="order-book-card">
        <div class="ob-header">
          <div class="ob-title"><i class="fa-solid fa-bars-staggered text-cyan"></i> Buku Order (L2 Depth)</div>
          <div class="ob-spread-badge">Spread: ${depth.spread} Pips</div>
        </div>
        <div class="ob-column-labels">
          <span>Harga (${asset.symbol.split('/')[1] || 'USD'})</span>
          <span>Ukuran</span>
          <span>Total Akumulasi</span>
        </div>
        <div class="ob-asks-list">${asksHtml}</div>
        <div class="ob-mid-price">
          <span class="mid-val ${quote.change24h >= 0 ? 'text-bull' : 'text-bear'}">${quote.price.toFixed(decimals)}</span>
          <span class="mid-icon">${quote.change24h >= 0 ? '▲' : '▼'}</span>
        </div>
        <div class="ob-bids-list">${bidsHtml}</div>
      </div>
    `;
  }
}
