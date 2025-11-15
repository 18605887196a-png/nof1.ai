/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * K线图生成和模式识别工具
 */

import { tool } from "@voltagent/core";
import { generateText } from "ai";
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from "../../utils/loggerUtils";
import { createGateClient } from "../../services/gateClient";
import { calculateIndicators } from "./marketData";
import { z } from "zod";

const logger = createLogger({
  name: "pattern-recognition",
  level: (process.env.LOG_LEVEL as any) || "info",
});

/**
 * 生成K线图的技术指标上下文
 */
export interface QuantReportContext {
  symbol: string;
  frame: {
    frame: string;
  };
  patternImageBase64: string;
}

/**
 * 生成K线图并返回base64编码的图像
 */
// 根据时间框架获取最优K线数量
function getOptimalKlineLimit(timeframe: string): number {
  const config: Record<string, number> = {
    "1m": 200,   // 3.3小时
    "5m": 150,   // 12.5小时  
    "15m": 100,  // 25小时
    "1h": 80,    // 80小时
    "4h": 60,    // 240小时
    "1d": 50     // 50天
  };
  return config[timeframe] || 100;
}

export async function generateCandlestickChart(
  symbol: string,
  timeframe: string = "15m",
  limit?: number
): Promise<string> {
  // 如果没有指定limit，使用智能默认值
  const optimalLimit = limit || getOptimalKlineLimit(timeframe);
  try {
    // 获取市场数据 - 直接调用API而不是工具
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    // 获取K线数据
    const candles = await client.getFuturesCandles(contract, timeframe, optimalLimit);
    
    // 计算技术指标
    const indicators = calculateIndicators(candles);
    
    // 格式化K线数据，提取必要的价格信息和时间戳
    const formattedKlines = candles.map(candle => ({
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
      timestamp: candle.t // 保留时间戳
    }));
    
    // 将格式化的K线数据添加到指标对象中
    const dataWithKlines = {
      ...indicators,
      klineData: formattedKlines,
      timeframe: timeframe // 添加时间框架信息
    };
    
    // 生成K线图图像
    const chartBase64 = generateCandlestickChartImage(dataWithKlines, symbol, timeframe);
    return chartBase64;
    
  } catch (error) {
    logger.error("生成K线图失败:", error);
    throw new Error(`生成K线图失败: ${error.message}`);
  }
}

