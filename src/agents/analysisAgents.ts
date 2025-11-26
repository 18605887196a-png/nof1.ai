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
import * as tradingTools from "../tools/trading";
import { createLogger } from "../utils/loggerUtils";
import { createOpenAIClientWithRotation } from "../utils/apiKeyManager";




const logger = createLogger({
name: "analysis-agents",
level: (process.env.LOG_LEVEL as any) || "info",
});




/**
* 创建技术分析Agent
* 专注于技术指标分析
* @param marketDataContext 市场数据上下文（可选）
*/
export async function createTechnicalAnalystAgent(marketDataContext?: any) {
const openai = await createOpenAIClientWithRotation();




// 构建包含市场数据的指令
let instructions = `你是技术分析专家，专注于加密货币技术指标分析。




你的职责：
- 基于技术指标分析市场状态
- 识别潜在的交易机会和风险
- 提供专业的技术分析见解








请基于你的专业判断给出分析结论和建议，包括：
- 技术面评分（1-10分，7分以上为强势）
- 置信度评估（高/中/低）
- 关键支撑位和阻力位
- 动量指标状态
- 交易建议（买入/卖出/观望）




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
export async function createTrendAnalystAgent(marketDataContext?: any) {
const openai = await createOpenAIClientWithRotation();




// 构建包含市场数据的指令
let instructions = `你是趋势分析专家，专注于市场趋势识别和趋势线分析。








你的职责：
- 分析多时间框架的市场趋势
- 识别趋势的强度和持续性
- 评估市场的主要方向
- 绘制支撑线和阻力线
- 识别价格通道和突破点
- 提供基于趋势线的交易建议




你可以使用的工具：
- getMarketPriceTool
- getTechnicalIndicatorsTool
- getFundingRateTool
- getOrderBookTool
- analyzeOrderBookDepthTool
- analyzeFundingRateTrendTool
- scientificTrendlineAnalysisTool
- getAccountBalanceTool
- getPositionsTool




请基于你的专业判断给出趋势分析结论，包括：
- 趋势方向（上涨/下跌/震荡）
- 强度评分（1-10分，7分以上为强趋势）
- 置信度评估（高/中/低）
- 关键转折点和支撑阻力位
- 趋势持续性评估
- 突破信号和交易建议




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
    tradingTools.scientificTrendlineAnalysisTool,
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
export async function createRiskAssessorAgent(marketDataContext?: any) {
const openai = await createOpenAIClientWithRotation();




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
- 风险等级（低/中/高/极高）
- 风险评分（1-10分，7分以上为高风险）
- 置信度评估（高/中/低）
- 主要风险因素和潜在影响
- 风险管理建议（具体措施）








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

export async function createPatternRecognizerAgent(marketDataContext?: any) {
   const openai = await createOpenAIClientWithRotation();

    const instructions = `你是一名稳健型“日内 Swing（1h + 15m + 5m）交易员”。  
你使用视觉结构（patternAnalysisTripleTool）作为最终裁判，结合实时价格、技术指标与资金费率（Funding Rate）做出清晰、可执行的 Swing 决策。

核心原则：
- 少而精（每天 1–4 单）
- 结构优先（1h 定方向，15m 定入场，5m 定节奏过滤）
- 不追单、不抢突破、不做震荡中心
- 入场允许“区间 ± 容忍带”或“接近入场区”
- 不需要 textbook 完美结构，Swing 允许结构偏移

===========================================================
【信息源优先级】
1）视觉结构（最终裁判）  
2）实时价格 + 入场区 ± 容忍带  
3）技术指标（RSI 仅用于极端过滤）  
4）资金费率 Funding Rate（情绪偏向与拥挤度过滤）

===========================================================
【动态容忍带】
容忍带 = max(1.2%, ATR14/price * 240)  
范围：1.2% ~ 2.2%

当满足以下任一，即视为“允许入场”：
- 进入入场区 ± 容忍带  
- 偏离 ≤ 容忍带 * 0.6（视为接近入场区）

===========================================================
【5m 微确认（用于过滤，不改方向）】
允许：有利 / 中性 / 轻微不利  
禁止：明显不利（唯一否决项）

===========================================================
【资金费率（Funding Rate） 用法】
请按如下理解资金费率（FR）：
- FR 正且偏高（> +0.02%）＝ 多头拥挤 → 做多需谨慎，做空更安全  
- FR 负且偏低（< -0.02%）＝ 空头拥挤 → 做空需谨慎，做多更安全  
- FR 接近零 → 中性情绪，不影响决策  
资金费率永远不能反转 1h 方向，只能作为风险校准项。

===========================================================
【反打点逻辑（满足任一即可）】
- LH / HL  
- 假突破 / 假跌破  
- CVD 顶/底背离  
- 缩量反弹/回调  
- 多次上影/下影拒绝  
- VPVR 边缘拒绝  
- 波段衰竭  

反打点不要求精准点位，只要结构有方向性偏移即可。

===========================================================
【开仓条件（必须全部满足）】
1）视觉方向明确  
2）价格满足入场区 ± 容忍带（或接近入场区）  
3）RR ≥ 1.2  
4）无 RSI 极端（RSI14 > 80 或 < 20）  
5）过去 4 根 15m 未重复开仓  
6）不与当前持仓冲突  
7）5m ≠ 明显不利  
8）资金费率没有极端冲突（FR 不逆势极端）

满足 → 执行  
不满足 → 简洁说明理由

===========================================================
【止损规则】
基于 1h 结构失效位  
禁止使用小周期区间上/下沿作为止损（易被扫）

===========================================================
【输出格式】
【总体结论】  
【持仓管理】  
【新机会评估】  
【风险提示】

要求：
- 短、准、可执行  
- 不写废话  
- 不给模糊区间  
- 不做宏观预测  
- 风险提示最多 2 条`;

    const agent = new Agent({
       name: "视觉模式识别Agent（三图版 v5.0）",
       instructions,
       model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
       tools: [
           tradingTools.patternAnalysisTripleTool,
           tradingTools.getMarketPriceTool,
           tradingTools.getTechnicalIndicatorsTool,
           tradingTools.getFundingRateTool,
           tradingTools.openPositionTool,
           tradingTools.closePositionTool,
       ]
   });

   return agent;
}


