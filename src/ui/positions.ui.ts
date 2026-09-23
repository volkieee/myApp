import { Position } from '../interfaces/trading.types';
import { marketFeed } from '../services/marketFeed.service';
import { orderEngine } from '../services/orderEngine.service';
import { ToastUI } from './toast.ui';

export class PositionsUI {
  private tableBodyEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;
  private badgeCountEl: HTMLElement | null = null;

  constructor() {
    this.tableBodyEl = document.getElementById('positionsTableBody');
    this.emptyStateEl = document.getElementById('emptyPositionsState');
    this.badgeCountEl = document.getElementById('badgeOpenPositionsCount');
  }

  public render(positions: Position[]): void {
    if (!this.tableBodyEl) return;

    if (this.badgeCountEl) {
      this.badgeCountEl.textContent = positions.length.toString();
    }

    if (positions.length === 0) {
      this.tableBodyEl.innerHTML = '';
      if (this.emptyStateEl) this.emptyStateEl.style.display = 'block';
      return;
    }

    if (this.emptyStateEl) this.emptyStateEl.style.display = 'none';

    const asset = (sym: string) => marketFeed.getAssets().find(a => a.symbol === sym);
    const fmt = (n: number, d: number) => n.toFixed(d);
    const fmtUSD = (n: number) => {
      const sign = n >= 0 ? '+' : '';
      return `${sign}$${Math.abs(n).toFixed(2)}`;
    };

    this.tableBodyEl.innerHTML = positions.map(pos => {
      const a = asset(pos.symbol);
      const decimals = a?.decimals || 5;
      const pnlClass = pos.floatingPnL >= 0 ? 'text-bull' : 'text-bear';
      const sideClass = pos.side === 'BUY' ? 'badge-buy' : 'badge-sell';
      const sign = pos.floatingPnLPct >= 0 ? '+' : '';

      const tp = pos.takeProfit ? fmt(pos.takeProfit, decimals) : '<span class="muted">–</span>';
      const sl = pos.stopLoss ? fmt(pos.stopLoss, decimals) : '<span class="muted">–</span>';

      return `
        <tr class="position-row ${pnlClass === 'text-bull' ? 'row-profit' : 'row-loss'}">
          <td>${new Date(pos.openedAt).toLocaleTimeString('id-ID')}</td>
          <td>
            <div class="asset-label">
              <span class="asset-sym">${pos.symbol}</span>
              <span class="asset-cat-tag">${a?.category || ''}</span>
            </div>
          </td>
          <td><span class="side-badge ${sideClass}">${pos.side}</span></td>
          <td><span class="leverage-chip">${pos.leverage}x</span></td>
          <td>$${pos.margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td>${fmt(pos.entryPrice, decimals)}</td>
          <td class="${pos.currentPrice > pos.entryPrice ? 'text-bull' : 'text-bear'}">${fmt(pos.currentPrice, decimals)}</td>
          <td>${tp}</td>
          <td>${sl}</td>
          <td class="${pnlClass} pnl-cell">
            <strong>${fmtUSD(pos.floatingPnL)}</strong>
            <span class="pnl-pct">${sign}${pos.floatingPnLPct.toFixed(2)}%</span>
          </td>
          <td class="action-cell">
            <button class="btn-close-pos" data-id="${pos.id}" title="Tutup Posisi">
              <i class="fa-solid fa-xmark"></i> Tutup
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind close buttons
    this.tableBodyEl.querySelectorAll('.btn-close-pos').forEach(btn => {
      btn.addEventListener('click', async () => {
        const posId = btn.getAttribute('data-id');
        if (!posId) return;
        const pos = positions.find(p => p.id === posId);
        const ok = await orderEngine.closePosition(posId, 'MANUAL');
        if (ok && pos) {
          ToastUI.show(
            'Posisi Ditutup',
            `${pos.side} ${pos.symbol}: PnL ${pos.floatingPnL >= 0 ? '+' : ''}$${pos.floatingPnL.toFixed(2)}`,
            pos.floatingPnL >= 0 ? 'success' : 'warning'
          );
        }
      });
    });
  }
}
