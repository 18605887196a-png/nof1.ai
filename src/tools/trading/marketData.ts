/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * 市场数据工具
 */
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { createGateClient } from "../../services/gateClient";
import { RISK_PARAMS } from "../../config/riskParams";

/**
 * 确保数值是有效的有限数字，否则返回默认值
 */
function ensureFinite(value: number, defaultValue: number = 0): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }
  return value;
}

/**
 * 确保数值在指定范围内
 */
function ensureRange(value: number, min: number, max: number, defaultValue?: number): number {
  if (!Number.isFinite(value)) {
    return defaultValue !== undefined ? defaultValue : (min + max) / 2;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// 计算 EMA
function calculateEMA(prices: number[], period: number) {
  if (!prices || prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Number.isFinite(ema) ? ema : 0;
}

// 计算 RSI
function calculateRSI(prices: number[], period: number) {
  if (!prices || prices.length < period + 1) return 50; // 数据不足，返回中性值
  
  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    if (i === 0) continue; // 跳过第一个元素，避免访问 prices[-1]
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return avgGain > 0 ? 100 : 50;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  
  // 确保RSI在0-100范围内
  return ensureRange(rsi, 0, 100, 50);
}

// 计算 MACD
function calculateMACD(prices: number[]) {
  if (!prices || prices.length < 26) return 0; // 数据不足
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  return Number.isFinite(macd) ? macd : 0;
}

// 计算 ATR
function calculateATR(candles: any[], period: number) {
  if (!candles || candles.length < 2) return 0;
  
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    let high: number, low: number, prevClose: number;
    
    // 处理对象格式（FuturesCandlestick）
    if (candles[i] && typeof candles[i] === 'object' && 'h' in candles[i]) {
      high = Number.parseFloat(candles[i].h);
      low = Number.parseFloat(candles[i].l);
      prevClose = Number.parseFloat(candles[i - 1].c);
    }
    // 处理数组格式（兼容旧代码）
    else if (Array.isArray(candles[i])) {
      high = Number.parseFloat(candles[i][3]);
      low = Number.parseFloat(candles[i][4]);
      prevClose = Number.parseFloat(candles[i - 1][2]);
    } else {
      continue;
    }
    
    if (Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(prevClose)) {
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
  }
  
  if (trs.length === 0) return 0;
  return trs.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
}

/**
 * 计算布林带指标
 * @param prices 价格数组
 * @param period 周期（默认20）
 * @param stdDev 标准差倍数（默认2）
 */
function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
  if (prices.length < period) {
    return { upper: 0, middle: 0, lower: 0, bandwidth: 0, position: 0 };
  }
  
  const recentPrices = prices.slice(-period);
  const middle = recentPrices.reduce((sum, price) => sum + price, 0) / period;
  
  // 计算标准差
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = middle + stdDev * std;
  const lower = middle - stdDev * std;
  const bandwidth = ((upper - lower) / middle) * 100; // 带宽百分比
  const currentPrice = prices[prices.length - 1];
  const position = ((currentPrice - lower) / (upper - lower)) * 100; // 0-100，表示在布林带中的位置
  
  return {
    upper: ensureFinite(upper),
    middle: ensureFinite(middle),
    lower: ensureFinite(lower),
    bandwidth: ensureFinite(bandwidth),
    position: ensureRange(position, 0, 100, 50)
  };
}

/**
 * 计算技术指标
 * 
 * K线数据格式：FuturesCandlestick 对象
 * {
 *   t: number,    // 时间戳
 *   v: number,    // 成交量
 *   c: string,    // 收盘价
 *   h: string,    // 最高价
 *   l: string,    // 最低价
 *   o: string,    // 开盘价
 *   sum: string   // 总成交额
 * }
 */
export function calculateIndicators(candles: any[]) {
  if (!candles || candles.length === 0) {
    return {
      currentPrice: 0,
      ema20: 0,
      ema50: 0,
      macd: 0,
      rsi7: 50,
      rsi14: 50,
      volume: 0,
      avgVolume: 0,
      atr3: 0,
      atr14: 0,
      bbUpper: 0,
      bbMiddle: 0,
      bbLower: 0,
      bbBandwidth: 0,
      bbPosition: 50,
    };
  }

  // 处理对象格式的K线数据（Gate.io API返回的是对象，不是数组）
  const closes = candles
    .map((c) => {
      // 如果是对象格式（FuturesCandlestick）
      if (c && typeof c === 'object' && 'c' in c) {
        return Number.parseFloat(c.c);
      }
      // 如果是数组格式（兼容旧代码）
      if (Array.isArray(c)) {
        return Number.parseFloat(c[2]);
      }
      return NaN;
    })
    .filter(n => Number.isFinite(n));

  const volumes = candles
    .map((c) => {
      // 如果是对象格式（FuturesCandlestick）
      if (c && typeof c === 'object' && 'v' in c) {
        const vol = Number.parseFloat(c.v);
        // 验证成交量：必须是有限数字且非负
        return Number.isFinite(vol) && vol >= 0 ? vol : 0;
      }
      // 如果是数组格式（兼容旧代码）
      if (Array.isArray(c)) {
        const vol = Number.parseFloat(c[1]);
        return Number.isFinite(vol) && vol >= 0 ? vol : 0;
      }
      return 0;
    })
    .filter(n => n >= 0); // 过滤掉负数成交量

  if (closes.length === 0 || volumes.length === 0) {
    return {
      currentPrice: 0,
      ema20: 0,
      ema50: 0,
      macd: 0,
      rsi7: 50,
      rsi14: 50,
      volume: 0,
      avgVolume: 0,
      atr3: 0,
      atr14: 0,
    };
  }

  // 计算布林带指标
  const bollingerBands = calculateBollingerBands(closes, 20, 2);
  
  return {
    currentPrice: ensureFinite(closes.at(-1) || 0),
    ema20: ensureFinite(calculateEMA(closes, 20)),
    ema50: ensureFinite(calculateEMA(closes, 50)),
    macd: ensureFinite(calculateMACD(closes)),
    rsi7: ensureRange(calculateRSI(closes, 7), 0, 100, 50),
    rsi14: ensureRange(calculateRSI(closes, 14), 0, 100, 50),
    volume: ensureFinite(volumes.at(-1) || 0),
    avgVolume: ensureFinite(volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0),
    atr3: ensureFinite(calculateATR(candles, 3)),
    atr14: ensureFinite(calculateATR(candles, 14)),
    volumeRatio: ensureFinite(volumes.length > 0 && (volumes.reduce((a, b) => a + b, 0) / volumes.length) > 0 
      ? (volumes.at(-1) || 0) / (volumes.reduce((a, b) => a + b, 0) / volumes.length) 
      : 1),
    // 布林带指标
    bbUpper: bollingerBands.upper,
    bbMiddle: bollingerBands.middle,
    bbLower: bollingerBands.lower,
    bbBandwidth: bollingerBands.bandwidth,
    bbPosition: bollingerBands.position,
  };
}

/**
 * 获取市场价格工具
 */
export const getMarketPriceTool = createTool({
  name: "getMarketPrice",
  description: "获取指定交易对的实时价格信息，包括标记价格（mark price）、最新成交价等，用于评估当前价格水平、计算止损止盈和风险收益比。",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
  }),
  execute: async ({ symbol }) => {
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    const ticker = await client.getFuturesTicker(contract);
    
    return {
      symbol,
      contract,
      lastPrice: Number.parseFloat(ticker.last || "0"),
      markPrice: Number.parseFloat(ticker.markPrice || "0"),
      indexPrice: Number.parseFloat(ticker.indexPrice || "0"),
      highPrice24h: Number.parseFloat(ticker.high24h || "0"),
      lowPrice24h: Number.parseFloat(ticker.low24h || "0"),
      volume24h: Number.parseFloat(ticker.volume24h || "0"),
      change24h: Number.parseFloat(ticker.changePercentage || "0"),
    };
  },
});

