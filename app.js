/* ==========================================================================
   APEX TRADER PRO - CORE APPLICATION JAVASCRIPT
   Forex & Stock Market Game Simulator with Candlestick Engine & Analytics
   ========================================================================== */

(function () {
  'use strict';

  // =========================================================================
  // 1. AUDIO SYNTHESIZER (WEB AUDIO API)
  // =========================================================================
  class SoundEngine {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playOrder() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playWin() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // High bright arpeggio
      [587.33, 739.99, 880, 1174.66].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }

    playLoss() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }

    playLiq() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [300, 200, 150].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.1;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    }
  }

  const sound = new SoundEngine();

  // =========================================================================
  // 2. ASSETS CONFIGURATION & MARKET STATE
  // =========================================================================
  const ASSETS = {
    'EURUSD': {
      id: 'EURUSD',
      symbol: 'EUR/USD',
      name: 'Euro / US Dollar',
      category: 'Forex',
      basePrice: 1.14520,
      decimals: 5,
      pipSize: 0.0001,
      spreadPips: 0.4,
      volatility: 0.00018,
      trendBias: 0.00001,
      minTrade: 10
    },
    'XAUUSD': {
      id: 'XAUUSD',
      symbol: 'XAU/USD',
      name: 'Gold / US Dollar',
      category: 'Komoditas',
      basePrice: 2638.40,
      decimals: 2,
      pipSize: 0.1,
      spreadPips: 2.5,
      volatility: 0.85,
      trendBias: 0.04,
      minTrade: 25
    },
    'BTCUSDT': {
      id: 'BTCUSDT',
      symbol: 'BTC/USDT',
      name: 'Bitcoin / Tether',
      category: 'Kripto',
      basePrice: 64520.00,
      decimals: 2,
      pipSize: 1.0,
      spreadPips: 3.5,
      volatility: 28.0,
      trendBias: 1.5,
      minTrade: 20
    },
    'AAPL': {
      id: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      category: 'Saham',
      basePrice: 228.60,
      decimals: 2,
      pipSize: 0.05,
      spreadPips: 1.2,
      volatility: 0.22,
      trendBias: 0.015,
      minTrade: 15
    },
    'TSLA': {
      id: 'TSLA',
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      category: 'Saham',
      basePrice: 254.80,
      decimals: 2,
      pipSize: 0.05,
      spreadPips: 1.8,
      volatility: 0.55,
      trendBias: 0.03,
      minTrade: 20
    }
  };

  const TIMEFRAMES = {
    '1s': { durationMs: 1000, label: '1s' },
    '5s': { durationMs: 5000, label: '5s' },
    '15s': { durationMs: 15000, label: '15s' },
    '1m': { durationMs: 60000, label: '1m' },
    '5m': { durationMs: 300000, label: '5m' }
  };

  // =========================================================================
  // 3. MARKET DATA GENERATOR & CANDLESTICK SYSTEM
  // =========================================================================
  class MarketEngine {
    constructor() {
      this.assets = {};
      this.selectedAssetId = 'EURUSD';
      this.selectedTimeframe = '1s';
      this.subscribers = [];
      this.initAssets();
      this.fetchLiveForexRates();
      setInterval(() => this.fetchLiveForexRates(), 15000);
    }

    async fetchLiveForexRates() {
      try {
        let rate = null;
        let provider = 'ECB Live Feed';

        // 1. Try local server proxy first
        try {
          const res = await fetch('/api/rates');
          if (res.ok) {
            const data = await res.json();
            if (data && data.rate) {
              rate = parseFloat(data.rate);
              provider = data.provider || 'Interbank Live Feed';
            }
          }
        } catch (e1) { }

        // 2. Direct Fallback to open.er-api.com
        if (!rate) {
          try {
            const res2 = await fetch('https://open.er-api.com/v6/latest/EUR');
            if (res2.ok) {
              const data2 = await res2.json();
              if (data2 && data2.rates && data2.rates.USD) {
                rate = parseFloat(data2.rates.USD);
                provider = 'Open-ER Global FX';
              }
            }
          } catch (e2) { }
        }

        // 3. Direct Fallback to Frankfurter ECB API
        if (!rate) {
          try {
            const res3 = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD');
            if (res3.ok) {
              const data3 = await res3.json();
              if (data3 && data3.rates && data3.rates.USD) {
                rate = parseFloat(data3.rates.USD);
                provider = 'ECB Frankfurt Live';
              }
            }
          } catch (e3) { }
        }

        if (rate && !isNaN(rate)) {
          this.applyLiveEURRate(rate, provider);
        }
      } catch (err) {
        console.warn('Live forex fetch error:', err);
      }
    }

    applyLiveEURRate(liveRate, provider) {
      const eur = this.assets['EURUSD'];
      if (!eur) return;

      eur.basePrice = liveRate;

      // Smoothly steer price towards live rate
      const diff = liveRate - eur.price;
      eur.price = eur.price + diff * 0.35;
      eur.bid = eur.price - eur.spreadAmount / 2;
      eur.ask = eur.price + eur.spreadAmount / 2;

      // Update sync indicator in UI
      const syncEl = document.getElementById('syncText');
      if (syncEl) {
        const d = new Date();
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        syncEl.textContent = `1 EUR = $${liveRate.toFixed(4)} USD (${timeStr})`;
      }

      this.notifySubscribers();
    }


    initAssets() {
      const now = Date.now();
      for (const [id, config] of Object.entries(ASSETS)) {
        const spreadAmount = config.spreadPips * config.pipSize;
        const assetState = {
          ...config,
          price: config.basePrice,
          lastPrice: config.basePrice,
          open24h: config.basePrice * (1 + (Math.random() * 0.02 - 0.01)),
          high24h: config.basePrice,
          low24h: config.basePrice,
          bid: config.basePrice - spreadAmount / 2,
          ask: config.basePrice + spreadAmount / 2,
          spreadAmount: spreadAmount,
          candles: {
            '1s': [],
            '5s': [],
            '15s': [],
            '1m': [],
            '5m': []
          },
          currentCandle: {},
          candleStartTime: {}
        };

        // Seed initial historical candles for each timeframe
        for (const [tf, tfData] of Object.entries(TIMEFRAMES)) {
          assetState.candles[tf] = this.generateHistoricalCandles(config, tfData.durationMs, 100, now);
          const lastCandle = assetState.candles[tf][assetState.candles[tf].length - 1];
          assetState.currentCandle[tf] = { ...lastCandle };
          assetState.candleStartTime[tf] = lastCandle.time;
        }

        assetState.price = assetState.candles['1s'][assetState.candles['1s'].length - 1].close;
        assetState.bid = assetState.price - spreadAmount / 2;
        assetState.ask = assetState.price + spreadAmount / 2;
        this.assets[id] = assetState;
      }
    }

    generateHistoricalCandles(config, durationMs, count, endTimestamp) {
      const candles = [];
      let currentPrice = config.basePrice * (1 - (Math.random() * 0.03 - 0.015));
      const startTimestamp = endTimestamp - count * durationMs;

      for (let i = 0; i < count; i++) {
        const time = startTimestamp + i * durationMs;
        const changePct = (Math.random() - 0.495) * 0.003;
        const open = currentPrice;
        const close = open * (1 + changePct);
        const wickUp = Math.abs(Math.random() * (open * 0.002));
        const wickDown = Math.abs(Math.random() * (open * 0.002));
        const high = Math.max(open, close) + wickUp;
        const low = Math.min(open, close) - wickDown;
        const volume = Math.floor(Math.random() * 80 + 20);

        candles.push({ time, open, high, low, close, volume });
        currentPrice = close;
      }
      return candles;
    }

    startTickSimulation() {
      // Simulate high-frequency tick every 300ms
      setInterval(() => {
        this.tick();
      }, 300);
    }

    tick() {
      const now = Date.now();

      for (const assetId in this.assets) {
        const asset = this.assets[assetId];
        // Stochastic Price Walk with Momentum
        const rand = (Math.random() - 0.5) * 2;
        const microJump = (Math.random() > 0.94) ? (Math.random() - 0.5) * 4 : 1;
        let delta = rand * asset.volatility * microJump + (Math.random() > 0.7 ? asset.trendBias : -asset.trendBias * 0.8);

        // Anchor micro-fluctuations directly to the live real-world interbank exchange rate
        if (assetId === 'EURUSD' && asset.basePrice) {
          delta += (asset.basePrice - asset.price) * 0.04;
        }

        asset.lastPrice = asset.price;
        asset.price = Math.max(asset.price * 0.1, asset.price + delta);

        // Spread calculation
        asset.bid = asset.price - asset.spreadAmount / 2;
        asset.ask = asset.price + asset.spreadAmount / 2;

        if (asset.price > asset.high24h) asset.high24h = asset.price;
        if (asset.price < asset.low24h) asset.low24h = asset.price;

        // Update candles for all timeframes
        for (const [tf, tfData] of Object.entries(TIMEFRAMES)) {
          const startTime = asset.candleStartTime[tf];
          const elapsed = now - startTime;

          if (elapsed >= tfData.durationMs) {
            // Finalize current candle and push to history
            const finishedCandle = { ...asset.currentCandle[tf] };
            asset.candles[tf].push(finishedCandle);
            if (asset.candles[tf].length > 250) {
              asset.candles[tf].shift();
            }

            // Start new candle
            asset.candleStartTime[tf] = now;
            asset.currentCandle[tf] = {
              time: now,
              open: asset.price,
              high: asset.price,
              low: asset.price,
              close: asset.price,
              volume: Math.floor(Math.random() * 10 + 2)
            };
          } else {
            // Update active candle
            const c = asset.currentCandle[tf];
            if (asset.price > c.high) c.high = asset.price;
            if (asset.price < c.low) c.low = asset.price;
            c.close = asset.price;
            c.volume += Math.floor(Math.random() * 2 + 1);
          }
        }
      }

      this.notifySubscribers();
    }

    subscribe(callback) {
      this.subscribers.push(callback);
    }

    notifySubscribers() {
      for (const cb of this.subscribers) {
        cb(this);
      }
    }

    getActiveAsset() {
      return this.assets[this.selectedAssetId];
    }

    getActiveCandles() {
      const asset = this.getActiveAsset();
      const list = [...asset.candles[this.selectedTimeframe]];
      if (asset.currentCandle[this.selectedTimeframe]) {
        list.push({ ...asset.currentCandle[this.selectedTimeframe] });
      }
      return list;
    }
  }

  // =========================================================================
  // 4. TECHNICAL INDICATORS CALCULATION
  // =========================================================================
  const TechnicalIndicators = {
    calculateEMA(candles, period) {
      if (candles.length < period) return [];
      const k = 2 / (period + 1);
      const emaArray = [];
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += candles[i].close;
      }
      let prevEma = sum / period;
      emaArray.push({ index: period - 1, value: prevEma });

      for (let i = period; i < candles.length; i++) {
        const val = candles[i].close * k + prevEma * (1 - k);
        emaArray.push({ index: i, value: val });
        prevEma = val;
      }
      return emaArray;
    },

    calculateBollingerBands(candles, period = 20, multiplier = 2) {
      if (candles.length < period) return [];
      const bands = [];
      for (let i = period - 1; i < candles.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += candles[i - j].close;
        }
        const sma = sum / period;
        let sqDiffSum = 0;
        for (let j = 0; j < period; j++) {
          sqDiffSum += Math.pow(candles[i - j].close - sma, 2);
        }
        const stdDev = Math.sqrt(sqDiffSum / period);
        bands.push({
          index: i,
          middle: sma,
          upper: sma + multiplier * stdDev,
          lower: sma - multiplier * stdDev
        });
      }
      return bands;
    },

    calculateRSI(candles, period = 14) {
      if (candles.length <= period) return [];
      const rsiArray = [];
      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
      }

      let avgGain = gains / period;
      let avgLoss = losses / period;
      let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      let rsi = 100 - (100 / (1 + rs));
      rsiArray.push({ index: period, value: rsi });

      for (let i = period + 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        const currentGain = diff > 0 ? diff : 0;
        const currentLoss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
        rsiArray.push({ index: i, value: rsi });
      }
      return rsiArray;
    }
  };

  // =========================================================================
  // 5. HIGH PERFORMANCE HTML5 CANVAS CANDLESTICK RENDERER
  // =========================================================================
  class ChartRenderer {
    constructor(canvasId, rsiCanvasId, marketEngine, tradingEngine) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.rsiCanvas = document.getElementById(rsiCanvasId);
      this.rsiCtx = this.rsiCanvas.getContext('2d');
      this.market = marketEngine;
      this.trading = tradingEngine;

      this.visibleCandlesCount = 55;
      this.offset = 0; // for panning
      this.showEMA = true;
      this.showBB = true;
      this.showRSI = false;

      this.mouse = { x: -1, y: -1, active: false };
      this.isDragging = false;
      this.dragStartX = 0;

      this.initEvents();
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);

      if (this.rsiCanvas) {
        const rsiRect = this.rsiCanvas.parentElement.getBoundingClientRect();
        this.rsiWidth = rsiRect.width;
        this.rsiHeight = rsiRect.height;
        this.rsiCanvas.width = this.rsiWidth * dpr;
        this.rsiCanvas.height = this.rsiHeight * dpr;
        this.rsiCtx.resetTransform();
        this.rsiCtx.scale(dpr, dpr);
      }
      this.render();
    }

    initEvents() {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.mouse.active = true;

        if (this.isDragging) {
          const deltaX = this.mouse.x - this.dragStartX;
          const candleWidth = this.width / this.visibleCandlesCount;
          const shift = Math.round(deltaX / candleWidth);
          if (shift !== 0) {
            this.offset = Math.max(0, this.offset - shift);
            this.dragStartX = this.mouse.x;
          }
        }
        this.render();
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.mouse.active = false;
        this.isDragging = false;
        this.render();
      });

      this.canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.canvas.getBoundingClientRect().left;
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.visibleCandlesCount = Math.max(20, this.visibleCandlesCount - 3);
        } else {
          this.visibleCandlesCount = Math.min(130, this.visibleCandlesCount + 3);
        }
        this.render();
      }, { passive: false });

      // Touch Gesture Support for Smartphones & Tablets
      let initialPinchDist = null;

      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.x = e.touches[0].clientX - rect.left;
          this.mouse.y = e.touches[0].clientY - rect.top;
          this.mouse.active = true;
          this.isDragging = true;
          this.dragStartX = this.mouse.x;
          this.render();
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          initialPinchDist = Math.hypot(dx, dy);
        }
      }, { passive: true });

      this.canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.x = e.touches[0].clientX - rect.left;
          this.mouse.y = e.touches[0].clientY - rect.top;
          this.mouse.active = true;

          if (this.isDragging) {
            const deltaX = this.mouse.x - this.dragStartX;
            const candleWidth = this.width / this.visibleCandlesCount;
            const shift = Math.round(deltaX / candleWidth);
            if (shift !== 0) {
              this.offset = Math.max(0, this.offset - shift);
              this.dragStartX = this.mouse.x;
            }
          }
          this.render();
        } else if (e.touches.length === 2 && initialPinchDist) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const diff = dist - initialPinchDist;
          if (Math.abs(diff) > 10) {
            if (diff > 0) {
              this.visibleCandlesCount = Math.max(20, this.visibleCandlesCount - 2);
            } else {
              this.visibleCandlesCount = Math.min(130, this.visibleCandlesCount + 2);
            }
            initialPinchDist = dist;
            this.render();
          }
        }
      }, { passive: true });

      this.canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
          this.isDragging = false;
          initialPinchDist = null;
          setTimeout(() => {
            if (!this.isDragging) {
              this.mouse.active = false;
              this.render();
            }
          }, 2500);
        }
      });
    }

    render() {
      if (!this.width || !this.height) return;
      const ctx = this.ctx;
      const asset = this.market.getActiveAsset();
      const allCandles = this.market.getActiveCandles();
      if (!allCandles || allCandles.length === 0) return;

      const total = allCandles.length;
      const count = Math.min(total, this.visibleCandlesCount);
      const endIndex = Math.max(count, total - this.offset);
      const startIndex = Math.max(0, endIndex - count);
      const visible = allCandles.slice(startIndex, endIndex);

      // Clear Canvas
      ctx.clearRect(0, 0, this.width, this.height);

      // Margins for price scale & volume
      const rightPadding = 75; // Y-axis price scale width
      const bottomPadding = 26; // X-axis time scale height
      const chartWidth = this.width - rightPadding;
      const chartHeight = this.height - bottomPadding;
      const volumeHeight = chartHeight * 0.18;
      const candleAreaHeight = chartHeight - volumeHeight - 10;

      // Calculate Price Range
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      let maxVol = 0;

      for (const c of visible) {
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
        if (c.volume > maxVol) maxVol = c.volume;
      }

      // Add 8% buffer to top/bottom
      const priceBuffer = (maxPrice - minPrice) * 0.08 || asset.pipSize * 10;
      minPrice -= priceBuffer;
      maxPrice += priceBuffer;
      const priceRange = maxPrice - minPrice;

      // Coordinate mapping helpers
      const getY = (price) => candleAreaHeight - ((price - minPrice) / priceRange) * candleAreaHeight;
      const getX = (index) => (index + 0.5) * (chartWidth / visible.length);
      const candleWidth = Math.max(2, (chartWidth / visible.length) * 0.72);

      // 1. Draw Grid Lines
      this.drawGrid(ctx, chartWidth, chartHeight, candleAreaHeight, minPrice, maxPrice, visible, asset.decimals);

      // 2. Draw Volume Bars
      this.drawVolume(ctx, visible, getX, candleWidth, chartHeight, volumeHeight, maxVol);

      // 3. Draw Indicators
      if (this.showBB) {
        this.drawBollingerBands(ctx, allCandles, startIndex, visible.length, getX, getY);
      }
      if (this.showEMA) {
        this.drawEMA(ctx, allCandles, startIndex, visible.length, getX, getY, 9, '#00d4ff');
        this.drawEMA(ctx, allCandles, startIndex, visible.length, getX, getY, 21, '#ffb703');
      }

      // 4. Draw Candlesticks
      this.drawCandles(ctx, visible, getX, getY, candleWidth);

      // 5. Draw Open Position Lines on Chart
      this.drawPositionMarkers(ctx, asset.id, chartWidth, getY);

      // 6. Draw Live Price Beacon Line
      this.drawLivePriceLine(ctx, asset.price, chartWidth, getY, asset.decimals, rightPadding);

      // 7. Draw Crosshair & Tooltip
      if (this.mouse.active && this.mouse.x < chartWidth && this.mouse.y < chartHeight) {
        this.drawCrosshair(ctx, chartWidth, chartHeight, rightPadding, bottomPadding, minPrice, priceRange, visible, asset);
      }

      // 8. Render RSI Sub-Chart if active
      if (this.showRSI && this.rsiCtx) {
        this.drawRSIChart(allCandles, startIndex, visible.length);
      }
    }

    drawGrid(ctx, width, height, candleHeight, minPrice, maxPrice, visible, decimals) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      // Horizontal price lines (5 intervals)
      const steps = 6;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#6b7a90';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= steps; i++) {
        const y = (candleHeight / steps) * i;
        const price = maxPrice - (i / steps) * (maxPrice - minPrice);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Price label on right margin
        ctx.fillText(price.toFixed(decimals), width + 8, y);
      }

      // Vertical time lines
      const timeSteps = Math.min(6, visible.length);
      const stepIndex = Math.floor(visible.length / timeSteps) || 1;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';

      for (let i = 0; i < visible.length; i += stepIndex) {
        const x = (i + 0.5) * (width / visible.length);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        const d = new Date(visible[i].time);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        ctx.fillText(timeStr, x, height + 6);
      }

      ctx.restore();
    }

    drawVolume(ctx, visible, getX, candleWidth, chartHeight, volumeHeight, maxVol) {
      if (maxVol === 0) return;
      ctx.save();
      for (let i = 0; i < visible.length; i++) {
        const c = visible[i];
        const x = getX(i);
        const isBull = c.close >= c.open;
        const vHeight = (c.volume / maxVol) * volumeHeight;
        const y = chartHeight - vHeight;

        ctx.fillStyle = isBull ? 'rgba(0, 245, 155, 0.18)' : 'rgba(255, 51, 102, 0.18)';
        ctx.fillRect(x - candleWidth / 2, y, candleWidth, vHeight);
      }
      ctx.restore();
    }

    drawCandles(ctx, visible, getX, getY, candleWidth) {
      ctx.save();
      for (let i = 0; i < visible.length; i++) {
        const c = visible[i];
        const x = getX(i);
        const isBull = c.close >= c.open;
        const openY = getY(c.open);
        const closeY = getY(c.close);
        const highY = getY(c.high);
        const lowY = getY(c.low);

        const color = isBull ? '#00f59b' : '#ff3366';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.2;

        // Wick
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Body
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      }
      ctx.restore();
    }

    drawEMA(ctx, allCandles, startIndex, visibleLength, getX, getY, period, color) {
      const ema = TechnicalIndicators.calculateEMA(allCandles, period);
      if (ema.length === 0) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      let started = false;
      for (const pt of ema) {
        if (pt.index >= startIndex && pt.index < startIndex + visibleLength) {
          const visibleIdx = pt.index - startIndex;
          const x = getX(visibleIdx);
          const y = getY(pt.value);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    drawBollingerBands(ctx, allCandles, startIndex, visibleLength, getX, getY) {
      const bands = TechnicalIndicators.calculateBollingerBands(allCandles, 20, 2);
      if (bands.length === 0) return;

      ctx.save();
      // Upper line
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const pt of bands) {
        if (pt.index >= startIndex && pt.index < startIndex + visibleLength) {
          const visibleIdx = pt.index - startIndex;
          const x = getX(visibleIdx);
          const y = getY(pt.upper);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();

      // Lower line
      ctx.beginPath();
      started = false;
      for (const pt of bands) {
        if (pt.index >= startIndex && pt.index < startIndex + visibleLength) {
          const visibleIdx = pt.index - startIndex;
          const x = getX(visibleIdx);
          const y = getY(pt.lower);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();

      // Middle SMA line
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
      ctx.beginPath();
      started = false;
      for (const pt of bands) {
        if (pt.index >= startIndex && pt.index < startIndex + visibleLength) {
          const visibleIdx = pt.index - startIndex;
          const x = getX(visibleIdx);
          const y = getY(pt.middle);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    drawPositionMarkers(ctx, assetId, chartWidth, getY) {
      const positions = this.trading.positions.filter(p => p.assetId === assetId);
      if (positions.length === 0) return;

      ctx.save();
      for (const pos of positions) {
        const y = getY(pos.entryPrice);
        const isBuy = pos.type === 'BUY';
        const color = isBuy ? '#00f59b' : '#ff3366';

        // Dashed entry line
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();

        // Position Badge Label
        ctx.setLineDash([]);
        ctx.fillStyle = isBuy ? 'rgba(0, 245, 155, 0.85)' : 'rgba(255, 51, 102, 0.85)';
        const tagText = `${pos.type} ${pos.leverage}x | Entry: ${pos.entryPrice}`;
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        const textWidth = ctx.measureText(tagText).width;
        ctx.fillRect(8, y - 8, textWidth + 8, 16);
        ctx.fillStyle = '#07090e';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, 12, y);

        // TP line if set
        if (pos.tpPrice) {
          const tpY = getY(pos.tpPrice);
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = '#00f59b';
          ctx.beginPath();
          ctx.moveTo(0, tpY);
          ctx.lineTo(chartWidth, tpY);
          ctx.stroke();
          ctx.fillStyle = '#00f59b';
          ctx.fillText(`TP: ${pos.tpPrice}`, chartWidth - 80, tpY - 6);
        }

        // SL line if set
        if (pos.slPrice) {
          const slY = getY(pos.slPrice);
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = '#ff3366';
          ctx.beginPath();
          ctx.moveTo(0, slY);
          ctx.lineTo(chartWidth, slY);
          ctx.stroke();
          ctx.fillStyle = '#ff3366';
          ctx.fillText(`SL: ${pos.slPrice}`, chartWidth - 80, slY - 6);
        }
      }
      ctx.restore();
    }

    drawLivePriceLine(ctx, price, chartWidth, getY, decimals, rightPadding) {
      const y = getY(price);
      ctx.save();

      // Dashed horizontal line
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Pulsing dot on live price tip
      ctx.setLineDash([]);
      ctx.fillStyle = '#00d4ff';
      ctx.beginPath();
      ctx.arc(chartWidth, y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Right axis price badge
      ctx.fillStyle = '#00d4ff';
      ctx.fillRect(chartWidth + 1, y - 9, rightPadding - 3, 18);
      ctx.fillStyle = '#07090e';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(price.toFixed(decimals), chartWidth + rightPadding / 2, y);

      ctx.restore();
    }

    drawCrosshair(ctx, chartWidth, chartHeight, rightPadding, bottomPadding, minPrice, priceRange, visible, asset) {
      const x = this.mouse.x;
      const y = this.mouse.y;

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;

      // Cross lines
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, chartHeight);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price Tag on Right Axis
      const hoverPrice = minPrice + ((chartHeight * 0.82 - y) / (chartHeight * 0.82)) * priceRange;
      ctx.fillStyle = '#222d42';
      ctx.fillRect(chartWidth + 1, y - 8, rightPadding - 3, 16);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(chartWidth + 1, y - 8, rightPadding - 3, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hoverPrice.toFixed(asset.decimals), chartWidth + rightPadding / 2, y);

      // Time Tag on Bottom Axis
      const candleWidth = chartWidth / visible.length;
      const hoveredIndex = Math.min(visible.length - 1, Math.max(0, Math.floor(x / candleWidth)));
      const hoveredCandle = visible[hoveredIndex];

      if (hoveredCandle) {
        const d = new Date(hoveredCandle.time);
        const timeStr = `${d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        const tagW = 120;
        ctx.fillStyle = '#222d42';
        ctx.fillRect(x - tagW / 2, chartHeight + 2, tagW, 18);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(x - tagW / 2, chartHeight + 2, tagW, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(timeStr, x, chartHeight + 11);

        // Update Top OHLC header values with hovered candle
        const elO = document.getElementById('barOpen');
        const elH = document.getElementById('barHigh');
        const elL = document.getElementById('barLow');
        const elC = document.getElementById('barClose');
        if (elO) elO.textContent = hoveredCandle.open.toFixed(asset.decimals);
        if (elH) elH.textContent = hoveredCandle.high.toFixed(asset.decimals);
        if (elL) elL.textContent = hoveredCandle.low.toFixed(asset.decimals);
        if (elC) elC.textContent = hoveredCandle.close.toFixed(asset.decimals);
      }

      ctx.restore();
    }

    drawRSIChart(allCandles, startIndex, visibleLength) {
      const rsiData = TechnicalIndicators.calculateRSI(allCandles, 14);
      const ctx = this.rsiCtx;
      const width = this.rsiWidth;
      const height = this.rsiHeight;
      if (!ctx || !width || !height) return;

      ctx.clearRect(0, 0, width, height);

      // Lines for 70 (Overbought) and 30 (Oversold)
      const getY = (rsi) => height - (rsi / 100) * height;

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.setLineDash([4, 4]);

      // 70 line
      ctx.beginPath();
      ctx.moveTo(0, getY(70));
      ctx.lineTo(width, getY(70));
      ctx.stroke();

      // 30 line
      ctx.beginPath();
      ctx.moveTo(0, getY(30));
      ctx.lineTo(width, getY(30));
      ctx.stroke();

      // RSI Curve
      ctx.setLineDash([]);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1.6;
      ctx.beginPath();

      let started = false;
      let lastVal = 50;
      for (const pt of rsiData) {
        if (pt.index >= startIndex && pt.index < startIndex + visibleLength) {
          const visibleIdx = pt.index - startIndex;
          const x = (visibleIdx + 0.5) * (width / visibleLength);
          const y = getY(pt.value);
          lastVal = pt.value;
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();

      // Update text tag
      const rsiTagVal = document.getElementById('rsiValue');
      if (rsiTagVal) rsiTagVal.textContent = lastVal.toFixed(1);

      ctx.restore();
    }
  }

  // =========================================================================
  // 6. TRADING POSITION & ORDER EXECUTION ENGINE
  // =========================================================================
  class TradingEngine {
    constructor(marketEngine) {
      this.market = marketEngine;
      this.initialBalance = 10000;
      this.balance = 10000;
      this.positions = [];
      this.history = [];
      this.equityHistory = [{ time: Date.now(), balance: 10000 }];
      this.achievements = {};

      this.selectedLeverage = 10;
      this.loadStorage();
      this.initAchievementsConfig();
    }

    initAchievementsConfig() {
      this.achievementList = [
        { id: 'first_trade', title: 'Langkah Awal', desc: 'Buka transaksi trading pertamamu', icon: '🚀' },
        { id: 'first_profit', title: 'Cuan Pertama', desc: 'Tutup posisi dengan hasil profit', icon: '💰' },
        { id: 'bull_master', title: 'Bullish Master', desc: 'Raih profit > 20% dari posisi BUY', icon: '🐂' },
        { id: 'bear_sniper', title: 'Short Sniper', desc: 'Raih profit > 20% dari posisi SELL', icon: '🐻' },
        { id: 'high_leverage', title: 'Adrenalin 100x', desc: 'Gunakan leverage ekstrim 100x', icon: '⚡' },
        { id: 'win_streak_3', title: 'Hat-trick Winner', desc: 'Raih 3 kali kemenangan beruntun', icon: '🔥' },
        { id: 'ten_trades', title: 'Trader Aktif', desc: 'Selesaikan 10 transaksi pasar', icon: '📊' },
        { id: 'portfolio_12k', title: 'Portofolio Elit', desc: 'Tumbuhkan ekuitas hingga melampaui $12,500', icon: '👑' }
      ];
    }

    openPosition(type, margin, customTP = null, customSL = null) {
      const asset = this.market.getActiveAsset();
      const freeMargin = this.getFreeMargin();

      if (margin > freeMargin) {
        showToast('Margin bebas tidak mencukupi!', 'danger');
        return false;
      }
      if (margin < 5) {
        showToast('Minimal margin trading adalah $5!', 'danger');
        return false;
      }

      const entryPrice = (type === 'BUY') ? asset.ask : asset.bid;
      const positionValue = margin * this.selectedLeverage;
      const units = positionValue / entryPrice;

      // Estimate liquidation price (at 90% margin exhaustion)
      let liqPrice = 0;
      if (type === 'BUY') {
        liqPrice = entryPrice - (margin * 0.9 / units);
      } else {
        liqPrice = entryPrice + (margin * 0.9 / units);
      }

      const position = {
        id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        assetId: asset.id,
        symbol: asset.symbol,
        decimals: asset.decimals,
        type: type,
        margin: margin,
        leverage: this.selectedLeverage,
        units: units,
        positionValue: positionValue,
        entryPrice: entryPrice,
        openTime: Date.now(),
        liqPrice: Math.max(0, liqPrice),
        tpPrice: customTP ? parseFloat(customTP) : null,
        slPrice: customSL ? parseFloat(customSL) : null,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0
      };

      this.positions.push(position);
      sound.playOrder();
      showToast(`Order ${type} ${asset.symbol} berhasil dibuka! ($${margin} @ ${this.selectedLeverage}x)`, 'success');

      // Check achievement
      this.unlockAchievement('first_trade');
      if (this.selectedLeverage === 100) {
        this.unlockAchievement('high_leverage');
      }

      this.saveStorage();
      return true;
    }

    closePosition(positionId, reason = 'Manual Close') {
      const index = this.positions.findIndex(p => p.id === positionId);
      if (index === -1) return;

      const pos = this.positions[index];
      const asset = this.market.assets[pos.assetId];
      const exitPrice = (pos.type === 'BUY') ? asset.bid : asset.ask;

      let pnl = 0;
      if (pos.type === 'BUY') {
        pnl = (exitPrice - pos.entryPrice) * pos.units;
      } else {
        pnl = (pos.entryPrice - exitPrice) * pos.units;
      }

      // Cap loss at margin limit
      if (pnl < -pos.margin) {
        pnl = -pos.margin;
      }

      const pnlPct = (pnl / pos.margin) * 100;
      this.balance += pnl;

      const historyItem = {
        id: pos.id,
        assetId: pos.assetId,
        symbol: pos.symbol,
        type: pos.type,
        margin: pos.margin,
        leverage: pos.leverage,
        entryPrice: pos.entryPrice,
        exitPrice: exitPrice,
        pnl: pnl,
        pnlPct: pnlPct,
        openTime: pos.openTime,
        closeTime: Date.now(),
        reason: reason
      };

      this.history.unshift(historyItem);
      this.positions.splice(index, 1);

      // Play Sound Feedback & Toast
      if (pnl >= 0) {
        sound.playWin();
        showToast(`Profit Ditutup: +$${pnl.toFixed(2)} (+${pnlPct.toFixed(1)}%) [${reason}]`, 'success');
        this.unlockAchievement('first_profit');
        if (pnlPct >= 20 && pos.type === 'BUY') this.unlockAchievement('bull_master');
        if (pnlPct >= 20 && pos.type === 'SELL') this.unlockAchievement('bear_sniper');
      } else {
        if (reason.includes('Likuidasi')) sound.playLiq();
        else sound.playLoss();
        showToast(`Posisi Ditutup: -$${Math.abs(pnl).toFixed(2)} (${pnlPct.toFixed(1)}%) [${reason}]`, 'danger');
      }

      // Streak & Total Count achievements
      if (this.history.length >= 10) this.unlockAchievement('ten_trades');
      this.checkStreakAchievement();

      const equity = this.getEquity();
      this.equityHistory.push({ time: Date.now(), balance: equity });
      if (equity >= 12500) this.unlockAchievement('portfolio_12k');

      this.saveStorage();
    }

    checkStreakAchievement() {
      let streak = 0;
      for (const h of this.history) {
        if (h.pnl > 0) streak++;
        else break;
      }
      if (streak >= 3) {
        this.unlockAchievement('win_streak_3');
      }
    }

    updateTick() {
      // Evaluate each open position with current live tick prices
      for (let i = this.positions.length - 1; i >= 0; i--) {
        const pos = this.positions[i];
        const asset = this.market.assets[pos.assetId];
        if (!asset) continue;

        const currentExitPrice = (pos.type === 'BUY') ? asset.bid : asset.ask;
        let pnl = 0;
        if (pos.type === 'BUY') {
          pnl = (currentExitPrice - pos.entryPrice) * pos.units;
        } else {
          pnl = (pos.entryPrice - currentExitPrice) * pos.units;
        }

        pos.unrealizedPnL = pnl;
        pos.unrealizedPnLPct = (pnl / pos.margin) * 100;

        // Auto Take Profit Evaluation
        if (pos.tpPrice) {
          if ((pos.type === 'BUY' && currentExitPrice >= pos.tpPrice) ||
            (pos.type === 'SELL' && currentExitPrice <= pos.tpPrice)) {
            this.closePosition(pos.id, '🎯 Take Profit Tersentuh');
            continue;
          }
        }

        // Auto Stop Loss Evaluation
        if (pos.slPrice) {
          if ((pos.type === 'BUY' && currentExitPrice <= pos.slPrice) ||
            (pos.type === 'SELL' && currentExitPrice >= pos.slPrice)) {
            this.closePosition(pos.id, '🛡️ Stop Loss Tersentuh');
            continue;
          }
        }

        // Auto Liquidation (at 92% loss)
        if (pnl <= -pos.margin * 0.92) {
          this.closePosition(pos.id, '⚠️ Margin Call / Likuidasi');
          continue;
        }
      }
    }

    getUsedMargin() {
      return this.positions.reduce((acc, p) => acc + p.margin, 0);
    }

    getTotalUnrealizedPnL() {
      return this.positions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
    }

    getEquity() {
      return this.balance + this.getTotalUnrealizedPnL();
    }

    getFreeMargin() {
      return Math.max(0, this.getEquity() - this.getUsedMargin());
    }

    getMarginLevel() {
      const used = this.getUsedMargin();
      if (used === 0) return 999;
      return (this.getEquity() / used) * 100;
    }

    resetAccount() {
      this.balance = this.initialBalance;
      this.positions = [];
      this.history = [];
      this.equityHistory = [{ time: Date.now(), balance: 10000 }];
      this.saveStorage();
      showToast('Portofolio telah direset ke saldo awal $10,000.00!', 'info');
    }

    clearHistory() {
      this.history = [];
      this.saveStorage();
      showToast('Riwayat transaksi telah dibersihkan!', 'info');
    }

    unlockAchievement(id) {
      if (!this.achievements[id]) {
        this.achievements[id] = true;
        const item = this.achievementList.find(a => a.id === id);
        if (item) {
          showToast(`🏆 Prestasi Terbuka: ${item.title}!`, 'success');
        }
        this.saveStorage();
      }
    }

    saveStorage() {
      try {
        const state = {
          balance: this.balance,
          positions: this.positions,
          history: this.history,
          equityHistory: this.equityHistory,
          achievements: this.achievements
        };
        localStorage.setItem('apex_trader_state_v1', JSON.stringify(state));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
    }

    loadStorage() {
      try {
        const raw = localStorage.getItem('apex_trader_state_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.balance === 'number') this.balance = parsed.balance;
          if (Array.isArray(parsed.positions)) this.positions = parsed.positions;
          if (Array.isArray(parsed.history)) this.history = parsed.history;
          if (Array.isArray(parsed.equityHistory)) this.equityHistory = parsed.equityHistory;
          if (parsed.achievements) this.achievements = parsed.achievements;
        }
      } catch (e) {
        console.warn('LocalStorage read error:', e);
      }
    }
  }

  // =========================================================================
  // 7. TOAST NOTIFICATION HELPER
  // =========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'danger') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // =========================================================================
  // 8. UI CONTROLLER & VIEW BINDINGS
  // =========================================================================
  class UIController {
    constructor(market, trading, renderer) {
      this.market = market;
      this.trading = trading;
      this.renderer = renderer;

      this.initDomElements();
      this.bindEvents();
      this.renderAssetCarousel();
      this.renderAchievementsGrid();
      this.updateAllUI();
    }

    initDomElements() {
      this.headerBalance = document.getElementById('headerBalance');
      this.headerEquity = document.getElementById('headerEquity');
      this.headerFloatingPnL = document.getElementById('headerFloatingPnL');
      this.headerFreeMargin = document.getElementById('headerFreeMargin');

      this.activeAssetSymbol = document.getElementById('activeAssetSymbol');
      this.activeAssetCategory = document.getElementById('activeAssetCategory');
      this.activeAssetPrice = document.getElementById('activeAssetPrice');
      this.activeAssetChange = document.getElementById('activeAssetChange');

      this.quoteBidPrice = document.getElementById('quoteBidPrice');
      this.quoteAskPrice = document.getElementById('quoteAskPrice');
      this.quoteSpreadTag = document.getElementById('quoteSpreadTag');
      this.btnSellSubPrice = document.getElementById('btnSellSubPrice');
      this.btnBuySubPrice = document.getElementById('btnBuySubPrice');

      this.displayLeverageVal = document.getElementById('displayLeverageVal');
      this.displayMaxMargin = document.getElementById('displayMaxMargin');
      this.inputOrderMargin = document.getElementById('inputOrderMargin');
      this.inputTakeProfit = document.getElementById('inputTakeProfit');
      this.inputStopLoss = document.getElementById('inputStopLoss');

      this.calcPositionValue = document.getElementById('calcPositionValue');
      this.calcEstLiqBuy = document.getElementById('calcEstLiqBuy');
      this.calcEstLiqSell = document.getElementById('calcEstLiqSell');

      this.positionsTableBody = document.getElementById('positionsTableBody');
      this.historyTableBody = document.getElementById('historyTableBody');
      this.emptyPositionsState = document.getElementById('emptyPositionsState');
      this.emptyHistoryState = document.getElementById('emptyHistoryState');

      this.badgeOpenPositionsCount = document.getElementById('badgeOpenPositionsCount');
      this.badgeHistoryCount = document.getElementById('badgeHistoryCount');
      this.badgeAchievementsCount = document.getElementById('badgeAchievementsCount');

      this.candleCountdown = document.getElementById('candleCountdown');
      this.equityCanvas = document.getElementById('equityCanvas');
    }

    bindEvents() {
      // Sound Toggle
      const btnSound = document.getElementById('btnToggleSound');
      if (btnSound) {
        btnSound.addEventListener('click', () => {
          const isEnabled = sound.toggle();
          btnSound.innerHTML = isEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
          btnSound.classList.toggle('active', isEnabled);
          showToast(isEnabled ? 'Suara efek diaktifkan' : 'Suara efek dimatikan', 'info');
        });
      }

      // Fullscreen Toggle
      const btnFullscreen = document.getElementById('btnToggleFullscreen');
      if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
          } else {
            document.exitFullscreen().catch(() => { });
          }
        });
      }

      // Timeframe Switchers
      const tfButtons = document.querySelectorAll('#timeframeSelector .seg-btn');
      tfButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          tfButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.market.selectedTimeframe = btn.dataset.tf;
          this.renderer.render();
        });
      });

      // Indicator Toggles
      const btnEMA = document.getElementById('btnToggleEMA');
      if (btnEMA) {
        btnEMA.addEventListener('click', () => {
          this.renderer.showEMA = !this.renderer.showEMA;
          btnEMA.classList.toggle('active', this.renderer.showEMA);
          this.renderer.render();
        });
      }

      const btnBB = document.getElementById('btnToggleBB');
      if (btnBB) {
        btnBB.addEventListener('click', () => {
          this.renderer.showBB = !this.renderer.showBB;
          btnBB.classList.toggle('active', this.renderer.showBB);
          this.renderer.render();
        });
      }

      const btnRSI = document.getElementById('btnToggleRSI');
      const rsiPanel = document.getElementById('rsiPanelWrapper');
      if (btnRSI && rsiPanel) {
        btnRSI.addEventListener('click', () => {
          this.renderer.showRSI = !this.renderer.showRSI;
          btnRSI.classList.toggle('active', this.renderer.showRSI);
          rsiPanel.classList.toggle('visible', this.renderer.showRSI);
          this.renderer.resize();
        });
      }

      // Leverage Selection Pills
      const levButtons = document.querySelectorAll('#leveragePills .lev-btn');
      levButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          levButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.trading.selectedLeverage = parseInt(btn.dataset.lev, 10);
          this.displayLeverageVal.textContent = `${this.trading.selectedLeverage}x`;
          this.updateOrderCalculations();
        });
      });

      // Quick Percent Margin Buttons
      const pctButtons = document.querySelectorAll('.quick-pct-row .pct-btn');
      pctButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const pct = parseInt(btn.dataset.pct, 10);
          const freeMargin = this.trading.getFreeMargin();
          const target = Math.max(5, Math.floor((freeMargin * pct) / 100));
          this.inputOrderMargin.value = target;
          this.updateOrderCalculations();
        });
      });

      this.inputOrderMargin.addEventListener('input', () => this.updateOrderCalculations());

      // BUY and SELL Buttons
      const btnBuy = document.getElementById('btnExecuteBuy');
      const btnSell = document.getElementById('btnExecuteSell');

      if (btnBuy) {
        btnBuy.addEventListener('click', () => {
          const margin = parseFloat(this.inputOrderMargin.value) || 0;
          const tp = this.inputTakeProfit.value ? parseFloat(this.inputTakeProfit.value) : null;
          const sl = this.inputStopLoss.value ? parseFloat(this.inputStopLoss.value) : null;
          this.trading.openPosition('BUY', margin, tp, sl);
          this.updateAllUI();
        });
      }

      if (btnSell) {
        btnSell.addEventListener('click', () => {
          const margin = parseFloat(this.inputOrderMargin.value) || 0;
          const tp = this.inputTakeProfit.value ? parseFloat(this.inputTakeProfit.value) : null;
          const sl = this.inputStopLoss.value ? parseFloat(this.inputStopLoss.value) : null;
          this.trading.openPosition('SELL', margin, tp, sl);
          this.updateAllUI();
        });
      }

      // Bottom Dock Tabs
      const dockTabs = document.querySelectorAll('#dockTabs .dock-tab-btn');
      dockTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          dockTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const targetId = tab.dataset.tab;
          document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          const targetPane = document.getElementById(targetId);
          if (targetPane) targetPane.classList.add('active');

          if (targetId === 'tabStats') {
            this.renderStatsAndEquityCurve();
          }
        });
      });

      // Export CSV Button
      const btnExport = document.getElementById('btnExportCSV');
      if (btnExport) {
        btnExport.addEventListener('click', () => this.exportCSV());
      }

      // Clear History Button
      const btnClearHistory = document.getElementById('btnClearHistory');
      if (btnClearHistory) {
        btnClearHistory.addEventListener('click', () => {
          if (confirm('Bersihkan semua daftar riwayat transaksi?')) {
            this.trading.clearHistory();
            this.updateAllUI();
          }
        });
      }

      // Reset Modal Dialog Events
      const resetModal = document.getElementById('resetModal');
      const btnOpenReset = document.getElementById('btnOpenResetModal');
      const btnCancelReset = document.getElementById('btnCancelReset');
      const btnConfirmReset = document.getElementById('btnConfirmReset');

      if (btnOpenReset && resetModal) {
        btnOpenReset.addEventListener('click', () => resetModal.classList.add('open'));
      }
      if (btnCancelReset && resetModal) {
        btnCancelReset.addEventListener('click', () => resetModal.classList.remove('open'));
      }
      if (btnConfirmReset && resetModal) {
        btnConfirmReset.addEventListener('click', () => {
          this.trading.resetAccount();
          resetModal.classList.remove('open');
          this.updateAllUI();
        });
      }
    }

    renderAssetCarousel() {
      const carousel = document.getElementById('assetTickerCarousel');
      if (!carousel) return;
      carousel.innerHTML = '';

      for (const [id, asset] of Object.entries(this.market.assets)) {
        const chip = document.createElement('div');
        chip.className = `ticker-chip ${id === this.market.selectedAssetId ? 'active' : ''}`;
        chip.id = `tickerChip_${id}`;

        const changePct = ((asset.price - asset.open24h) / asset.open24h) * 100;
        const isUp = changePct >= 0;

        chip.innerHTML = `
          <span class="ticker-symbol">${asset.symbol}</span>
          <span class="ticker-price">${asset.price.toFixed(asset.decimals)}</span>
          <span class="ticker-change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${changePct.toFixed(2)}%</span>
        `;

        chip.addEventListener('click', () => {
          document.querySelectorAll('.ticker-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.market.selectedAssetId = id;
          this.updateAssetHeader();
          this.updateOrderCalculations();
          this.renderer.render();
        });

        carousel.appendChild(chip);
      }
    }

    updateAssetCarouselQuotes() {
      for (const [id, asset] of Object.entries(this.market.assets)) {
        const chip = document.getElementById(`tickerChip_${id}`);
        if (!chip) continue;
        const changePct = ((asset.price - asset.open24h) / asset.open24h) * 100;
        const isUp = changePct >= 0;

        const priceEl = chip.querySelector('.ticker-price');
        const changeEl = chip.querySelector('.ticker-change');
        if (priceEl) priceEl.textContent = asset.price.toFixed(asset.decimals);
        if (changeEl) {
          changeEl.className = `ticker-change ${isUp ? 'up' : 'down'}`;
          changeEl.textContent = `${isUp ? '+' : ''}${changePct.toFixed(2)}%`;
        }
      }
    }

    updateAssetHeader() {
      const asset = this.market.getActiveAsset();
      this.activeAssetSymbol.textContent = asset.symbol;
      this.activeAssetCategory.textContent = asset.category;

      const changePct = ((asset.price - asset.open24h) / asset.open24h) * 100;
      const isUp = changePct >= 0;

      // Price Flash animation
      const prevPrice = parseFloat(this.activeAssetPrice.textContent) || asset.price;
      if (asset.price > prevPrice) {
        this.activeAssetPrice.classList.remove('flash-down');
        this.activeAssetPrice.classList.add('flash-up');
      } else if (asset.price < prevPrice) {
        this.activeAssetPrice.classList.remove('flash-up');
        this.activeAssetPrice.classList.add('flash-down');
      }
      setTimeout(() => {
        this.activeAssetPrice.classList.remove('flash-up', 'flash-down');
      }, 400);

      this.activeAssetPrice.textContent = asset.price.toFixed(asset.decimals);
      this.activeAssetChange.className = `current-market-change ${isUp ? 'up' : 'down'}`;
      this.activeAssetChange.textContent = `${isUp ? '+' : ''}${changePct.toFixed(2)}%`;

      // Live Quotes in Order Terminal
      this.quoteBidPrice.textContent = asset.bid.toFixed(asset.decimals);
      this.quoteAskPrice.textContent = asset.ask.toFixed(asset.decimals);
      this.quoteSpreadTag.textContent = `Spread: ${(asset.spreadPips).toFixed(1)} Pips ($${asset.spreadAmount.toFixed(asset.decimals)})`;

      this.btnSellSubPrice.textContent = `Bid ${asset.bid.toFixed(asset.decimals)}`;
      this.btnBuySubPrice.textContent = `Ask ${asset.ask.toFixed(asset.decimals)}`;
    }

    updateOrderCalculations() {
      const asset = this.market.getActiveAsset();
      const margin = parseFloat(this.inputOrderMargin.value) || 0;
      const leverage = this.trading.selectedLeverage;
      const positionVal = margin * leverage;

      this.calcPositionValue.textContent = `$${positionVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      if (positionVal > 0 && asset.price > 0) {
        const units = positionVal / asset.price;
        const liqBuy = asset.price - (margin * 0.9 / units);
        const liqSell = asset.price + (margin * 0.9 / units);

        this.calcEstLiqBuy.textContent = `$${Math.max(0, liqBuy).toFixed(asset.decimals)}`;
        this.calcEstLiqSell.textContent = `$${liqSell.toFixed(asset.decimals)}`;
      } else {
        this.calcEstLiqBuy.textContent = '-';
        this.calcEstLiqSell.textContent = '-';
      }

      this.displayMaxMargin.textContent = `$${this.trading.getFreeMargin().toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }

    updateHeaderPortfolio() {
      const balance = this.trading.balance;
      const equity = this.trading.getEquity();
      const floatingPnL = this.trading.getTotalUnrealizedPnL();
      const freeMargin = this.trading.getFreeMargin();

      this.headerBalance.textContent = `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      this.headerEquity.textContent = `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      this.headerFloatingPnL.textContent = `${floatingPnL >= 0 ? '+' : ''}$${floatingPnL.toFixed(2)}`;
      this.headerFloatingPnL.className = `value ${floatingPnL >= 0 ? 'profit' : 'loss'}`;

      this.headerFreeMargin.textContent = `$${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    renderPositionsTable() {
      const positions = this.trading.positions;
      this.badgeOpenPositionsCount.textContent = positions.length;

      if (positions.length === 0) {
        this.positionsTableBody.innerHTML = '';
        this.emptyPositionsState.style.display = 'flex';
        return;
      }

      this.emptyPositionsState.style.display = 'none';
      let html = '';

      for (const pos of positions) {
        const asset = this.market.assets[pos.assetId];
        const currentPrice = (pos.type === 'BUY') ? asset.bid : asset.ask;
        const pnl = pos.unrealizedPnL;
        const pnlPct = pos.unrealizedPnLPct;
        const isProfit = pnl >= 0;

        const d = new Date(pos.openTime);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

        html += `
          <tr>
            <td>${timeStr}</td>
            <td><b>${pos.symbol}</b></td>
            <td><span class="badge-direction ${pos.type.toLowerCase()}">${pos.type}</span></td>
            <td><span style="color: var(--accent-cyan); font-weight:700;">${pos.leverage}x</span></td>
            <td>$${pos.margin.toFixed(2)}</td>
            <td>${pos.entryPrice.toFixed(pos.decimals)}</td>
            <td>${currentPrice.toFixed(pos.decimals)}</td>
            <td>${pos.tpPrice ? pos.tpPrice.toFixed(pos.decimals) : '-'}</td>
            <td>${pos.slPrice ? pos.slPrice.toFixed(pos.decimals) : '-'}</td>
            <td class="${isProfit ? 'val-profit' : 'val-loss'}">
              ${isProfit ? '+' : ''}$${pnl.toFixed(2)} (${isProfit ? '+' : ''}${pnlPct.toFixed(2)}%)
            </td>
            <td>
              <button class="btn-close-position" onclick="window.closeTradingPosition('${pos.id}')">
                Tutup
              </button>
            </td>
          </tr>
        `;
      }

      this.positionsTableBody.innerHTML = html;
    }

    renderHistoryTable() {
      const history = this.trading.history;
      this.badgeHistoryCount.textContent = history.length;

      if (history.length === 0) {
        this.historyTableBody.innerHTML = '';
        this.emptyHistoryState.style.display = 'flex';
        return;
      }

      this.emptyHistoryState.style.display = 'none';
      let html = '';

      for (const h of history.slice(0, 50)) {
        const isProfit = h.pnl >= 0;
        const d = new Date(h.closeTime);
        const timeStr = `${d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        html += `
          <tr>
            <td>${timeStr}</td>
            <td><b>${h.symbol}</b></td>
            <td><span class="badge-direction ${h.type.toLowerCase()}">${h.type}</span></td>
            <td>${h.leverage}x</td>
            <td>$${h.margin.toFixed(2)}</td>
            <td>${h.entryPrice.toFixed(4)}</td>
            <td>${h.exitPrice.toFixed(4)}</td>
            <td class="${isProfit ? 'val-profit' : 'val-loss'}">
              ${isProfit ? '+' : ''}$${h.pnl.toFixed(2)}
            </td>
            <td class="${isProfit ? 'val-profit' : 'val-loss'}">
              ${isProfit ? '+' : ''}${h.pnlPct.toFixed(2)}%
            </td>
            <td><span style="font-size: 0.72rem; color: var(--text-muted);">${h.reason}</span></td>
          </tr>
        `;
      }

      this.historyTableBody.innerHTML = html;
    }

    renderStatsAndEquityCurve() {
      const history = this.trading.history;
      const totalTrades = history.length;
      let totalPnL = 0;
      let wins = 0;
      let losses = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let bestTrade = 0;
      let worstTrade = 0;
      let maxDrawdown = 0;

      for (const h of history) {
        totalPnL += h.pnl;
        if (h.pnl > 0) {
          wins++;
          grossProfit += h.pnl;
          if (h.pnl > bestTrade) bestTrade = h.pnl;
        } else if (h.pnl < 0) {
          losses++;
          grossLoss += Math.abs(h.pnl);
          if (h.pnl < worstTrade) worstTrade = h.pnl;
        }
      }

      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99.9 : 0);
      const avgWin = wins > 0 ? grossProfit / wins : 0;
      const avgLoss = losses > 0 ? grossLoss / losses : 0;
      const returnPct = ((this.trading.getEquity() - this.trading.initialBalance) / this.trading.initialBalance) * 100;

      // Drawdown calculation from equity history
      let peak = this.trading.initialBalance;
      for (const pt of this.trading.equityHistory) {
        if (pt.balance > peak) peak = pt.balance;
        const dd = ((peak - pt.balance) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      // Populate DOM elements
      const elNetPnL = document.getElementById('statNetPnL');
      const elNetPnLPct = document.getElementById('statNetPnLPct');
      const elWinRate = document.getElementById('statWinRate');
      const elWinLossCounts = document.getElementById('statWinLossCounts');
      const elProfitFactor = document.getElementById('statProfitFactor');
      const elTotalTrades = document.getElementById('statTotalTrades');
      const elBestTrade = document.getElementById('statBestTrade');
      const elWorstTrade = document.getElementById('statWorstTrade');
      const elAvgWin = document.getElementById('statAvgWin');
      const elAvgLoss = document.getElementById('statAvgLoss');
      const elMaxDD = document.getElementById('statMaxDrawdown');

      if (elNetPnL) {
        elNetPnL.textContent = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
        elNetPnL.className = `stat-big-val ${totalPnL >= 0 ? 'val-profit' : 'val-loss'}`;
      }
      if (elNetPnLPct) elNetPnLPct.textContent = `Return Akun: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
      if (elWinRate) elWinRate.textContent = `${winRate.toFixed(1)}%`;
      if (elWinLossCounts) elWinLossCounts.textContent = `${wins} Menang / ${losses} Kalah`;
      if (elProfitFactor) elProfitFactor.textContent = profitFactor.toFixed(2);
      if (elTotalTrades) elTotalTrades.textContent = totalTrades;
      if (elBestTrade) elBestTrade.textContent = `+$${bestTrade.toFixed(2)}`;
      if (elWorstTrade) elWorstTrade.textContent = worstTrade === 0 ? '$0.00' : `-$${Math.abs(worstTrade).toFixed(2)}`;
      if (elAvgWin) elAvgWin.textContent = `Rata-rata Menang: $${avgWin.toFixed(2)}`;
      if (elAvgLoss) elAvgLoss.textContent = `Rata-rata Kalah: $${avgLoss.toFixed(2)}`;
      if (elMaxDD) elMaxDD.textContent = `${maxDrawdown.toFixed(2)}%`;

      // Dual progress bar
      const barWin = document.getElementById('progressWinBar');
      const barLoss = document.getElementById('progressLossBar');
      const txtWin = document.getElementById('barWinPct');
      const txtLoss = document.getElementById('barLossPct');
      if (barWin && barLoss) {
        const lossRate = totalTrades > 0 ? (losses / totalTrades) * 100 : 0;
        barWin.style.width = `${totalTrades === 0 ? 50 : winRate}%`;
        barLoss.style.width = `${totalTrades === 0 ? 50 : lossRate}%`;
        if (txtWin) txtWin.textContent = `${winRate.toFixed(0)}%`;
        if (txtLoss) txtLoss.textContent = `${lossRate.toFixed(0)}%`;
      }

      // Draw Equity Canvas Chart
      this.drawEquityCanvas();
    }

    drawEquityCanvas() {
      const canvas = this.equityCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      const history = this.trading.equityHistory;
      if (!history || history.length < 1) return;

      let minEq = Infinity;
      let maxEq = -Infinity;
      for (const pt of history) {
        if (pt.balance < minEq) minEq = pt.balance;
        if (pt.balance > maxEq) maxEq = pt.balance;
      }

      minEq = Math.min(minEq, 9800);
      maxEq = Math.max(maxEq, 10200);
      const buffer = (maxEq - minEq) * 0.1;
      minEq -= buffer;
      maxEq += buffer;
      const range = maxEq - minEq;

      const getY = (val) => height - 20 - ((val - minEq) / range) * (height - 35);
      const getX = (idx) => (idx / (history.length - 1 || 1)) * (width - 60) + 10;

      // Draw baseline ($10,000)
      const base10kY = getY(10000);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, base10kY);
      ctx.lineTo(width - 55, base10kY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6b7a90';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText('$10,000', width - 50, base10kY + 3);

      // Gradient area fill
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
      grad.addColorStop(1, 'rgba(0, 212, 255, 0.0)');

      ctx.beginPath();
      ctx.moveTo(getX(0), getY(history[0].balance));
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(getX(i), getY(history[i].balance));
      }
      ctx.lineTo(getX(history.length - 1), height - 20);
      ctx.lineTo(getX(0), height - 20);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke Line
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(history[0].balance));
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(getX(i), getY(history[i].balance));
      }
      ctx.stroke();

      // Last point glowing circle
      const lastX = getX(history.length - 1);
      const lastY = getY(history[history.length - 1].balance);
      ctx.fillStyle = '#00f59b';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    renderAchievementsGrid() {
      const container = document.getElementById('achievementsGrid');
      if (!container) return;
      container.innerHTML = '';

      let unlockedCount = 0;
      for (const item of this.trading.achievementList) {
        const isUnlocked = !!this.trading.achievements[item.id];
        if (isUnlocked) unlockedCount++;

        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
        card.innerHTML = `
          <div class="achievement-icon">${item.icon}</div>
          <div class="achievement-info">
            <h4>${item.title} ${isUnlocked ? '✓' : ''}</h4>
            <p>${item.desc}</p>
          </div>
        `;
        container.appendChild(card);
      }

      this.badgeAchievementsCount.textContent = `${unlockedCount}/${this.trading.achievementList.length}`;
    }

    exportCSV() {
      const history = this.trading.history;
      if (history.length === 0) {
        showToast('Tidak ada data riwayat untuk diekspor!', 'info');
        return;
      }

      let csv = 'ID,Waktu_Tutup,Aset,Arah,Leverage,Modal_USD,Harga_Masuk,Harga_Keluar,PnL_USD,Return_Persen,Alasan_Tutup\n';
      for (const h of history) {
        const timeStr = new Date(h.closeTime).toISOString();
        csv += `"${h.id}","${timeStr}","${h.symbol}","${h.type}",${h.leverage},${h.margin.toFixed(2)},${h.entryPrice},${h.exitPrice},${h.pnl.toFixed(2)},${h.pnlPct.toFixed(2)},"${h.reason}"\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ApexTrader_History_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV berhasil diunduh!', 'success');
    }

    updateAllUI() {
      this.updateAssetHeader();
      this.updateAssetCarouselQuotes();
      this.updateHeaderPortfolio();
      this.updateOrderCalculations();
      this.renderPositionsTable();
      this.renderHistoryTable();
      this.renderAchievementsGrid();
    }
  }

  // =========================================================================
  // 9. APPLICATION BOOTSTRAPPER
  // =========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    const market = new MarketEngine();
    const trading = new TradingEngine(market);
    const renderer = new ChartRenderer('candlestickCanvas', 'rsiCanvas', market, trading);
    const ui = new UIController(market, trading, renderer);

    // Global helper for inline table button
    window.closeTradingPosition = (posId) => {
      trading.closePosition(posId, 'Manual Close');
      ui.updateAllUI();
      renderer.render();
    };

    // Market Tick Subscription
    market.subscribe(() => {
      trading.updateTick();
      ui.updateAllUI();
      renderer.render();

      // Update next candle countdown
      const asset = market.getActiveAsset();
      const tf = market.selectedTimeframe;
      const duration = TIMEFRAMES[tf].durationMs;
      const elapsed = Date.now() - (asset.candleStartTime[tf] || Date.now());
      const remainingSec = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      const countdownEl = document.getElementById('candleCountdown');
      if (countdownEl) {
        countdownEl.textContent = `${remainingSec}s`;
      }
    });

    market.startTickSimulation();
  });

})();
