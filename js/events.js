/**
 * DYNAMIC MARKET EVENTS & BREAKING NEWS SYSTEM
 * =====================================================================
 * Menghasilkan event random realistis (misal: Elon Musk tweet, FOMC Rate Cut,
 * Whale Liquidation, Exchange Outage) yang berdampak langsung pada volatilitas
 * dan arah grafik harga!
 * =====================================================================
 */

import { sfx } from './audio.js';

export const MARKET_EVENTS = [
    {
        id: "elon_pump",
        title: "🚀 ELON MUSK TWEET!",
        desc: "Elon Musk memposting cuitan bullish tentang adopsi crypto di sistem pembayaran global!",
        asset: "BTC/USDT",
        impact: "PUMP",
        intensity: 2.8,
        durationTicks: 25,
        type: "positive"
    },
    {
        id: "fed_cut",
        title: "🏛️ THE FED PANGKAS SUKU BUNGA!",
        desc: "Federal Reserve mengumumkan pemangkasan suku bunga darurat sebesar 50 bps!",
        asset: "ALL",
        impact: "PUMP",
        intensity: 2.2,
        durationTicks: 30,
        type: "positive"
    },
    {
        id: "whale_dump",
        title: "🐋 DUMP DARI MEGA WHALE!",
        desc: "Dompet kuno tahun 2011 mendadak mentransfer 20,000 BTC ke bursa untuk dijual!",
        asset: "BTC/USDT",
        impact: "DUMP",
        intensity: 3.0,
        durationTicks: 25,
        type: "negative"
    },
    {
        id: "sec_lawsuit",
        title: "⚠️ SEC MENGELUARKAN REGULASI KETAT!",
        desc: "Regulator meluncurkan investigasi terhadap stablecoin terkemuka.",
        asset: "ALL",
        impact: "DUMP",
        intensity: 2.4,
        durationTicks: 28,
        type: "negative"
    },
    {
        id: "gold_rush",
        title: "✨ KETEGANGAN GEOPOLITIK MENINGKAT!",
        desc: "Investor berbondong-bondong memindahkan aset mereka ke Safe Haven Emas (XAU)!",
        asset: "XAU/USD",
        impact: "PUMP",
        intensity: 2.6,
        durationTicks: 25,
        type: "positive"
    },
    {
        id: "sol_etf",
        title: "🔥 RUMOR ETF SOLANA DISETUJUI!",
        desc: "Wall Street bersiap meluncurkan Spot Solana ETF pertama minggu depan!",
        asset: "SOL/USDT",
        impact: "PUMP",
        intensity: 3.5,
        durationTicks: 20,
        type: "positive"
    }
];

export class MarketEventManager {
    constructor() {
        this.activeEvent = null;
        this.remainingTicks = 0;
        this.eventHistory = [];
        this.listeners = [];
        this.nextEventCountdown = 45; // seconds
    }

    onEvent(callback) {
        this.listeners.push(callback);
    }

    notify(eventData) {
        this.listeners.forEach(cb => cb(eventData));
    }

    tick() {
        if (this.activeEvent) {
            this.remainingTicks--;
            if (this.remainingTicks <= 0) {
                const finished = this.activeEvent;
                this.activeEvent = null;
                this.notify({ type: 'EVENT_ENDED', event: finished });
            }
        }
    }

    triggerRandomEvent(forceEvent = null) {
        const eventTemplate = forceEvent || MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
        this.activeEvent = {
            ...eventTemplate,
            startTime: Date.now()
        };
        this.remainingTicks = eventTemplate.durationTicks;

        this.eventHistory.unshift({
            ...this.activeEvent,
            timestamp: new Date().toLocaleTimeString()
        });
        if (this.eventHistory.length > 20) this.eventHistory.pop();

        sfx.playAlert();
        this.notify({ type: 'EVENT_STARTED', event: this.activeEvent });
        return this.activeEvent;
    }

    getSentimentModifier(assetSymbol) {
        if (!this.activeEvent) return 0;
        if (this.activeEvent.asset !== "ALL" && this.activeEvent.asset !== assetSymbol) {
            return 0;
        }

        const baseMultiplier = this.activeEvent.impact === "PUMP" ? 1 : -1;
        return baseMultiplier * this.activeEvent.intensity;
    }
}

export const eventManager = new MarketEventManager();
