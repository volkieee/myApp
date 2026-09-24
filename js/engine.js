/**
 * TRADING & SIMULATION ENGINE
 * =====================================================================
 * Mengatur pergerakan harga aset realtime, Order Execution (Long/Short),
 * Multi-Timeframe Candlestick aggregation, Margin calculation,
 * Stop Loss / Take Profit & Liquidation.
 * =====================================================================
 */

import { game } from './game.js';
import { eventManager } from './events.js';
import { sfx } from './audio.js';

export const ASSETS = {
    'BTC/USDT': { name: 'Bitcoin', symbol: 'BTC/USDT', icon: 'fab fa-bitcoin', color: '#f7931a', basePrice: 65420.00, decimals: 2, tickSize: 2.5, volatility: 0.0018 },
    'ETH/USDT': { name: 'Ethereum', symbol: 'ETH/USDT', icon: 'fab fa-ethereum', color: '#627eea', basePrice: 3480.00, decimals: 2, tickSize: 0.4, volatility: 0.0022 },
    'SOL/USDT': { name: 'Solana', symbol: 'SOL/USDT', icon: 'fas fa-bolt', color: '#14f195', basePrice: 152.40, decimals: 2, tickSize: 0.05, volatility: 0.0035 },
    'DOGE/USDT': { name: 'Dogecoin', symbol: 'DOGE/USDT', icon: 'fas fa-dog', color: '#cb9800', basePrice: 0.1420, decimals: 4, tickSize: 0.0001, volatility: 0.0045 },
    'XAU/USD': { name: 'Gold Spot', symbol: 'XAU/USD', icon: 'fas fa-coins', color: '#ffd700', basePrice: 2360.50, decimals: 2, tickSize: 0.15, volatility: 0.0012 }
};

export class TradingEngine {
    constructor() {
        this.selectedAsset = 'BTC/USDT';
        this.prices = {};
        this.candles = {}; // { 'BTC/USDT': [ { time, open, high, low, close, volume } ] }
        this.positions = []; // Active trades
        this.orderBook = { bids: [], asks: [] };
        this.timeframe = '5s'; // 1s, 5s, 15s, 1m
        this.simulationSpeed = 1; // 1x, 2x, 5x
        this.isRunning = true;
        this.tickTimer = null;
        this.listeners = [];

        this.initPrices();
    }

    initPrices() {
        Object.keys(ASSETS).forEach(sym => {
            const base = ASSETS[sym].basePrice;
            this.prices[sym] = {
                price: base,
                prevPrice: base,
                change24h: ((Math.random() * 8) - 3.5),
                high24h: base * 1.05,
                low24h: base * 0.95,
                volume: Math.floor(Math.random() * 50000) + 10000
            };
            this.generateInitialCandles(sym, 180);
        });
        this.generateOrderBook();
    }

    generateInitialCandles(symbol, count) {
        this.candles[symbol] = [];
        let cur = ASSETS[symbol].basePrice * 0.96;
        const now = Date.now();
        const intervalMs = this.getTimeframeSeconds() * 1000;

        for (let i = count; i >= 0; i--) {
            const time = now - (i * intervalMs);
            const delta = (Math.random() - 0.48) * (cur * ASSETS[symbol].volatility * 2);
            const open = cur;
            const close = cur + delta;
            const high = Math.max(open, close) + Math.random() * Math.abs(delta) * 0.8;
            const low = Math.min(open, close) - Math.random() * Math.abs(delta) * 0.8;
            const volume = Math.floor(Math.random() * 50) + 5;

            this.candles[symbol].push({ time, open, high, low, close, volume });
            cur = close;
        }
        this.prices[symbol].price = cur;
    }

    getTimeframeSeconds() {
        switch (this.timeframe) {
            case '1s': return 1;
            case '5s': return 5;
            case '15s': return 15;
            case '1m': return 60;
            default: return 5;
        }
    }

    setTimeframe(tf) {
        this.timeframe = tf;
        this.generateInitialCandles(this.selectedAsset, 180);
        this.notify('TIMEFRAME_CHANGE');
    }

    setSimulationSpeed(speed) {
        this.simulationSpeed = speed;
        this.startEngine();
    }

    startEngine() {
        if (this.tickTimer) clearInterval(this.tickTimer);
        const interval = Math.max(150, Math.floor(800 / this.simulationSpeed));
        this.tickTimer = setInterval(() => this.tick(), interval);
    }

    onUpdate(callback) {
        this.listeners.push(callback);
    }

    notify(eventType = 'TICK') {
        this.listeners.forEach(cb => cb(eventType, this));
    }

