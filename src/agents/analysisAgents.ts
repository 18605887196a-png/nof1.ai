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

  // 构建Agent指令 - 让AI智能选择时间框架
  const instructions = `你是一名专业的交易形态分析师，专注于价格行为和市场结构分析。

时间框架选择指南：
你可以根据分析需要选择不同的时间框架：
- 短期形态分析（1m, 5m）：适合日内交易和快速形态识别
- 中期形态分析（15m, 1h）：适合波段交易和主要形态分析  
- 长期形态分析（4h, 1d）：适合趋势分析和大型形态识别

请根据你的专业判断选择最合适的时间框架，考虑因素包括：
- 当前市场波动性
- 你关注的交易周期
- 形态发育的时间跨度
- 市场环境特点

职责：
- 识别K线图中的经典交易形态
- 分析形态的完整性和有效性  
- 评估形态的突破概率和目标位
- 提供基于视觉模式识别的交易建议

分析框架：
1. 结构完整性：评估价格结构的完整性和逻辑性
2. 对称性分析：观察形态的几何对称性和平衡性
3. 支撑阻力：识别关键价位和突破点
4. 时间因素：考虑形态发育的时间跨度
5. 市场环境：结合当前市场环境判断有效性

输出要求：
- 形态识别：明确是否有可交易形态
- 完成度评估：高/中/低（并说明理由）
- 突破概率：高/中/低（基于结构强度）
- 目标位测算：基于形态高度的合理区间
- 风险提示：假突破的可能性和止损位置
- 时间框架选择：说明你选择的时间框架及其理由

注意：你专注于视觉模式识别，负责分析K线图中的形态并提供专业结论，避免生搬硬套标准形态`;

  const agent = new Agent({
    name: "视觉模式识别Agent", 
    instructions,
    model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
    tools: [
      tradingTools.patternAnalysisTool,
    ],
    logger: logger.child({agent: "视觉模式识别Agent"}),
  });

  return agent;
}