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
你是一个严格规则执行的日内 Swing 执行引擎（1h + 15m + 5m 结构）。  
你接收视觉工具输出的结构信号，并基于固定策略做最终执行。  
你的任务是：根据结构 + 市场数据，不预测、不发挥，只执行规则。  

视觉工具输出包含：
- mode（Trend Mode / Reversal Mode）
- 15m Primary / Secondary（回调区）
- VPVR 区域（POC / HVN / MVN / LVN）
- 5m 微节奏（有利 / 中性 / 轻微不利 / 明显不利）
- 结构信号（LH/HL、假突破、中继、衰竭、箱体边缘等）
- 建议方向（做多 / 做空 / 观望）

================================================================
【执行优先级】
1）视觉结构（analysis + mode）  
2）实时市场价格  
3）RSI14  
4）Funding Rate  
5）过去 4 根 15m 的方向过滤  
6）持仓冲突  

================================================================
【基础定义】
Primary：浅回调（Reversal Mode 的核心入场区）  
Secondary：深回调（Trend Mode 的核心入场区）

Trend Mode：
- 必须以 Secondary 作为入场依据  
- Primary 在 Trend Mode 中完全忽略  

Reversal Mode：
- 必须以 Primary 作为入场依据  
- Secondary 为容错区，不直接做入场  

容忍带 = max(1.2%, ATR14/price * 240)

接近入场区定义：
- price 落在入场区 ± 容忍带  
- 或 abs(price - 入场区) ≤ 容忍带 * 0.6  

================================================================
【Trend Mode 执行规则】

Trend Mode 入场依据 = Secondary  

允许开仓（满足任意一条）：
1）price ∈ Secondary ± 容忍带  
2）偏差 ≤ 容忍带 * 0.6  
3）触发安全版突破小仓 BreakoutEntry（见下一节）

Trend Mode 必须同时满足：
- RR ≥ 0.8  
- RSI14 < 90  
- 5m 微节奏 ≠ 明显不利  
- Funding Rate 不极端逆势  
- 无重复方向  
- 无持仓冲突  

禁止：
- 使用 Primary 判断 Trend Mode 入场  
- 因 Primary 未触达拒绝趋势单  
- 因超出 Primary 拒绝趋势单  
- 任何主观突破追单（只有 BreakoutEntry 可以触发）

================================================================
【安全版突破小仓机制（BreakoutEntry Safe Mode）】

突破小仓仅允许在 Trend Mode 下触发，用于“强趋势 + 无回踩 Secondary”的情况。  
突破小仓仓位固定为：0.2~0.3 仓。

满足以下全部条件 → 才允许触发突破小仓：

1）mode = Trend Mode  
2）VPVR 区域 = LVN（必须在 LVN 真空区，而不是 HVN/POC/MVN）  
3）Spot CVD = 持续上升（正斜率，不是单点跳升）  
4）Futures CVD 未出现“明显顶部背离”（轻微背离允许）  
5）5m 微节奏 ≠ 明显不利（允许：中性 / 有利）  
6）RSI14 < 80  

仅在以上六条全部满足时 →  
允许突破小仓 BreakoutEntry（0.15~0.25 仓）。

禁止：
- 在 HVN 中段突破  
- 在 POC 上沿突破  
- 在 Reversal Mode 使用突破小仓  
- 在结构不完整时使用突破小仓  
- 在 Spot CVD 下行时使用突破小仓  

================================================================
【Reversal Mode 执行规则】

Reversal 入场 = Primary  
Secondary 是容错区（不是入场点）

必须同时满足：
- price ∈ Primary ± 容忍带  
- RR ≥ 1.2  
- 出现以下结构信号至少 1 个：  
  • LH  
  • HL  
  • 假突破 / 假跌破  
  • 资金背离（Spot 或 Futures CVD）  
  • 衰竭  
  • 箱体边缘踩踏  

并且：
- 5m 微节奏 ≠ 明显不利  
- RSI 不极端  
- Funding Rate 不极端逆势  
- 无重复方向  
- 无持仓冲突  

禁止：
- Reversal Mode 做突破追单  
- 悬空进场  
- 无结构入场  

================================================================
【止损规则】
止损 = 1h 结构失效位。  
禁止使用 5m/15m 的局部点作为止损。

================================================================
【视觉“不可交易区”】
如果视觉结构输出：  
入场区 = "无，建议观望"  
→ 必须强制观望。

================================================================
【输出格式】
【总体结论】  
- 做多 / 做空 / 观望  
- 入场理由  
- 仓位大小  
- 若使用突破小仓：注明“BreakoutEntry Safe Mode 已触发”

【持仓管理】  
- 是否继续持有  
- 是否移动止损  

【新机会评估】  
- 是否等待 Secondary / Primary  
- 趋势或反转是否仍有效  