    tick() {
        eventManager.tick();

        // Update all assets
        Object.keys(ASSETS).forEach(sym => {
            const assetConfig = ASSETS[sym];
            const pData = this.prices[sym];
            const sentimentMod = eventManager.getSentimentModifier(sym);

            // Realistic random walk with volatility spikes, micro-wicks and fakeouts
            const isSpikeTick = Math.random() < 0.12; // 12% chance of micro volatility spike / wick
            const spikeMultiplier = isSpikeTick ? (Math.random() * 2.5 + 1.2) : 1.0;
            
            // Trend momentum & Sentiment + noise
            if (!pData.trendBias || Math.random() < 0.08) {
                pData.trendBias = (Math.random() - 0.5) * 0.8; // Semi-persistent trend bias
            }
            const noise = (Math.random() - 0.498) + (pData.trendBias * 0.3);
            const randFactor = (noise * spikeMultiplier) + (sentimentMod * 0.45);
            const delta = randFactor * (pData.price * assetConfig.volatility);

            pData.prevPrice = pData.price;
            pData.price = Math.max(pData.price * 0.1, pData.price + delta);

            // Update current candle
            const currentCandles = this.candles[sym];
            const lastCandle = currentCandles[currentCandles.length - 1];
            const now = Date.now();
            const tfMs = this.getTimeframeSeconds() * 1000;

            // Add realistic high/low wicks during volatility
            const wickExpansion = isSpikeTick ? Math.abs(delta) * (Math.random() * 1.5 + 0.5) : 0;

            if (lastCandle && (now - lastCandle.time) < tfMs) {
                lastCandle.close = pData.price;
                if (pData.price + wickExpansion > lastCandle.high) lastCandle.high = pData.price + wickExpansion;
                if (pData.price - wickExpansion < lastCandle.low) lastCandle.low = Math.max(0.0001, pData.price - wickExpansion);
                lastCandle.volume += Math.floor(Math.random() * 3) + 1;
            } else {
                currentCandles.push({
                    time: now,
                    open: pData.price,
                    high: pData.price + wickExpansion,
                    low: Math.max(0.0001, pData.price - wickExpansion),
                    close: pData.price,
                    volume: 1
                });
                if (currentCandles.length > 350) currentCandles.shift();
            }
        });

        this.generateOrderBook();
        this.evaluatePositions();
        this.notify('TICK');
    }

    generateOrderBook() {
        const curPrice = this.getCurrentPrice();
        const sym = this.selectedAsset;
        const decimals = ASSETS[sym].decimals;
        const tick = ASSETS[sym].tickSize;

        const asks = [];
        const bids = [];

        for (let i = 1; i <= 6; i++) {
            const askP = curPrice + (i * tick);
            const askV = (Math.random() * 4 + 0.2).toFixed(2);
            asks.unshift({ price: askP.toFixed(decimals), volume: askV });

            const bidP = curPrice - (i * tick);
            const bidV = (Math.random() * 4 + 0.2).toFixed(2);
            bids.push({ price: bidP.toFixed(decimals), volume: bidV });
        }

        this.orderBook = { asks, bids };
    }

    getCurrentPrice(symbol = null) {
        const sym = symbol || this.selectedAsset;
        return this.prices[sym] ? this.prices[sym].price : 0;
    }

    selectAsset(symbol) {
        if (ASSETS[symbol]) {
            this.selectedAsset = symbol;
            this.generateOrderBook();
            this.notify('ASSET_CHANGE');
        }
    }

