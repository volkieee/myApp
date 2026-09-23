import { TradeHistoryItem } from '../interfaces/trading.types';
import { marketFeed } from '../services/marketFeed.service';
import { orderEngine } from '../services/orderEngine.service';
import { ToastUI } from './toast.ui';

export class HistoryUI {
  private tableBodyEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;
  private badgeCountEl: HTMLElement | null = null;

  constructor() {
    this.tableBodyEl = document.getElementById('historyTableBody');
    this.emptyStateEl = document.getElementById('emptyHistoryState');
    this.badgeCountEl = document.getElementById('badgeHistoryCount');

    // Bind action buttons
    const btnClear = document.getElementById('btnClearHistory');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        await orderEngine.clearHistory();
        ToastUI.show('Riwayat Dibersihkan', 'Semua riwayat transaksi telah dihapus.', 'info');
      });
    }

    const btnExport = document.getElementById('btnExportCSV');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCSV());
    }
  }

  public render(history: TradeHistoryItem[]): void {
    if (!this.tableBodyEl) return;

    if (this.badgeCountEl) {
      this.badgeCountEl.textContent = history.length.toString();
    }

    if (history.length === 0) {
      this.tableBodyEl.innerHTML = '';
      if (this.emptyStateEl) this.emptyStateEl.style.display = 'block';
      return;
    }

    if (this.emptyStateEl) this.emptyStateEl.style.display = 'none';

    const asset = (sym: string) => marketFeed.getAssets().find(a => a.symbol === sym);
    const reasonLabel = (reason: string) => ({
      MANUAL: '<span class="tag-manual">Manual</span>',
      TAKE_PROFIT: '<span class="tag-tp">Take Profit ✓</span>',
      STOP_LOSS: '<span class="tag-sl">Stop Loss ⚠</span>',
      LIQUIDATION: '<span class="tag-liq">Likuidasi !</span>',
    }[reason] || reason);

    this.tableBodyEl.innerHTML = history.map(item => {
      const a = asset(item.symbol);
      const decimals = a?.decimals || 5;
      const pnlClass = item.pnl >= 0 ? 'text-bull' : 'text-bear';
      const sideClass = item.side === 'BUY' ? 'badge-buy' : 'badge-sell';
      const sign = item.pnl >= 0 ? '+' : '';
      const pctSign = item.pnlPercentage >= 0 ? '+' : '';

      return `
        <tr>
          <td>${new Date(item.closedAt).toLocaleString('id-ID')}</td>
          <td>
            <div class="asset-label">
              <span class="asset-sym">${item.symbol}</span>
            </div>
          </td>
          <td><span class="side-badge ${sideClass}">${item.side}</span></td>
          <td><span class="leverage-chip">${item.leverage}x</span></td>
          <td>$${item.margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td>${item.entryPrice.toFixed(decimals)}</td>
          <td>${item.exitPrice.toFixed(decimals)}</td>
          <td class="${pnlClass}"><strong>${sign}$${Math.abs(item.pnl).toFixed(2)}</strong></td>
          <td class="${pnlClass}">${pctSign}${item.pnlPercentage.toFixed(2)}%</td>
          <td>${reasonLabel(item.reason)}</td>
        </tr>
      `;
    }).join('');
  }

  private exportCSV(): void {
    const history = orderEngine.getTradeHistory();
    if (history.length === 0) {
      ToastUI.show('Tidak Ada Data', 'Riwayat transaksi masih kosong.', 'warning');
      return;
    }

    const headers = ['Waktu Tutup', 'Aset', 'Arah', 'Leverage', 'Modal ($)', 'Harga Masuk', 'Harga Keluar', 'PnL ($)', 'Return (%)', 'Alasan'];
    const rows = history.map(item => {
      const a = marketFeed.getAssets().find(a => a.symbol === item.symbol);
      const d = a?.decimals || 5;
      return [
        new Date(item.closedAt).toISOString(),
        item.symbol,
        item.side,
        item.leverage + 'x',
        item.margin.toFixed(2),
        item.entryPrice.toFixed(d),
        item.exitPrice.toFixed(d),
        item.pnl.toFixed(2),
        item.pnlPercentage.toFixed(2) + '%',
        item.reason
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex_trader_history_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ToastUI.show('CSV Diekspor', `${history.length} transaksi berhasil diunduh.`, 'success');
  }
}
