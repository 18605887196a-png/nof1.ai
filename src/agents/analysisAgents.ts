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


import { Agent } from "@voltagent/core";
import { createOpenAI } from "@ai-sdk/openai";
import * as tradingTools from "../tools/trading";
import { createLogger } from "../utils/loggerUtils";


const logger = createLogger({
 service: "analysis-agents",
 level: (process.env.LOG_LEVEL as any) || "info",
});


/**
* 创建技术分析Agent
* 专注于技术指标分析
* @param marketDataContext 市场数据上下文（可选）
*/
export function createTechnicalAnalystAgent(marketDataContext?: any) {
 const openai = createOpenAI({
   apiKey: process.env.OPENAI_API_KEY || "",
   baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
 });


 // 构建包含市场数据的指令
 let instructions = `你是技术分析专家，专注于加密货币技术指标分析。


你的职责：
- 基于技术指标分析市场状态
- 识别潜在的交易机会和风险
- 提供专业的技术分析见解


你可以使用的工具：
- getMarketPriceTool
- getTechnicalIndicatorsTool
- getFundingRateTool
- getAccountBalanceTool
- getPositionsTool


请基于你的专业判断给出分析结论和建议，包括：
- 技术面评分（1-10分）
- 置信度评估
- 关键支撑位和阻力位
- 动量指标状态


请基于你的专业经验给出客观的技术分析结论。`;


 // 如果有市场数据上下文，添加到指令中
 if (marketDataContext) {
   instructions += `\n\n当前市场数据上下文：\n${JSON.stringify(marketDataContext, null, 2)}`;
 }


 const agent = new Agent({
   name: "技术分析Agent",
   instructions,
   model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
   tools: [
     tradingTools.getMarketPriceTool,
     tradingTools.getTechnicalIndicatorsTool,
     tradingTools.getFundingRateTool,
     tradingTools.getAccountBalanceTool,
     tradingTools.getPositionsTool,
   ],
   logger: logger.child({ agent: "技术分析Agent" }),
 });


 return agent;
}


/**
* 创建趋势分析Agent
* 专注于多时间框架趋势分析
* @param marketDataContext 市场数据上下文（可选）
*/
export function createTrendAnalystAgent(marketDataContext?: any) {
 const openai = createOpenAI({
   apiKey: process.env.OPENAI_API_KEY || "",
   baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
 });


 // 构建包含市场数据的指令
 let instructions = `你是趋势分析专家，专注于市场趋势识别。


你的职责：
- 分析多时间框架的市场趋势
- 识别趋势的强度和持续性
- 评估市场的主要方向


你可以使用的工具：
- getMarketPriceTool
- getTechnicalIndicatorsTool
- getFundingRateTool
- getOrderBookTool
- analyzeOrderBookDepthTool
- analyzeFundingRateTrendTool
- getAccountBalanceTool
- getPositionsTool


请基于你的专业判断给出趋势分析结论，包括：
- 趋势方向判断
- 强度评分（1-10分）
- 置信度评估


请基于你的专业经验给出客观的趋势分析结论。`;


 // 如果有市场数据上下文，添加到指令中
 if (marketDataContext) {
   instructions += `\n\n当前市场数据上下文：\n${JSON.stringify(marketDataContext, null, 2)}`;
 }


 const agent = new Agent({
   name: "趋势分析Agent",
   instructions,
   model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
   tools: [
     tradingTools.getMarketPriceTool,
     tradingTools.getTechnicalIndicatorsTool,
     tradingTools.getFundingRateTool,
     tradingTools.getOrderBookTool,
     tradingTools.analyzeFundingRateTrendTool,
     tradingTools.analyzeOrderBookDepthTool,
     tradingTools.getAccountBalanceTool,
     tradingTools.getPositionsTool,
   ],
   logger: logger.child({ agent: "趋势分析Agent" }),
 });


 return agent;
}


/**
* 创建风险评估Agent
* 专注于市场风险评估
* @param marketDataContext 市场数据上下文（可选）
*/
export function createRiskAssessorAgent(marketDataContext?: any) {
 const openai = createOpenAI({
   apiKey: process.env.OPENAI_API_KEY || "",
   baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
 });


 // 构建包含市场数据的指令
 let instructions = `你是风险评估专家，专注于市场风险识别和评估。


你的职责：
- 评估当前市场风险水平
- 识别潜在的风险因素
- 提供风险管理建议


你可以使用的工具：
- getMarketPriceTool
- getTechnicalIndicatorsTool
- getFundingRateTool
- getOrderBookTool
- analyzeOrderBookDepthTool
- analyzeFundingRateTrendTool
- getAccountBalanceTool
- getPositionsTool


请基于你的专业判断给出风险评估结论，包括：
- 风险等级评估（低/中/高/极高）
- 风险评分（1-10分）
- 置信度评估（高/中/低）
- 主要风险因素和潜在影响
- 风险管理建议


请基于你的专业经验给出客观的风险评估结论，综合考虑：
- 市场波动性和流动性状况
- 持仓风险和集中度
- 整体风险环境
- 市场情绪和外部因素


作为风险评估专家，你应该自主决定如何权衡各种风险因素，给出最准确的风险评估。`;


 // 如果有市场数据上下文，添加到指令中
 if (marketDataContext) {
   instructions += `\n\n当前市场数据上下文：\n${JSON.stringify(marketDataContext, null, 2)}`;
 }


 const agent = new Agent({
   name: "风险评估Agent",
   instructions,
   model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
   tools: [
     tradingTools.getMarketPriceTool,
     tradingTools.getTechnicalIndicatorsTool,
     tradingTools.getFundingRateTool,
     tradingTools.getOrderBookTool,
     tradingTools.analyzeFundingRateTrendTool,
     tradingTools.analyzeOrderBookDepthTool,
     tradingTools.getAccountBalanceTool,
     tradingTools.getPositionsTool,
   ],
   logger: logger.child({ agent: "风险评估Agent" }),
 });


 return agent;
}