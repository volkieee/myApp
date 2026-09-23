import { AccountState, DepositWithdrawParams, TransactionRecord } from '../interfaces/account.types';
import { dbRepo } from '../db/repository';

export type AccountListener = (state: AccountState) => void;

const DEFAULT_INITIAL_BALANCE = 10000;

export class AccountService {
  private static instance: AccountService;

  private state: AccountState;
  private listeners: Set<AccountListener> = new Set();

  private constructor() {
    this.state = {
      id: 'default',
      accountNumber: 'APX-774921-PRO',
      currency: 'USD',
      balance: DEFAULT_INITIAL_BALANCE,
      equity: DEFAULT_INITIAL_BALANCE,
      usedMargin: 0,
      freeMargin: DEFAULT_INITIAL_BALANCE,
      marginLevel: 0,
      floatingPnL: 0,
      initialDeposit: DEFAULT_INITIAL_BALANCE,
      isMarginCall: false,
      isStopOut: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  public static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService();
    }
    return AccountService.instance;
  }

  public async init(): Promise<void> {
    const saved = await dbRepo.getAdapter().getAccount('default');
    if (saved) {
      this.state = saved;
    } else {
      await this.persist();
    }
    this.notify();
  }

  public getState(): AccountState {
    return { ...this.state };
  }

  public subscribe(listener: AccountListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /**
   * Called by OrderEngine on every market tick to compute real-time dynamic equity & margin
   */
  public updatePositionsPnL(totalUsedMargin: number, totalFloatingPnL: number): void {
    this.state.usedMargin = totalUsedMargin;
    this.state.floatingPnL = totalFloatingPnL;
    this.state.equity = this.state.balance + totalFloatingPnL;
    this.state.freeMargin = Math.max(0, this.state.equity - totalUsedMargin);

    if (totalUsedMargin > 0) {
      this.state.marginLevel = (this.state.equity / totalUsedMargin) * 100;
    } else {
      this.state.marginLevel = 0;
    }

    // Risk alerts
    this.state.isMarginCall = totalUsedMargin > 0 && this.state.marginLevel < 100;
    this.state.isStopOut = totalUsedMargin > 0 && this.state.marginLevel <= 20;
    this.state.updatedAt = Date.now();

    this.notify();
  }

  /**
   * Settles a closed trade: adds/subtracts realized PnL to balance
   */
  public async settleTradePnL(realizedPnL: number, marginReleased: number, note: string): Promise<void> {
    const prevBalance = this.state.balance;
    this.state.balance += realizedPnL;
    this.state.usedMargin = Math.max(0, this.state.usedMargin - marginReleased);
    this.state.equity = this.state.balance + this.state.floatingPnL;
    this.state.freeMargin = Math.max(0, this.state.equity - this.state.usedMargin);
    this.state.updatedAt = Date.now();

    // Record ledger transaction
    const tx: TransactionRecord = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      accountId: this.state.id,
      type: realizedPnL >= 0 ? 'TRADE_PROFIT' : 'TRADE_LOSS',
      amount: realizedPnL,
      balanceBefore: prevBalance,
      balanceAfter: this.state.balance,
      note,
      timestamp: Date.now()
    };

    await dbRepo.getAdapter().addTransaction(tx);
    await this.persist();
    this.notify();
  }

  /**
   * Deducts margin when a new order is opened
   */
  public reserveMargin(margin: number): boolean {
    if (this.state.freeMargin < margin) {
      return false; // Insufficient margin
    }
    this.state.usedMargin += margin;
    this.state.freeMargin = Math.max(0, this.state.equity - this.state.usedMargin);
    this.notify();
    return true;
  }

  /**
   * Deposit real-time funds
   */
  public async deposit(params: DepositWithdrawParams): Promise<{ success: boolean; message: string }> {
    if (params.amount <= 0 || isNaN(params.amount)) {
      return { success: false, message: 'Nominal deposit harus lebih dari $0.' };
    }

    const prevBalance = this.state.balance;
    this.state.balance += params.amount;
    this.state.equity += params.amount;
    this.state.freeMargin = Math.max(0, this.state.equity - this.state.usedMargin);
    this.state.updatedAt = Date.now();

    const tx: TransactionRecord = {
      id: 'tx_dep_' + Date.now(),
      accountId: this.state.id,
      type: 'DEPOSIT',
      amount: params.amount,
      balanceBefore: prevBalance,
      balanceAfter: this.state.balance,
      note: params.note || `Deposit via ${params.method}`,
      paymentMethod: params.method,
      timestamp: Date.now()
    };

    await dbRepo.getAdapter().addTransaction(tx);
    await this.persist();
    this.notify();

    return { success: true, message: `Berhasil deposit $${params.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}!` };
  }

  /**
   * Withdraw funds (validated against free margin)
   */
  public async withdraw(params: DepositWithdrawParams): Promise<{ success: boolean; message: string }> {
    if (params.amount <= 0 || isNaN(params.amount)) {
      return { success: false, message: 'Nominal penarikan harus lebih dari $0.' };
    }

    if (params.amount > this.state.freeMargin) {
      return {
        success: false,
        message: `Dana tidak cukup! Maksimum yang dapat ditarik (Free Margin) adalah $${this.state.freeMargin.toFixed(2)}.`
      };
    }

    const prevBalance = this.state.balance;
    this.state.balance -= params.amount;
    this.state.equity -= params.amount;
    this.state.freeMargin = Math.max(0, this.state.equity - this.state.usedMargin);
    this.state.updatedAt = Date.now();

    const tx: TransactionRecord = {
      id: 'tx_wdr_' + Date.now(),
      accountId: this.state.id,
      type: 'WITHDRAWAL',
      amount: -params.amount,
      balanceBefore: prevBalance,
      balanceAfter: this.state.balance,
      note: params.note || `Withdrawal to ${params.method}`,
      paymentMethod: params.method,
      timestamp: Date.now()
    };

    await dbRepo.getAdapter().addTransaction(tx);
    await this.persist();
    this.notify();

    return { success: true, message: `Berhasil menarik dana $${params.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}!` };
  }

  /**
   * Factory reset account to default $10,000
   */
  public async resetAccount(targetBalance: number = DEFAULT_INITIAL_BALANCE): Promise<void> {
    this.state = {
      id: 'default',
      accountNumber: 'APX-774921-PRO',
      currency: 'USD',
      balance: targetBalance,
      equity: targetBalance,
      usedMargin: 0,
      freeMargin: targetBalance,
      marginLevel: 0,
      floatingPnL: 0,
      initialDeposit: targetBalance,
      isMarginCall: false,
      isStopOut: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await dbRepo.getAdapter().resetAll();
    await this.persist();
    this.notify();
  }

  private async persist(): Promise<void> {
    await dbRepo.getAdapter().saveAccount(this.state);
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach(cb => cb(s));
  }
}

export const accountService = AccountService.getInstance();