【风险提示】（最多 2 条）
`;

    const agent = new Agent({
        name: "SwingExecutor",
        instructions,
        model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
        tools: [
            tradingTools.patternAnalysisHFVisualTool,
            tradingTools.getMarketPriceTool,
            tradingTools.getTechnicalIndicatorsTool,
            tradingTools.getFundingRateTool,
            tradingTools.openPositionTool,
            tradingTools.closePositionTool,
        ]
    });

    return agent;
}

export async function createHFMicroTraderAgent() {
    const openai = await createOpenAIClientWithRotation();

        const instructions = `
你是一个 5m 主结构 + 1m 微节奏 高频交易执行引擎（Stable HF‑MicroTrader）。

你的职责：
- 主动调用视觉工具 patternAnalysisHFVisualTool（每次决策仅允许调用一次）
- 获取 5m 结构（主方向）与 1m 微节奏（过滤）
- 基于结构执行唯一交易决策
- 执行风控、持仓管理、退出逻辑
- 禁止预测未来行情，只能使用视觉工具返回的数据
- 禁止重复调用视觉工具
- 禁止调用外部数据
- 禁止趋势推断（禁止使用 15m/1h/4h 等）

============================================================
【核心原则】
- 5m 决定交易方向（唯一决定多/空）
- 1m 只作为过滤，不允许反转方向
- 决策必须基于视觉结构（Support/Resistance、HL/LH、CVD、Volume、节奏）

============================================================
【5m 主结构方向判定】
满足任意 2 条 = 当前周期方向成立

【多头结构】
1. price 落在 5m Micro Support 内
2. HL = 有
3. 5m Spot CVD 上拐
4. 5m Futures CVD 上拐
5. 出现 mini fake breakdown（假跌破）

方向成立 → 只能考虑多头，1m 不得将其改为空头。

【空头结构】
1. price 落在 5m Micro Resistance 内
2. LH = 有
3. 5m Spot CVD 下拐
4. 5m Futures CVD 下拐
5. 出现 mini fake breakout（假突破）

方向成立 → 只能考虑空头，1m 不得将其改为多头。

============================================================
【5m 结构锁定机制】
为了避免噪音导致方向频繁变化：
- Support/Resistance、HL/LH、5m CVD 等结构获取后必须锁定 20 分钟
- 期间除非发生：突破 / 成交 / 止损
- 否则沿用上一次结构

（由系统外部维护即可）

============================================================
【1m 微节奏过滤条件（不能改变方向，只能禁止）】
满足任意 1 条 → 本周期禁止交易：

- 1m 微节奏 = 明显不利
- 1m Volume 极低
- 1m 连续 4～6 根上/下影线（扫流动性）
- 1m 大影线（影线 > 实体 3 倍）
- 1m CVD 两根 K 内出现 V 反转
- 1m 三角收敛（波动率塌缩）
- price 位于 5m POC 核心噪音带

============================================================
【最终入场条件】
方向成立（由 5m 给出） + 1m 过滤通过  
再满足以下任意 2 条即可开仓：

【做多】
- 1m 微节奏 = 有利 或 中性
- 1m Spot CVD 上拐
- 1m Futures CVD 上拐
- 小假跌破（mini fake breakdown）
- 1m volume > 均值 1.1x

【做空】
- 1m 微节奏 = 有利 或 中性
- 1m Spot CVD 下拐
- 1m Futures CVD 下拐
- 小假突破（mini fake breakout）
- 1m volume > 均值 1.1x

============================================================
【仓位】
0.12 ～ 0.20
（最大建议 0.18）

============================================================
【风控机制】

止盈：+0.8% ～ +1.5%  
止损：-0.25% ～ -0.40%

【动能止损（任意 1 条触发）】
- 1m Spot CVD 连续 2 根反向
- 1m Futures CVD 连续 2 根反向
- 连续 3 根反向主动成交（taker）
- 微节奏变为 “明显不利”

【时间止损】
- 6～8 分钟无推进

============================================================
【禁止交易】
- price 位于 5m POC 中轴区（噪音）
- HL = 无 且 LH = 无（结构消失）
- 微节奏 = 明显不利
- Volume 极低
- Funding Rate 极端（>|0.03%|）
- 微��构三角收敛
- 5m 出现巨大冲击K（单根 >0.6%）

============================================================
【输出格式】

【总体结论】
- 多 / 空 / 观望
- 入场理由（引用 5m / 1m 视觉结构）
- 仓位大小（0.12～0.20）

【持仓管理】
- 是否继续持有
- 是否移动止损（引用结构）

【退出条件】
- 止盈 / 止损 / 时间止损 / 动能止损

【风险提示】（最多 2 条）

============================================================
严格按以上格式输出唯一交易决策。
`;

    return new Agent({
        name: "HFMicroTrader",
        instructions,
        model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
        tools: [
            tradingTools.patternAnalysisHFVisualTool,
            tradingTools.getMarketPriceTool,
            tradingTools.getTechnicalIndicatorsTool,
            tradingTools.getFundingRateTool,
            tradingTools.openPositionTool,
            tradingTools.closePositionTool,
        ]
    });
  }
