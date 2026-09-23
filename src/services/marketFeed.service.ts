import { AssetConfig, Candle, OrderBookDepth, OrderBookLevel, TickerQuote, TimeframeKey } from '../interfaces/market.types';

export const ASSETS: AssetConfig[] = [
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'Forex',
    basePrice: 1.14630,
    decimals: 5,
    spreadPips: 0.4,
    pipMultiplier: 0.0001,
    volatility: 0.00015,
    drift: 0.000002,
    maxLeverage: 100,
    icon: 'fa-euro-sign'
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    category: 'Forex',
    basePrice: 1.28450,
    decimals: 5,
    spreadPips: 0.8,
    pipMultiplier: 0.0001,
    volatility: 0.00025,
    drift: -0.000003,
    maxLeverage: 100,
    icon: 'fa-sterling-sign'
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    category: 'Forex',
    basePrice: 154.200,
    decimals: 3,
    spreadPips: 0.6,
    pipMultiplier: 0.01,
    volatility: 0.04,
    drift: 0.005,
    maxLeverage: 100,
    icon: 'fa-yen-sign'
  },
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin / Tether USD',
    category: 'Crypto',
    basePrice: 65420.00,
    decimals: 2,
    spreadPips: 1.5,
    pipMultiplier: 1.0,
    volatility: 18.5,
    drift: 2.1,
    maxLeverage: 50,
    binancePair: 'btcusdt',
    icon: 'fa-brands fa-bitcoin'
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum / Tether USD',
    category: 'Crypto',
    basePrice: 3450.50,
    decimals: 2,
    spreadPips: 1.2,
    pipMultiplier: 0.1,
    volatility: 2.8,
    drift: 0.25,
    maxLeverage: 50,
    binancePair: 'ethusdt',
    icon: 'fa-brands fa-ethereum'
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana / Tether USD',
    category: 'Crypto',
    basePrice: 152.80,
    decimals: 2,
    spreadPips: 2.0,
    pipMultiplier: 0.05,
    volatility: 0.35,
    drift: 0.05,
    maxLeverage: 25,
    binancePair: 'solusdt',
    icon: 'fa-bolt'
  },
  {
    symbol: 'XAU/USD',
    name: 'Emas / Gold Spot',
    category: 'Commodities',
    basePrice: 2380.50,
    decimals: 2,
    spreadPips: 1.8,
    pipMultiplier: 0.1,
    volatility: 0.95,
    drift: 0.1,
    maxLeverage: 50,
    icon: 'fa-coins'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    category: 'Stocks',
    basePrice: 188.40,
    decimals: 2,
    spreadPips: 1.0,
    pipMultiplier: 0.01,
    volatility: 0.12,
    drift: 0.02,
    maxLeverage: 20,
    icon: 'fa-apple-whole'
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    category: 'Stocks',
    basePrice: 215.60,
    decimals: 2,
    spreadPips: 2.5,
    pipMultiplier: 0.01,
    volatility: 0.45,
    drift: -0.05,
    maxLeverage: 20,
    icon: 'fa-car'
  }
];

export const TIMEFRAMES: Record<TimeframeKey, { label: string; ms: number; candleLimit: number }> = {
  '1s': { label: '1s (Turbo)', ms: 1000, candleLimit: 120 },
  '5s': { label: '5s', ms: 5000, candleLimit: 120 },
  '15s': { label: '15s', ms: 15000, candleLimit: 120 },
  '1m': { label: '1m', ms: 60000, candleLimit: 120 },
  '5m': { label: '5m', ms: 300000, candleLimit: 120 }
};

type TickCallback = (quote: TickerQuote) => void;
type CandleCallback = (candles: Candle[], currentCandle: Candle) => void;
type OrderBookCallback = (depth: OrderBookDepth) => void;

export class MarketFeedService {
  private static instance: MarketFeedService;

  private currentAsset: AssetConfig;
  private currentTimeframe: TimeframeKey = '1s';
  private currentPrices: Map<string, number> = new Map();
  private initialDayPrices: Map<string, number> = new Map();

