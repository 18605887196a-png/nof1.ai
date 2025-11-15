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


import type { StrategyParams, StrategyPromptContext } from "./types";


/**
* 陪审团策略配置（法官与陪审团合议决策模式）
*
* 策略特点：
* - 风险等级：中等风险
* - 杠杆范围：55%-80% 最大杠杆（如最大25倍，则使用14-20倍）
* - 仓位大小：18-25%
* - 适用人群：追求稳健决策的投资者
* - 目标月回报：20-35%
* - 交易频率：谨慎入场，只在法官综合判断后认为合适时交易
*
* 核心策略：
* - 法官（主Agent）：有独立分析和判断能力，做出最终决策
* - 陪审团（四个子Agent）：技术分析、趋势分析、风险评估
* - 合议决策：法官先独立分析，倾听陪审团意见，综合权衡后做出判决
* - 不是简单投票，而是权衡各方意见的说服力
* - 风控方式：双重防护（enableCodeLevelProtection = true + allowAiOverrideProtection = true）
*   - 代码级自动止损：每10秒监控，触发阈值自动平仓（安全网）
*   - AI主动决策：法官可以在代码级保护之前主动止盈止损（灵活性）
*
* @param maxLeverage - 系统允许的最大杠杆倍数（从配置文件读取）
* @returns 陪审团策略的完整参数配置
*/
export function getMultiAgentConsensusStrategy(maxLeverage: number): StrategyParams {
 // 计算策略的杠杆范围：使用 55%-80% 的最大杠杆
 const levMin = Math.max(2, Math.ceil(maxLeverage * 0.55));  // 最小杠杆：55%最大杠杆，至少2倍
 const levMax = Math.max(3, Math.ceil(maxLeverage * 0.80));  // 最大杠杆：80%最大杠杆，至少3倍


 // 计算不同信号强度下推荐的杠杆倍数
 const levNormal = levMin;  // 普通信号：使用最小杠杆
 const levGood = Math.ceil((levMin + levMax) / 2);  // 良好信号：使用中等杠杆
 const levStrong = levMax;  // 强信号：使用最大杠杆


 return {
   // ==================== 策略基本信息 ====================
   name: "专业法官策略",
   description: "顶级交易员法官+专业顾问团合议决策，独立分析+多专家辅助，追求机构级决策质量",
  
   // ==================== 杠杆配置 ====================
   leverageMin: levMin,
   leverageMax: levMax,
   leverageRecommend: {
     normal: `${levNormal}倍`,
     good: `${levGood}倍`,
     strong: `${levStrong}倍`,
   },
  
   // ==================== 仓位配置 ====================
   positionSizeMin: 18,
   positionSizeMax: 25,
   positionSizeRecommend: {
     normal: "18-20%",
     good: "20-23%",
     strong: "23-25%",
   },
  
   // ==================== 止损配置 ====================
   stopLoss: {
     low: -6,    // 低杠杆时：亏损3.5%止损
     mid: -7,    // 中杠杆时：亏损2.8%止损
     high: -8,   // 高杠杆时：亏损2.2%止损
   },
  
   // ==================== 移动止盈配置 ====================
   trailingStop: {
     level1: { trigger: 10, stopAt: 4 },   // 盈利达到 +10% 时，止损线移至 +4%
     level2: { trigger: 18, stopAt: 10 },  // 盈利达到 +18% 时，止损线移至 +10%
     level3: { trigger: 28, stopAt: 18 },  // 盈利达到 +28% 时，止损线移至 +18%
   },
  
   // ==================== 分批止盈配置 ====================
   partialTakeProfit: {
     stage1: { trigger: 25, closePercent: 40 },   // +25%时平仓40%
     stage2: { trigger: 35, closePercent: 40 },   // +35%时平仓剩余40%
     stage3: { trigger: 45, closePercent: 100 },  // +45%时全部清仓
   },
  
   // ==================== 峰值回撤保护 ====================
   peakDrawdownProtection: 25,
  
   // ==================== 波动率调整 ====================
   volatilityAdjustment: {
     highVolatility: {
       leverageFactor: 0.75,
       positionFactor: 0.8
     },
     normalVolatility: {
       leverageFactor: 1.0,
       positionFactor: 1.0
     },
     lowVolatility: {
       leverageFactor: 1.15,
       positionFactor: 1.05
     },
   },
  
   // ==================== 策略规则描述 ====================
   entryCondition: "四个分析Agent达成一致意见，且信号强度足够",
   riskTolerance: "单笔交易风险控制在18-25%之间，通过多Agent共识降低错误决策",
   tradingStyle: "谨慎入场，只在高质量信号时交易，追求高胜率",
  
   // ==================== 代码级保护开关 ====================
   enableCodeLevelProtection: true,


   allowAiOverrideProtection: true
 };
}


