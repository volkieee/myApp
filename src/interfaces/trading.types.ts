export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type PositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED';
export type CloseReason = 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  units: number;
  margin: number;
  leverage: number;
  requestedPrice: number;
  executedPrice?: number;
  takeProfit?: number | null;
  stopLoss?: number | null;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createdAt: number;
  filledAt?: number;
}

export interface Position {
  id: string;
  orderId?: string;
  symbol: string;
  assetName: string;
  side: OrderSide;
  leverage: number;
  margin: number;
  units: number;
  entryPrice: number;
  currentPrice: number;
  takeProfit: number | null;
  stopLoss: number | null;
  liquidationPrice: number;
  floatingPnL: number;
  floatingPnLPct: number;
  spreadCost: number;
  status: PositionStatus;
  openedAt: number;
  lastUpdated: number;
}

export interface TradeHistoryItem {
  id: string;
  symbol: string;
  assetName: string;
  side: OrderSide;
  leverage: number;
  margin: number;
  units: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercentage: number;
  reason: CloseReason;
  openedAt: number;
  closedAt: number;
  spreadCost: number;
}

export interface CreateOrderParams {
  symbol: string;
  side: OrderSide;
  margin: number;
  leverage: number;
  takeProfit?: number | null;
  stopLoss?: number | null;
}