  // Candle history storage per asset & timeframe
  private candleHistory: Map<string, Map<TimeframeKey, Candle[]>> = new Map();
  private currentCandles: Map<string, Map<TimeframeKey, Candle>> = new Map();

  // Binance WebSocket
  private ws: WebSocket | null = null;
  private wsReconnectTimer: number | null = null;
  private isWsConnected: boolean = false;

  // Interbank FX Sync
  private fxSyncInterval: number | null = null;
  private lastFxRate: number = 1.1463;

  // Real-time tick timer
  private tickInterval: number | null = null;
  private lastTickTimestamp: number = Date.now();

  // Listeners
  private tickListeners: Set<TickCallback> = new Set();
  private candleListeners: Set<CandleCallback> = new Set();
  private orderBookListeners: Set<OrderBookCallback> = new Set();

  private constructor() {
    this.currentAsset = ASSETS[0];
    this.initHistoricalData();
    this.startInterbankSync();
  }

  public static getInstance(): MarketFeedService {
    if (!MarketFeedService.instance) {
      MarketFeedService.instance = new MarketFeedService();
    }
    return MarketFeedService.instance;
  }

  public start(): void {
    this.connectBinanceWs();
    this.startTickLoop();
  }

  public stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.fxSyncInterval) clearInterval(this.fxSyncInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Assets Management
  public getAssets(): AssetConfig[] {
    return ASSETS;
  }

  public getActiveAsset(): AssetConfig {
    return this.currentAsset;
  }

  public setActiveAsset(symbol: string): void {
    const found = ASSETS.find(a => a.symbol === symbol);
    if (found && found.symbol !== this.currentAsset.symbol) {
      this.currentAsset = found;
      this.connectBinanceWs();
      this.notifyCandleUpdate();
      this.notifyOrderBookUpdate();
    }
  }

  public getTimeframe(): TimeframeKey {
    return this.currentTimeframe;
  }

  public setTimeframe(tf: TimeframeKey): void {
    if (TIMEFRAMES[tf]) {
      this.currentTimeframe = tf;
      this.notifyCandleUpdate();
    }
  }

  public getQuote(symbol?: string): TickerQuote {
    const asset = symbol ? ASSETS.find(a => a.symbol === symbol) || this.currentAsset : this.currentAsset;
    const price = this.currentPrices.get(asset.symbol) || asset.basePrice;
    const halfSpread = (asset.spreadPips * asset.pipMultiplier) / 2;
    const bid = price - halfSpread;
    const ask = price + halfSpread;
    const dayStart = this.initialDayPrices.get(asset.symbol) || asset.basePrice;
    const change24h = ((price - dayStart) / dayStart) * 100;

    return {
      symbol: asset.symbol,
      price,
      bid,
      ask,
      spread: asset.spreadPips,
      change24h,
      high24h: price * 1.015,
      low24h: price * 0.985,
      timestamp: Date.now(),
      isRealTimeLive: !!(asset.binancePair && this.isWsConnected) || (asset.symbol === 'EUR/USD'),
      provider: asset.binancePair ? (this.isWsConnected ? 'Binance Live WebSocket' : 'Binance Gateway') : 'Interbank Global Feed'
    };
  }

  public getCandles(): { history: Candle[]; current: Candle } {
    const assetKey = this.currentAsset.symbol;
    const tfKey = this.currentTimeframe;

    const hist = this.candleHistory.get(assetKey)?.get(tfKey) || [];
    let cur = this.currentCandles.get(assetKey)?.get(tfKey);
    if (!cur) {
      const price = this.currentPrices.get(assetKey) || this.currentAsset.basePrice;
      cur = {
        time: Date.now(),
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1
      };
    }
    return { history: hist, current: cur };
  }

  // Subscribe to streams
  public onTick(cb: TickCallback): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  public onCandle(cb: CandleCallback): () => void {
    this.candleListeners.add(cb);
    return () => this.candleListeners.delete(cb);
  }

  public onOrderBook(cb: OrderBookCallback): () => void {
    this.orderBookListeners.add(cb);
    return () => this.orderBookListeners.delete(cb);
  }

  // Generate Realistic L2 Order Book Depth
  public getOrderBook(levels: number = 8): OrderBookDepth {
    const quote = this.getQuote();
    const asset = this.currentAsset;
    const tickStep = asset.pipMultiplier * (asset.category === 'Crypto' ? 2 : 1);

    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    let totalBid = 0;
    let totalAsk = 0;

    for (let i = 0; i < levels; i++) {
      const bidPrice = quote.bid - (i * tickStep);
      const askPrice = quote.ask + (i * tickStep);

      // Organic random volume with depth distribution
      const baseVol = (asset.category === 'Crypto' ? 0.8 : 2.5) * (1 + (i * 0.25));
      const bidAmount = Number((baseVol * (0.8 + Math.random() * 0.6)).toFixed(4));
      const askAmount = Number((baseVol * (0.8 + Math.random() * 0.6)).toFixed(4));

      totalBid += bidAmount;
      totalAsk += askAmount;

      bids.push({
        price: bidPrice,
        amount: bidAmount,
        total: totalBid,
        depthPct: 0 // calculated below
      });

      asks.push({
        price: askPrice,
        amount: askAmount,
        total: totalAsk,
        depthPct: 0
      });
    }

    const maxTotal = Math.max(totalBid, totalAsk);
    bids.forEach(b => b.depthPct = Math.min(100, Math.round((b.total / maxTotal) * 100)));
    asks.forEach(a => a.depthPct = Math.min(100, Math.round((a.total / maxTotal) * 100)));

    return {
      symbol: asset.symbol,
      bids,
      asks,
      spread: quote.spread,
      timestamp: Date.now()
    };
  }

  // Private Implementation
  private initHistoricalData(): void {
    ASSETS.forEach(asset => {
      this.currentPrices.set(asset.symbol, asset.basePrice);
      this.initialDayPrices.set(asset.symbol, asset.basePrice * (1 + (Math.random() - 0.5) * 0.01));

      const tfMap = new Map<TimeframeKey, Candle[]>();
      const curMap = new Map<TimeframeKey, Candle>();

      (Object.keys(TIMEFRAMES) as TimeframeKey[]).forEach(tf => {
        const tfConfig = TIMEFRAMES[tf];
        const candles: Candle[] = [];
        let price = asset.basePrice * 0.98;
        const now = Date.now();

        for (let i = tfConfig.candleLimit; i > 0; i--) {
          const candleTime = now - (i * tfConfig.ms);
          const change = (Math.random() - 0.49) * asset.volatility * Math.sqrt(tfConfig.ms / 1000);
          const open = price;
          const close = Math.max(price * 0.5, open + change);
          const high = Math.max(open, close) + Math.random() * asset.volatility * 0.5;
          const low = Math.min(open, close) - Math.random() * asset.volatility * 0.5;
          const volume = Math.floor(10 + Math.random() * 90);

          candles.push({ time: candleTime, open, high, low, close, volume });
          price = close;
        }

        tfMap.set(tf, candles);
        curMap.set(tf, {
          time: now,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 1
        });
      });

      this.candleHistory.set(asset.symbol, tfMap);
      this.currentCandles.set(asset.symbol, curMap);
    });
  }

  private connectBinanceWs(): void {
    if (typeof window === 'undefined' || !window.WebSocket) return;

    if (this.ws) {
      try {
        this.ws.close();
      } catch { }
      this.ws = null;
    }

    const pair = this.currentAsset.binancePair;
    if (!pair) {
      this.isWsConnected = false;
      return;
    }

    try {
      const endpoint = `wss://stream.binance.com:9443/ws/${pair}@trade`;
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.isWsConnected = true;
        console.log(`[WS] Connected to Binance real-time stream for ${pair.toUpperCase()}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.p) {
            const livePrice = parseFloat(data.p);
            this.handleIncomingTick(this.currentAsset.symbol, livePrice, true);
          }
        } catch { }
      };

      this.ws.onerror = () => {
        this.isWsConnected = false;
      };

      this.ws.onclose = () => {
        this.isWsConnected = false;
        if (this.currentAsset.binancePair) {
          if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
          this.wsReconnectTimer = window.setTimeout(() => this.connectBinanceWs(), 5000);
        }
      };
    } catch {
      this.isWsConnected = false;
    }
  }

  private startInterbankSync(): void {
    const fetchFx = async () => {
      try {
        // Try local server endpoint first or public open exchange API
        const res = await fetch('/api/rates').catch(() => fetch('https://open.er-api.com/v6/latest/EUR'));
        if (res.ok) {
          const data = await res.json();
          const rate = data.rates?.USD || data.rate;
          if (rate && typeof rate === 'number') {
            this.lastFxRate = rate;
            const eurAsset = ASSETS.find(a => a.symbol === 'EUR/USD');
            if (eurAsset) {
              this.handleIncomingTick('EUR/USD', rate, true);
            }
          }
        }
      } catch { }
    };

    fetchFx();
    this.fxSyncInterval = window.setInterval(fetchFx, 30000);
  }

  private startTickLoop(): void {
    // 250ms high-resolution market pulse loop
    this.tickInterval = window.setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - this.lastTickTimestamp) / 1000;
      this.lastTickTimestamp = now;

      // Update active asset price if not driven by high-frequency websocket
      if (!this.currentAsset.binancePair || !this.isWsConnected) {
        const curPrice = this.currentPrices.get(this.currentAsset.symbol) || this.currentAsset.basePrice;
        // Geometric Brownian Motion / Mean-reversion micro-tick
        const noise = (Math.random() - 0.495) * this.currentAsset.volatility * Math.sqrt(deltaSec);
        const drift = this.currentAsset.drift * deltaSec;
        const newPrice = Math.max(curPrice * 0.1, curPrice + noise + drift);
        this.handleIncomingTick(this.currentAsset.symbol, newPrice, false);
      }

      // Check candle period rollover
      this.updateCandles(now);
      this.notifyOrderBookUpdate();
    }, 250);
  }

  private handleIncomingTick(symbol: string, newPrice: number, isRealTime: boolean): void {
    this.currentPrices.set(symbol, newPrice);

    // Update current active candle for all timeframes
    const tfMap = this.currentCandles.get(symbol);
    if (tfMap) {
      tfMap.forEach(candle => {
        candle.high = Math.max(candle.high, newPrice);
        candle.low = Math.min(candle.low, newPrice);
        candle.close = newPrice;
        candle.volume += 1;
      });
    }

    if (symbol === this.currentAsset.symbol) {
      const quote = this.getQuote();
      quote.isRealTimeLive = isRealTime;
      this.tickListeners.forEach(cb => cb(quote));
      this.notifyCandleUpdate();
    }
  }

  private updateCandles(now: number): void {
    const symbol = this.currentAsset.symbol;
    const curMap = this.currentCandles.get(symbol);
    const histMap = this.candleHistory.get(symbol);
    if (!curMap || !histMap) return;

    (Object.keys(TIMEFRAMES) as TimeframeKey[]).forEach(tf => {
      const tfConfig = TIMEFRAMES[tf];
      const cur = curMap.get(tf);
      const hist = histMap.get(tf);
      if (!cur || !hist) return;

      if (now - cur.time >= tfConfig.ms) {
        // Roll candle over
        hist.push({ ...cur });
        if (hist.length > tfConfig.candleLimit) {
          hist.shift();
        }
        // Start next candle
        const nextTime = cur.time + tfConfig.ms;
        curMap.set(tf, {
          time: nextTime,
          open: cur.close,
          high: cur.close,
          low: cur.close,
          close: cur.close,
          volume: 1
        });
      }
    });
  }

  private notifyCandleUpdate(): void {
    const { history, current } = this.getCandles();
    this.candleListeners.forEach(cb => cb(history, current));
  }

  private notifyOrderBookUpdate(): void {
    const depth = this.getOrderBook();
    this.orderBookListeners.forEach(cb => cb(depth));
  }
}

export const marketFeed = MarketFeedService.getInstance();
