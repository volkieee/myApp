import { IDatabaseAdapter } from '../interfaces/database.types';
import { AccountState, TransactionRecord } from '../interfaces/account.types';
import { Position, TradeHistoryItem, Order } from '../interfaces/trading.types';

/**
 * ApiDatabaseAdapter
 * Pluggable backend adapter that communicates with a remote REST or WebSocket API
 * (e.g., PostgreSQL, Supabase, MySQL backend).
 */
export class ApiDatabaseAdapter implements IDatabaseAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  public async init(): Promise<void> {
    console.log(`[API DB] Initialized adapter for endpoint: ${this.baseUrl}`);
  }

  public async getAccount(id: string = 'default'): Promise<AccountState | null> {
    try {
      const res = await fetch(`${this.baseUrl}/account/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public async saveAccount(account: AccountState): Promise<void> {
    await fetch(`${this.baseUrl}/account/${account.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
  }

  public async getOpenPositions(): Promise<Position[]> {
    try {
      const res = await fetch(`${this.baseUrl}/positions`);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  public async savePosition(position: Position): Promise<void> {
    await fetch(`${this.baseUrl}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(position)
    });
  }

  public async removePosition(positionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/positions/${positionId}`, {
      method: 'DELETE'
    });
  }

  public async getTradeHistory(limit: number = 200): Promise<TradeHistoryItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/trades?limit=${limit}`);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  public async addTradeHistory(item: TradeHistoryItem): Promise<void> {
    await fetch(`${this.baseUrl}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  }

  public async clearTradeHistory(): Promise<void> {
    await fetch(`${this.baseUrl}/trades`, { method: 'DELETE' });
  }

  public async getOrders(): Promise<Order[]> {
    try {
      const res = await fetch(`${this.baseUrl}/orders`);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  public async saveOrder(order: Order): Promise<void> {
    await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
  }

  public async getTransactions(limit: number = 100): Promise<TransactionRecord[]> {
    try {
      const res = await fetch(`${this.baseUrl}/transactions?limit=${limit}`);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  public async addTransaction(tx: TransactionRecord): Promise<void> {
    await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
  }

  public async resetAll(): Promise<void> {
    await fetch(`${this.baseUrl}/reset`, { method: 'POST' });
  }
}
