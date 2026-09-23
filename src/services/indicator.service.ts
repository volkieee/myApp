import { Candle } from '../interfaces/market.types';

export interface BollingerBandsResult {
  middle: number[];
  upper: number[];
  lower: number[];
}

export class IndicatorService {
  /**
   * Exponential Moving Average (EMA)
   */
  public static calculateEMA(candles: Candle[], period: number): (number | null)[] {
    const k = 2 / (period + 1);
    const result: (number | null)[] = new Array(candles.length).fill(null);
    if (candles.length < period) return result;

    // First value is simple SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += candles[i].close;
    }
    let previousEMA = sum / period;
    result[period - 1] = previousEMA;

    for (let i = period; i < candles.length; i++) {
      const currentEMA = candles[i].close * k + previousEMA * (1 - k);
      result[i] = currentEMA;
      previousEMA = currentEMA;
    }
    return result;
  }

  /**
   * Bollinger Bands (Period, Multiplier)
   */
  public static calculateBollingerBands(candles: Candle[], period: number = 20, multiplier: number = 2): {
    middle: (number | null)[];
    upper: (number | null)[];
    lower: (number | null)[];
  } {
    const len = candles.length;
    const middle: (number | null)[] = new Array(len).fill(null);
    const upper: (number | null)[] = new Array(len).fill(null);
    const lower: (number | null)[] = new Array(len).fill(null);

    if (len < period) return { middle, upper, lower };

    for (let i = period - 1; i < len; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      const sma = sum / period;
      middle[i] = sma;

      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        const diff = candles[i - j].close - sma;
        varianceSum += diff * diff;
      }
      const stdev = Math.sqrt(varianceSum / period);
      upper[i] = sma + multiplier * stdev;
      lower[i] = sma - multiplier * stdev;
    }

    return { middle, upper, lower };
  }

  /**
   * Relative Strength Index (RSI 14)
   */
  public static calculateRSI(candles: Candle[], period: number = 14): (number | null)[] {
    const len = candles.length;
    const result: (number | null)[] = new Array(len).fill(null);
    if (len <= period) return result;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));

    for (let i = period + 1; i < len; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) {
        result[i] = 100;
      } else {
        rs = avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }

    return result;
  }
}
