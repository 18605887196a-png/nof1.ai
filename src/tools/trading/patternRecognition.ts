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


const patternAnalysisTool = tool({
   name: "patternAnalysis",
   description: "基于 Coinglass 图表截图，对价格走势、成交量、CVD、持仓量 OI、资金费率等进行视觉与资金结构综合分析，返回可用于交易决策的专业文字结论。",
   parameters: z.object({
       symbol: z.enum(["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "AVAX", "DOT", "MATIC"]).describe("币种代码"),
       timeframe: z.string().default("15m").describe("时间框架，如1m, 5m, 15m, 1h, 4h, 1d等"),
   }),
   execute: async ({symbol, timeframe}) => {
       try {
           // 使用统一的模式分析函数，包含错误处理
           const finalTimeframe = timeframe || "15m";
           const result = await getPatternAnalysis(symbol, finalTimeframe);


           // 优化返回数据：只返回分析摘要，不返回base64图像数据
           return {
               symbol,
               timeframe: finalTimeframe,
               analysis: result.analysis,
               timestamp: new Date().toISOString(),
               success: true
           };
       } catch (error) {
           const finalTimeframe = timeframe || "15m";
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
export {generateCandlestickChartTool, patternAnalysisTool};


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
                   content: `你是一名专业量化交易员与链上资金流分析师，当前任务是：根据我上传的交易图表截图，对该交易对进行完整、系统、深入的分析，并给出可直接用于交易决策的结论。


一、图表说明与指标范围


图表为 Coinglass 风格的多维面板，通常包含但不限于：


左侧主图：K 线价格 + 成交量（Volume）；
中下方若干资金与衍生品指标：
持仓量 OI（Open Interest）；
期货 CVD / 聚合合约累积成交量增量（Futures CVD）；
现货聚合 CVD（Spot CVD，若有）；
持仓加权平均资金费率（Funding Rate, Open Interest Weighted）；
期货买卖差 Bid & Ask Delta（若有）；
其他你能在图中清晰识别的指标；
右侧面板：当前品种价格、涨跌幅、24h 成交量、资金费率、多空比例/持仓分布、其它币种表现等（如果能看清，作为情绪和相对强弱的辅助参考）。
如果某些指标在截图中不存在或看不清，请在分析中明确说明“该指标本图中缺失或不清晰”，并不要编造数据。


二、指标拆解（逐项分析）


请先对图中“实际出现”的每一个指标进行拆解（没有的就略过），每项至少包含三点：


1）价格与成交量类


K 线价格：


说明它在专业交易中的作用：用于分析趋势结构、高低点和波段节奏，是判断当前是上升、下跌还是震荡阶段的基础；
分析当前截图中的关键特征：
整体趋势：最近一段时间是单边下跌、单边上涨、下跌后的反弹、上涨后的回调还是区间震荡；
最近高点/低点是持续抬高还是持续降低；
是否存在明显的区间整理、假突破/假跌破；
在关键位置（前高/前低、明显成交密集区附近）是否出现放量长影线、吞没、大实体 K 等关键行为信号；
如有明显形态（双顶/双底、头肩形态、楔形、三角形等），请指出，并说明只在结合 OI、CVD、成交量的前提下评估其可靠性，而不是仅凭形态下结论。
说明这些特征在经验上通常意味着什么（趋势延续、反转前兆、洗盘、诱多/诱空等）。
成交量 Volume：


说明它的作用：通过放量/缩量评估突破、跌破的有效性，识别放量趋势、缩量反弹、无量假突破等；
分析当前是放量下跌、放量上涨、缩量反弹、缩量震荡等；
说明这些量价配合在经验上意味着什么（趋势可靠性、行情衰竭、假动作概率等）。
2）衍生品资金与多空力量指标


持仓量 OI：


说明作用：判断杠杆资金是否在持续进场/离场，识别多空加仓/减仓，观察是否存在高位堆积和“踩踏”风险；
分析当前 OI 的绝对水平（相对近期是偏高、偏低还是中性）以及最近的变化方向（上升/下降/横盘）；
将 OI 与价格方向组合，说明当前主要处于：
价涨+OI涨、
价涨+OI跌、
价跌+OI涨、
价跌+OI跌
中的哪一象限，以及这在经验上对应“多头加仓、空头加仓、多头止盈、空头回补或去杠杆”等哪类行为。
聚合合约 CVD / 期货 CVD：


说明作用：用于判定主动买卖力量的方向和强度；
分析：
CVD 是整体上升、下降还是横向震荡；
CVD 与价格的关系：
CVD 上升而价格不涨/下跌 → 可能吸筹或逼空；
CVD 下降而价格不跌/上涨 → 可能派发或杀多；
CVD 与价格是否存在明显背离（价创新低但 CVD 未创新低等）。
说明这些行为通常意味着真涨/假涨、真跌/假跌、主力吃货/出货等。
现货聚合 CVD（如果有）：


说明作用：观察现货端资金是净买入还是净卖出，用于辅助判断“现货吸筹/派发”活动；
分析现货 CVD 的方向及其与价格、期货 CVD 的关系，说明更像是现货接筹还是现货出货。
持仓加权平均资金费率（Funding Rate）：


说明作用：反映全市场多空情绪与持仓成本，判断多头/空头是否过度拥挤，以及是否接近情绪极端（适合寻找反向机会）；
分析当前资金费率是正还是负，绝对值是否接近相对极端，最近是走高、走低还是稳定；
特别关注不健康组合：
下跌过程中费率依然明显为正 → 多头顽固，易杀多；
上涨过程中费率依然明显为负 → 空头顽固，易杀空或 squeeze。
币种聚合多空比/主动买卖比（如果图中有）：


说明作用：识别散户及整体市场的追多/追空行为；
分析当前多空比是偏多还是偏空，最近的变化是否突然冲高或骤降；
结合价格所处位置（相对高位、相对低位、区间边缘），判断是否属于高位追多或低位追空。
交易对爆仓数据（如果图中有）：


分析最近一段时间是多单爆仓为主，还是空单爆仓为主；
判断当前是否处于爆仓“高潮阶段”或刚刚经历集中爆仓；
爆仓集中区是否位于关键支撑/阻力、成交密集区附近，并说明这意味着“杀多/杀空是否接近尾声”。
三、市场结构与资金行为综合分析


在综合以上所有“实际可见指标”的基础上，系统回答以下问题：


1）整体趋势结构：


当前是强多、强空还是偏震荡？
更像是：
大跌后的技术性反弹；
上涨后的分歧/高位震荡；
下跌中继（反弹后大概率还有一波）；
底部震荡构筑中；
清晰的趋势延续阶段。
使用至少价格结构 + OI + CVD + 成交量/资金费率中的 2–3 个指标组合来支撑你的判断。
2）主力资金行为：


结合 CVD + OI 说明：
当前主力更像是在吸筹、派发，还是筹码快速交换（洗盘、换手）；
价与 OI 的象限组合具体对应的是多头加仓、空头加仓、多头止盈还是空头回补等行为，以及其可能的后续含义。
3）散户行为与情绪：


若图中有多空比/右侧多空占比，结合资金费率判断：
散户更偏向追多还是追空？
情绪是否接近过热或恐慌的极端区域？
如果没有直接多空比，也可通过资金费率极端与价格表现间接推断情绪状态。
4）多空力量对比：


综合 CVD 方向 vs 价格方向：谁在用“真金白银”推动价格；
若有多空比：偏向哪一侧，谁在追单；
若有爆仓数据：爆仓主要集中在哪一侧（多单还是空单），谁刚被收割。
5）行情阶段判断：


综合价格结构、CVD、OI、资金费率、多空比与爆仓数据，判断当前更接近：
诱多 / 诱空 / 杀多 / 杀空 / 洗盘 / 吸筹 / 派发
中的哪一种或哪几种叠加，并说明理由；
结合 OI + CVD，判断最近这一段上涨/下跌：
更像是真实“增量趋势”（有新资金持续进入）；
还是“假突破/假跌破”的概率更大（主要依赖短期挤压或空头/多头回补）。
四、下一步走势的量化级推断


基于以上分析，请对短期（接下来数根当前周期 K 线到数个周期）的可能行情路线做推演，并给出清晰倾向：


1）价格与 OI 四象限分析：


当前主要属于：价涨+OI涨、价涨+OI跌、价跌+OI涨、价跌+OI跌中的哪一象限；
说明这一象限在历史上通常对应：
趋势加速；
短暂挤压（short/long squeeze）；
获利了结；
空头/多头回补；
结合当前环境判断，这一次更偏向哪种。
2）CVD 相对价格的变化：


有无明显背离？背离方向对后续走势是偏多还是偏空；
若没有明确背离，则说明 CVD 是顺势配合，增强趋势，还是出现钝化。
3）爆仓、多空比与资金费率（如图上有）：


最近是多头爆仓为主还是空头爆仓为主？爆仓后价格和 OI 是延续还是反向；
多空比与资金费率是跟随价格方向，还是反向，是否出现过热/过冷；
结合这些信息，判断短期更大概率是：
上冲（逼空）；
下杀（杀多）；
维持区间高波动震荡。
4）请用明确语言给出结论：


短期更大概率的方向（上冲、下杀或区间震荡）；
这一方向背后的资金逻辑（谁在被收割、谁在控盘、主力更可能采取拉盘/压盘/洗盘中的哪种）。
五、交易策略级建议（多头 / 空头 / 观望）


基于你的综合判断，请给出三套互斥的策略方案，并明确指出当前“综合风险收益比最优”的选择是哪一个：


1）多头策略：


入场逻辑：需要哪些关键指标组合到位（列 2–3 条最核心前提，例如：
CVD 继续上行且 OI 增长；
下跌后 OI 见底回升、资金费率由极端负值回归中性；
价格回踩关键支撑不破且出现放量止跌等）；
具体触发条件：
大致价格区域：突破/回踩哪些明显结构（前低/前高/重要区间上下沿/成交密集区等）；
指标配合：OI、CVD、资金费率等需要出现怎样的变化；
确认信号与假动作过滤：
哪些组合出现说明多头信号真正成立；
哪些相反变化说明是诱多/假突破，不宜追高，甚至需要反向思考。
2）空头策略：


类似说明：
入场逻辑（例如：反弹接近明显供给区，CVD 走弱或转负，OI 高位继续上升，资金费率正向过热等）；
触发条件（价格接近哪些阻力位 + 指标表现）；
确认信号和假动作特征（例如：突破瞬间 OI 下降、CVD 不跟则是假突破）。
3）观望策略：


指出在什么前提下，不建议贸然开仓：
指标严重矛盾；
CVD 与 OI 同时无明显趋势；
成交量极度低迷；
爆仓和情绪信号中性等；
说明等待哪些信号出现才考虑从观望转为进攻。
4）明确当前首选策略：


在“多头 / 空头 / 观望”中，明确指出当前更适合执行哪一个，并说明放弃其他两个方案的核心理由（例如：虽然结构偏空，但已属于杀多后去杠杆阶段，向下空间有限，因此不建议再追空等）。
六、风险控制模型建议


请针对当前图表状态给出实用风控建议，包括：


1）止损思路：


根据当前波动和结构，给出合理的止损区域或条件，例如：
突破失败回到某关键价位；
关键高低点被反向突破；
OI 和 CVD 同时反向的节点等。
2）杠杆建议：


在当前 OI、潜在爆仓风险和情绪水平下，给出合理的杠杆范围（如建议仅低杠杆或仅做现货）；
明确指出哪些情形属于“爆仓风险高”的场景（例如：OI 高位 + 多空比极端 + 资金费率极端 + 爆仓开始放大），并说明在这些场景下为何必须降低仓位或直接观望。
3）不适合交易的情形：


列举几种当前或潜在的不适合重仓或频繁交易的状态，并说明原因。
4）反向信号（必须立刻减仓或平仓）：


针对你在本次分析中给出的主方向，如果出现以下类组合，必须视为行情与预期相反，需要立刻减仓或止损，例如：
做多前提下：CVD 掉头向下且持续、OI 高位快速上升且多头爆仓放大、资金费率由负转大幅为正等；
做空前提下：价格放量突破关键阻力、CVD 与 OI 同步大幅上升、资金费率快速转负但价格不跌等。
七、三句话最终总结


最后，请用不超过三句话，清晰总结：


1）当前市场的核心结构（趋势方向与所处阶段）；
2）主力资金的主要意图（吸筹、派发、洗盘或收割行为）；
3）对我来说当前最合理的应对方式（做多 / 做空 / 观望），以及最关键的一条理由。


要求：


全程使用专业、简洁、可执行的交易员语言；
不要输出与图无关的宏观故事；
当某项信息图中缺失或难以识别时，请说明“看不清/缺失，因此以下判断偏保守”。`
               },
               {
                   role: "user",
                   content: [
                       {
                           type: "text",
                           text: `这是一张 ${symbol} 在 ${timeframe} 周期的 Coinglass 图表截图，请按系统要求完整分析。`,
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
           max_tokens: 8192
           // temperature: 0.4,
       });


       const content = response.choices[0]?.message?.content?.trim();
       if (!content) {
           throw new Error("AI模型未能识别出有效形态，请勿参考此分析结果。");
       }
       return content;


   } catch (error) {
       logger.error("模式识别分析失败:", error);
       throw new Error(`模式识别分析失败: ${error instanceof Error ? error.message : String(error)}`);
   }
}


/**
* 获取完整的模式识别分析结果
*/
export async function getPatternAnalysis(
   symbol: string,
   timeframe: string = "5m"
): Promise<{
   chart: string;
   analysis: string;
}> {
   try {
       // 使用 CoinGlass 截图替代自绘K线图（固定使用30分钟周期）
       logger.info(`开始获取 ${symbol} 的 CoinGlass 图表（30分钟周期）...`);
       const chartBase64 = await captureCoingleassChart(symbol, '30m');


       // 运行模式识别分析
       const analysis = await runPatternAgent(chartBase64, symbol, '30m');


       return {
           chart: chartBase64, // 返回base64编码
           analysis
       };
   } catch (error) {
       logger.error("获取模式分析失败:", error);


       // 返回有意义的错误信息，而不是抛出异常
       return {
           chart: "",
           analysis: `模式识别分析失败: ${error instanceof Error ? error.message : String(error)}. 可能原因：CoinGlass 截图失败、网络异常。建议检查网络连接或稍后重试。`
       };
   }
}

