export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_PROFIT' | 'TRADE_LOSS' | 'RESET';

export interface AccountState {
  id: string;
  accountNumber: string;
  currency: string;
  balance: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number; // Equity / UsedMargin * 100
  floatingPnL: number;
  initialDeposit: number;
  isMarginCall: boolean;
  isStopOut: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TransactionRecord {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string;
  paymentMethod?: string;
  timestamp: number;
}

export interface DepositWithdrawParams {
  amount: number;
  method: string;
  note?: string;
}
