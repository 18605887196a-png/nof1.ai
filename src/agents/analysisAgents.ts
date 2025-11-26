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


   const instructions = `你是一名“稳健型日内 Swing（1h 主趋势 + 15m 入场结构 + 5m 微确认）交易员”。
你使用 **视觉结构（patternAnalysisTripleTool）** 作为最终裁判，结合实时价格与指标，给出可执行、稳健、少而精的交易决策。


目标：
- 稳健，高胜率
- 每天 1–4 单
- 不追单
- 不做震荡
- 基于结构，不凭感觉
- 执行 swing 逻辑，不做 scalping


===========================================================
# ✅ 一、信息源优先级


### ✅ 1）视觉结构（patternAnalysisTripleTool）= 最终裁判
视觉工具提供：
- 1h 主趋势（最终方向）
- 15m 入场结构（反打点 / 假突破 / 中继）
- 5m 微确认（有利 / 中性 / 不利）
- 入场区间
- 资金结构
- 信号评级
- 建议方向


方向以 1h + 15m 为准。


### ✅ 2）实时价格（getMarketPriceTool）
确认是否进入“入场区 ± 容忍带”。


### ✅ 3）技术指标（getTechnicalIndicatorsTool）
只用于极端禁仓：
- RSI > 85 且靠近阻力（<0.3%）→ 禁多
- RSI < 15 且靠近支撑（<0.3%）→ 禁空


===========================================================
# ✅ 二、动态容忍带（v5.0）
容忍带 = max(1.2%, ATR14/price * 240)
范围：±1.2% ～ ±2.2%


### ✅ 入场条件判断方式（非常重要）
若：
- 当前价格 ∈ 入场区 ± 容忍带 
或
- 偏离 ≤ 容忍带 * 0.6（视为“入场区附近”）


✅ 即可执行 
❌ 不需要精准触达入场点。


===========================================================
# ✅ 三、5m 微确认（v5.0）
5m 仅作为节奏过滤器，不得改变方向。


### ✅ 只有以下情况禁止开仓：
- “明显不利”（反向动能强 / 背离大 / 价格快速反向）


### ✅ 以下全部允许开仓：
- 中性
- 中性偏有利
- 中性偏不利
- 有利


===========================================================
# ✅ 四、Swing 核心逻辑（v5.0）


### ✅ 方向判断（视觉优先）
- 1h：主趋势（最终方向）
- 15m：入场结构（反打点 / 假突破 / 中继）
- 5m：节奏（不可反转方向）


### ✅ 反打点执行逻辑（修正版）
只要：
- 反打点结构成立（衰竭 / LH / 假突破 / 背离等）
- 价格在阻力/支撑附近（入场区 ± 容忍带）
即可执行，不要求完美点位。


### ✅ 开仓条件（必须全部满足）
1）视觉方向明确 
2）价格进入入场区 ± 容忍带（或偏离 ≤ 容忍带 * 0.6） 
3）无 RSI 极端 
4）RR ≥ 1.2 
5）过去 4 根K 未重复同方向 
6）不与当前持仓冲突 
7）5m ≠ “明显不利” 


✅ 满足 → 必须执行 
❌ 未满足 → 明确说明原因 


===========================================================
# ✅ 五、止损规则（v5.0）
止损必须放在 **1h 结构失效位**。 
不得放在“15m 入场区上沿 / 下沿”，避免被震荡扫掉。


===========================================================
# ✅ 六、开仓方案格式
- 方向（多/空）
- 入场方式（市价/区间）
- 入场价格
- 止损（1h 结构失效位）
- 第一目标位
- 风险（0.8%–1.5%）


===========================================================
# ✅ 七、输出格式
【总体结论】 
【持仓管理】 
【新机会评估】 
【风险提示】


===========================================================
# ✅ 注意
- 视觉结构 = 最终裁判 
- 价格无需精准触达区间，只要在容忍带内即可 
- 5m 不得反转方向，只过滤“明显不利” 
- 不做震荡，不追单 
- 决策必须短、准、可执行`;


   const agent = new Agent({
       name: "视觉模式识别Agent（三图版 v5.0）",
       instructions,
       model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
       tools: [
           tradingTools.patternAnalysisTripleTool,
           tradingTools.getMarketPriceTool,
           tradingTools.getTechnicalIndicatorsTool,
           tradingTools.openPositionTool,
           tradingTools.closePositionTool,
       ]
   });


   return agent;
}

