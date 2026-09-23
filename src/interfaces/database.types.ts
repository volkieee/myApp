import { AccountState, TransactionRecord } from './account.types';
import { Position, TradeHistoryItem, Order } from './trading.types';

export interface IDatabaseAdapter {
  init(): Promise<void>;

  // Account operations
  getAccount(id?: string): Promise<AccountState | null>;
  saveAccount(account: AccountState): Promise<void>;

  // Trades & Positions
  getOpenPositions(): Promise<Position[]>;
  savePosition(position: Position): Promise<void>;
  removePosition(positionId: string): Promise<void>;

  // Trade History
  getTradeHistory(limit?: number): Promise<TradeHistoryItem[]>;
  addTradeHistory(item: TradeHistoryItem): Promise<void>;
  clearTradeHistory(): Promise<void>;

  // Orders
  getOrders(): Promise<Order[]>;
  saveOrder(order: Order): Promise<void>;

  // Transactions / Ledger
  getTransactions(limit?: number): Promise<TransactionRecord[]>;
  addTransaction(tx: TransactionRecord): Promise<void>;

  // Factory reset
  resetAll(): Promise<void>;
}