/**
 * 获取技术指标工具
 */
export const getTechnicalIndicatorsTool = createTool({
  name: "getTechnicalIndicators",
  description: "获取指定交易对在给定周期上的技术指标（如 RSI、ATR、均线、布林带等），用于评估市场波动率、超买超卖状态和趋势强弱。尤其可用ATR估算波动率并据此设置入场价容忍带。",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    interval: z.enum(["1m", "3m", "5m", "15m", "30m", "1h", "4h"]).default("5m").describe("K线周期"),
    limit: z.number().default(100).describe("K线数量"),
  }),
  execute: async ({ symbol, interval, limit }) => {
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    const candles = await client.getFuturesCandles(contract, interval, limit);
    const indicators = calculateIndicators(candles);
    
    return {
      symbol,
      interval,
      ...indicators,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 获取资金费率工具
 */
export const getFundingRateTool = createTool({
  name: "getFundingRate",
  description: "获取指定永续合约的最新资金费率，用于判断多空持仓的拥挤程度和市场情绪偏向（正值偏多头，负值偏空头），以及监控极端情绪带来的潜在反向风险。",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
  }),
  execute: async ({ symbol }) => {
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    const fundingRate = await client.getFundingRate(contract);
    
    return {
      symbol,
      fundingRate: Number.parseFloat(fundingRate.r || "0"),
      fundingTime: fundingRate.t,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 获取订单簿深度工具（原始数据）
 */
export const getOrderBookTool = createTool({
  name: "getOrderBook",
  description: "获取指定币种的订单簿深度原始数据",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    limit: z.number().default(10).describe("深度档位数量"),
  }),
  execute: async ({ symbol, limit }) => {
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    const orderBook = await client.getOrderBook(contract, limit);
    
    return {
      symbol,
      contract,
      bids: orderBook.bids || [],
      asks: orderBook.asks || [],
      id: orderBook.id,
      current: orderBook.current,
      update: orderBook.update,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 获取合约持仓量工具
 */
export const getOpenInterestTool = createTool({
  name: "getOpenInterest",
  description: "获取指定币种的合约持仓量",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
  }),
  execute: async ({ symbol }) => {
    // Gate API 需要通过其他方式获取持仓量数据
    // 暂时返回 0，后续可以通过其他端点获取
    return {
      symbol,
      openInterest: 0,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 分析资金费率历史趋势工具
 */
export const analyzeFundingRateTrendTool = createTool({
  name: "analyzeFundingRateTrend",
  description: "分析指定币种的资金费率历史趋势",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    hours: z.number().default(24).describe("分析小时数，默认24小时"),
  }),
  execute: async ({ symbol, hours }) => {
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    // 计算需要获取的数据点数（资金费率每8小时结算一次）
    const limit = Math.ceil(hours / 8);
    
    // 获取原始数据
    const rawData = await client.getFundingRateHistory(contract, limit);
    
    if (rawData.length === 0) {
      return {
        symbol,
        history: [],
        currentRate: 0,
        avg24h: 0,
        trend: 'neutral',
        volatility: 0,
        timestamp: new Date().toISOString(),
      };
    }
    
    // 使用正确的属性名 r 和 t
    const currentRate = parseFloat(rawData[0].r || '0');
    const avg24h = rawData.reduce((sum, item) => sum + parseFloat(item.r || '0'), 0) / rawData.length;
    
    // 计算趋势（基于最近3个费率点）
    let trend = 'neutral';
    if (rawData.length >= 3) {
      const recentRates = rawData.slice(0, 3).map(item => parseFloat(item.r || '0'));
      const isIncreasing = recentRates.every((rate, i) => i === 0 || rate >= recentRates[i-1]);
      const isDecreasing = recentRates.every((rate, i) => i === 0 || rate <= recentRates[i-1]);
      
      if (isIncreasing) trend = 'increasing';
      else if (isDecreasing) trend = 'decreasing';
    }
    
    // 计算波动率（标准差）
    const variance = rawData.reduce((sum, item) => sum + Math.pow(parseFloat(item.r || '0') - avg24h, 2), 0) / rawData.length;
    const volatility = Math.sqrt(variance);
    
    return {
      symbol,
      history: rawData.map(item => ({
        rate: parseFloat(item.r || '0'),
        time: item.t
      })),
      currentRate,
      avg24h,
      trend,
      volatility,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 分析订单簿深度工具
 */
export const analyzeOrderBookDepthTool = createTool({
  name: "analyzeOrderBookDepth",
  description: "分析指定交易对的订单簿深度，评估流动性并识别大额挂单，从而推断短期支撑/阻力位，评估在某价位附近下单的滑点风险和挂单结构。",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    depthLimit: z.number().default(50).describe("深度档位数量，默认50档"),
  }),
  execute: async ({ symbol, depthLimit }) => {
    try {
      const client = createGateClient();
      const contract = `${symbol}_USDT`;
      
      // 获取原始订单簿数据
      const orderBook = await client.getOrderBook(contract, depthLimit);
      
      if (!orderBook || !orderBook.asks || !orderBook.bids) {
        return {
          symbol,
          error: "获取订单簿数据失败",
          timestamp: new Date().toISOString(),
        };
      }
      
      const asks = orderBook.asks.slice(0, depthLimit);
      const bids = orderBook.bids.slice(0, depthLimit);
      
      // 计算买卖盘总量（使用对象格式的p和s字段）
      const totalAskAmount = asks.reduce((sum, ask) => sum + parseFloat(ask.s), 0);
      const totalBidAmount = bids.reduce((sum, bid) => sum + parseFloat(bid.s), 0);
      
      // 计算深度比例
      const depthRatio = totalBidAmount / totalAskAmount;
      
      // 识别关键价位（大额挂单）
      const largeOrdersThreshold = Math.max(totalAskAmount, totalBidAmount) * 0.1; // 10%阈值
      
      const largeAsks = asks.filter(ask => parseFloat(ask.s) > largeOrdersThreshold);
      const largeBids = bids.filter(bid => parseFloat(bid.s) > largeOrdersThreshold);
      
      // 计算支撑/阻力位
      const resistanceLevels = largeAsks.map(ask => parseFloat(ask.p)).sort((a, b) => a - b);
      const supportLevels = largeBids.map(bid => parseFloat(bid.p)).sort((a, b) => b - a);
      
      // 流动性风险评估
      let liquidityRisk = 'low';
      if (depthRatio < 0.5) liquidityRisk = 'high';
      else if (depthRatio < 0.8) liquidityRisk = 'medium';
      
      // 估算当前价格（使用买卖盘中间价）
      const bestBid = bids.length > 0 ? parseFloat(bids[0].p) : 0;
      const bestAsk = asks.length > 0 ? parseFloat(asks[0].p) : 0;
      const currentPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;
      
      // 估算清算价位（基于订单簿分析）
      const liquidationDistance = 0.05; // 5%距离估算
      
      const longLiquidationEstimate = currentPrice * (1 - liquidationDistance);
      const shortLiquidationEstimate = currentPrice * (1 + liquidationDistance);
      
      return {
        symbol,
        contract,
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        depthRatio: parseFloat(depthRatio.toFixed(3)),
        totalAskAmount: parseFloat(totalAskAmount.toFixed(2)),
        totalBidAmount: parseFloat(totalBidAmount.toFixed(2)),
        liquidityRisk,
        resistanceLevels: resistanceLevels.slice(0, 3), // 前3个阻力位
        supportLevels: supportLevels.slice(0, 3), // 前3个支撑位
        largeOrders: {
          askCount: largeAsks.length,
          bidCount: largeBids.length,
          largestAsk: largeAsks.length > 0 ? parseFloat(largeAsks[0].s) : 0,
          largestBid: largeBids.length > 0 ? parseFloat(largeBids[0].s) : 0
        },
        liquidationEstimates: {
          longLiquidation: parseFloat(longLiquidationEstimate.toFixed(2)),
          shortLiquidation: parseFloat(shortLiquidationEstimate.toFixed(2)),
          distancePercentage: liquidationDistance * 100
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol,
        error: `分析订单簿深度失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      };
    }
  },
});

