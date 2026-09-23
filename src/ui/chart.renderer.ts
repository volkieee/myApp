import { Candle } from '../interfaces/market.types';
import { IndicatorService } from '../services/indicator.service';
import { marketFeed } from '../services/marketFeed.service';

export class ChartRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rsiCanvas: HTMLCanvasElement | null = null;
  private rsiCtx: CanvasRenderingContext2D | null = null;

  // Indicator Visibility States
  private showEMA: boolean = true;
  private showBB: boolean = true;
  private showRSI: boolean = false;

  // Auto-render loop
  private renderInterval: number | null = null;

  // Crosshair
  private mouseX: number = -1;
  private mouseY: number = -1;
  private isHovered: boolean = false;

  // High-DPI handling
  private dpr: number = 1;

  constructor(canvasId: string, rsiCanvasId?: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    if (rsiCanvasId) {
      this.rsiCanvas = document.getElementById(rsiCanvasId) as HTMLCanvasElement;
      if (this.rsiCanvas) {
        this.rsiCtx = this.rsiCanvas.getContext('2d');
      }
    }

    this.initCanvas();
    this.bindEvents();
  }

  public toggleEMA(): boolean {
    this.showEMA = !this.showEMA;
    this.render();
    return this.showEMA;
  }

  public toggleBB(): boolean {
    this.showBB = !this.showBB;
    this.render();
    return this.showBB;
  }

  public toggleRSI(): boolean {
    this.showRSI = !this.showRSI;
    const rsiWrapper = document.getElementById('rsiPanelWrapper');
    if (rsiWrapper) {
      rsiWrapper.style.display = this.showRSI ? 'block' : 'none';
    }
    this.resize();
    this.render();
    return this.showRSI;
  }

  public resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = rect.width * this.dpr;
      this.canvas.height = rect.height * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);
    }

    if (this.rsiCanvas && this.showRSI) {
      const rsiRect = this.rsiCanvas.getBoundingClientRect();
      if (rsiRect.width > 0 && rsiRect.height > 0) {
        this.rsiCanvas.width = rsiRect.width * this.dpr;
        this.rsiCanvas.height = rsiRect.height * this.dpr;
        if (this.rsiCtx) this.rsiCtx.scale(this.dpr, this.dpr);
      }
    }

    this.render();
  }

  public render(): void {
    // Force re-size if canvas has no dimensions yet
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.resize();
    }

    const { history, current } = marketFeed.getCandles();
    const asset = marketFeed.getActiveAsset();
    const allCandles = [...history, current];
    if (allCandles.length === 0) return;

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    if (width <= 0 || height <= 0) return;
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Padding
    const padTop = 20;
    const padBottom = 30;
    const padRight = 75; // for price axis
    const chartHeight = height - padTop - padBottom;
    const chartWidth = width - padRight;

    // Price Bounds
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    allCandles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    const priceMargin = (maxPrice - minPrice) * 0.1 || asset.volatility * 2;
    minPrice -= priceMargin;
    maxPrice += priceMargin;
    const priceRange = maxPrice - minPrice;

    const getY = (val: number) => padTop + chartHeight - ((val - minPrice) / priceRange) * chartHeight;

    // Draw Grid Lines & Price Labels
    this.drawGridAndAxes(ctx, width, height, chartWidth, chartHeight, padTop, padRight, minPrice, maxPrice, asset.decimals);

    // Draw Indicators Behind Candles
    if (this.showBB) {
      this.drawBollingerBands(ctx, allCandles, chartWidth, getY);
    }
    if (this.showEMA) {
      this.drawEMA(ctx, allCandles, chartWidth, getY);
    }

    // Draw Candlesticks
    const candleCount = allCandles.length;
    const candleSlotWidth = chartWidth / candleCount;
    const candleBodyWidth = Math.max(2, candleSlotWidth * 0.7);

    allCandles.forEach((c, i) => {
      const x = i * candleSlotWidth + candleSlotWidth / 2;
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);

      const isBull = c.close >= c.open;
      const color = isBull ? '#00e676' : '#ff1744';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const topY = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
      ctx.fillRect(x - candleBodyWidth / 2, topY, candleBodyWidth, bodyHeight);
    });

    // Draw Current Price Line & Badge
    const curPrice = current.close;
    const curY = getY(curPrice);
    const isBull = current.close >= current.open;
    const curColor = isBull ? '#00e676' : '#ff1744';

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = curColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, curY);
    ctx.lineTo(chartWidth, curY);
    ctx.stroke();
    ctx.restore();

    // Price Badge on Right Axis
    ctx.fillStyle = curColor;
    ctx.fillRect(chartWidth + 1, curY - 11, padRight - 5, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(curPrice.toFixed(asset.decimals), chartWidth + 6, curY + 4);

    // Crosshair & Tooltip
    if (this.isHovered && this.mouseX >= 0 && this.mouseX <= chartWidth && this.mouseY >= 0 && this.mouseY <= height) {
      this.drawCrosshair(ctx, width, height, chartWidth, chartHeight, padTop, minPrice, priceRange, asset.decimals);
    }

    // Render Sub-chart: RSI
    if (this.showRSI && this.rsiCtx && this.rsiCanvas) {
      this.drawRSIChart(allCandles);
    }
  }

  private drawGridAndAxes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    chartWidth: number,
    chartHeight: number,
    padTop: number,
    padRight: number,
    minPrice: number,
    maxPrice: number,
    decimals: number
  ): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'left';

    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const y = padTop + (chartHeight / steps) * i;
      const priceVal = maxPrice - ((maxPrice - minPrice) / steps) * i;

      // Horizontal grid
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Axis label
      ctx.fillText(priceVal.toFixed(decimals), chartWidth + 6, y + 3);
    }

    // Vertical time grid lines
    const timeSteps = 5;
    for (let i = 1; i <= timeSteps; i++) {
      const x = (chartWidth / (timeSteps + 1)) * i;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + chartHeight);
      ctx.stroke();
    }
  }

  private drawEMA(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    chartWidth: number,
    getY: (val: number) => number
  ): void {
    const ema9 = IndicatorService.calculateEMA(candles, 9);
    const ema21 = IndicatorService.calculateEMA(candles, 21);
    const slot = chartWidth / candles.length;

    // EMA 9 (Cyan)
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    ema9.forEach((val, i) => {
      if (val !== null) {
        const x = i * slot + slot / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();

    // EMA 21 (Gold / Orange)
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    started = false;
    ema21.forEach((val, i) => {
      if (val !== null) {
        const x = i * slot + slot / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();
  }

  private drawBollingerBands(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    chartWidth: number,
    getY: (val: number) => number
  ): void {
    const { middle, upper, lower } = IndicatorService.calculateBollingerBands(candles, 20, 2);
    const slot = chartWidth / candles.length;

    // Upper band
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    upper.forEach((val, i) => {
      if (val !== null) {
        const x = i * slot + slot / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();

    // Lower band
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
    ctx.beginPath();
    started = false;
    lower.forEach((val, i) => {
      if (val !== null) {
        const x = i * slot + slot / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();

    // Middle SMA
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    started = false;
    middle.forEach((val, i) => {
      if (val !== null) {
        const x = i * slot + slot / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    chartWidth: number,
    chartHeight: number,
    padTop: number,
    minPrice: number,
    priceRange: number,
    decimals: number
  ): void {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(this.mouseX, padTop);
    ctx.lineTo(this.mouseX, padTop + chartHeight);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, this.mouseY);
    ctx.lineTo(chartWidth, this.mouseY);
    ctx.stroke();
    ctx.restore();

    // Crosshair price tag
    const hoverPrice = minPrice + ((padTop + chartHeight - this.mouseY) / chartHeight) * priceRange;
    ctx.fillStyle = '#2a3b50';
    ctx.fillRect(chartWidth + 1, this.mouseY - 10, width - chartWidth - 5, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(hoverPrice.toFixed(decimals), chartWidth + 6, this.mouseY + 4);
  }

  private drawRSIChart(candles: Candle[]): void {
    if (!this.rsiCtx || !this.rsiCanvas) return;
    const ctx = this.rsiCtx;
    const width = this.rsiCanvas.width / this.dpr;
    const height = this.rsiCanvas.height / this.dpr;
    ctx.clearRect(0, 0, width, height);

    const rsiVals = IndicatorService.calculateRSI(candles, 14);
    const lastRsi = rsiVals[rsiVals.length - 1];
    const rsiText = document.getElementById('rsiValue');
    if (rsiText && lastRsi !== null && lastRsi !== undefined) {
      rsiText.textContent = lastRsi.toFixed(1);
    }

    // Reference lines 30 and 70
    const getY = (val: number) => height - (val / 100) * height;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([2, 2]);
    [30, 70].forEach(level => {
      const y = getY(level);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // RSI Line
    const slot = width / candles.length;
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    rsiVals.forEach((val, i) => {
      if (val !== null) {
        const x = i * slot + slot / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();
  }

  private initCanvas(): void {
    window.addEventListener('resize', () => this.resize());

    // Wait for DOM layout then size + render
    const doInit = () => {
      this.resize();
      // Start continuous render loop at 250ms so chart updates with every tick
      if (!this.renderInterval) {
        this.renderInterval = window.setInterval(() => {
          this.render();
        }, 250);
      }
    };

    // Use requestAnimationFrame inside setTimeout to ensure CSS layout is done
    setTimeout(() => requestAnimationFrame(() => doInit()), 50);
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.isHovered = true;
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isHovered = false;
      this.render();
    });
  }
}
