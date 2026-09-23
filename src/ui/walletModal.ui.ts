import { accountService } from '../services/account.service';
import { dbRepo } from '../db/repository';
import { TransactionRecord } from '../interfaces/account.types';
import { ToastUI } from './toast.ui';

export class WalletModalUI {
  private modal: HTMLElement | null = null;
  private tabDepositEl: HTMLElement | null = null;
  private tabWithdrawEl: HTMLElement | null = null;
  private tabHistoryEl: HTMLElement | null = null;
  private depositPanelEl: HTMLElement | null = null;
  private withdrawPanelEl: HTMLElement | null = null;
  private historyPanelEl: HTMLElement | null = null;
  private activeTab: 'deposit' | 'withdraw' | 'history' = 'deposit';

  constructor() {
    this.modal = document.getElementById('walletModal');
    this.tabDepositEl = document.getElementById('walletTabDeposit');
    this.tabWithdrawEl = document.getElementById('walletTabWithdraw');
    this.tabHistoryEl = document.getElementById('walletTabHistory');
    this.depositPanelEl = document.getElementById('walletPanelDeposit');
    this.withdrawPanelEl = document.getElementById('walletPanelWithdraw');
    this.historyPanelEl = document.getElementById('walletPanelHistory');

    this.bindEvents();
  }

  public open(tab: 'deposit' | 'withdraw' | 'history' = 'deposit'): void {
    if (!this.modal) return;
    this.modal.classList.add('active');
    this.switchTab(tab);
    this.updateStateDisplay();
  }

  public close(): void {
    if (!this.modal) return;
    this.modal.classList.remove('active');
  }

  private switchTab(tab: 'deposit' | 'withdraw' | 'history'): void {
    this.activeTab = tab;
    const panels = [this.depositPanelEl, this.withdrawPanelEl, this.historyPanelEl];
    const tabs = [this.tabDepositEl, this.tabWithdrawEl, this.tabHistoryEl];

    panels.forEach(p => { if (p) p.style.display = 'none'; });
    tabs.forEach(t => { if (t) t.classList.remove('active'); });

    if (tab === 'deposit' && this.depositPanelEl) {
      this.depositPanelEl.style.display = 'block';
      this.tabDepositEl?.classList.add('active');
    } else if (tab === 'withdraw' && this.withdrawPanelEl) {
      this.withdrawPanelEl.style.display = 'block';
      this.tabWithdrawEl?.classList.add('active');
    } else if (tab === 'history' && this.historyPanelEl) {
      this.historyPanelEl.style.display = 'block';
      this.tabHistoryEl?.classList.add('active');
      this.loadTransactionHistory();
    }
  }

  private updateStateDisplay(): void {
    const state = accountService.getState();
    const balEl = document.getElementById('walletCurrentBalance');
    const freeEl = document.getElementById('walletFreeMargin');
    const marginEl = document.getElementById('walletUsedMargin');

    if (balEl) balEl.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (freeEl) freeEl.textContent = `$${state.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (marginEl) marginEl.textContent = `$${state.usedMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  private async loadTransactionHistory(): Promise<void> {
    if (!this.historyPanelEl) return;
    const txList = await dbRepo.getAdapter().getTransactions(50);

    if (txList.length === 0) {
      this.historyPanelEl.innerHTML = `
        <div class="tx-empty">
          <i class="fa-solid fa-receipt"></i>
          <p>Belum ada riwayat transaksi dana.</p>
        </div>
      `;
      return;
    }

    const typeLabel = (type: string) => ({
      DEPOSIT: '<span class="tx-badge tx-deposit">Deposit</span>',
      WITHDRAWAL: '<span class="tx-badge tx-withdraw">Penarikan</span>',
      TRADE_PROFIT: '<span class="tx-badge tx-profit">Profit Trading</span>',
      TRADE_LOSS: '<span class="tx-badge tx-loss">Loss Trading</span>',
      RESET: '<span class="tx-badge tx-reset">Reset Akun</span>',
    }[type] || type);

    this.historyPanelEl.innerHTML = `
      <div class="tx-list">
        ${txList.map((tx: TransactionRecord) => `
          <div class="tx-row">
            <div class="tx-left">
              ${typeLabel(tx.type)}
              <span class="tx-note">${tx.note || ''}</span>
            </div>
            <div class="tx-right">
              <span class="tx-amount ${tx.amount >= 0 ? 'text-bull' : 'text-bear'}">
                ${tx.amount >= 0 ? '+' : ''}$${Math.abs(tx.amount).toFixed(2)}
              </span>
              <span class="tx-time">${new Date(tx.timestamp).toLocaleString('id-ID')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private bindEvents(): void {
    // Tab switching
    this.tabDepositEl?.addEventListener('click', () => this.switchTab('deposit'));
    this.tabWithdrawEl?.addEventListener('click', () => this.switchTab('withdraw'));
    this.tabHistoryEl?.addEventListener('click', () => this.switchTab('history'));

    // Close buttons
    document.getElementById('walletModalClose')?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Deposit submit
    document.getElementById('btnDepositSubmit')?.addEventListener('click', async () => {
      const amountEl = document.getElementById('depositAmount') as HTMLInputElement;
      const methodEl = document.getElementById('depositMethod') as HTMLSelectElement;
      const amount = parseFloat(amountEl?.value || '0');
      const method = methodEl?.value || 'Bank Transfer';

      const result = await accountService.deposit({ amount, method });
      if (result.success) {
        ToastUI.show('Deposit Berhasil', result.message, 'success');
        if (amountEl) amountEl.value = '';
        this.updateStateDisplay();
      } else {
        ToastUI.show('Deposit Gagal', result.message, 'danger');
      }
    });

    // Withdraw submit
    document.getElementById('btnWithdrawSubmit')?.addEventListener('click', async () => {
      const amountEl = document.getElementById('withdrawAmount') as HTMLInputElement;
      const methodEl = document.getElementById('withdrawMethod') as HTMLSelectElement;
      const amount = parseFloat(amountEl?.value || '0');
      const method = methodEl?.value || 'Bank Transfer';

      const result = await accountService.withdraw({ amount, method });
      if (result.success) {
        ToastUI.show('Penarikan Berhasil', result.message, 'success');
        if (amountEl) amountEl.value = '';
        this.updateStateDisplay();
      } else {
        ToastUI.show('Penarikan Gagal', result.message, 'danger');
      }
    });

    // Quick deposit presets
    document.querySelectorAll('.deposit-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-amount');
        const el = document.getElementById('depositAmount') as HTMLInputElement;
        if (el && val) el.value = val;
      });
    });

    // Wallet open triggers
    document.getElementById('btnOpenWallet')?.addEventListener('click', () => this.open('deposit'));
    document.getElementById('btnOpenDeposit')?.addEventListener('click', () => this.open('deposit'));
    document.getElementById('btnOpenWithdraw')?.addEventListener('click', () => this.open('withdraw'));
  }
}
