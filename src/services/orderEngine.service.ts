import { CloseReason, CreateOrderParams, Position, TradeHistoryItem } from '../interfaces/trading.types';
import { marketFeed } from './marketFeed.service';
import { accountService } from './account.service';
import { soundEngine } from './sound.service';
import { dbRepo } from '../db/repository';

export type PositionsListener = (positions: Position[]) => void;
export type HistoryListener = (history: TradeHistoryItem[]) => void;

export class OrderEngineService {
  private static instance: OrderEngineService;

  private openPositions: Position[] = [];
  private tradeHistory: TradeHistoryItem[] = [];

  private positionsListeners: Set<PositionsListener> = new Set();
  private historyListeners: Set<HistoryListener> = new Set();

  private constructor() { }

  public static getInstance(): OrderEngineService {
    if (!OrderEngineService.instance) {
      OrderEngineService.instance = new OrderEngineService();
    }
    return OrderEngineService.instance;
  }

  public async init(): Promise<void> {
    const adapter = dbRepo.getAdapter();
    this.openPositions = await adapter.getOpenPositions();
    this.tradeHistory = await adapter.getTradeHistory(200);

    // Subscribe to market ticks to update positions & check TP/SL/Liquidation
    marketFeed.onTick(() => {
      this.evaluateAllPositions();
    });

    this.notifyPositions();
    this.notifyHistory();
  }

  public getOpenPositions(): Position[] {
    return [...this.openPositions];
  }

  public getTradeHistory(): TradeHistoryItem[] {
    return [...this.tradeHistory];
  }

  public subscribePositions(cb: PositionsListener): () => void {
    this.positionsListeners.add(cb);
    cb(this.getOpenPositions());
    return () => this.positionsListeners.delete(cb);
  }

  public subscribeHistory(cb: HistoryListener): () => void {
    this.historyListeners.add(cb);
    cb(this.getTradeHistory());
    return () => this.historyListeners.delete(cb);
  }

  /**
   * Execute an instant Market BUY or SELL order
   */
  public async executeMarketOrder(params: CreateOrderParams): Promise<{ success: boolean; message: string; position?: Position }> {
    const asset = marketFeed.getAssets().find(a => a.symbol === params.symbol);
    if (!asset) {
      return { success: false, message: `Aset ${params.symbol} tidak ditemukan.` };
    }

    if (params.margin <= 0 || isNaN(params.margin)) {
      return { success: false, message: 'Nominal margin / modal tidak valid.' };
    }

    // Check account free margin
    const canReserve = accountService.reserveMargin(params.margin);
    if (!canReserve) {
      return { success: false, message: 'Margin bebas tidak mencukupi untuk membuka order ini.' };
    }

    const quote = marketFeed.getQuote(params.symbol);
    // Entry price with spread (BUY at Ask, SELL at Bid)
    const rawPrice = params.side === 'BUY' ? quote.ask : quote.bid;
    // Real-world dynamic slippage modeling (0 - 0.5 pip)
    const slippage = (Math.random() * 0.5 * asset.spreadPips * asset.pipMultiplier) * (params.side === 'BUY' ? 1 : -1);
    const entryPrice = rawPrice + slippage;

    const notionalValue = params.margin * params.leverage;
    const units = notionalValue / entryPrice;
    const spreadCost = (quote.ask - quote.bid) * units;

    // Calculate Liquidation Price (assuming ~90% margin loss threshold for position)
    let liquidationPrice: number;
    if (params.side === 'BUY') {
      liquidationPrice = entryPrice * (1 - 0.9 / params.leverage);
    } else {
      liquidationPrice = entryPrice * (1 + 0.9 / params.leverage);
    }

    const position: Position = {
      id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      symbol: asset.symbol,
      assetName: asset.name,
      side: params.side,
      leverage: params.leverage,
      margin: params.margin,
      units,
      entryPrice,
      currentPrice: entryPrice,
      takeProfit: params.takeProfit && params.takeProfit > 0 ? params.takeProfit : null,
      stopLoss: params.stopLoss && params.stopLoss > 0 ? params.stopLoss : null,
      liquidationPrice,
      floatingPnL: -spreadCost, // immediate spread impact
      floatingPnLPct: ((-spreadCost) / params.margin) * 100,
      spreadCost,
      status: 'OPEN',
      openedAt: Date.now(),
      lastUpdated: Date.now()
    };

    this.openPositions.push(position);
    await dbRepo.getAdapter().savePosition(position);

    soundEngine.playOrder();
    this.evaluateAllPositions();
    this.notifyPositions();

    return {
      success: true,
      message: `Order ${params.side} ${params.symbol} berhasil dieksekusi pada harga ${entryPrice.toFixed(asset.decimals)}!`,
      position
    };
  }

