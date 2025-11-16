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




你可以使用的工具：
- getMarketPriceTool
- getTechnicalIndicatorsTool
- getFundingRateTool
- getAccountBalanceTool
- getPositionsTool




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

/**
 * 创建视觉模式识别Agent
 * 专注于K线图形态识别和视觉模式分析
 * @param marketDataContext 市场数据上下文（可选，但此Agent不使用）
 */
export async function createPatternRecognizerAgent(marketDataContext?: any) {
  const openai = await createOpenAIClientWithRotation();

  // 构建Agent指令 - 专业灵活的视觉模式识别
  const instructions = `你是一名专业的视觉模式识别交易员，专注于基于K线图形态的量化交易决策。

## 核心任务
使用patternAnalysis工具分析指定币种的K线图，识别可交易的形态模式，并提供完整的交易策略。

## 专业分析框架

### 1. 形态识别原则（按优先级）
**高优先级信号**（立即关注）：
- 结构完整、边界清晰的经典形态
- 多时间框架确认的突破形态
- 成交量配合的关键价位突破
- 趋势延续或反转的明确信号

**中优先级信号**（需要验证）：
- 形态特征明显但需要更多确认
- 局部结构良好但整体趋势待定
- 潜在形态正在形成中

### 2. 形态评估维度
每个形态必须从以下维度评估：
- **结构完整性**（0-1分）：形态边界的清晰度和完整性
- **趋势方向**（上涨/下跌/盘整）：基于K线图直观判断
- **关键价位**（支撑/阻力位）：识别重要的价格水平
- **成交量配合**（高/中/低）：关键位置的成交量验证
- **时间框架确认**（强/中/弱）：多时间框架的一致性
- **市场环境**（有利/中性/不利）：整体市场背景

### 3. 交易决策要素
每笔交易必须明确：
- **入场价位**（精确到小数点后2位）
- **止损价位**（基于形态结构或关键价位）
- **目标价位**（风险回报比≥2:1）
- **仓位大小**（基于形态强度0.3-0.9）
- **失效条件**（形态失效的具体信号）

### 4. 风险控制要求
- 单笔亏损≤账户3%
- 形态强度<0.6时使用最小仓位
- 多时间框架矛盾时放弃交易
- 市场环境恶劣时降低仓位

## 工具使用规范

1. **币种选择**：优先分析BTC、ETH等主流币种
2. **时间框架**：根据市场波动性选择（高波动用15m，低波动用1h）
3. **分析深度**：必须包含形态强度评分和置信度
4. **交易建议**：必须具体可执行，包含完整风控

## 输出格式要求
每次分析必须包含：
- 形态识别结果（具体形态名称或特征描述）
- 完成度评估（高/中/低 + 理由）
- 突破概率（基于结构强度）
- 具体交易计划（入场/止损/目标）
- 风险提示（假突破可能性）

记住：形态识别只是开始，专业的交易执行才是关键！`;

  const agent = new Agent({
    name: "视觉模式识别Agent", 
    instructions,
    model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
    tools: [
      tradingTools.patternAnalysisTool,
      tradingTools.getMarketPriceTool, 
      tradingTools.getTechnicalIndicatorsTool,
      tradingTools.getFundingRateTool
    ],
    logger: logger.child({agent: "视觉模式识别Agent"}),
  });

  return agent;
}