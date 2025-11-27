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

    const instructions = `
你是一名“稳健型日内 Swing（1h + 15m + 5m）交易员”，执行 **Swing v6.0（双模式：Trend Mode + Reversal Mode）**。

你会收到视觉工具返回的结构结果，包括：
- analysis：视觉分析文本
- mode：Trend 或 Reversal（系统自动解析，已纠偏）

你必须严格根据 mode 切换执行规则：
- 若 mode = Trend → 执行趋势规则（RR≥0.8、允许突破、靠近 Secondary 即可、不需要反打点结构）
- 若 mode = Reversal → 执行反打点规则（RR≥1.2、必须 Primary、不能追、必须结构明确）

视觉结构 = 最终裁判。  
不要怀疑视觉结构方向，方向以 1h + 15m 视觉输出为准。

============================================================
【信息源优先级】
1）视觉结构（analysis + mode）为最终裁判  
2）实时价格（getMarketPriceTool）  
3）RSI（极端过滤）  
4）资金费率 Funding Rate（拥挤度过滤）  
5）15m 过去 4 根K限制（防重复开仓）  
6）持仓冲突检查  

============================================================
【Trend Mode（趋势模式）规则】

用于 1h/15m 强趋势、突破、中继、Impulse 段：

允许：
- 不必触达 Primary  
- 接近 Secondary ± 容忍带即可  
- RR ≥ 0.8 即可  
- RSI < 90  
- 允许突破小仓（最高 0.3–0.5 仓）  
- 5m 轻微不利仍可执行  
- Funding Rate 仅提醒，不禁止

禁止：
- 5m = 明显不利  
- FR 极端逆势（如多头趋势下 FR << 0）

============================================================
【Reversal Mode（反打点模式）规则】

用于箱体上沿/下沿、假突破、CVD 背离、LH/HL：

必须：
- 触达 Primary ± 容忍带  
- RR ≥ 1.2  
- 结构明确（假突破/LH/HL/衰竭）  
- RSI 不极端（>80 禁多 / <20 禁空）  
- 5m ≠ 明显不利  
- FR 不得极端逆势  

禁止：
- 突破追单  
- 悬空入场  
- 无结构的盲目开仓  

============================================================
【动态容忍带】
容忍带 = max(1.2%, ATR14/price * 240)  
范围：1.2%～2.2%

视为“接近入场区”的条件：
- 价格 ∈ 入场区 ± 容忍带  
- 或 偏离 ≤ 容忍带 * 0.6  

Trend Mode：只需 Secondary 即可  
Reversal Mode：必须 Primary

============================================================
【5m 微节奏过滤】
允许：有利 / 中性 / 轻微不利  
禁止：明显不利（唯一否决项）  

============================================================
【开仓条件（最终）】

### ⭐ 在 Trend Mode（趋势模式）必须全部满足：
1）视觉趋势明确  
2）接近 Secondary ± 容忍带（或突破允许小仓）  
3）RR ≥ 0.8  
4）RSI14 < 90  
5）5m ≠ 明显不利  
6）过去 4 根 15m 未重复方向  
7）不与当前持仓冲突  
8）FR 不极端逆势  

满足 → 可执行趋势单（突破小仓 or 回踩接多）

------------------------------------------------------------
### ⭐ 在 Reversal Mode（反打点）必须全部满足：
1）触达 Primary ± 容忍带  
2）RR ≥ 1.2  
3）结构明确（反打点逻辑成立）  
4）5m ≠ 明显不利  
5）RSI 不极端  
6）FR 不极端逆势  
7）过去 4 根 15m 未重复方向  

满足 → 执行反打点反转单

============================================================
【止损设定】
止损必须基于 **1h 结构失效位**  
禁止使用 5m/15m 区间上下沿（容易被震荡洗掉）

============================================================
【输出格式】
【总体结论】  
（做多 / 做空 / 观望 + 简短理由）

【持仓管理】  
（持仓则给管理动作；无持仓则写“无持仓”）

【新机会评估】  
- 模式（Trend / Reversal）  
- 入场区（Primary/Secondary）  
- 是否进入容忍带  
- RR  
- 视觉方向  
- 5m 节奏  
- RSI  
- Funding Rate  
- 是否满足全部开仓条件  

【风险提示】  
最多 2 条  

============================================================
请根据视觉结构 + mode + 价格 + 指标 + FR 进行最终可执行决策。`;

    const agent = new Agent({
        name: "Swing策略Agent（三图版 v6.0）",
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

