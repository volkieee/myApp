import { TradeHistoryItem } from '../interfaces/trading.types';

export class AnalyticsUI {
  private equityCanvas: HTMLCanvasElement | null = null;
  private equityCtx: CanvasRenderingContext2D | null = null;
  private equityCurve: number[] = [];

  constructor(initialBalance: number = 10000) {
    this.equityCanvas = document.getElementById('equityCanvas') as HTMLCanvasElement;
    if (this.equityCanvas) {
      this.equityCtx = this.equityCanvas.getContext('2d');
    }
    this.equityCurve = [initialBalance];
  }

  public render(history: TradeHistoryItem[], currentBalance: number): void {
    // Update equity curve
    this.equityCurve = [this.equityCurve[0]];
    let running = this.equityCurve[0];
    history.slice().reverse().forEach(item => {
      running += item.pnl;
      this.equityCurve.push(running);
    });

    const total = history.length;
    const wins = history.filter(t => t.pnl > 0).length;
    const losses = history.filter(t => t.pnl < 0).length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    const grossWin = history.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(history.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

    const bestTrade = history.length > 0 ? Math.max(...history.map(t => t.pnl)) : 0;
    const worstTrade = history.length > 0 ? Math.min(...history.map(t => t.pnl)) : 0;
    const avgWin = wins > 0 ? grossWin / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;

    // Max Drawdown calculation
    let maxDD = 0;
    let peak = this.equityCurve[0];
    this.equityCurve.forEach(val => {
      if (val > peak) peak = val;
      const dd = peak > 0 ? ((peak - val) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    });

    // Best Win Streak
    let bestStreak = 0;
    let currentStreak = 0;
    let curStreakDir: 'WIN' | 'LOSS' | null = null;
    history.slice().reverse().forEach(t => {
      const dir = t.pnl >= 0 ? 'WIN' : 'LOSS';
      if (dir === curStreakDir) {
        currentStreak++;
      } else {
        curStreakDir = dir;
        currentStreak = 1;
      }
      if (dir === 'WIN' && currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
    });
    const liveStreak = (() => {
      let s = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (i === history.length - 1) {
          curStreakDir = history[i].pnl >= 0 ? 'WIN' : 'LOSS';
          s = 1;
        } else {
          const d = history[i].pnl >= 0 ? 'WIN' : 'LOSS';
          if (d === curStreakDir) s++;
          else break;
        }
      }
      return s;
    })();

    const netPnL = currentBalance - (this.equityCurve[0]);

    // Update DOM stats
    this.updateStat('statNetPnL', `${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)}`);
    this.updateStat('statNetPnLPct', `Return: ${this.equityCurve[0] > 0 ? ((netPnL / this.equityCurve[0]) * 100).toFixed(2) : '0.00'}%`);
    this.updateStat('statWinRate', `${winRate.toFixed(1)}%`);
    this.updateStat('statWinLossCounts', `${wins} Menang / ${losses} Kalah`);
    this.updateStat('statProfitFactor', profitFactor >= 999 ? '∞' : profitFactor.toFixed(2));
    this.updateStat('statTotalTrades', total.toString());
    this.updateStat('statBestTrade', `+$${Math.max(0, bestTrade).toFixed(2)}`);
    this.updateStat('statAvgWin', `Rata-rata: +$${avgWin.toFixed(2)}`);
    this.updateStat('statWorstTrade', `$${worstTrade.toFixed(2)}`);
    this.updateStat('statAvgLoss', `Rata-rata: -$${avgLoss.toFixed(2)}`);
    this.updateStat('statMaxDrawdown', `${maxDD.toFixed(2)}%`);
    this.updateStat('statBestStreak', bestStreak.toString());
    this.updateStat('statCurrentStreak', `Streak Saat ini: ${liveStreak}`);

    // Update PnL card coloring
    const netCard = document.getElementById('cardNetPnL');
    if (netCard) {
      netCard.className = `stat-card ${netPnL >= 0 ? 'win-card' : 'loss-card'}`;
    }

    // Win/Loss progress bars
    const winBarEl = document.getElementById('progressWinBar');
    const lossBarEl = document.getElementById('progressLossBar');
    const barWinPct = document.getElementById('barWinPct');
    const barLossPct = document.getElementById('barLossPct');

    if (total > 0) {
      const wPct = (wins / total) * 100;
      const lPct = 100 - wPct;
      if (winBarEl) winBarEl.style.width = `${wPct}%`;
      if (lossBarEl) lossBarEl.style.width = `${lPct}%`;
      if (barWinPct) barWinPct.textContent = `${wPct.toFixed(1)}%`;
      if (barLossPct) barLossPct.textContent = `${lPct.toFixed(1)}%`;
    }

    // Draw equity curve chart
    this.drawEquityCurve();
  }

  private drawEquityCurve(): void {
    if (!this.equityCtx || !this.equityCanvas) return;
    const ctx = this.equityCtx;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.equityCanvas.getBoundingClientRect();

    if (rect.width === 0) return;

    this.equityCanvas.width = rect.width * dpr;
    this.equityCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;

    if (this.equityCurve.length < 2) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    const minVal = Math.min(...this.equityCurve);
    const maxVal = Math.max(...this.equityCurve);
    const range = maxVal - minVal || 1;

    const padT = 15, padB = 25, padL = 10, padR = 10;
    const cw = width - padL - padR;
    const ch = height - padT - padB;

    ctx.clearRect(0, 0, width, height);

    const getX = (i: number) => padL + (i / (this.equityCurve.length - 1)) * cw;
    const getY = (val: number) => padT + ch - ((val - minVal) / range) * ch;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
    const isProfit = this.equityCurve[this.equityCurve.length - 1] >= this.equityCurve[0];
    grad.addColorStop(0, isProfit ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 68, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    this.equityCurve.forEach((val, i) => {
      const x = getX(i);
      const y = getY(val);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(getX(this.equityCurve.length - 1), padT + ch);
    ctx.lineTo(getX(0), padT + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    this.equityCurve.forEach((val, i) => {
      const x = getX(i);
      const y = getY(val);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isProfit ? '#00e676' : '#ff1744';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Baseline
    const baseY = getY(this.equityCurve[0]);
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(padL, baseY);
    ctx.lineTo(padL + cw, baseY);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private updateStat(id: string, value: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}
