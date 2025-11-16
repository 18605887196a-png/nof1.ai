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
* 视觉模式识别策略配置（基于K线图形态分析的交易模式）
*
* 策略特点：
* - 风险等级：中等风险
* - 杠杆范围：60%-85% 最大杠杆
* - 仓位大小：20-28%
* - 适用人群：偏好技术分析和图表形态的交易者
* - 目标月回报：25-40%
* - 交易频率：基于形态识别信号，高质量信号时入场
*
* 核心策略：
* - 完全基于K线图视觉模式识别进行交易决策
* - 使用AI视觉模型分析图表形态（头肩顶、双底、三角形等）
* - 结合技术指标验证形态有效性
* - 风控方式：双重防护（enableCodeLevelProtection = true + allowAiOverrideProtection = true）
*
* @param maxLeverage - 系统允许的最大杠杆倍数（从配置文件读取）
* @returns 视觉模式识别策略的完整参数配置
*/
export function getVisualPatternStrategy(maxLeverage: number): StrategyParams {
 // 计算策略的杠杆范围：使用 60%-85% 的最大杠杆
 const levMin = Math.max(2, Math.ceil(maxLeverage * 0.60));  // 最小杠杆：60%最大杠杆，至少2倍
 const levMax = Math.max(3, Math.ceil(maxLeverage * 0.85));  // 最大杠杆：85%最大杠杆，至少3倍

 // 计算不同信号强度下推荐的杠杆倍数
 const levNormal = levMin;  // 普通信号：使用最小杠杆
 const levGood = Math.ceil((levMin + levMax) / 2);  // 良好信号：使用中等杠杆
 const levStrong = levMax;  // 强信号：使用最大杠杆

 return {
   // ==================== 策略基本信息 ====================
   name: "视觉模式识别策略",
   description: "基于AI视觉模型分析K线图形态，识别经典交易模式，结合技术指标验证，追求高胜率交易",
  
   // ==================== 杠杆配置 ====================
   leverageMin: levMin,
   leverageMax: levMax,
   leverageRecommend: {
     normal: `${levNormal}倍`,
     good: `${levGood}倍`,
     strong: `${levStrong}倍`,
   },
  
   // ==================== 仓位配置 ====================
   positionSizeMin: 20,
   positionSizeMax: 28,
   positionSizeRecommend: {
     normal: "20-22%",
     good: "22-25%",
     strong: "25-28%",
   },
  
   // ==================== 止损配置 ====================
   stopLoss: {
     low: -5.5,    // 低杠杆时：亏损5.5%止损
     mid: -6.5,    // 中杠杆时：亏损6.5%止损
     high: -7.5,   // 高杠杆时：亏损7.5%止损
   },
  
   // ==================== 移动止盈配置 ====================
   trailingStop: {
     level1: { trigger: 12, stopAt: 6 },   // 盈利达到 +12% 时，止损线移至 +6%
     level2: { trigger: 20, stopAt: 12 },  // 盈利达到 +20% 时，止损线移至 +12%
     level3: { trigger: 32, stopAt: 20 },  // 盈利达到 +32% 时，止损线移至 +20%
   },
  
   // ==================== 分批止盈配置 ====================
   partialTakeProfit: {
     stage1: { trigger: 28, closePercent: 30 },   // +28%时平仓30%
     stage2: { trigger: 40, closePercent: 40 },   // +40%时平仓剩余40%
     stage3: { trigger: 55, closePercent: 100 },  // +55%时全部清仓
   },
  
   // ==================== 峰值回撤保护 ====================
   peakDrawdownProtection: 30,
  
   // ==================== 波动率调整 ====================
   volatilityAdjustment: {
     highVolatility: {
       leverageFactor: 0.7,
       positionFactor: 0.75
     },
     normalVolatility: {
       leverageFactor: 1.0,
       positionFactor: 1.0
     },
     lowVolatility: {
       leverageFactor: 1.2,
       positionFactor: 1.1
     },
   },
  
   // ==================== 策略规则描述 ====================
   entryCondition: "识别出明确的K线图形态信号，且技术指标验证有效",
   riskTolerance: "单笔交易风险控制在20-28%之间，基于形态识别的高胜率特性",
   tradingStyle: "基于形态识别信号入场，追求高质量交易机会",
  
   // ==================== 代码级保护开关 ====================
   enableCodeLevelProtection: true,
   allowAiOverrideProtection: true
 };
}


