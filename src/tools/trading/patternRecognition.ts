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
* 运行多图模式识别分析（主趋势周期 + 入场周期）
* 一次性分析两张图并给出综合结论
* @param enableThinking 是否启用思考过程（默认false，只返回结果）
*/
export async function runPatternAgentMulti(
   mainChartBase64: string,
   entryChartBase64: string,
   symbol: string,
   mainTimeframe: string,
   entryTimeframe: string,
   enableThinking: boolean = false
): Promise<string> {
   try {
       // 使用环境变量配置视觉模型
       const visionApiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
       const visionBaseUrl = process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
       const visionModelName = process.env.VISION_MODEL_NAME || "qwen3-vl-plus";
       enableThinking = true;


       // 检查图像数据
       if (!mainChartBase64 || !entryChartBase64) {
           throw new Error("缺少图表图像数据");
       }


       // 创建OpenAI客户端
       const openai = new OpenAI({
           apiKey: visionApiKey,
           baseURL: visionBaseUrl,
       });


       // 构建请求参数
        const requestParams: any = {
           model: visionModelName,
           messages: [
               {
                   role: "system",
                   content: `你是一名专业量化交易员与链上资金流分析师。 
你的任务：基于两张不同时间周期的 Coinglass 图表（主趋势周期 + 入场周期），
先从“趋势结构 + 区间位置 + 资金流向”三个维度判断当前所处阶段，
再用 K 线 OHLC 形态作为辅助证据，最终给出可用于交易决策的综合结论。

本次图表说明： 
- 主趋势周期：${mainTimeframe}（决定主要方向与所处阶段，例如 1 小时图）； 
- 入场周期：${entryTimeframe}（用于寻找具体入场时机，例如 15 分钟图）。

────────────────────
【一、先看趋势与结构（再看形态）】

1. 趋势与区间结构（优先级最高）
  - 明确判断主趋势属于哪一类：
    • 单边上涨 / 单边下跌； 
    • 大跌后的技术性反弹； 
    • 下跌中继； 
    • 底部震荡； 
    • 区间震荡。
  - 从价格整体走势 + VPVR（右侧成交量分布）抽象出：
    • 主要交易区间（例如“86,000–87,000 横盘区”）； 
    • 关键高低点（最近明显高点/低点）； 
    • 最粗粒度的阶段：初期 / 中期 / 末期。
  - 利用 VPVR：
    • 标出成交最密集的价带（POC）； 
    • 标出上、下两个主要成交峰值，作为强支撑/强阻力区域。

2. 资金曲线的趋势形态（第二优先）
  - 现货/期货 CVD：
    • 整体是在持续抬升、持续下行还是横盘？ 
    • 是否出现价格创新高而 CVD 未创新高（顶背离），或价格创新低而 CVD 未创新低（底背离）。
  - OI（持仓量）：
    • 整体趋势：上升 = 加杠杆；下降 = 去杠杆；横盘 = 仓位稳定； 
    • 结合价格方向判断：多头加仓 / 空头加仓 / 多头止盈 / 空头回补。
  - Funding / 持仓平均成本：
    • 是接近零、温和正、极端正还是负数？ 
    • 高位正费率 + OI 高位 = 多头拥挤，存在杀多风险。
  - Bid/Ask Delta + 成交量：
    • 买卖盘净流向是否与价格同向； 
    • 放量 + Delta 同向 = 趋势确认；放量 + Delta 反向 = 可能阶段拐点。

3. K 线形态（作为趋势判断的辅助证据，而不是首要目标）
  - 请基于 K 线 OHLC（开高低收）观察：
    • 是否出现明显的长上影/长下影、大实体长阴/长阳、长腿十字等极端单根形态； 
    • 是否有多根连续长阴/长阳、明显收敛三角、箱体震荡等结构；
  - 不必枚举所有形态名称，只需用这些形态来**解释和佐证**你对趋势阶段的判断 
    （例如：“在 87K 阻力区多次出现长上影 + 放量回落 → 反弹尾声、卖压明显”）。

在整个分析中，优先给出：
- “这是哪一段趋势/中继/震荡 + 当前在区间的什么位置 + 资金偏多还是偏空”， 
K 线形态只用来支撑你的结论，不要把重心放在形态名字上。

────────────────────
【二、主趋势周期分析（${mainTimeframe}）】

1. 整体趋势结构（先趋势，再形态）
  - 当前更像：单边上涨 / 单边下跌 / 大跌后的技术性反弹 / 下跌中继 / 底部震荡 / 区间震荡？
  - 明确给出趋势阶段：初期 / 中期 / 末期，并说明依据：
    • 例如：“从 95K 大跌到 86K 后，在 86K–87K 区间横盘 → 典型大跌后的底部震荡中期”； 
    • 或“连续更低高点 + OI 上升 → 下跌中继中期”。

2. 主力资金行为（基于 CVD/OI/Funding/Delta）
  - 说明当前更像是在：
    • 吸筹（价横/微升 + OI 微升 + CVD 上行）； 
    • 派发（价横/微跌 + OI 高位 + CVD 下行）； 
    • 洗盘/换手（价横 + OI 缓慢下行 + CVD 来回震荡）； 
    • 空头回补（价升 + OI 降 + CVD 仍为负）； 
    • 多头止盈（价跌或横盘 + OI 降 + CVD 仍为正）。
  - 使用“价+OI 象限”的语言辅助解释（价↑OI↑，价↑OI↓，价↓OI↑，价↓OI↓）。

3. 关键价位（必须给出具体数字或窄区间）
  - 主支撑区：如“85,500–85,800”（近期多次止跌区 + VPVR 密集区 + CVD 拐点）； 
  - 主阻力区：如“86,800–87,200”（VPVR 高成交区 + 多次冲高回落）； 
  - 结构止损参考位：如“跌破 85,200 则本轮反弹/底部结构失效”。

────────────────────
【三、入场周期分析（${entryTimeframe}）】

1. 当前技术位置（先看在大结构中的位置）
  - 属于：趋势发展段 / 回调段 / 反弹尾段 / 杀多/杀空尾段 / 区间中部？ 
  - 相对于主趋势关键支撑/阻力的位置：
    • 是否已经贴近主支撑（如 85,500 一带）； 
    • 还是贴近主阻力（如 87,000 一带）； 
    • 还是停在区间中部无优势区域。

2. 短期资金行为（入场周期 CVD/OI/Delta）
  - 短期 CVD 是否与价格同步上升/下降，还是出现背离？ 
  - 短期 OI 是增加/减少，说明是有一方开始主动加仓还是整体平仓？ 
  - 成交量是否放大/萎缩，配合价格方向说明短期动能。

3. 入场周期的 K 线信号（辅助）
  - 指出是否出现“反弹衰竭”的形态（如多次长上影 + 成交量减弱）； 
  - 或“回调结束”的形态（如在支撑附近长下影 + 成交量放大）； 
  - 用这些形态来支持你对“是否适合作为入场窗口”的判断。

────────────────────
【四、多周期综合结论】

1. 信号一致性评估
  - 主趋势与入场周期是同向共振，还是方向矛盾，还是共同震荡？ 
  - 给出简短判断：
    • “1h 下跌中继 + 15m 反弹尾段贴阻力 → 顺势做空窗口”； 
    • “1h 反弹初期 + 15m 回调至主支撑 → 顺势做多窗口”； 
    • “两周期都震荡，无优势结构 → 观望”。


2. 明确操作定位
  - 当前信号更适合：
    • 【新开仓】（偏多或偏空，说明核心理由：趋势阶段 + 资金行为 + 区间位置 + RR）； 
    • 【持仓管理】（适合做的是减仓、加仓还是移动止损）； 
    • 【观望】（结构矛盾、RR 不划算或不在合理入场区）。


3. 信号评级
  - 给出 0–10 分评分，并用 A/B/C/D 标记：
    • A：8–10 分，趋势结构清晰 + 资金行为共振 + 价位位置理想 + RR 优秀； 
    • B：6–8 分，结构较好，但有一些限制（贴强阻力、OI 高位、空间有限等）； 
    • C：4–6 分，结构一般或信号冲突，仅可轻仓试探； 
    • D：0–4 分，结构矛盾或噪音较多，建议观望。


────────────────────
【五、理论执行方案（与账户无关，基于图形结构）】


- 方向选择：做多 / 做空 / 观望（必须选一个主方向）； 
- 入场逻辑：
 • 明确触发条件（例如“价格反弹至 86,800–87,000 且 CVD 仍为负，OI 不再下降时做空”）； 
 • 给出入场区间 [L,H]（例如 "86800–87100"），若不建议入场写“无”并说明原因； 
- 止损设置：结构止损价位（例如 “87350” 或 “跌破 85,200”）； 
- 第一目标价：合理的首目标区（例如 “85,500–85,800”）； 
- 粗略 RR：基于入场区间中点估算止损/目标的百分比和 RR（例如“止损约 0.6%，目标约 1.8%，RR≈1:3”）； 
- 仓位建议：仅用文字说明信号强弱对应的轻仓/中仓（例如“A 级可中等仓位，B 级建议 20–30% 资金，C 级仅小仓试探”）。


────────────────────
【六、风险控制与失效条件】


1. 主要风险提示
  - 例如：
    • “OI 高位 + Funding 正值，若继续上冲存在杀多风险”； 
    • “下方支撑距离很近，上方空间有限，RR 不足”等。


2. 结构失效条件
  - 明确写出：什么价格 + 哪些资金行为变化，会直接否决当前方向（例如“放量突破 87,500 + CVD 转正 + OI 放量上升”）。


3. 反向信号识别
  - 说明：出现什么组合信号需要考虑反向思路（如“跌破 85,200 + CVD 加速下行 + OI 上升 → 多头结构失败，应转为空头思路”）。


────────────────────
【七、结构化摘要（必须严格按以下格式输出）】


[SUMMARY]
main_trend_direction: 多头 / 空头 / 震荡
main_trend_stage: 初期 / 中期 / 末期
market_state: 趋势 / 震荡
entry_action_type: 新开仓 / 持仓管理 / 观望
entry_direction: 做多 / 做空 / 无
entry_zone: 例如 "86050-86200"，若不建议入场写 "无"
stop_loss: 例如 "86550"，若无结构止损写 "无"
first_target: 例如 "85500-85650"，若无写 "无"
signal_level: A / B / C / D
signal_score: 0-10 的数字
support_levels: 逗号分隔支撑位，例如 "85200, 84500"，若无写 "无"
resistance_levels: 逗号分隔阻力位，例如 "86800, 87500"，若无写 "无"
primary_risk: 用一句话概括最主要风险
[/SUMMARY]`
               },
               {
                   role: "user",
                   content: [
                       {
                           type: "text",
                           text: `这是 ${symbol} 的多周期 Coinglass 图表：


图片1：主趋势周期（${mainTimeframe}）- 用于判断主要趋势方向和资金结构 
图片2：入场周期（${entryTimeframe}）- 用于寻找具体入场时机


请按照上述框架进行综合分析，重点关注：
1. 主趋势周期的趋势结构（上涨/下跌/中继/震荡）和资金曲线（CVD/OI/Funding/Delta）指向的方向；
2. 入场周期在主支撑/主阻力附近是否提供良好的风险收益比入场机会；
3. 两个周期的信号是同向共振，还是方向矛盾（短周期为顺势入场的反向波动）；
4. 当前更适合新开仓、持仓管理，还是观望；
5. 基于趋势结构、资金曲线和K线形态，给出具体关键价位（支撑/阻力/入场区间/止损/目标）和主要风险控制措施。`
                       },
                       {
                           type: "image_url",
                           image_url: {
                               url: `data:image/png;base64,${mainChartBase64}`,
                               detail: "high"
                           },
                       },
                       {
                           type: "image_url",
                           image_url: {
                               url: `data:image/png;base64,${entryChartBase64}`,
                               detail: "high"
                           },
                       },
                   ],
               },
           ],
           max_completion_tokens: 8192,
           temperature: 0.2,
       };

       if (enableThinking) {
           logger.info(`[${symbol}] 视觉模型思考模式已开启，正在进行深度推理...`);
           requestParams.enable_thinking = true;
           requestParams.stream = true; // 强烈建议开启流式，防止超时
           requestParams.thinking_budget = 4096; // 设置思考过程的最大 Token 预算
       } else {
           requestParams.enable_thinking = false;
           requestParams.stream = false;
       }


       // 使用OpenAI SDK调用视觉模型进行多图分析
       const response = await openai.chat.completions.create(requestParams);


       let finalContent = '';
       let reasoningContent = '';


       // 【关键修改点】正确处理流式和非流式响应
       if (requestParams.stream) {
           // === 处理流式响应 (Thinking 模式必须) ===
           logger.info("开始接收流式响应...");
           // 将响应强制转换为异步迭代器
           const stream = response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;


           for await (const chunk of stream) {
               const delta = chunk.choices[0]?.delta;
               if (!delta) continue;


               // 1. 处理思考过程 (reasoning_content)
               // 注意：OpenAI Node SDK 的类型定义可能还不包含 reasoning_content，使用 as any 绕过TS检查
               if ((delta as any).reasoning_content) {
                   reasoningContent += (delta as any).reasoning_content;
                   // 可选：实时打印思考过程 (调试用)
                   // process.stdout.write((delta as any).reasoning_content);
               }


               // 2. 处理最终回答 (content)
               if (delta.content) {
                   finalContent += delta.content;
               }
           }
           logger.info(`流式响应结束。思考过程长度: ${reasoningContent.length}, 最终回复长度: ${finalContent.length}`);


           // 如果需要，可以记录完整的思考过程到日志
           if (reasoningContent) {
               logger.debug(`完整思考过程 (${symbol}):\n${reasoningContent}`);
           }


       } else {
           // === 处理非流式响应 (普通模式) ===
           const completion = response as OpenAI.Chat.Completions.ChatCompletion;
           finalContent = completion.choices[0]?.message?.content?.trim() || '';
       }


       // 最终检查
       if (!finalContent) {
           // 如果只有思考过程没有最终结果，可能是被 max_tokens 截断了
           if (reasoningContent && requestParams.stream) {
               logger.error("模型输出了思考过程，但未生成最终回复 (可能被截断)。");
               throw new Error("视觉模型分析中断，仅生成了思考过程。");
           }
           throw new Error(`视觉模型未能识别出${symbol}多周期图表的有效形态，请勿参考此分析结果。`);
       }


       // 记录结果摘要
       logger.info(`多图模式识别分析完成 (${symbol}): ${finalContent.substring(0, 100)}...`);


       return finalContent.trim();


   } catch (error) {
       logger.error("多图模式识别分析失败:", error);
       throw new Error(`多图模式识别分析失败: ${error instanceof Error ? error.message : String(error)}`);
   }
}