    openPosition({ type, margin, leverage, tpPercent = null, slPercent = null }) {
        const sym = this.selectedAsset;
        const curPrice = this.getCurrentPrice(sym);

        if (margin <= 0) return { success: false, msg: "Margin tidak valid" };
        if (game.balance < margin) return { success: false, msg: "Saldo tidak mencukupi!" };

        // Max positions based on trader rank
        const rankInfo = game.getRankInfo();
        const maxPositions = rankInfo.level === 1 ? 3 : (rankInfo.level === 2 ? 5 : (rankInfo.level === 3 ? 8 : 12));
        if (this.positions.length >= maxPositions) {
            return { success: false, msg: `Maksimal ${maxPositions} posisi terbuka untuk Rank ${rankInfo.name}!` };
        }

        // Max leverage check
        const maxLev = rankInfo.maxLeverage;
        if (leverage > maxLev) {
            return { success: false, msg: `Rank kamu saat ini hanya mengizinkan leverage maksimal ${maxLev}x!` };
        }

        // Deduct margin from game balance
        game.deductBalance(margin);

        const positionValue = margin * leverage;
        const amount = positionValue / curPrice;

        // Realistic Taker Fee / Spread (0.08% dari nilai total posisi bernilai leverage)
        const fee = positionValue * 0.0008;

        // Liquidation calculation (approx 90% loss of margin)
        const liqDistance = (curPrice / leverage) * 0.9;
        const liqPrice = type === 'LONG' ? Math.max(0, curPrice - liqDistance) : curPrice + liqDistance;

        const position = {
            id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            symbol: sym,
            type: type.toUpperCase(), // LONG or SHORT
            entryPrice: curPrice,
            currentPrice: curPrice,
            margin: margin,
            leverage: leverage,
            amount: amount,
            fee: fee,
            holdingFee: 0, // Biaya Funding Rate / Menginap posisi
            liqPrice: liqPrice,
            pnl: -fee, // Mulai dari minus fee transaksi agar realistis (tidak instan profit 0 detik)
            pnlPercent: -(fee / margin) * 100,
            tpPrice: tpPercent ? (type === 'LONG' ? curPrice * (1 + (tpPercent / (100 * leverage))) : curPrice * (1 - (tpPercent / (100 * leverage)))) : null,
            slPrice: slPercent ? (type === 'LONG' ? curPrice * (1 - (slPercent / (100 * leverage))) : curPrice * (1 + (slPercent / (100 * leverage)))) : null,
            openedAt: new Date().toLocaleTimeString(),
            timestamp: Date.now()
        };

        this.positions.unshift(position);

        if (type === 'LONG') sfx.playBuy();
        else sfx.playSell();

        this.notify('POSITION_OPENED');
        return { success: true, position };
    }

    evaluatePositions() {
        for (let i = this.positions.length - 1; i >= 0; i--) {
            const pos = this.positions[i];
            const curPrice = this.getCurrentPrice(pos.symbol);
            pos.currentPrice = curPrice;

            // Biaya Funding Rate bertambah seiring waktu posisi ditahan (0.005% dari nilai leverage per tick)
            const positionValue = pos.margin * pos.leverage;
            pos.holdingFee = (pos.holdingFee || 0) + (positionValue * 0.00005);

            let priceDiff = 0;
            if (pos.type === 'LONG') {
                priceDiff = curPrice - pos.entryPrice;
            } else {
                priceDiff = pos.entryPrice - curPrice;
            }

            const pnlRatio = priceDiff / pos.entryPrice;
            const grossPnl = pos.margin * pnlRatio * pos.leverage;
            
            // Net PnL dikurangi trading fee & holding fee (Funding Rate)
            const netPnl = grossPnl - pos.fee - pos.holdingFee;
            pos.pnl = netPnl;
            pos.pnlPercent = (netPnl / pos.margin) * 100;

            // Check Liquidation
            let isLiquidated = false;
            if (pos.type === 'LONG' && curPrice <= pos.liqPrice) isLiquidated = true;
            if (pos.type === 'SHORT' && curPrice >= pos.liqPrice) isLiquidated = true;

            if (isLiquidated) {
                this.positions.splice(i, 1);
                const cashback = game.handleLiquidation(pos);
                window.dispatchEvent(new CustomEvent('apex_liquidation', {
                    detail: { position: pos, cashback }
                }));
                this.notify('LIQUIDATION');
                continue;
            }

            // Check Take Profit
            if (pos.tpPrice) {
                if ((pos.type === 'LONG' && curPrice >= pos.tpPrice) || (pos.type === 'SHORT' && curPrice <= pos.tpPrice)) {
                    this.closePosition(pos.id, 'TP_TRIGGERED');
                    continue;
                }
            }

            // Check Stop Loss
            if (pos.slPrice) {
                if ((pos.type === 'LONG' && curPrice <= pos.slPrice) || (pos.type === 'SHORT' && curPrice >= pos.slPrice)) {
                    this.closePosition(pos.id, 'SL_TRIGGERED');
                    continue;
                }
            }
        }
    }

    closePosition(posId, reason = 'MANUAL') {
        const idx = this.positions.findIndex(p => p.id === posId);
        if (idx === -1) return null;

        const pos = this.positions[idx];
        this.positions.splice(idx, 1);

        const closedTrade = {
            ...pos,
            closePrice: this.getCurrentPrice(pos.symbol),
            closedAt: new Date().toLocaleTimeString(),
            closeReason: reason
        };

        game.handleTradeClosed(closedTrade);
        this.notify('POSITION_CLOSED');
        return closedTrade;
    }

    closeAllPositions() {
        const closedCount = this.positions.length;
        while (this.positions.length > 0) {
            this.closePosition(this.positions[0].id, 'CLOSE_ALL');
        }
        return closedCount;
    }
}

export const engine = new TradingEngine();
