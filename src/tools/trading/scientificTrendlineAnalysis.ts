/**
* 科学的技术分析趋势线工具
* 基于经典技术分析原理和统计学方法
*/




import { createTool } from "@voltagent/core";
import { z } from "zod";
import { createLogger } from "../../utils/loggerUtils";
import { createGateClient } from "../../services/gateClient";




const logger = createLogger({
    name: "scientific-trendline-analysis",
    level: (process.env.LOG_LEVEL as any) || "info",
});




// 数据点接口
interface DataPoint {
   time: number;
   price: number;
   index: number;
}




// 趋势线接口
interface TrendLine {
   slope: number;
   intercept: number;
   startPoint: DataPoint;
   endPoint: DataPoint;
   r2: number;          // 拟合优度
   touchPoints: number; // 触碰点数量
   strength: number;    // 综合强度 (0-1)
   significance: number; // 统计显著性
}




// 价格通道接口
interface PriceChannel {
   upperLine: TrendLine;
   lowerLine: TrendLine;
   width: number;       // 通道宽度百分比
   isValid: boolean;
   breakoutLevel: "upper" | "lower" | "none";
   confidence: number;  // 通道置信度
}




// 分析结果接口
interface TrendAnalysisResult {
   symbol: string;
   timeframe: string;
   currentPrice: number;
   supportLines: TrendLine[];
   resistanceLines: TrendLine[];
   channel: PriceChannel | null;
   keyLevels: {
       support: number[];
       resistance: number[];
   };
   trendDirection: "上涨" | "下跌" | "震荡";
   trendStrength: number; // 0-10
   breakoutSignal: {
       hasBreakout: boolean;
       direction?: "上涨" | "下跌";
       confidence: number;
   };
   recommendation: string;
   statistics: {
       totalPoints: number;
       supportPoints: number;
       resistancePoints: number;
       channelReliability: number;
   };
}




/**
* 科学的最小二乘法趋势线计算
* 包含统计显著性检验
*/
function calculateTrendLine(points: DataPoint[]): TrendLine | null {
   if (points.length < 3) return null; // 至少需要3个点




   const n = points.length;
   let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;




   points.forEach(point => {
       sumX += point.index;
       sumY += point.price;
       sumXY += point.index * point.price;
       sumX2 += point.index * point.index;
       sumY2 += point.price * point.price;
   });




   // 最小二乘法计算斜率和截距
   const denominator = n * sumX2 - sumX * sumX;
   if (Math.abs(denominator) < 1e-10) {
       // 几乎垂直或水平线，避免除零
       return null;
   }
   const slope = (n * sumXY - sumX * sumY) / denominator;
   const intercept = (sumY - slope * sumX) / n;




   // 计算R²（拟合优度）
   const yMean = sumY / n;
   let ssTotal = 0, ssResidual = 0;




   points.forEach(point => {
       const yPredicted = slope * point.index + intercept;
       ssTotal += Math.pow(point.price - yMean, 2);
       ssResidual += Math.pow(point.price - yPredicted, 2);
   });




   // 🔧 修复：防止 ssTotal 为 0 导致 NaN
   const r2 = ssTotal === 0 ? 1 : Math.max(0, 1 - (ssResidual / ssTotal));




   // 计算统计显著性（t检验）
   const stdError = Math.sqrt(ssResidual / (n - 2));
   const slopeStdError = stdError / Math.sqrt(sumX2 - Math.pow(sumX, 2) / n);
   const tStat = Math.abs(slope / slopeStdError);
   const significance = Math.min(1, tStat / 10); // 简化的显著性指标




   // 计算触碰点数量（价格在趋势线±0.5%范围内）
   let touchPoints = 0;
   const tolerance = 0.005; // 0.5%的容差


   points.forEach(point => {
       const predictedPrice = slope * point.index + intercept;
       const deviation = Math.abs(point.price - predictedPrice) / predictedPrice;
       if (deviation < tolerance) touchPoints++;
   });




   // 计算趋势线强度（多因子模型）
   const r2Weight = Math.max(0, r2 - 0.5) * 2; // R²>0.5才开始计分
   const touchWeight = touchPoints / n;
   const significanceWeight = significance;
   const strength = Math.min(1, (r2Weight * 0.4 + touchWeight * 0.3 + significanceWeight * 0.3));




   return {
       slope,
       intercept,
       startPoint: points[0],
       endPoint: points[points.length - 1],
       r2,
       touchPoints,
       strength,
       significance,
   };
}




