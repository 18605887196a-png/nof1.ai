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
* K线图生成和模式识别工具
*/




import {tool} from "@voltagent/core";
import OpenAI from 'openai';
import {createLogger} from "../../utils/loggerUtils";
import {createGateClient} from "../../services/gateClient";
import {calculateIndicators} from "./marketData";
import {z} from "zod";
import svg2img from 'svg2img';
import {promisify} from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {captureCoingleassChart} from '../../utils/coinglassScreenshot';
import { logDecisionConclusion } from '../../utils/decisionLogger';
import { sendVisionAnalysisNotification } from '../../services/telegramBot';








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
      const indicators = calculateIndicators(candles,symbol,timeframe);




      // 格式化K线数据，提取必要的价格信息和时间戳
      const formattedKlines = candles.map((candle: any) => ({
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
      throw new Error(`生成K线图失败: ${error instanceof Error ? error.message : String(error)}`);
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
  execute: async ({symbol, timeframe, limit}) => {
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




/**
* 多图模式识别分析工具
* 同时抓取主趋势周期和入场周期图表，进行多周期综合分析
*/
const patternAnalysisMultiTool = tool({
  name: "patternAnalysisMulti",
  description: "基于Coinglass图表截图，同时对主趋势周期（1h/4h）和入场周期（15m/1h）进行视觉与资金结构综合分析，返回多周期共振的交易决策结论。适用于寻找最佳入场时机和确认趋势方向。",
  parameters: z.object({
      symbol: z
          .enum(["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "AVAX", "DOT", "MATIC"])
          .describe("币种代码"),
      mainTimeframe: z
          .enum(["1h", "4h"])
          .default("1h")
          .describe("主趋势周期，用于判断主要趋势方向"),
      entryTimeframe: z
          .enum(["15m", "1h"])
          .default("15m")
          .describe("入场周期，用于寻找具体入场时机"),
  }),
  execute: async ({symbol, mainTimeframe, entryTimeframe}) => {
      try {
          // 并行抓取两个周期的图表
          const [mainChartResult, entryChartResult] = await Promise.all([
              captureCoingleassChart(symbol, mainTimeframe),
              captureCoingleassChart(symbol, entryTimeframe)
          ]);




          // 运行多图模式识别分析（默认关闭思考过程，只返回结果）
          const analysis = await runPatternAgentMulti(
              mainChartResult,
              entryChartResult,
              symbol,
              mainTimeframe,
              entryTimeframe,
              false  // 关闭思考过程，只返回最终结果
          );




          // 记录视觉决策结论
          logDecisionConclusion('视觉', symbol, analysis, {
              mainTimeframe,
              entryTimeframe
          });
         
          // 返回综合分析结果，不包含base64图像数据以节省token
          return {
              symbol,
              mainTimeframe,
              entryTimeframe,
              analysis: analysis,
              timestamp: new Date().toISOString(),
              success: true
          };
      } catch (error) {
          return {
              symbol,
              mainTimeframe,
              entryTimeframe,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
              success: false
          };
      }
  },
});




// 导出工具函数
export {generateCandlestickChartTool, patternAnalysisMultiTool};








/**
* 保存PNG文件到本地
*/
async function savePngToLocal(buffer: Buffer, symbol: string, timeframe: string): Promise<string> {
  try {
      // 创建输出目录
      const outputDir = path.join(process.cwd(), 'pattern-images');
      if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, {recursive: true});
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
      throw new Error(`PNG文件保存失败: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error(`PNG文件保存失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}








/**
* 将SVG转换为PNG格式的base64字符串（高清质量）
*/
async function convertSvgToPng(svgContent: string, symbol?: string, timeframe?: string): Promise<string> {
  try {
      // 提高图像质量设置（与SVG绘制分辨率保持一致）
      const buffer = await svg2imgAsync(svgContent);








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








              mockKlines.push({open, high, low, close});
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
      throw new Error(`K线图生成失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}








/**
* 绘制K线图SVG
*/
function drawCandlestickSVG(
  klineData: Array<{ open: number, high: number, low: number, close: number, timestamp?: number }>,
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
  const padding = {top: 50, right: 150, bottom: 80, left: 80}; // 增加边距
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
 <text x="${width / 2}" y="35" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="20" font-weight="bold">
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
 <rect x="${x - enhancedCandleWidth / 2}" y="${bodyTop}" width="${enhancedCandleWidth}" height="${bodyHeight}" fill="${color}" />
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
  const labelCount = Math.min(15, klineData.length); // 增加标签数量以显示更多时间点








  // 优化标签选择逻辑，确保时间标签在整个范围内均匀分布
  const indices = [];








  // 如果数据点足够多，使用更智能的分布策略
  if (klineData.length > labelCount) {
      // 计算总时间范围
      const startTime = klineData[0]?.timestamp || 0;
      const endTime = klineData[klineData.length - 1]?.timestamp || 0;
      const totalTimeRange = endTime - startTime;








      // 基于时间间隔均匀选择标签，而不仅仅是基于索引
      for (let i = 0; i < labelCount; i++) {
          // 计算当前标签的目标时间点
          const targetTime = startTime + (totalTimeRange * i / (labelCount - 1));








          // 找到最接近目标时间的索引
          let closestIndex = 0;
          let minTimeDiff = Infinity;








          // 为了性能，我们只在关键区域搜索
          const searchStart = Math.floor((klineData.length - 1) * (i - 0.1) / (labelCount - 1));
          const searchEnd = Math.floor((klineData.length - 1) * (i + 0.1) / (labelCount - 1));








          for (let j = Math.max(0, searchStart); j <= Math.min(klineData.length - 1, searchEnd); j++) {
              const currentTime = klineData[j]?.timestamp || 0;
              const timeDiff = Math.abs(currentTime - targetTime);








              if (timeDiff < minTimeDiff) {
                  minTimeDiff = timeDiff;
                  closestIndex = j;
              }
          }








          // 确保不重复添加索引
          if (!indices.includes(closestIndex)) {
              indices.push(closestIndex);
          }
      }








      // 确保包含首尾点
      if (!indices.includes(0)) {
          indices.unshift(0);
      }
      if (!indices.includes(klineData.length - 1)) {
          indices.push(klineData.length - 1);
      }
  } else {
      // 数据点较少时，直接使用所有索引
      for (let i = 0; i < klineData.length; i++) {
          indices.push(i);
      }
  }








  // 按索引排序并去重
  indices.sort((a, b) => a - b);








  // 遍历选中的索引生成标签
  for (const index of indices) {
      const candle = klineData[index];
      const x = padding.left + candleSpacing * index + candleSpacing / 2;








      let timeLabel = '';
      try {
          // 改进的时间戳验证和转换逻辑
          const timestamp = candle.timestamp;








          // 详细的日志记录用于调试








          if (timestamp && typeof timestamp === 'number') {
              // 确保时间戳是有效的（检查是否为有限数字且不是NaN）
              if (isFinite(timestamp) && !isNaN(timestamp)) {
                  // 转换为正确的日期对象
                  const date = new Date(timestamp);








                  // 再次验证Date对象的有效性
                  if (!isNaN(date.getTime())) {
                      // 根据时间框架使用不同的格式化策略
                      if (timeframe.includes('m')) {
                          // 检查时间戳是否需要从秒转换为毫秒
                          // 通常API返回的Unix时间戳可能是秒级的，需要转换为毫秒级
                          let timestampMs = timestamp;
                          // 如果时间戳小于1e12，很可能是秒级时间戳，需要转换为毫秒
                          if (timestampMs < 1000000000000) {
                              timestampMs = timestampMs * 1000;








                          }








                          // 使用转换后的时间戳创建Date对象
                          const correctedDate = new Date(timestampMs);








                          // 分钟级别 - 使用本地时区并显示时分
                          const hours = correctedDate.getHours().toString().padStart(2, '0');
                          const minutes = correctedDate.getMinutes().toString().padStart(2, '0');
                          timeLabel = `${hours}:${minutes}`;








                          // 对于1m和5m等小周期，每小时显示一次完整日期
                          if (minutes === '00') {
                              const month = (correctedDate.getMonth() + 1).toString().padStart(2, '0');
                              const day = correctedDate.getDate().toString().padStart(2, '0');
                              timeLabel = `${month}/${day} ${hours}:00`;
                          }
                      } else if (timeframe.includes('h')) {
                          // 检查时间戳是否需要从秒转换为毫秒
                          let timestampMs = timestamp;
                          if (timestampMs < 1000000000000) {
                              timestampMs = timestampMs * 1000;








                          }
                          const correctedDate = new Date(timestampMs);








                          // 小时级别 - 显示月日和小时
                          const month = (correctedDate.getMonth() + 1).toString().padStart(2, '0');
                          const day = correctedDate.getDate().toString().padStart(2, '0');
                          const hours = correctedDate.getHours().toString().padStart(2, '0');
                          timeLabel = `${month}/${day} ${hours}:00`;
                      } else if (timeframe.includes('d')) {
                          // 检查时间戳是否需要从秒转换为毫秒
                          let timestampMs = timestamp;
                          if (timestampMs < 1000000000000) {
                              timestampMs = timestampMs * 1000;








                          }
                          const correctedDate = new Date(timestampMs);








                          // 日线级别 - 显示月日
                          const month = (correctedDate.getMonth() + 1).toString().padStart(2, '0');
                          const day = correctedDate.getDate().toString().padStart(2, '0');
                          timeLabel = `${month}/${day}`;
                      } else {
                          // 检查时间戳是否需要从秒转换为毫秒
                          let timestampMs = timestamp;
                          if (timestampMs < 1000000000000) {
                              timestampMs = timestampMs * 1000;








                          }
                          const correctedDate = new Date(timestampMs);








                          // 默认格式 - 使用更明确的格式
                          timeLabel = correctedDate.toLocaleString('zh-CN', {
                              year: '2-digit',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                          });
                      }








                  } else {
                      timeLabel = `T${i}`;
                  }
              } else {
                  console.log(`[DEBUG] 索引${index}的时间戳不是有效数字`);
                  timeLabel = `T${i}`;
              }
          } else {
              // 时间戳不存在或不是数字类型
              console.log(`[DEBUG] 索引${index}的时间戳不存在或类型错误`);
              // 创建相对时间标签，使用距离当前的分钟数
              const relativeMinutes = (klineData.length - 1 - index) * getMinutesFromTimeframe(timeframe);
              timeLabel = `-${relativeMinutes}m`;
          }
      } catch (error) {
          // 出错时显示索引和错误信息
          console.log(`[DEBUG] 索引${index}时间格式化错误:`, error);
          timeLabel = `#${index}`;
      }








      // 辅助函数：根据时间框架获取分钟数
      function getMinutesFromTimeframe(tf: string): number {
          if (tf.includes('m')) {
              return parseInt(tf.replace('m', '')) || 1;
          } else if (tf.includes('h')) {
              return (parseInt(tf.replace('h', '')) || 1) * 60;
          } else if (tf.includes('d')) {
              return (parseInt(tf.replace('d', '')) || 1) * 24 * 60;
          }
          return 1;
      }








      // 使用旋转变换确保文本更好地显示，避免重叠
      svgContent += `
 <text x="${x}" y="${height - padding.bottom + 25}" text-anchor="middle" fill="#a0aec0" font-family="Arial" font-size="12" font-weight="bold" transform="rotate(-30, ${x}, ${height - padding.bottom + 25})">
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
* 三图模式识别分析工具（1h + 15m + 5m）
* 用于视觉结构：主趋势（1h）+ 入场结构（15m）+ 微确认（5m）
*/
export const patternAnalysisTripleTool = tool({
   name: "patternAnalysisTriple",
   description: "基于Coinglass三周期（1h/15m/5m）同时捕获图表并进行视觉结构、资金结构、反打点识别与多周期共振分析。适用于稳健Swing（日内）策略。",
   parameters: z.object({
       symbol: z.enum([
           "BTC", "ETH", "SOL", "BNB",
           "ADA", "XRP", "DOGE", "AVAX",
           "DOT", "MATIC"
       ]).describe("交易币种"),


       mainTimeframe: z.enum(["1h"]).default("1h"),
       entryTimeframe: z.enum(["15m"]).default("15m"),
       microTimeframe: z.enum(["5m"]).default("5m")
   }),


   execute: async ({ symbol, mainTimeframe, entryTimeframe, microTimeframe }) => {
       try {
           // ✅ 捕获三张 Coinglass 图
           const [
               mainChartResult,
               entryChartResult,
               microChartResult
           ] = await Promise.all([
               captureCoingleassChart(symbol, mainTimeframe),   // 1h
               captureCoingleassChart(symbol, entryTimeframe),  // 15m
               captureCoingleassChart(symbol, microTimeframe)   // 5m
           ]);


           // ✅ 调用视觉三图分析器（你的 runPatternAgentTriple）
           const analysis = await runPatternAgentTriple(
               mainChartResult,
               entryChartResult,
               microChartResult,
               symbol,
               false
           );


           // ✅ 记录视觉决策
           logDecisionConclusion("视觉（三图）", symbol, analysis, {
               mainTimeframe,
               entryTimeframe,
               microTimeframe
           });
           
            // ✅ 发送 Telegram 通知
           await sendVisionAnalysisNotification({
               symbol,
               mainTimeframe,
               entryTimeframe,
               microTimeframe,
               analysis,
               timestamp: new Date().toISOString()
           }).catch(err => {
               logger.warn(`发送视觉分析 Telegram 通知失败: ${err.message}`);
           });

           // ✅ 返回结构（不含base64节省token）
           return {
               symbol,
               mainTimeframe,
               entryTimeframe,
               microTimeframe,
               analysis,
               timestamp: new Date().toISOString(),
               success: true
           };
       } catch (err) {
           return {
               symbol,
               mainTimeframe,
               entryTimeframe,
               microTimeframe,
               error: err instanceof Error ? err.message : String(err),
               timestamp: new Date().toISOString(),
               success: false
           };
       }
   }
});

export async function runPatternAgentTriple(
   mainChartBase64: string,     // 1h
   entryChartBase64: string,    // 15m
   microChartBase64: string,    // 5m
   symbol: string,
   enableThinking: boolean = false
): Promise<string> {
   try {
       const apiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
       const baseUrl = process.env.VISION_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
       const model = process.env.VISION_MODEL_NAME || "qwen3-vl-plus";


       if (!mainChartBase64 || !entryChartBase64 || !microChartBase64) {
           throw new Error("缺少图像数据（1h/15m/5m），请检查截图管道。");
       }


       const openai = new OpenAI({ apiKey, baseURL: baseUrl });


       const response = await openai.chat.completions.create({
           model,
           messages: [
               {
                   role: "system",
                   content:`你是一名专业的“视觉结构 + 多周期共振”分析师。  
你基于三张 Coinglass 图（1h 主趋势 + 15m 入场结构 + 5m 节奏）输出可用于稳健 Swing（日内波段）交易的结构化分析。

============================================================
【图像结构说明 —— 必须理解】

当前三张图包含且仅包含以下六项有效信息：

（结构类）
1. K线结构（趋势段、中继、反转、假突破、LH/HL、衰竭）
2. VPVR（成交密度：高密度＝阻力/支撑，低密度＝快速通道）
3. 成交量 Volume

（动能类）
4. Spot CVD（现货主动买卖力）
5. Futures CVD（永续/合约主动买卖力）

（仓位类）
6. OI（持仓量）K线

这六类信息构成你整个分析的基础，不可忽略，也不可替代。

============================================================
【极其重要：正确处理左上角 OHLC（四个数字）】

每张图左上角会显示「开、高、低、收」四个数字（OHLC）。
你必须严格遵守以下规则：

- 它们只代表最新一根 K 线的价格标签（当前时刻）
- 它们不是结构点位
- 不代表行情高点/低点
- 与趋势判断无关
- 与 LH/HL、假突破、支撑/阻力无关
- 不能参与任何入场区判断
- 不能参与 Swing 决策

你必须将 OHLC 完全视为「单根 K线的信息标签」，  
禁止将其视为图表结构的一部分。

============================================================
【必须忽略的内容】

图中除上述六项信息以外的内容全部忽略，包括但不限于：

- 右侧所有内容（币种列表、行情、涨跌幅、统计数据）
- 订单簿 / 深度相关信息（已不存在，但必须确认忽略）
- 图上任何提示框、标签、颜色装饰
- 任何非结构性文字

这些内容与结构、动能、入场区无关，不得用于决策。

============================================================
【三图职责与分析框架】

【1h 主趋势图】
你只需判断：
- 趋势方向：多 / 空 / 震荡偏多 / 震荡偏空
- 结构类型：趋势段、中继、箱体、震荡中心、粘滞区
- 是否位于不可交易区：POC、箱体中轴、极低波动密集区

【15m 入场图】
你判断：
- 是否存在反打点结构（LH/HL、假突破/假跌破、CVD 背离、衰竭）
- 是否存在中继（上涨中继 / 下跌中继）
- 是否接近 VPVR 边缘（允许入场）
- 若位于 POC 或箱体中轴 → 必须给“不可交易区”

【5m 微确认图】
输出四选一：
- 有利  
- 中性  
- 轻微不利  
- 明显不利（唯一禁止执行）

5m 只能过滤节奏，不得反转 1h 方向。

============================================================
【反打点标准（Swing 核心）】

反打点成立（满足任意一项即可）：
- LH / HL  
- 假突破 / 假跌破  
- CVD 顶背离 / 底背离  
- 上影/下影多次拒绝  
- 缩量反弹（做空）/ 缩量回调（做多）  
- 波段衰竭（明显减弱）  
- VPVR 边缘拒绝  

不要求 textbook 完美形态。

============================================================
【入场区要求】

需要给两个区间（至少 Primary）：
- Primary（主要区间）  
- Secondary（可选，宽区间，容错更高）

规则：
- 区间宽度 300～1200 美金  
- 不得给精确点位  
- 不得给狭窄区间  

若不可交易 → 必须写：
“入场区：无”

============================================================
【NO TRADE ZONE（必须执行）】

任意满足以下条件 → 直接输出“不可交易，入场区：无”
- VPVR POC 核心区  
- 箱体震荡中轴  
- 极低波动 / 噪音时间  
- 三角形收敛中段  
- 假突破后的粘滞中心  
- K线无序重叠（垃圾区）

============================================================
【资金结构简述】
简洁总结主动买卖力量，如：
- “Spot CVD 持续流出，反弹虚弱”
- “OI 上升 + CVD 上升，动能真实”
- “反弹多为空头回补”

============================================================
【输出格式（必须遵守）】

【1h 主趋势结构】  
【15m 入场结构】  
【5m 微确认】  
【资金结构简述】  
【信号评级（A/B/C/D + 分数）】  
【建议方向】（多 / 空 / 观望）  
【入场区】（Primary / Secondary 或 “无”）  
【风险提示（≤ 2 条）】

禁止：
- 长段落  
- 模糊表达  
- 超过两条风险提示  
- 精确价格点位  
- 5m 反转 1h  
- 将 OHLC 或任何非结构数据用于判断

请按上述结构输出短、准、可执行的视觉 Swing 分析。`
               },
               {
                   role: "user",
                   content: [
                       { type: "text", text: `以下为 ${symbol} 的 1h（主趋势） + 15m（入场） + 5m（微确认）三张图，请按 Swing 结构分析：` },
                       { type: "image_url", image_url: { url: `data:image/png;base64,${mainChartBase64}`, detail: "high" }},
                       { type: "image_url", image_url: { url: `data:image/png;base64,${entryChartBase64}`, detail: "high" }},
                       { type: "image_url", image_url: { url: `data:image/png;base64,${microChartBase64}`, detail: "high" }},
                   ]
               }
           ],
           max_completion_tokens: 4096,
           temperature: 0.2,
           enable_thinking: enableThinking,
           stream: false
       });


       const finalContent = response.choices[0]?.message?.content?.trim();
       if (!finalContent) throw new Error("视觉模型未返回结果。");


       return finalContent;


   } catch (err) {
       console.error(`[${symbol}] 视觉分析请求失败，转为默认观望状态:`, err);
       return `
【1h 主趋势结构】数据获取失败
【15m 入场结构】无法分析
【5m 微确认】中性
【资金结构简述】无
【信号评级（A/B/C/D + 分数）】D 0
【建议方向】观望
【入场区】无
【风险提示】
1. 视觉模型 API 连接异常
2. 系统自动触发风控保护`;
   }
}