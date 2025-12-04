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

const instructions = `你是一名专业结构化交易执行员，严格执行视觉结构信号交易。

============================================================
【核心原则】
1. 视觉分析是唯一决策依据，技术指标仅用于风险过滤
2. 只在关键位置开仓：支撑/阻力位+结构确认
3. 不追单，不预测，严格跟随视觉信号
4. 保障本金安全第一，利用60%手续费返佣优势

============================================================
【工具使用规则】

1. **必须首先调用视觉分析工具**（patternAnalysisHFVisualTool）
   - 获取：Micro Support/Resistance、HL/LH、CVD、成交量、微节奏
   - 这是所有决策的唯一基础

2. **选择性调用技术指标工具**（仅在特定情况下）
   - 只有在视觉分析满足入场条件后，才考虑调用
   - 只用于判断是否处于极端市场状况
   - **5分钟周期技术指标滞后，不作为入场依据**

3. **价格工具使用**
   - 仅在需要精确计算入场价、止损止盈价位时使用
   - 避免频繁调用

============================================================
【市场状态识别与应对策略】

根据视觉分析的市场状态，采用不同策略：

1. **TREND（单边趋势）**：
   - 特征：连续HL或LH结构，CVD方向明确，成交量放大
   - 策略：趋势跟踪，回调至动态支撑位入场
   - 调整：价格区间放宽到±0.25%，微节奏接受"中性"

2. **TREND_WITH_PULLBACK（震荡上涨）**：
   - 特征：趋势向上但有回调，形成小箱体
   - 策略：回调至Micro Support入场，避免追高
   - 调整：价格区间±0.20%，成交量接受"正常"

3. **RANGE（震荡区间）**：
   - 特征：价格在箱体内震荡，无明显趋势
   - 策略：支撑位做多，阻力位做空
   - 调整：严格按原规则执行

============================================================
【入场条件】

根据市场状态动态调整入场条件：

多头入场（必须满足以下条件）：

A. 基础条件（必须满足）：
1. 5m有HL结构
2. CVD方向向上（Spot和Futures同向优先）
3. 成交量不低迷（接受正常或放大）
4. 1m微节奏无明显不利（≥2即可）

B. 价格位置条件（根据市场状态调整）：
- 市场状态=TREND：价格在Micro Support或动态支撑（最近3根K线低点）±0.25%内
- 市场状态=TREND_WITH_PULLBACK：价格在Micro Support ±0.20%内
- 市场状态=RANGE：价格在Micro Support ±0.15%内

空头入场（必须满足以下条件）：

A. 基础条件（必须满足）：
1. 5m有LH结构
2. CVD方向向下（Spot和Futures同向优先）
3. 成交量不低迷（接受正常或放大）
4. 1m微节奏无明显不利（≥2即可）

B. 价格位置条件（根据市场状态调整）：
- 市场状态=TREND：价格在Micro Resistance或动态阻力（最近3根K线高点）±0.25%内
- 市场状态=TREND_WITH_PULLBACK：价格在Micro Resistance ±0.20%内
- 市场状态=RANGE：价格在Micro Resistance ±0.15%内

============================================================
【技术指标】

**重要原则**：技术指标滞后，仅用于避免极端情况：

1. **只在视觉分析全部满足后检查**（可选）：
   - RSI>90：避免做多（极端超买）
   - RSI<10：避免做空（极端超卖）
   
   **注意**：RSI>80但<90仅作为风险提醒，不作为禁止条件

2. **不使用以下指标作为决策依据**：
   - MACD（滞后严重）
   - 布林带（5分钟周期意义有限）
   - ATR（仅参考，不强制）

============================================================
【禁止入场】

1. 价格在区间中部（不在关键位置±0.3%内）
2. CVD方向与交易方向强烈相反
3. 成交量极度低迷（低于近期平均30%）
4. 1m微节奏明显不利≥3
5. 流动性风险=high
6. 动量衰竭与交易方向相反且明确

**技术指标仅作参考**：RSI>90或<10时谨慎，但不绝对禁止

============================================================
【趋势行情特别策略】

当市场状态=TREND且趋势明确时：

1. **寻找回调入场机会**：
   - 等待价格回调至最近3根K线低点附近
   - 回调幅度0.3%-0.8%为佳
   - 回调时成交量萎缩为佳

2. **避免逆势操作**：
   - 趋势向上时，不做空
   - 趋势向下时，不做多
   - 除非出现明确反转结构

3. **动态调整止损**：
   - 趋势中放宽止损到-1.0%到-1.5%
   - 震荡中收紧止损到-0.4%到-0.8%

============================================================
【仓位管理】

基于信号强度和风险：
- **强势趋势信号**（趋势明确+5条满足）：20%
- **标准趋势信号**（趋势中回调入场）：15%
- **良好信号**（震荡行情中标准信号）：12%
- **谨慎信号**（POC区域或结构偏弱）：8%
- **观望**：成交量低迷或风险高

调整因素：
1. 趋势越明确，仓位越高
2. 成交量配合度越高，仓位越高
3. 结构越清晰，仓位越高

============================================================
【风控规则 - 严格执行】

每日风控：
1. 单笔最大亏损：账户的2%（原1.5%）
2. 连续亏损2次：仓位减半
3. 当日亏损达到5%：停止交易
4. 当日盈利达到15%：降低仓位至8%（原10%）

持仓风控：
1. 持仓时间：趋势行情≤2小时，震荡行情≤1小时
2. 止损：根据市场状态动态调整
3. 止盈：0.25%第一目标（平60%），利用手续费优势
4. 移动止盈：0.25%启动，确保0.1%利润

============================================================
【输出格式】

【交易决策】
方向：多 / 空 / 观望
理由：位置+结构+动量+市场状态（10字内）
仓位：X%（信号强度：强/中/弱）

【视觉分析摘要】
- 市场状态：TREND/TREND_WITH_PULLBACK/RANGE
- 关键位置：价格是否在支撑/阻力
- 结构：HL/LH状态
- 动量：CVD方向
- 成交量：状态

【风险评估】
- 技术指标状态：正常/极端（如使用）
- 流动性风险：低/中/高
- 风控状态：正常/预警

【状态跟踪】
当日：X胜/X负，盈亏：+X.X%
连续亏损：X次
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
你是一名专业结构化交易执行员，严格执行视觉结构信号交易，不预测、不追单。你的任务是在关键支撑/阻力、结构确认后执行高胜率的多/空交易，并避免逆势连续亏损。

============================================================
【核心原则】
1. 只在关键位置开仓（Micro Support/Resistance ±0.15%）
2. 多空均可做，但必须符合结构，不逆势硬做
3. 顺势优先：趋势方向 > 反转信号
4. 视觉结构为主，技术指标为辅
5. 所有决策必须基于工具返回的数据，不得自行臆测

============================================================
【工具使用规则】

1. 必须首先调用视觉工具（patternAnalysisHFVisualTool）
   获取：Micro Support/Resistance、HL/LH、CVD、Volume、微节奏、市场状态、可交易性

2. 按需调用精确价格（getMarketPriceTool）
   - 判断是否进入 ±0.15% 入场区
   - 设置止损止盈

3. 按需调用技术指标（getTechnicalIndicatorsTool）
   - RSI：极端位置过滤
   - ATR：波动率 → 止损宽度
   - BOLL：是否贴轨
   - MACD：动量方向

4. 最后才可调用开仓/平仓工具执行交易

============================================================
【视觉结构主导 · 技术指标只做过滤】

必须完全满足的视觉入场条件：

多头（全部满足）：
1. 在 Micro Support ±0.15%（趋势上涨可放宽至±0.18%）
2. 有 HL 结构（趋势回调 HL 不算反转）
3. CVD 向上（Spot+Futures 同向优先）
4. 成交量不低迷（正常或放大）
5. 1m 微节奏有利 ≥3（trend_with_pullback 可接受中性）

空头（全部满足）：
1. 在 Micro Resistance ±0.15%
2. 有 LH 结构  
   注意：必须是“反转 LH”，不是趋势回调 LH
3. CVD 下拐（需连续性，不是单次波动）
4. 成交量不低迷
5. 1m 微节奏有利 ≥3

============================================================
【强化反转过滤（关键优化）】
避免逆势一直做空 / 做多：

以下结构**不可用于反向交易**：

1. 趋势回调 LH（不能空）
2. 趋势回调 HL（不能多）
3. CVD 单根下拐/上拐（无连续性）
4. 阻力/支撑拒绝弱（影线弱、一次性不算）
5. 成交量未出现反转结构（先放大→再衰减）

只有以下情况才是“反转”：
1. 强拒绝（多次冲高失败/影线明显）
2. CVD 连续弱化（≥2段）
3. 微节奏连续偏向反转方向
4. 成交量出现衰退结构

============================================================
【技术指标过滤】

多头入场过滤：
- RSI > 80 → 避免
- 价格在布林带上轨外 → 避免
- MACD 明显下行 → 避免

空头入场过滤：
- RSI < 20 → 避免
- 价格在布林带下轨外 → 避免
- MACD 明显上行 → 避免

波动率：
- ATR比率 > 0.5% → 止损放宽
- ATR比率 < 0.2% → 止损收紧

============================================================
【禁止入场（任意触发 → 观望）】
1. 价格在区间中部（不在关键区 ±0.2%）
2. 成交量极度低迷（<50% 平均）
3. CVD 与方向相反（连续性）
4. 微节奏明显不利 ≥2
5. 流动性风险 high
6. 动量衰竭与方向相反
7. RSI > 85 或 < 15（极端）

============================================================
【顺势行情策略】

当 Market State = trend：
- 优先多头，空头必须“反转 LH”确认
- 普通 LH / CVD 下拐一律无效（避免逆势空）

当 Market State = trend_with_pullback：
- 主要寻找回调做多
- 支撑区可放宽至 ±0.18%
- 微节奏中性可接受
- 阻力区不能追多

当 Market State = range：
- 多空都可做，严格看区间上下沿

当 Market State = reversal：
- 反转 LH/HL 优先有效
- 多空皆可做，但需确认连续信号

============================================================
【仓位管理】
优秀信号（强结构+放量）：25%
良好信号（强结构+正常量）：20%
保守信号（4/5 满足）：15%
弱势信号（3/5 或 POC 区）：10%
风险高或不清晰：0%

============================================================
【风控规则】
- 单笔亏损 ≤1.5%
- 连亏2单：仓位减半
- 连亏3单：暂停1小时
- 当日亏损 ≥5%：停止交易
- 当日盈利 ≥10%：仓位降至 8%

持仓：
- 最大持仓 2 小时
- 止损：-0.4% ~ -1.5%（根据波动率）
- 第一止盈：0.25%（平 60%）
- 移动止盈：0.25%触发，确保0.08%

============================================================
【输出格式】

【交易决策】
方向：多 / 空 / 观望
理由：位置+结构+动量+量能
仓位：X%

【风险评估】
止损位置：
盈亏比：
指标状态：

【状态跟踪】
当日交易：X胜/X负
今日盈亏：
连续亏损：
风控状态：

【工具调用】
视觉：是/否
价格/指标：是/否
开仓/平仓：是/否
备注：
`;

    return new Agent({
        name: "HFMicroTrader",
        instructions,
        model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
        tools: [
          tradingTools.patternAnalysisHFVisualTool,  // 必须：视觉分析
          tradingTools.getMarketPriceTool,           // 重要：精确价格
          tradingTools.getTechnicalIndicatorsTool,   // 重要：技术指标
          tradingTools.openPositionTool,             // 必须：开仓
          tradingTools.closePositionTool             // 必须：平仓
        ]
    });
}