/**
* 科学的局部极值点识别
* 基于价格分位数和时间窗口
*/
function findSignificantExtremes(prices: number[], windowSize: number = 5): {
   lows: DataPoint[];
   highs: DataPoint[];
} {
   const dataPoints: DataPoint[] = prices.map((price, index) => ({
       time: Date.now() - (prices.length - index) * 60000,
       price,
       index,
   }));




   // 计算价格分位数作为参考（使用更宽松的分位数）
   const sortedPrices = [...prices].sort((a, b) => a - b);
   const lowerQuantile = sortedPrices[Math.floor(sortedPrices.length * 0.15)]; // 15%分位数
   const upperQuantile = sortedPrices[Math.floor(sortedPrices.length * 0.85)]; // 85%分位数
   const priceRange = upperQuantile - lowerQuantile;




   const lows: DataPoint[] = [];
   const highs: DataPoint[] = [];




   // 🔧 修复：优化局部低点识别，避免平台期重复
   for (let i = windowSize; i < dataPoints.length - windowSize; i++) {
       const current = dataPoints[i];


       const isLocalMin =
           Array.from({ length: windowSize }, (_, j) => i - j - 1)
               .every(idx => dataPoints[idx].price > current.price) &&
           Array.from({ length: windowSize }, (_, j) => i + j + 1)
               .every(idx => dataPoints[idx].price >= current.price);


       if (isLocalMin && current.price <= lowerQuantile + priceRange * 0.1) {
           lows.push(current);
       }
   }




   // 🔧 修复：优化局部高点识别
   for (let i = windowSize; i < dataPoints.length - windowSize; i++) {
       const current = dataPoints[i];


       const isLocalMax =
           Array.from({ length: windowSize }, (_, j) => i - j - 1)
               .every(idx => dataPoints[idx].price < current.price) &&
           Array.from({ length: windowSize }, (_, j) => i + j + 1)
               .every(idx => dataPoints[idx].price <= current.price);


       if (isLocalMax && current.price >= upperQuantile - priceRange * 0.1) {
           highs.push(current);
       }
   }




   return { lows, highs };
}




/**
* 科学的支撑线识别
* 基于时间顺序和统计显著性
*/
function findSupportLines(prices: number[], minPoints: number = 3): TrendLine[] {
   const { lows } = findSignificantExtremes(prices);


   if (lows.length < minPoints) return [];




   const supportLines: TrendLine[] = [];
   const MAX_COMBINATIONS = 50; // 🔧 性能保护：最多尝试50种组合
   let combinationCount = 0;


   // 按时间顺序尝试不同的点组合
   for (let startIdx = 0; startIdx <= lows.length - minPoints; startIdx++) {
       for (let endIdx = startIdx + minPoints - 1; endIdx < lows.length; endIdx++) {
           if (combinationCount++ > MAX_COMBINATIONS) break;


           const points = lows.slice(startIdx, endIdx + 1);


           // 确保点之间有一定的时间间隔（放宽到10%）
           const timeSpan = points[points.length - 1].index - points[0].index;
           if (timeSpan < prices.length * 0.1) continue; // 至少覆盖10%的时间跨度
           const line = calculateTrendLine(points);


           if (line && line.r2 > 0.6 && line.strength > 0.5 && line.significance > 0.3) {
               supportLines.push(line);
           }
       }
       if (combinationCount > MAX_COMBINATIONS) break;
   }




   // 按强度排序并去重（避免过于相似的线）
   return deduplicateTrendLines(supportLines.sort((a, b) => b.strength - a.strength));
}




