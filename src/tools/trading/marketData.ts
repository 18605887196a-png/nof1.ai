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
 if (prices.length < period) {
   // 数据不足，返回简单平均
   return prices.reduce((sum, p) => sum + p, 0) / prices.length;
 }


 // 使用前 period 个价格的 SMA 作为初始 EMA
 let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;


 const k = 2 / (period + 1);
 for (let i = period; i < prices.length; i++) {
   ema = prices[i] * k + ema * (1 - k);
 }
 return Number.isFinite(ema) ? ema : 0;
}


// 计算 RSI（使用 Wilder's Smoothing 方法）
function calculateRSI(prices: number[], period: number) {
 if (!prices || prices.length < period + 1) return 50; // 数据不足，返回中性值


 // 第一步：计算价格变化
 const changes: number[] = [];
 for (let i = 1; i < prices.length; i++) {
   changes.push(prices[i] - prices[i - 1]);
 }


 if (changes.length < period) return 50;


 // 第二步：计算初始平均涨幅和跌幅（前 period 个变化）
 let avgGain = 0;
 let avgLoss = 0;


 for (let i = 0; i < period; i++) {
   if (changes[i] > 0) {
     avgGain += changes[i];
   } else {
     avgLoss += Math.abs(changes[i]);
   }
 }


 avgGain /= period;
 avgLoss /= period;


 // 第三步：使用 Wilder's Smoothing（类似 EMA）平滑后续数据
 for (let i = period; i < changes.length; i++) {
   const change = changes[i];
   if (change > 0) {
     avgGain = (avgGain * (period - 1) + change) / period;
     avgLoss = (avgLoss * (period - 1)) / period;
   } else {
     avgGain = (avgGain * (period - 1)) / period;
     avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
   }
 }


 // 第四步：计算 RSI
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


// 计算 ATR（使用 Wilder's Smoothing 方法）
function calculateATR(candles: any[], period: number) {
 if (!candles || candles.length < 2) return 0;


 // 第一步：计算所有 True Range 值
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


 // 数据不足，返回简单平均
 if (trs.length < period) {
   return trs.reduce((sum, tr) => sum + tr, 0) / trs.length;
 }


 // 第二步：计算初始 ATR（前 period 个 TR 的简单平均）
 let atr = trs.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;


 // 第三步：使用 Wilder's Smoothing 平滑后续数据
 // 公式：ATR = (ATR_prev × (period-1) + TR) / period
 for (let i = period; i < trs.length; i++) {
   atr = (atr * (period - 1) + trs[i]) / period;
 }


 return atr;
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
export function calculateIndicators(candles: any[], symbol: string, interval: string) {
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
          atrRatio: 0
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
          atrRatio: 0
      };
  }




  // === 先计算所有基础指标（包括 atr14）===
  const atr14 = ensureFinite(calculateATR(candles, 14));
  const currentPrice = ensureFinite(closes[closes.length - 1]); // 最新收盘价




  const atrRatio = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0; // 转换为百分比（如 0.3 表示 0.3%）
  console.log(`ATR Ratio: ${atrRatio.toFixed(4)}% (ATR14: ${atr14.toFixed(2)}, Current Price: ${currentPrice.toFixed(2)})`);




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
      atrRatio
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
 description: "获取指定交易对在给定周期上的技术指标（如 RSI、ATR、均线、布林带等），用于评估市场波动率、超买超卖状态和趋势强弱。尤其可用ATR估算波动率并据此设置入场价容忍带。RSI使用5分钟周期,MACD/ATR/BOLL使用15分钟周期。",
 parameters: z.object({
   symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
   interval: z.enum(["1m", "3m", "5m", "15m", "30m", "1h", "4h"]).default("5m").describe("K线周期（已废弃，系统自动使用多周期）"),
   limit: z.number().default(100).describe("K线数量"),
 }),
 execute: async ({ symbol, interval, limit }) => {
   const client = createGateClient();
   const contract = `${symbol}_USDT`;
  
   // 获取5分钟K线数据用于RSI计算
   const candles5m = await client.getFuturesCandles(contract, "5m", limit);
   
   // 获取15分钟K线数据用于MACD、ATR、BOLL计算
   const candles15m = await client.getFuturesCandles(contract, "15m", limit);
   
   // 从5分钟数据计算RSI
   const closes5m = candles5m
     .map((c) => {
       if (c && typeof c === 'object' && 'c' in c) {
         return Number.parseFloat(c.c);
       }
       if (Array.isArray(c)) {
         return Number.parseFloat(c[2]);
       }
       return NaN;
     })
     .filter(n => Number.isFinite(n));
   
   const rsi7_5m = ensureRange(calculateRSI(closes5m, 7), 0, 100, 50);
   const rsi14_5m = ensureRange(calculateRSI(closes5m, 14), 0, 100, 50);
   
   // 从15分钟数据计算其他指标
   const closes15m = candles15m
     .map((c) => {
       if (c && typeof c === 'object' && 'c' in c) {
         return Number.parseFloat(c.c);
       }
       if (Array.isArray(c)) {
         return Number.parseFloat(c[2]);
       }
       return NaN;
     })
     .filter(n => Number.isFinite(n));
   
   const volumes15m = candles15m
     .map((c) => {
       if (c && typeof c === 'object' && 'v' in c) {
         const vol = Number.parseFloat(c.v);
         return Number.isFinite(vol) && vol >= 0 ? vol : 0;
       }
       if (Array.isArray(c)) {
         const vol = Number.parseFloat(c[1]);
         return Number.isFinite(vol) && vol >= 0 ? vol : 0;
       }
       return 0;
     })
     .filter(n => n >= 0);
   
   // 计算15分钟周期的指标
   const currentPrice = ensureFinite(closes15m[closes15m.length - 1]);
   const ema20_15m = ensureFinite(calculateEMA(closes15m, 20));
   const ema50_15m = ensureFinite(calculateEMA(closes15m, 50));
   const macd_15m = ensureFinite(calculateMACD(closes15m));
   const atr3_15m = ensureFinite(calculateATR(candles15m, 3));
   const atr14_15m = ensureFinite(calculateATR(candles15m, 14));
   const bollingerBands_15m = calculateBollingerBands(closes15m, 20, 2);
   
   const atrRatio = currentPrice > 0 ? (atr14_15m / currentPrice) * 100 : 0;
   console.log(`[多周期指标] RSI(5m): ${rsi14_5m.toFixed(2)}, MACD(15m): ${macd_15m.toFixed(4)}, ATR(15m): ${atr14_15m.toFixed(2)}, ATR Ratio: ${atrRatio.toFixed(4)}%`);
   
   return {
     symbol,
     interval: "multi-timeframe (RSI:5m, Others:15m)",
     currentPrice,
     ema20: ema20_15m,
     ema50: ema50_15m,
     macd: macd_15m,
     rsi7: rsi7_5m,
     rsi14: rsi14_5m,
     volume: ensureFinite(volumes15m.at(-1) || 0),
     avgVolume: ensureFinite(volumes15m.length > 0 ? volumes15m.reduce((a, b) => a + b, 0) / volumes15m.length : 0),
     atr3: atr3_15m,
     atr14: atr14_15m,
     volumeRatio: ensureFinite(volumes15m.length > 0 && (volumes15m.reduce((a, b) => a + b, 0) / volumes15m.length) > 0
       ? (volumes15m.at(-1) || 0) / (volumes15m.reduce((a, b) => a + b, 0) / volumes15m.length)
       : 1),
     bbUpper: bollingerBands_15m.upper,
     bbMiddle: bollingerBands_15m.middle,
     bbLower: bollingerBands_15m.lower,
     bbBandwidth: bollingerBands_15m.bandwidth,
     bbPosition: bollingerBands_15m.position,
     atrRatio,
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

