import { IDatabaseAdapter } from '../interfaces/database.types';
import { AccountState, TransactionRecord } from '../interfaces/account.types';
import { Position, TradeHistoryItem, Order } from '../interfaces/trading.types';

const DB_NAME = 'ApexTraderDB';
const DB_VERSION = 1;

export class IndexedDBAdapter implements IDatabaseAdapter {
  private db: IDBDatabase | null = null;
  private isAvailable: boolean = true;

  public async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[DB] IndexedDB not available, falling back to LocalStorage');
      this.isAvailable = false;
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[DB] Failed to open IndexedDB:', request.error);
        this.isAvailable = false;
        resolve(); // fallback gracefully
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[DB] IndexedDB initialized successfully (ApexTraderDB)');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('account')) {
          db.createObjectStore('account', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('trade_history')) {
          const store = db.createObjectStore('trade_history', { keyPath: 'id' });
          store.createIndex('closedAt', 'closedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
      };
    });
  }

  // Account
  public async getAccount(id: string = 'default'): Promise<AccountState | null> {
    if (!this.db || !this.isAvailable) {
      const raw = localStorage.getItem('apex_account_' + id);
      return raw ? JSON.parse(raw) : null;
    }
    return this.getOne<AccountState>('account', id);
  }

  public async saveAccount(account: AccountState): Promise<void> {
    if (!this.db || !this.isAvailable) {
      localStorage.setItem('apex_account_' + account.id, JSON.stringify(account));
      return;
    }
    await this.put('account', account);
  }

  // Positions
  public async getOpenPositions(): Promise<Position[]> {
    if (!this.db || !this.isAvailable) {
      const raw = localStorage.getItem('apex_positions');
      return raw ? JSON.parse(raw) : [];
    }
    return this.getAll<Position>('positions');
  }

  public async savePosition(position: Position): Promise<void> {
    if (!this.db || !this.isAvailable) {
      const positions = await this.getOpenPositions();
      const idx = positions.findIndex(p => p.id === position.id);
      if (idx >= 0) positions[idx] = position;
      else positions.push(position);
      localStorage.setItem('apex_positions', JSON.stringify(positions));
      return;
    }
    await this.put('positions', position);
  }

  public async removePosition(positionId: string): Promise<void> {
    if (!this.db || !this.isAvailable) {
      const positions = await this.getOpenPositions();
      const filtered = positions.filter(p => p.id !== positionId);
      localStorage.setItem('apex_positions', JSON.stringify(filtered));
      return;
    }
    await this.delete('positions', positionId);
  }

  // Trade History
  public async getTradeHistory(limit: number = 200): Promise<TradeHistoryItem[]> {
    if (!this.db || !this.isAvailable) {
      const raw = localStorage.getItem('apex_trade_history');
      const list: TradeHistoryItem[] = raw ? JSON.parse(raw) : [];
      return list.slice(0, limit);
    }
    const all = await this.getAll<TradeHistoryItem>('trade_history');
    return all.sort((a, b) => b.closedAt - a.closedAt).slice(0, limit);
  }

  public async addTradeHistory(item: TradeHistoryItem): Promise<void> {
    if (!this.db || !this.isAvailable) {
      const list = await this.getTradeHistory();
      list.unshift(item);
      localStorage.setItem('apex_trade_history', JSON.stringify(list));
      return;
    }
    await this.put('trade_history', item);
  }

  public async clearTradeHistory(): Promise<void> {
    if (!this.db || !this.isAvailable) {
      localStorage.removeItem('apex_trade_history');
      return;
    }
    await this.clear('trade_history');
  }

  // Orders
  public async getOrders(): Promise<Order[]> {
    if (!this.db || !this.isAvailable) {
      const raw = localStorage.getItem('apex_orders');
      return raw ? JSON.parse(raw) : [];
    }
    return this.getAll<Order>('orders');
  }

  public async saveOrder(order: Order): Promise<void> {
    if (!this.db || !this.isAvailable) {
      const list = await this.getOrders();
      list.push(order);
      localStorage.setItem('apex_orders', JSON.stringify(list));
      return;
    }
    await this.put('orders', order);
  }

  // Ledger / Transactions
  public async getTransactions(limit: number = 100): Promise<TransactionRecord[]> {
    if (!this.db || !this.isAvailable) {
      const raw = localStorage.getItem('apex_transactions');
      const list: TransactionRecord[] = raw ? JSON.parse(raw) : [];
      return list.slice(0, limit);
    }
    const all = await this.getAll<TransactionRecord>('transactions');
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  public async addTransaction(tx: TransactionRecord): Promise<void> {
    if (!this.db || !this.isAvailable) {
      const list = await this.getTransactions();
      list.unshift(tx);
      localStorage.setItem('apex_transactions', JSON.stringify(list));
      return;
    }
    await this.put('transactions', tx);
  }

  // Reset
  public async resetAll(): Promise<void> {
    if (!this.db || !this.isAvailable) {
      localStorage.clear();
      return;
    }
    await this.clear('account');
    await this.clear('positions');
    await this.clear('trade_history');
    await this.clear('transactions');
    await this.clear('orders');
  }

  // Private Helper Methods
  private getOne<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(null);
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    });
  }

  private getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  private put<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