  /**
   * Close an open position manually
   */
  public async closePosition(positionId: string, reason: CloseReason = 'MANUAL'): Promise<boolean> {
    const idx = this.openPositions.findIndex(p => p.id === positionId);
    if (idx < 0) return false;

    const pos = this.openPositions[idx];
    const quote = marketFeed.getQuote(pos.symbol);
    const exitPrice = pos.side === 'BUY' ? quote.bid : quote.ask;

    const pnl = pos.floatingPnL;
    const pnlPercentage = (pnl / pos.margin) * 100;

    const historyItem: TradeHistoryItem = {
      id: pos.id,
      symbol: pos.symbol,
      assetName: pos.assetName,
      side: pos.side,
      leverage: pos.leverage,
      margin: pos.margin,
      units: pos.units,
      entryPrice: pos.entryPrice,
      exitPrice,
      pnl,
      pnlPercentage,
      reason,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      spreadCost: pos.spreadCost
    };

    // Remove from open positions and save to history
    this.openPositions.splice(idx, 1);
    await dbRepo.getAdapter().removePosition(pos.id);
    await dbRepo.getAdapter().addTradeHistory(historyItem);
    this.tradeHistory.unshift(historyItem);

    // Settle with Account Service
    await accountService.settleTradePnL(
      pnl,
      pos.margin,
      `Tutup Posisi ${pos.side} ${pos.symbol} (${reason}): PnL $${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`
    );

    // Audio cue
    if (reason === 'LIQUIDATION') {
      soundEngine.playLiquidation();
    } else if (pnl >= 0) {
      soundEngine.playWin();
    } else {
      soundEngine.playLoss();
    }

    this.evaluateAllPositions();
    this.notifyPositions();
    this.notifyHistory();

    return true;
  }

  /**
   * Modify TP and SL on an active position
   */
  public async modifyTPSL(positionId: string, tp: number | null, sl: number | null): Promise<boolean> {
    const pos = this.openPositions.find(p => p.id === positionId);
    if (!pos) return false;

    pos.takeProfit = tp;
    pos.stopLoss = sl;
    pos.lastUpdated = Date.now();

    await dbRepo.getAdapter().savePosition(pos);
    this.notifyPositions();
    return true;
  }

  /**
   * Clear all trade history
   */
  public async clearHistory(): Promise<void> {
    this.tradeHistory = [];
    await dbRepo.getAdapter().clearTradeHistory();
    this.notifyHistory();
  }

  /**
   * Evaluate all positions on each tick
   */
  private evaluateAllPositions(): void {
    if (this.openPositions.length === 0) {
      accountService.updatePositionsPnL(0, 0);
      return;
    }

    let totalUsedMargin = 0;
    let totalFloatingPnL = 0;
    const positionsToClose: { id: string; reason: CloseReason }[] = [];

    this.openPositions.forEach(pos => {
      const quote = marketFeed.getQuote(pos.symbol);
      const curPrice = pos.side === 'BUY' ? quote.bid : quote.ask;
      pos.currentPrice = curPrice;

      // PnL calculation
      let priceDiff = curPrice - pos.entryPrice;
      if (pos.side === 'SELL') {
        priceDiff = pos.entryPrice - curPrice;
      }

      const rawPnL = priceDiff * pos.units;
      pos.floatingPnL = rawPnL - pos.spreadCost;
      pos.floatingPnLPct = (pos.floatingPnL / pos.margin) * 100;
      pos.lastUpdated = Date.now();

      totalUsedMargin += pos.margin;
      totalFloatingPnL += pos.floatingPnL;

      // 1. Take Profit Check
      if (pos.takeProfit) {
        if ((pos.side === 'BUY' && curPrice >= pos.takeProfit) ||
          (pos.side === 'SELL' && curPrice <= pos.takeProfit)) {
          positionsToClose.push({ id: pos.id, reason: 'TAKE_PROFIT' });
          return;
        }
      }

      // 2. Stop Loss Check
      if (pos.stopLoss) {
        if ((pos.side === 'BUY' && curPrice <= pos.stopLoss) ||
          (pos.side === 'SELL' && curPrice >= pos.stopLoss)) {
          positionsToClose.push({ id: pos.id, reason: 'STOP_LOSS' });
          return;
        }
      }

      // 3. Single Position Liquidation Check
      if ((pos.side === 'BUY' && curPrice <= pos.liquidationPrice) ||
        (pos.side === 'SELL' && curPrice >= pos.liquidationPrice)) {
        positionsToClose.push({ id: pos.id, reason: 'LIQUIDATION' });
      }
    });

    // Update account dynamic equity & margin
    accountService.updatePositionsPnL(totalUsedMargin, totalFloatingPnL);

    // Check account-level Stop Out (Margin Level <= 20%)
    const accountState = accountService.getState();
    if (accountState.isStopOut && this.openPositions.length > 0) {
      // Find the position with highest negative PnL to liquidate first
      const sortedByLoss = [...this.openPositions].sort((a, b) => a.floatingPnL - b.floatingPnL);
      if (sortedByLoss[0] && !positionsToClose.some(p => p.id === sortedByLoss[0].id)) {
        positionsToClose.push({ id: sortedByLoss[0].id, reason: 'LIQUIDATION' });
      }
    }

    // Execute triggered closures
    if (positionsToClose.length > 0) {
      positionsToClose.forEach(item => {
        this.closePosition(item.id, item.reason);
      });
    }

    this.notifyPositions();
  }

  private notifyPositions(): void {
    const list = this.getOpenPositions();
    this.positionsListeners.forEach(cb => cb(list));
  }

  private notifyHistory(): void {
    const list = this.getTradeHistory();
    this.historyListeners.forEach(cb => cb(list));
  }
}

export const orderEngine = OrderEngineService.getInstance();