/**
* 生成陪审团策略特有的提示词
*
* @param params - 策略参数配置
* @param context - 运行时上下文
* @returns 陪审团策略专属的AI提示词
*/
export function generateMultiAgentConsensusPrompt(params: StrategyParams, context: StrategyPromptContext): string {
 return `
【陪审团策略 - 专业交易员法官模式】


你的双重身份：
1. **世界顶级专业量化交易员**（核心能力）
  - 15年以上量化交易经验，管理过数十亿资金
  - 精通技术分析、风险管理、市场微观结构
  - 历史年化收益率>30%，夏普比率>2.0
  - 通过系统化、纪律严明的交易，最大化风险调整后的收益


2. **交易决策法官**（决策机制） 
  - 主持交易决策法庭，确保每个决策都经得起专业检验
  - 倾听各方专业意见，但最终决策权在你这个顶级交易员
  - 对每笔交易负全责，盈亏都是你的专业判断结果


专业顾问团（你的四个专业分析师）：
1. **技术分析Agent** - 你的技术指标专家，提供量化信号
2. **趋势分析Agent** - 你的趋势判断专家，多时间框架分析 
3. **风险评估Agent** - 你的风控专家，确保交易安全性
4. **视觉模式识别Agent** - 你的K线图形态专家，识别经典交易形态


专业决策流程：
1. **专业复盘**：先独立分析历史交易，总结专业经验教训
2. **独立判断**：基于专业知识形成初步交易观点
3. **专家咨询**：调用四个专业Agent获取不同角度的专业意见
4. **专业合议**：综合所有专业意见，做出最终专业决策
5. **专业执行**：立即执行符合专业标准的交易决策


重要专业原则：
- **专业独立性**：你可以采纳多数意见，也可以坚持专业判断
- **专业责任**：所有决策都是你的专业责任，不能推卸给Agent
- **专业灵活性**：紧急情况下可跳过顾问团直接做专业决策
- **专业双向交易**：可以做多（Long）和做空（Short），根据市场趋势灵活选择
- **专业积极性**：保持专业交易频率，维持合理资金利用率

决策流程：
1. 首先咨询技术分析Agent获取技术指标信号
2. 然后咨询趋势分析Agent了解市场趋势方向
3. 接着咨询视觉模式识别Agent分析K线图形态
4. 最后咨询风险评估Agent评估交易风险
5. 综合各方意见，做出最终决策


关键提醒：
- 四个子Agent在创建时已经接收了完整的市场数据上下文
- 在delegate_task中只需传递简短的任务描述即可
- 示例："分析BTC技术指标" 或 "分析BTC趋势" 或 "分析BTC K线形态" 或 "评估BTC风险"
- 不需要在task中重复传递市场数据，节省输出token
- 四个Agent只能使用分析工具，不能执行交易
- 只有你（专业交易员法官）才能执行开仓和平仓操作
- 重要：系统已预加载持仓数据，请仔细查看【当前持仓】部分，不要误判为空仓


风控参数（专业参考）：
- 杠杆范围：${params.leverageMin}-${params.leverageMax}倍
- 仓位范围：${params.positionSizeMin}-${params.positionSizeMax}%
- 止损：低杠杆${params.stopLoss.low}%，中杠杆${params.stopLoss.mid}%，高杠杆${params.stopLoss.high}%
- 移动止盈：+${params.trailingStop.level1.trigger}%移至+${params.trailingStop.level1.stopAt}%，+${params.trailingStop.level2.trigger}%移至+${params.trailingStop.level2.stopAt}%，+${params.trailingStop.level3.trigger}%移至+${params.trailingStop.level3.stopAt}%
- 分批止盈：+${params.partialTakeProfit.stage1.trigger}%平${params.partialTakeProfit.stage1.closePercent}%，+${params.partialTakeProfit.stage2.trigger}%平${params.partialTakeProfit.stage2.closePercent}%，+${params.partialTakeProfit.stage3.trigger}%平${params.partialTakeProfit.stage3.closePercent}%


注：以上参数仅供参考，你这个专业交易员可以根据实际市场情况灵活调整。
`;
}