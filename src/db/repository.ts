import { IDatabaseAdapter } from '../interfaces/database.types';
import { IndexedDBAdapter } from './indexedDB.adapter';

export class DatabaseRepository {
  private static instance: DatabaseRepository;
  private adapter: IDatabaseAdapter;

  private constructor() {
    this.adapter = new IndexedDBAdapter();
  }

  public static getInstance(): DatabaseRepository {
    if (!DatabaseRepository.instance) {
      DatabaseRepository.instance = new DatabaseRepository();
    }
    return DatabaseRepository.instance;
  }

  public setAdapter(adapter: IDatabaseAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): IDatabaseAdapter {
    return this.adapter;
  }

  public async init(): Promise<void> {
    await this.adapter.init();
  }
}

export const dbRepo = DatabaseRepository.getInstance();
