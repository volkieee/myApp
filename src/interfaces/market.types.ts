export type AssetCategory = 'Forex' | 'Crypto' | 'Stocks' | 'Commodities';
export type TimeframeKey = '1s' | '5s' | '15s' | '1m' | '5m';

export interface AssetConfig {
  symbol: string;
  name: string;
  category: AssetCategory;
  basePrice: number;
  decimals: number;
  spreadPips: number;
  pipMultiplier: number;
  volatility: number;
  drift: number;
  maxLeverage: number;
  binancePair?: string; // e.g. 'btcusdt'
  icon?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  change24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
  isRealTimeLive: boolean;
  provider: string;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
  depthPct: number;
}

export interface OrderBookDepth {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  timestamp: number;
}