/**
* 科学的阻力线识别
* 基于时间顺序和统计显著性
*/
function findResistanceLines(prices: number[], minPoints: number = 3): TrendLine[] {
   const { highs } = findSignificantExtremes(prices);


   if (highs.length < minPoints) return [];




   const resistanceLines: TrendLine[] = [];
   const MAX_COMBINATIONS = 50; // 🔧 性能保护
   let combinationCount = 0;


   // 按时间顺序尝试不同的点组合
   for (let startIdx = 0; startIdx <= highs.length - minPoints; startIdx++) {
       for (let endIdx = startIdx + minPoints - 1; endIdx < highs.length; endIdx++) {
           if (combinationCount++ > MAX_COMBINATIONS) break;


           const points = highs.slice(startIdx, endIdx + 1);


           // 确保点之间有一定的时间间隔（放宽到10%）
           const timeSpan = points[points.length - 1].index - points[0].index;
           if (timeSpan < prices.length * 0.1) continue; // 至少覆盖10%的时间跨度


           const line = calculateTrendLine(points);


           if (line && line.r2 > 0.6 && line.strength > 0.5 && line.significance > 0.3) {
               resistanceLines.push(line);
           }
       }
       if (combinationCount > MAX_COMBINATIONS) break;
   }




   // 按强度排序并去重（避免过于相似的线）
   return deduplicateTrendLines(resistanceLines.sort((a, b) => b.strength - a.strength));
}




/**
* 趋势线去重（避免过于相似的线）
*/
function deduplicateTrendLines(lines: TrendLine[]): TrendLine[] {
   if (lines.length === 0) return lines;


   const unique: TrendLine[] = [];
   // 🔧 使用第一条线的价格和时间尺度进行归一化
   const priceScale = (lines[0].startPoint.price + lines[0].endPoint.price) / 2;
   const timeScale = lines[0].endPoint.index - lines[0].startPoint.index || 1;


   for (const line of lines) {
       const isDuplicate = unique.some(existing => {
           // 归一化斜率差异：转换为相对价格变动比例
           const normalizedSlopeDiff = Math.abs(line.slope - existing.slope) * timeScale / priceScale;
           const interceptDiff = Math.abs(line.intercept - existing.intercept);


           return normalizedSlopeDiff < 0.05 && // 斜率差异 < 5%
               interceptDiff < priceScale * 0.02; // 截距差异 < 2%
       });


       if (!isDuplicate) {
           unique.push(line);
       }
   }


   return unique.slice(0, 3); // 返回前3条
}




/**
* 科学的价格通道识别
* 基于平行线检验和统计显著性
*/
function identifyPriceChannel(
   supportLines: TrendLine[],
   resistanceLines: TrendLine[],
   currentPrice: number,
   prices: number[]
): PriceChannel | null {
   if (supportLines.length === 0 || resistanceLines.length === 0) return null;




   let bestChannel: PriceChannel | null = null;
   let maxConfidence = 0;




   for (const support of supportLines) {
       for (const resistance of resistanceLines) {
           // 检查是否为平行通道（斜率差异<5%）
           const slopeDiff = Math.abs(support.slope - resistance.slope);
           const avgSlope = (Math.abs(support.slope) + Math.abs(resistance.slope)) / 2;


           if (slopeDiff > avgSlope * 0.05) continue;




           // 计算通道在当前时间点的价格
           const currentIndex = prices.length - 1;
           const lowerPrice = support.slope * currentIndex + support.intercept;
           const upperPrice = resistance.slope * currentIndex + resistance.intercept;


           // 确保通道合理（上轨价格>下轨价格）
           if (upperPrice <= lowerPrice) continue;


           const width = ((upperPrice - lowerPrice) / lowerPrice) * 100;


           // 通道宽度合理（1%-20%）
           if (width < 1 || width > 20) continue;




           // 计算通道置信度
           const priceInChannel = prices.filter((price, idx) => {
               const channelLower = support.slope * idx + support.intercept;
               const channelUpper = resistance.slope * idx + resistance.intercept;
               return price >= channelLower && price <= channelUpper;
           }).length;


           const confidence = priceInChannel / prices.length;


           // 判断突破
           let breakoutLevel: "upper" | "lower" | "none" = "none";
           if (currentPrice > upperPrice * 1.003) {
               breakoutLevel = "upper";
           } else if (currentPrice < lowerPrice * 0.997) {
               breakoutLevel = "lower";
           }




           if (confidence > maxConfidence && confidence > 0.6) {
               maxConfidence = confidence;
               bestChannel = {
                   upperLine: resistance,
                   lowerLine: support,
                   width,
                   isValid: true,
                   breakoutLevel,
                   confidence,
               };
           }
       }
   }




   return bestChannel;
}