/**
* 生成视觉模式识别策略特有的提示词
*
* @param params - 策略参数配置
* @param context - 运行时上下文
* @returns 视觉模式识别策略专属的AI提示词
*/
export function generateVisualPatternPrompt(params: StrategyParams, context: StrategyPromptContext): string {
 return `
【视觉模式识别策略 - 图表形态分析专家】

你的专业身份：
**顶级图表形态分析师** - 专注于K线图视觉模式识别和价格行为分析

核心能力：
- 精通各种经典K线图形态（头肩顶/底、双顶/底、三角形、旗形、楔形等）
- 能够识别形态的完成度、突破概率和有效性
- 结合技术指标验证形态信号
- 基于形态分析制定精确的入场点和目标位

交易决策流程：
1. **形态识别**：使用视觉模式识别工具分析当前K线图
2. **形态评估**：判断形态的完成度、对称性和有效性
3. **市场深度验证**：使用订单簿工具验证形态突破的真实性
4. **支撑阻力确认**：结合科学趋势线工具确认关键价位
5. **交易决策**：基于综合分析制定具体的交易计划
6. **风险管理**：根据形态特点设置合理的止损止盈

重要交易原则：
- **形态优先**：所有交易决策必须基于明确的K线图形态信号
- **突破确认**：等待形态突破确认后再入场，避免假突破
- **深度验证**：使用订单簿工具验证突破的真实性
- **目标测算**：基于形态高度合理测算目标价位
- **风险控制**：止损设置在形态的关键支撑/阻力位之外

形态分析要点：
- **头肩形态**：识别颈线位置，测算突破目标
- **双顶/双底**：确认颈线突破，计算目标高度
- **三角形整理**：观察收敛程度，判断突破方向
- **旗形/楔形**：识别中继形态，测算后续目标

【关键工具使用指导】

1. **视觉形态识别工具 (patternAnalysis)**
   - 主要用途：识别K线图形态信号
   - 使用时机：每次交易决策前
   - 重点关注：形态对称性、成交量配合、突破信号

2. **订单簿深度分析工具 (analyzeOrderBookDepth)**
   - 主要用途：验证形态突破的真实性
   - 使用时机：形态识别后，确认突破时
   - 重点关注：
     - 流动性风险评估
     - 大额订单分布
     - 买卖盘深度比例
     - 基于订单簿的即时支撑阻力位

3. **科学趋势线分析工具 (scientificTrendlineAnalysis)**
   - 主要用途：确认长期支撑阻力位
   - 使用时机：形态分析完成后
   - 重点关注：
     - 基于历史价格的支撑阻力位
     - 趋势线拟合质量
     - 价格通道位置

【工具协同使用策略】

形态识别 → 订单簿验证 → 趋势线确认 → 交易决策

1. **形态识别阶段**：使用patternAnalysis识别形态信号
2. **突破验证阶段**：使用analyzeOrderBookDepth验证突破强度
3. **价位确认阶段**：使用scientificTrendlineAnalysis确认关键价位
4. **最终决策阶段**：综合所有分析结果制定交易计划

风控参数（专业参考）：
- 杠杆范围：${params.leverageMin}-${params.leverageMax}倍
- 仓位范围：${params.positionSizeMin}-${params.positionSizeMax}%
- 止损：低杠杆${params.stopLoss.low}%，中杠杆${params.stopLoss.mid}%，高杠杆${params.stopLoss.high}%
- 移动止盈：+${params.trailingStop.level1.trigger}%移至+${params.trailingStop.level1.stopAt}%，+${params.trailingStop.level2.trigger}%移至+${params.trailingStop.level2.stopAt}%，+${params.trailingStop.level3.trigger}%移至+${params.trailingStop.level3.stopAt}%
- 分批止盈：+${params.partialTakeProfit.stage1.trigger}%平${params.partialTakeProfit.stage1.closePercent}%，+${params.partialTakeProfit.stage2.trigger}%平${params.partialTakeProfit.stage2.closePercent}%，+${params.partialTakeProfit.stage3.trigger}%平${params.partialTakeProfit.stage3.closePercent}%

关键提醒：
- 系统已预加载持仓数据，请仔细查看【当前持仓】部分
- 可以做多（Long）和做空（Short），根据形态突破方向选择
- 订单簿工具提供实时市场深度，帮助验证形态突破
- 科学趋势线工具提供长期支撑阻力位参考

【特别注意事项】

假突破风险防范：
- 使用订单簿工具检查突破时的买卖盘深度
- 确认突破时有足够的成交量配合
- 避免在流动性不足时入场

形态有效性验证：
- 科学趋势线工具确认的支撑阻力位应与形态分析一致
- 订单簿深度比例应支持突破方向
- 多个时间周期确认形态有效性

注：以上参数仅供参考，你这个专业形态分析师可以根据实际形态特点灵活调整。
`;
}