// 定义 Voltagent 工具
const generateCandlestickChartTool = tool({
  name: "generateCandlestickChart",
  description: "生成指定币种的K线图，返回base64编码的图像数据",
  parameters: z.object({
    symbol: z.enum(["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "AVAX", "DOT", "MATIC"]).describe("币种代码"),
    timeframe: z.string().default("15m").describe("时间框架，如1m, 5m, 15m, 1h, 4h, 1d等"),
    limit: z.number().default(100).describe("K线数量，默认100根"),
  }),
  execute: async ({ symbol, timeframe, limit }) => {
    try {
      const chartBase64 = await generateCandlestickChart(symbol, timeframe, limit);
      return {
        symbol,
        timeframe,
        chartBase64,
        timestamp: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      return {
        symbol,
        timeframe,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        success: false
      };
    }
  },
});

const patternAnalysisTool = tool({
  name: "patternAnalysis",
  description: "进行K线图形态识别分析，生成K线图并提供专业的形态分析结果",
  parameters: z.object({
    symbol: z.enum(["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "AVAX", "DOT", "MATIC"]).describe("币种代码"),
    timeframe: z.string().default(`${Number.parseInt(process.env.TRADING_INTERVAL_MINUTES || "5")}m`).describe("时间框架，如1m, 5m, 15m, 1h, 4h, 1d等"),
  }),
  execute: async ({ symbol, timeframe }) => {
    try {
      // 使用统一的模式分析函数，包含错误处理
      const finalTimeframe = timeframe || `${Number.parseInt(process.env.TRADING_INTERVAL_MINUTES || "5")}m`;
      const result = await getPatternAnalysis(symbol, finalTimeframe);
      
      return {
        symbol,
        timeframe: finalTimeframe,
        chart: result.chart,
        analysis: result.analysis,
        timestamp: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      const finalTimeframe = timeframe || `${Number.parseInt(process.env.TRADING_INTERVAL_MINUTES || "5")}m`;
      return {
        symbol,
        timeframe: finalTimeframe,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        success: false
      };
    }
  },
});

// 导出工具函数
export { generateCandlestickChartTool, patternAnalysisTool };

/**
 * 生成K线图图像（使用Canvas API生成真实的图表）
 */
function generateCandlestickChartImage(data: any, symbol: string, timeframe: string): string {
  try {
    // 从数据中提取K线信息
    const klineData = data.klineData || [];
    const currentPrice = data.currentPrice || 0;
    const ema20 = data.ema20 || 0;
    const ema50 = data.ema50 || 0;
    const rsi = data.rsi14 || 0;
    const macd = data.macd || 0;
    
    // 如果没有K线数据，创建一个模拟的K线图
    if (klineData.length === 0) {
      // 生成模拟K线数据
      const mockKlines = [];
      let price = currentPrice || 50000;
      
      for (let i = 0; i < 20; i++) {
        const open = price;
        const close = price * (1 + (Math.random() - 0.5) * 0.02);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        
        mockKlines.push({ open, high, low, close });
        price = close;
      }
      
      // 使用模拟数据绘制K线图
      return drawCandlestickSVG(mockKlines, symbol, timeframe, {
        currentPrice,
        ema20,
        ema50,
        rsi,
        macd
      });
    }
    
    // 使用真实数据绘制K线图
    return drawCandlestickSVG(klineData, symbol, timeframe, {
      currentPrice,
      ema20,
      ema50,
      rsi,
      macd
    });
    
  } catch (error) {
    logger.error("生成K线图图像失败:", error);
    
    // 如果图像生成失败，直接抛出错误，避免浪费API调用
    throw new Error(`K线图生成失败: ${error.message}`);
  }
}

/**
 * 绘制K线图SVG
 */
function drawCandlestickSVG(
  klineData: Array<{open: number, high: number, low: number, close: number, timestamp?: number}> , 
  symbol: string, 
  timeframe: string,
  indicators: {
    currentPrice: number,
    ema20: number,
    ema50: number,
    rsi: number,
    macd: number
  }
): string {
  const width = 600;
  const height = 400;
  const padding = { top: 40, right: 120, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // 计算价格范围
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  for (const candle of klineData) {
    minPrice = Math.min(minPrice, candle.low);
    maxPrice = Math.max(maxPrice, candle.high);
  }
  
  // 添加一些边距
  const priceRange = maxPrice - minPrice;
  minPrice -= priceRange * 0.05;
  maxPrice += priceRange * 0.05;
  
  // 生成SVG内容
  let svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e293b"/>
      
      <!-- 标题 -->
      <text x="${width/2}" y="25" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="16" font-weight="bold">
        ${symbol} - ${timeframe} K线图
      </text>
      
      <!-- 网格线 -->
      <g stroke="#2d3748" stroke-width="0.5">
  `;
  
  // 添加水平网格线
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i;
    const price = maxPrice - (priceRange / 5) * i;
    svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />
        <text x="${padding.left - 10}" y="${y + 5}" text-anchor="end" fill="#a0aec0" font-family="Arial" font-size="10">
          ${price.toFixed(2)}
        </text>
    `;
  }
  
  // 添加垂直网格线
  const candleWidth = Math.max(2, chartWidth / klineData.length * 0.6);
  const candleSpacing = chartWidth / klineData.length;
  
  svgContent += `
      </g>
      
      <!-- K线 -->
  `;
  
  // 绘制K线
  klineData.forEach((candle, index) => {
    const x = padding.left + candleSpacing * index + candleSpacing / 2;
    const yHigh = padding.top + ((maxPrice - candle.high) / priceRange) * chartHeight;
    const yLow = padding.top + ((maxPrice - candle.low) / priceRange) * chartHeight;
    const yOpen = padding.top + ((maxPrice - candle.open) / priceRange) * chartHeight;
    const yClose = padding.top + ((maxPrice - candle.close) / priceRange) * chartHeight;
    
    const color = candle.close >= candle.open ? "#10b981" : "#ef4444"; // 绿涨红跌
    
    // 绘制影线
    svgContent += `
      <line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${color}" stroke-width="1" />
    `;
    
    // 绘制实体
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.abs(yClose - yOpen) || 1; // 最小高度为1
    
    svgContent += `
      <rect x="${x - candleWidth/2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${color}" />
    `;
  });
  
  // 添加指标信息
  svgContent += `
      <!-- 指标信息 -->
      <g font-family="Arial" font-size="12">
        <text x="${width - padding.right + 10}" y="${padding.top + 20}" fill="#60a5fa">
          价格: ${indicators.currentPrice.toFixed(2)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 40}" fill="#f87171">
          EMA20: ${indicators.ema20.toFixed(2)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 60}" fill="#34d399">
          EMA50: ${indicators.ema50.toFixed(2)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 80}" fill="#fbbf24">
          RSI: ${indicators.rsi.toFixed(1)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 100}" fill="#a78bfa">
          MACD: ${indicators.macd.toFixed(4)}
        </text>
      </g>
      
      <!-- 时间轴 -->
      <g font-family="Arial" font-size="10" fill="#a0aec0">
  `;
  
  // 添加时间轴标签（只显示部分）
  const timeLabelInterval = Math.max(1, Math.floor(klineData.length / 5));
  klineData.forEach((candle, index) => {
    if (index % timeLabelInterval === 0) {
      const x = padding.left + candleSpacing * index + candleSpacing / 2;
      let timeLabel = (index + 1).toString(); // 默认使用序号
      
      // 对于15分钟图表，生成正确的15分钟间隔标签
      if (timeframe === '15m') {
        // 计算相对时间点，确保显示准确的15分钟间隔
        const now = new Date();
        // 为了确保显示准确的15分钟间隔，我们需要计算正确的时间点
        // 首先计算从现在回溯的完整15分钟周期数
        const totalBackwardIntervals = Math.floor((klineData.length - index) / 1);
        // 计算具体的回溯时间
        const relativeTime = new Date(now.getTime() - totalBackwardIntervals * 15 * 60 * 1000);
        
        // 确保分钟严格为15的倍数
        const hours = relativeTime.getHours();
        const minutesRaw = relativeTime.getMinutes();
        // 使用Math.floor而不是Math.round，确保时间点是过去的15分钟标记
        const roundedMinutes = Math.floor(minutesRaw / 15) * 15;
        
        timeLabel = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
      } else if (candle.timestamp) {
        // 对于其他时间框架，使用时间戳
        const timestamp = typeof candle.timestamp === 'string' ? parseInt(candle.timestamp) : candle.timestamp;
        const date = new Date(timestamp);
        
        if (timeframe.includes('m')) { // 分钟级别
          const hours = date.getHours();
          const minutes = date.getMinutes();
          timeLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else if (timeframe.includes('h')) { // 小时级别
          timeLabel = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
        } else { // 日线及以上
          timeLabel = `${date.getMonth() + 1}/${date.getDate()}`;
        }
      }
      
      svgContent += `
        <text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle">
          ${timeLabel}
        </text>
      `;
    }
  });
  
  svgContent += `
      </g>
    </svg>
  `;
  
  // 将SVG转换为base64
  const base64 = Buffer.from(svgContent).toString('base64');
  return base64;
}

/**
 * 运行模式识别分析
 */
export async function runPatternAgent(ctx: QuantReportContext): Promise<string> {
  try {
    // 使用环境变量配置视觉模型
    const visionApiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
    const visionBaseUrl = process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
    const visionModelName = process.env.VISION_MODEL_NAME || "deepseek-chat";

    // 如果没有配置视觉API密钥，使用普通文本分析
    if (!visionApiKey) {
      logger.warn("未配置视觉模型API密钥，使用文本模式分析");
      return await runTextPatternAnalysis(ctx);
    }

    // 创建OpenAI客户端
    const openai = createOpenAI({
      apiKey: visionApiKey,
      baseURL: visionBaseUrl,
    });

    // 使用generateText进行API调用
    const { text } = await generateText({
      model: openai(visionModelName),
      messages: [
        {
          role: "system",
          content: `你是一名专业的交易形态分析师，专注于价格行为和市场结构分析。你善于从K线图中识别有意义的形态和交易机会，基于市场内在逻辑进行专业判断。

请遵循以下分析框架：

1. 结构完整性：评估价格结构的完整性和逻辑性
2. 对称性分析：观察形态的几何对称性和平衡性  
3. 支撑阻力：识别关键价位和突破点
4. 时间因素：考虑形态发育的时间跨度
5. 市场环境：结合当前市场环境判断有效性

输出要求：
- 形态识别：明确是否有可交易形态
- 完成度评估：高/中/低（并说明理由）
- 突破概率：高/中/低（基于结构强度）
- 目标位测算：基于形态高度的合理区间
- 风险提示：假突破的可能性和止损位置

请提供专业的形态分析，注重市场的真实表现，避免生搬硬套标准形态。`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `这是一张 ${ctx.symbol} 在 ${ctx.frame.frame} 周期的 K 线图，请说明是否存在可交易的经典形态、形态阶段以及多空含义。`,
            },
            {
              type: "image",
              image: `data:image/png;base64,${ctx.patternImageBase64}`,
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.4,
    });

    return text.trim() || "未能识别出有效形态。";
  } catch (error) {
    logger.error("模式识别分析失败:", error);
    throw new Error(`模式识别分析失败: ${error.message}`);
  }
}

/**
 * 文本模式分析（当没有视觉API时使用）
 */
async function runTextPatternAnalysis(ctx: QuantReportContext): Promise<string> {
  try {
    // 创建OpenAI客户端
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
    });

    const { text } = await generateText({
      model: openai(process.env.AI_MODEL_NAME || "deepseek-chat"),
      messages: [
        {
          role: "system",
          content: `你是一名专业的交易形态分析师，专注于基于数据的市场结构分析。`
        },
        {
          role: "user",
          content: `请基于 ${ctx.symbol} 在 ${ctx.frame.frame} 周期的市场数据进行形态分析。
        
        由于无法获取图像，请基于以下信息进行分析：
        - 价格行为模式
        - 技术指标形态
        - 支撑阻力位
        - 市场结构
        
        请提供专业的形态分析报告。`
        }
      ],
      max_tokens: 1024,
      temperature: 0.4,
    });

    return text.trim() || "未能进行有效的形态分析。";
  } catch (error) {
    logger.error("文本模式分析失败:", error);
    return "模式分析暂时不可用。";
  }
}

/**
 * 获取完整的模式识别分析结果
 */
export async function getPatternAnalysis(
  symbol: string, 
  timeframe: string = `${Number.parseInt(process.env.TRADING_INTERVAL_MINUTES || "5")}m`
): Promise<{
  chart: string;
  analysis: string;
}> {
  try {
    // 生成K线图
    const chartBase64 = await generateCandlestickChart(symbol, timeframe);
    
    // 创建分析上下文
    const context: QuantReportContext = {
      symbol,
      frame: { frame: timeframe },
      patternImageBase64: chartBase64
    };
    
    // 运行模式识别分析
    const analysis = await runPatternAgent(context);
    
    return {
      chart: chartBase64,
      analysis
    };
  } catch (error) {
    logger.error("获取模式分析失败:", error);
    
    // 返回有意义的错误信息，而不是抛出异常
    return {
      chart: "",
      analysis: `模式识别分析失败: ${error.message}. 可能原因：数据获取异常、K线图生成失败或API调用错误。建议检查数据源连接或稍后重试。`
    };
  }
}