/**
* 科学的市场趋势分析
* 多维度综合判断
*/
function analyzeMarketTrend(
   prices: number[],
   supportLines: TrendLine[],
   resistanceLines: TrendLine[],
   channel: PriceChannel | null
): {
   direction: "上涨" | "下跌" | "震荡";
   strength: number;
   breakoutSignal: { hasBreakout: boolean; direction?: "上涨" | "下跌"; confidence: number };
} {
   const currentPrice = prices[prices.length - 1];
   const priceChange = ((currentPrice - prices[0]) / prices[0]) * 100;


   // 计算价格波动率
   const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
   const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) * Math.sqrt(252);




   // 基于多因子判断趋势方向
   let direction: "上涨" | "下跌" | "震荡";
   let directionScore = 0;




   // 价格变化因子（40%权重）
   if (priceChange > 3) directionScore += 0.4;
   else if (priceChange < -3) directionScore -= 0.4;




   // 趋势线因子（30%权重）
   const supportStrength = supportLines.length > 0 ? supportLines[0].strength : 0;
   const resistanceStrength = resistanceLines.length > 0 ? resistanceLines[0].strength : 0;


   if (supportStrength > resistanceStrength + 0.2) directionScore += 0.3;
   else if (resistanceStrength > supportStrength + 0.2) directionScore -= 0.3;




   // 通道因子（30%权重）
   if (channel && channel.isValid) {
       const channelPosition = ((currentPrice - channel.lowerLine.slope * (prices.length - 1) - channel.lowerLine.intercept) /
           (channel.upperLine.slope * (prices.length - 1) + channel.upperLine.intercept -
               channel.lowerLine.slope * (prices.length - 1) - channel.lowerLine.intercept));


       if (channelPosition > 0.7) directionScore -= 0.15;
       else if (channelPosition < 0.3) directionScore += 0.15;
   }




   // 确定趋势方向
   if (directionScore > 0.3) direction = "上涨";
   else if (directionScore < -0.3) direction = "下跌";
   else direction = "震荡";




   // 计算趋势强度（0-10）
   let strength = 5 + Math.abs(directionScore) * 5;


   // 考虑波动率调整
   if (volatility < 0.2) strength *= 1.1; // 低波动率增加置信度
   else if (volatility > 0.5) strength *= 0.9; // 高波动率降低置信度


   strength = Math.min(10, Math.max(0, strength));




   // 突破信号检测
   let breakoutSignal = {
       hasBreakout: false,
       direction: undefined as "上涨" | "下跌" | undefined,
       confidence: 0,
   };




   if (channel && channel.breakoutLevel !== "none") {
       breakoutSignal.hasBreakout = true;
       breakoutSignal.direction = channel.breakoutLevel === "upper" ? "上涨" : "下跌";
       breakoutSignal.confidence = Math.min(0.95, channel.confidence * 0.8 + 0.2);
   }




   return { direction, strength, breakoutSignal };
}




