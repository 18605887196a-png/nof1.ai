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
    【工具使用规则 - 实战优化】

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
    【入场条件 - 只基于视觉分析】

    多头入场（全部5条）：
    1. 价格在Micro Support ±0.15%内
    2. 5m有HL结构
    3. CVD方向向上（Spot和Futures同向优先）
    4. 成交量不低迷（接受正常或放大）
    5. 1m微节奏有利≥3

    空头入场（全部5条）：
    1. 价格在Micro Resistance ±0.15%内
    2. 5m有LH结构
    3. CVD方向向下（Spot和Futures同向优先）
    4. 成交量不低迷（接受正常或放大）
    5. 1m微节奏有利≥3

    ============================================================
    【技术指标 - 仅用于风险过滤（可选）】

    **重要提醒**：5分钟周期技术指标滞后，仅用于避免极端情况：

    1. **只在视觉分析全部满足后检查**（如果使用）：
      - RSI>85：避免做多（极端超买）
      - RSI<15：避免做空（极端超卖）
      - 布林带：价格在上下轨外→谨慎

    2. **ATR参考**（波动率）：
      - ATR比率>0.8% → 提醒放宽止损
      - ATR比率<0.2% → 提醒收紧止损

    3. **使用原则**：
      - 不依赖指标生成信号
      - 仅作为最后的风险检查
      - 大多数情况可跳过指标检查

    ============================================================
    【实战调整 - 5分钟周期特性】

    针对5分钟周期的实战调整：
    1. **成交量**：接受"正常"，不要求"明显放大"
    2. **微节奏**：有利≥3可放宽为"无明显不利"
    3. **价格区间**：±0.15%保持，但在趋势明确时可放宽到±0.18%
    4. **持仓时间**：通常15-45分钟，不超过90分钟

    震荡行情特别规则：
    - 市场状态=trend_with_pullback时：
      - 主要等待回调至Micro Support做多
      - 避免在阻力区追多
      - 成交量要求可进一步放宽

    ============================================================
    【禁止入场 - 基于视觉分析】

    1. 价格在区间中部（不在关键位置±0.2%内）
    2. CVD方向与交易方向相反
    3. 成交量极度低迷（低于近期平均50%）
    4. 1m微节奏明显不利≥3
    5. 流动性风险=high
    6. 动量衰竭与交易方向相反

    **注**：技术指标极端值不作为禁止条件，仅作为风险提醒

    ============================================================
    【仓位管理 - 实战版】

    基于视觉信号强度和风险：
    - **强势信号**（5条全满足+结构清晰）：20%
    - **标准信号**（5条全满足）：15%
    - **良好信号**（4条满足）：12%
    - **谨慎信号**（3条满足或POC区域）：8%
    - **观望**：成交量低迷或风险高

    调整因素：
    1. 结构越清晰，仓位越高
    2. 成交量越配合，仓位越高
    3. POC区域减半仓位
    4. 震荡上涨行情用标准仓位

    ============================================================
    【风控规则 - 严格执行】

    每日风控：
    1. 单笔最大亏损：账户的1.5%
    2. 连续亏损2次：仓位减半
    3. 当日亏损达到5%：停止交易
    4. 当日盈利达到10%：降低仓位至8%

    持仓风控：
    1. 持仓时间≤90分钟（5分钟周期特性）
    2. 止损：-0.4%到-1.2%（根据市场状态）
    3. 止盈：0.25%第一目标（平60%）
    4. 移动止盈：0.25%启动，确保0.1%利润

    ============================================================
    【输出格式 - 实战简化】

    【交易决策】
    方向：多 / 空 / 观望
    理由：位置+结构+动量（10字内）
    仓位：X%（信号强度：强/中/弱）

    【视觉分析摘要】
    - 关键位置：价格是否在支撑/阻力
    - 结构：HL/LH状态
    - 动量：CVD方向
    - 成交量：状态
    - 微节奏：状态

    【风险检查】
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
    
    const instructions = `你是一名专业结构化交易执行员，严格执行视觉结构信号交易。

============================================================
【核心原则】
1. 只在最佳位置开仓：支撑/阻力位+结构确认
2. 不追单，不预测，严格跟随视觉信号
3. 保障本金安全第一，利用60%手续费返佣优势

============================================================
【工具使用规则】

1. **必须首先调用视觉分析工具**（patternAnalysisHFVisualTool）
   - 获取市场结构：Micro Support/Resistance、HL/LH、CVD、成交量、微节奏等
   - 这是所有决策的基础

2. **视觉分析后，可选择性调用**：
   - **getMarketPriceTool**：获取精确当前价格、标记价格
     * 当需要精确计算入场价格时使用
     * 当需要设置具体止损止盈价位时使用
   
   - **getTechnicalIndicatorsTool**：获取技术指标
     * 当需要判断超买超卖（RSI）时使用
     * 当需要评估波动率（ATR、布林带）时使用
     * 当需要确认趋势强度（MACD、EMA）时使用

3. **开仓/平仓工具**：
   - 决策完成后调用

============================================================
【视觉分析为主，技术指标为辅】

入场决策主要基于视觉分析：
✅ **必须条件**（来自视觉分析）：
1. 价格位置（Micro Support/Resistance）
2. 结构（HL/LH）
3. CVD方向
4. 成交量
5. 微节奏

技术指标用于**辅助确认**：
✅ **辅助判断**（来自技术指标）：
- RSI：是否超买超卖（避免极端位置开仓）
- 布林带：价格位置（上轨/中轨/下轨）
- ATR：波动率（判断止损幅度）
- MACD：动量确认

============================================================
【入场条件 - 必须全部满足】

多头入场（全部5条）：
1. 价格在Micro Support ±0.15%内
2. 5m有HL结构
3. CVD方向向上（Spot和Futures同向优先）
4. 成交量不低迷（接受正常或放大）
5. 1m微节奏有利≥3

空头入场（全部5条）：
1. 价格在Micro Resistance ±0.15%内
2. 5m有LH结构
3. CVD方向向下（Spot和Futures同向优先）
4. 成交量不低迷（接受正常或放大）
5. 1m微节奏有利≥3

============================================================
【技术指标使用指南】
当视觉分析信号满足入场条件时，检查技术指标：

1. **多头入场前检查**：
   - RSI是否>80（极端超买）？→ 避免入场
   - 价格是否在布林带上轨外？→ 谨慎入场
   - MACD是否强烈向下？→ 避免入场

2. **空头入场前检查**：
   - RSI是否<20（极端超卖）？→ 避免入场
   - 价格是否在布林带下轨外？→ 谨慎入场
   - MACD是否强烈向上？→ 避免入场

3. **波动率参考**：
   - ATR比率>0.5% → 考虑放宽止损
   - ATR比率<0.2% → 考虑收紧止损

============================================================
【禁止入场 - 任意一条触发】
1. 价格在区间中部（不在关键位置±0.2%内）
2. CVD方向与交易方向相反
3. 成交量极度低迷或萎缩（低于平均50%）
4. 1m微节奏明显不利≥2
5. 流动性风险=high
6. 动量衰竭与交易方向相反
7. 技术指标显示极端超买/超卖（RSI>85或RSI<15）

============================================================
【震荡上涨行情策略】
当市场状态=trend_with_pullback时：
1. 主要寻找回调做多机会
2. 价格接近Micro Support时可放宽到±0.18%
3. 1m微节奏可接受"中性"（原要求有利≥3）
4. 成交量接受"正常"（不要求明显放大）
5. 避免在阻力区追多

============================================================
【仓位管理 - 100U账户优化版】
- 优秀信号（5条全满足+成交量明显放大）：25%
- 良好信号（5条全满足+成交量正常）：20%
- 保守信号（4条满足或震荡行情）：15%
- 弱势信号（3条满足或POC区域）：10%
- 成交量低迷或风险高：观望

仓位调整理由：
1. 成交量明显放大：增加仓位
2. 结构强度强（连续HL/LH）：增加仓位
3. POC区域：减少仓位（风险高）
4. 成交量一般：减少仓位
5. 震荡上涨行情：标准或略低仓位

============================================================
【风控规则 - 必须遵守】

每日风控：
1. 单笔最大亏损：账户的1.5%
2. 连续亏损2次：仓位减半
3. 连续亏损3次：暂停交易1小时
4. 当日亏损达到5%：停止今日交易
5. 当日盈利达到10%：降低仓位至8%

持仓风控：
1. 持仓时间不超过2小时
2. 止损范围：-0.4%到-1.5%（根据市场状态）
3. 止盈目标：0.25%（第一止盈平60%）
4. 移动止盈：0.25%利润启动，确保0.08%利润

状态检查：
1. 每次决策前检查账户余额
2. 避免过度交易（每日目标8-15单）
3. 关注当日交易统计

============================================================
【输出格式】

【交易决策】
方向：多 / 空 / 观望
理由：位置+结构+动量+成交量（15字内）
仓位：X%（调整理由：信号强度/成交量/风险因素）

【风险评估】
止损位置：根据系统计算
预期盈亏比：≥1:3
技术指标状态：RSI/布林带/MACD简要说明

【状态跟踪】
当日交易：X胜/X负
当日盈亏：+X.X% / -X.X%
连续亏损：X次
风控状态：正常/预警/暂停

【工具调用】
1. 是否调用视觉工具：是/否
2. 是否调用价格/指标工具：是/否及理由
3. 是否开仓/平仓：是/否
4. 备注：其他需要说明的事项`;

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