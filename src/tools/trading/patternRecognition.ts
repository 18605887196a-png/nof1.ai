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
import OpenAI from 'openai';
import { createLogger } from "../../utils/loggerUtils";
import { createGateClient } from "../../services/gateClient";
import { calculateIndicators } from "./marketData";
import { z } from "zod";
import svg2img from 'svg2img';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger({
  name: "pattern-recognition",
  level: (process.env.LOG_LEVEL as any) || "info",
});

// 将svg2img转换为Promise版本，便于使用async/await
const svg2imgAsync = promisify(svg2img);

// 本地文件保存开关函数
function shouldSaveLocalFile(): boolean {
  return process.env.SAVE_PATTERN_IMAGE_LOCAL === 'true' || false;
}

/**
 * 生成K线图的技术指标上下文
 */
export interface QuantReportContext {
  symbol: string;
  frame: { frame: string };
  patternImagePath: string;
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
    
    // 生成K线图图像 (现在是异步函数)
    const chartBase64 = await generateCandlestickChartImage(dataWithKlines, symbol, timeframe);
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
      logger.error("图表生成工具执行失败:", error);
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
 * 保存PNG文件到本地
 */
async function savePngToLocal(buffer: Buffer, symbol: string, timeframe: string): Promise<string> {
  try {
    // 创建输出目录
    const outputDir = path.join(process.cwd(), 'pattern-images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 生成唯一的文件名
    const timestamp = Date.now();
    const filename = `${symbol}_${timeframe}_${timestamp}.png`;
    const filePath = path.join(outputDir, filename);
    
    // 保存PNG文件
    fs.writeFileSync(filePath, buffer);
    
    logger.info(`PNG文件已保存: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error("PNG文件保存失败:", error);
    throw new Error(`PNG文件保存失败: ${error.message}`);
  }
}

/**
 * 将SVG转换为PNG并保存到本地文件（保留作为备用）
 */
async function convertSvgToPngFile(svgContent: string, symbol: string, timeframe: string): Promise<string> {
  try {
    // 将SVG转换为PNG Buffer
    const buffer = await svg2imgAsync(svgContent);
    
    // 保存到本地
    return await savePngToLocal(buffer, symbol, timeframe);
  } catch (error) {
    logger.error("SVG到PNG文件转换失败:", error);
    throw new Error(`PNG文件保存失败: ${error.message}`);
  }
}

/**
 * 将SVG转换为PNG格式的base64字符串（高清质量）
 */
async function convertSvgToPng(svgContent: string, symbol?: string, timeframe?: string): Promise<string> {
  try {
    // 提高图像质量设置（与SVG绘制分辨率保持一致）
    const buffer = await svg2imgAsync(svgContent, {
      format: 'png',
      quality: 100, // 最高质量
      width: 1600,  // 高清分辨率（与SVG绘制保持一致）
      height: 1000
    });
    
    // 如果启用了本地文件保存，同时保存到本地
    if (shouldSaveLocalFile() && symbol && timeframe) {
      console.log(`[DEBUG] 本地文件保存已启用，准备保存 ${symbol}_${timeframe} 图像`);
      await savePngToLocal(buffer, symbol, timeframe);
    } else {
      console.log(`[DEBUG] 本地文件保存状态: shouldSaveLocalFile()=${shouldSaveLocalFile()}, symbol=${symbol}, timeframe=${timeframe}`);
    }
    
    // 将Buffer转换为base64字符串
    return buffer.toString('base64');
  } catch (error) {
    logger.error("SVG到PNG转换失败:", error);
    // 如果转换失败，返回SVG的base64作为后备方案
    return Buffer.from(svgContent).toString('base64');
  }
}

/**
 * 生成K线图图像（使用Canvas API生成真实的图表）
 */
async function generateCandlestickChartImage(data: any, symbol: string, timeframe: string): Promise<string> {
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
    const svgContent = drawCandlestickSVG(mockKlines, symbol, timeframe, {
      currentPrice,
      ema20,
      ema50,
      rsi,
      macd
    });
    
    // 转换为base64编码，可选择保存到本地
    return await convertSvgToPng(svgContent, symbol, timeframe);
    }
    
    // 使用真实数据绘制K线图
    const svgContent = drawCandlestickSVG(klineData, symbol, timeframe, {
      currentPrice,
      ema20,
      ema50,
      rsi,
      macd
    });
    
    // 转换为base64编码，可选择保存到本地
    return await convertSvgToPng(svgContent, symbol, timeframe);
    
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
  // 提高分辨率以获得更清晰的图像（高清设置）
  const width = 1600; // 增加宽度
  const height = 1000; // 增加高度
  const padding = { top: 50, right: 150, bottom: 80, left: 80 }; // 增加边距
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
      <text x="${width/2}" y="35" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="20" font-weight="bold">
        ${symbol} - ${timeframe} K线图
      </text>
      
      <!-- 网格线 -->
      <g stroke="#2d3748" stroke-width="1">
  `;
  
  // 添加水平网格线
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i;
    const price = maxPrice - (priceRange / 5) * i;
    svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />
        <text x="${padding.left - 15}" y="${y + 5}" text-anchor="end" fill="#a0aec0" font-family="Arial" font-size="12" font-weight="bold">
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
    
    // 绘制影线（加粗）
    svgContent += `
      <line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${color}" stroke-width="2" />
    `;
    
    // 绘制实体（加宽）
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.abs(yClose - yOpen) || 2; // 最小高度为2
    const enhancedCandleWidth = candleWidth * 1.2; // 增加20%宽度
    
    svgContent += `
      <rect x="${x - enhancedCandleWidth/2}" y="${bodyTop}" width="${enhancedCandleWidth}" height="${bodyHeight}" fill="${color}" />
    `;
  });
  
  // 添加指标信息
  svgContent += `
      <!-- 指标信息 -->
      <g font-family="Arial" font-size="14" font-weight="bold">
        <text x="${width - padding.right + 10}" y="${padding.top + 25}" fill="#60a5fa">
          价格: ${indicators.currentPrice.toFixed(2)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 50}" fill="#f87171">
          EMA20: ${indicators.ema20.toFixed(2)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 75}" fill="#34d399">
          EMA50: ${indicators.ema50.toFixed(2)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 100}" fill="#fbbf24">
          RSI: ${indicators.rsi.toFixed(1)}
        </text>
        <text x="${width - padding.right + 10}" y="${padding.top + 125}" fill="#a78bfa">
          MACD: ${indicators.macd.toFixed(4)}
        </text>
      </g>
      
      <!-- 时间轴 -->
      <g font-family="Arial" font-size="10" fill="#a0aec0">
  `;
  
  // 添加时间轴标签
  const timeLabels = [];
  const labelCount = Math.min(12, klineData.length); // 增加标签数量
  const step = Math.floor(klineData.length / labelCount);
  
  for (let i = 0; i < labelCount; i++) {
    const index = Math.min(i * step, klineData.length - 1);
    const candle = klineData[index];
    const x = padding.left + candleSpacing * index + candleSpacing / 2;
    
    let timeLabel = '';
    if (timeframe.includes('m')) {
      // 分钟级别
      const date = new Date(candle.timestamp);
      timeLabel = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (timeframe.includes('h')) {
      // 小时级别
      const date = new Date(candle.timestamp);
      timeLabel = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
    } else if (timeframe.includes('d')) {
      // 日线级别
      const date = new Date(candle.timestamp);
      timeLabel = `${date.getMonth() + 1}/${date.getDate()}`;
    } else {
      // 默认显示时间戳
      timeLabel = new Date(candle.timestamp).toLocaleTimeString();
    }
    
    svgContent += `
      <text x="${x}" y="${height - padding.bottom + 25}" text-anchor="middle" fill="#a0aec0" font-family="Arial" font-size="12" font-weight="bold">
        ${timeLabel}
      </text>
    `;
  }
  
  svgContent += `
      </g>
    </svg>
  `;
  
  // 返回原始SVG内容
    return svgContent;
}

/**
 * 运行模式识别分析
 */
export async function runPatternAgent(imageBase64: string, symbol: string, timeframe: string): Promise<string> {
  try {
    // 使用环境变量配置视觉模型
    const visionApiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
    const visionBaseUrl = process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const visionModelName = process.env.VISION_MODEL_NAME || "qwen3-vl-plus";

    // 检查base64数据是否有效
    if (!imageBase64) {
      throw new Error("未找到PNG图像数据");
    }
    
    // 验证base64数据长度
    if (imageBase64.length === 0) {
      throw new Error("图像数据为空");
    }

    // 创建OpenAI客户端
    const openai = new OpenAI({
      apiKey: visionApiKey,
      baseURL: visionBaseUrl,
    });

    // 使用OpenAI SDK直接调用视觉模型
    const response = await openai.chat.completions.create({
      model: visionModelName,
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
              text: `这是一张 ${symbol} 在 ${timeframe} 周期的 K 线图，请说明是否存在可交易的经典形态、形态阶段以及多空含义。`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("AI模型未能识别出有效形态，请勿参考此分析结果。");
    }
    return content;
    
  } catch (error) {
    logger.error("模式识别分析失败:", error);
    throw new Error(`模式识别分析失败: ${error.message}`);
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
    // 生成K线图（返回base64编码）
    const chartBase64 = await generateCandlestickChart(symbol, timeframe);
    
    // 运行模式识别分析
    const analysis = await runPatternAgent(chartBase64, symbol, timeframe);
    
    return {
      chart: chartBase64, // 返回base64编码
      analysis
    };
  } catch (error) {
    logger.error("获取模式分析失败:", error);
    
    // 返回有意义的错误信息，而不是抛出异常
    return {
      chart: "",
      analysis: `模式识别分析失败: ${error.message}. 可能原因：数据获取异常、K线图生成失败。建议检查数据源连接或稍后重试。`
    };
  }
}