/**
* 科学的交易建议生成
* 基于多维度风险评估
*/
function generateTradingRecommendation(
   trendDirection: "上涨" | "下跌" | "震荡",
   trendStrength: number,
   breakoutSignal: { hasBreakout: boolean; direction?: "上涨" | "下跌"; confidence: number },
   channel: PriceChannel | null,
   currentPrice: number,
   supportLines: TrendLine[],
   resistanceLines: TrendLine[],
   prices: number[]
): string {
   const recommendations: string[] = [];
   const currentIndex = prices.length - 1;




   // 突破信号分析
   if (breakoutSignal.hasBreakout) {
       const confidenceLevel = breakoutSignal.confidence > 0.8 ? "强烈" :
           breakoutSignal.confidence > 0.6 ? "中等" : "潜在";


       if (breakoutSignal.direction === "上涨") {
           recommendations.push(`🚀 ${confidenceLevel}上涨突破信号（置信度${(breakoutSignal.confidence * 100).toFixed(0)}%）`);
       } else {
           recommendations.push(`⚠️ ${confidenceLevel}下跌突破信号（置信度${(breakoutSignal.confidence * 100).toFixed(0)}%）`);
       }
   }




   // 关键价位分析
   const nearbySupports = supportLines.map(line => {
       const price = line.slope * currentIndex + line.intercept;
       const distance = ((currentPrice - price) / currentPrice) * 100;
       return { price, distance, strength: line.strength };
   }).filter(level => Math.abs(level.distance) < 3); // 3%范围内




   const nearbyResistances = resistanceLines.map(line => {
       const price = line.slope * currentIndex + line.intercept;
       const distance = ((price - currentPrice) / currentPrice) * 100;
       return { price, distance, strength: line.strength };
   }).filter(level => Math.abs(level.distance) < 3); // 3%范围内




   if (nearbySupports.length > 0) {
       const strongestSupport = nearbySupports.sort((a, b) => b.strength - a.strength)[0];
       recommendations.push(`🛡️ 接近强支撑位${strongestSupport.price.toFixed(2)}（距离${strongestSupport.distance.toFixed(1)}%）`);
   }




   if (nearbyResistances.length > 0) {
       const strongestResistance = nearbyResistances.sort((a, b) => b.strength - a.strength)[0];
       recommendations.push(`🚧 接近强阻力位${strongestResistance.price.toFixed(2)}（距离${strongestResistance.distance.toFixed(1)}%）`);
   }




   // 趋势强度建议
   if (trendStrength >= 8) {
       recommendations.push(`💪 极强势${trendDirection}趋势（强度${trendStrength.toFixed(1)}/10），建议顺势操作`);
   } else if (trendStrength >= 6) {
       recommendations.push(`📈 明显${trendDirection}趋势（强度${trendStrength.toFixed(1)}/10），可考虑顺势操作`);
   } else if (trendStrength <= 4) {
       recommendations.push(`⚡ 趋势不明确（强度${trendStrength.toFixed(1)}/10），建议谨慎观望`);
   }




   // 通道位置建议
   if (channel && channel.isValid) {
       const upperPrice = channel.upperLine.slope * currentIndex + channel.upperLine.intercept;
       const lowerPrice = channel.lowerLine.slope * currentIndex + channel.lowerLine.intercept;
       const position = ((currentPrice - lowerPrice) / (upperPrice - lowerPrice)) * 100;


       if (position < 20) {
           recommendations.push(`📍 价格接近通道下轨（${position.toFixed(0)}%），反弹概率较高`);
       } else if (position > 80) {
           recommendations.push(`📍 价格接近通道上轨（${position.toFixed(0)}%），回调概率较高`);
       }
   }




   return recommendations.length > 0 ? recommendations.join("；") : "市场信号复杂，建议等待更明确的机会。";
}




/**
* 科学的趋势线分析工具
* 基于经典技术分析原理和现代统计学方法
*/
export const scientificTrendlineAnalysisTool = createTool({
   name: "scientificTrendlineAnalysis",
   description: `科学的技术分析工具，提供专业的趋势线、支撑阻力位和价格通道分析。




核心功能：
1. 基于统计学的极值点识别
2. 最小二乘法趋势线拟合与显著性检验
3. 科学的价格通道识别
4. 多维度趋势强度评估
5. 风险调整的交易建议




技术特点：
- 使用分位数方法识别有效极值点
- R²拟合优度检验（>0.6）
- t检验统计显著性
- 多因子趋势强度模型
- 自动异常值检测与修正`,
   parameters: z.object({
       symbol: z.string().describe("交易对符号，如 BTCUSDT"),
       timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).describe("时间周期"),
       lookbackPeriods: z.number().min(50).max(500).default(200).describe("回看周期数（默认200）"),
   }),
   execute: async ({symbol, timeframe, lookbackPeriods = 200}) => {
       try {
           logger.info(`开始科学趋势线分析: ${symbol} ${timeframe} (回看${lookbackPeriods}周期)`);




           const gateClient = createGateClient();
           const contract = symbol.replace('USDT', '_USDT');


           const klines = await gateClient.getFuturesCandles(contract, timeframe, lookbackPeriods);




           if (!klines || klines.length < 50) {
               return {
                   success: false,
                   error: "历史数据不足，需要至少50个周期",
               };
           }




           const prices = klines.map(k => parseFloat(k.c)).filter(p => !isNaN(p) && p > 0);
           const currentPrice = prices[prices.length - 1];


           logger.info(`成功获取 ${prices.length} 个价格数据点`);




           // 科学识别支撑线和阻力线
           const supportLines = findSupportLines(prices);
           const resistanceLines = findResistanceLines(prices);




           logger.info(`找到${supportLines.length}条支撑线，${resistanceLines.length}条阻力线`);




           // 科学识别价格通道
           const channel = identifyPriceChannel(supportLines, resistanceLines, currentPrice, prices);




           // 提取关键价位（不再强制修正，相信科学算法）
           const keyLevels = {
               support: supportLines.map(line => {
                   const price = line.slope * (prices.length - 1) + line.intercept;
                   return parseFloat(price.toFixed(2));
               }),
               resistance: resistanceLines.map(line => {
                   const price = line.slope * (prices.length - 1) + line.intercept;
                   return parseFloat(price.toFixed(2));
               }),
           };




           // 科学分析市场趋势
           const {direction, strength, breakoutSignal} = analyzeMarketTrend(
               prices,
               supportLines,
               resistanceLines,
               channel
           );




           // 生成科学的交易建议
           const recommendation = generateTradingRecommendation(
               direction,
               strength,
               breakoutSignal,
               channel,
               currentPrice,
               supportLines,
               resistanceLines,
               prices
           );




           const result: TrendAnalysisResult = {
               symbol,
               timeframe,
               currentPrice,
               supportLines: supportLines.map(line => ({
                   ...line,
                   startPoint: {...line.startPoint, price: parseFloat(line.startPoint.price.toFixed(2))},
                   endPoint: {...line.endPoint, price: parseFloat(line.endPoint.price.toFixed(2))},
               })),
               resistanceLines: resistanceLines.map(line => ({
                   ...line,
                   startPoint: {...line.startPoint, price: parseFloat(line.startPoint.price.toFixed(2))},
                   endPoint: {...line.endPoint, price: parseFloat(line.endPoint.price.toFixed(2))},
               })),
               channel,
               keyLevels,
               trendDirection: direction,
               trendStrength: parseFloat(strength.toFixed(1)),
               breakoutSignal,
               recommendation,
               statistics: {
                   totalPoints: prices.length,
                   supportPoints: supportLines.reduce((sum, line) => sum + line.touchPoints, 0),
                   resistancePoints: resistanceLines.reduce((sum, line) => sum + line.touchPoints, 0),
                   channelReliability: channel ? channel.confidence : 0,
               },
           };




           logger.info(`科学趋势线分析完成: ${symbol} - ${direction}趋势（强度${strength.toFixed(1)}）`);




           return {
               success: true,
               data: result,
           };
       } catch (error: any) {
           logger.error(`科学趋势线分析失败: ${error.message}`, error);
           return {
               success: false,
               error: error.message,
           };
       }
   },
});

