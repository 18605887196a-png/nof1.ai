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




import type {StrategyParams, StrategyPromptContext} from "./types";




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
            low: -1.8,
            mid: -1.2,
            high: -0.8
        },

       // ==================== 移动止盈配置 ====================
      trailingStop: {
          level1: { trigger: 0.8, stopAt: 0.4 },
          level2: { trigger: 1.2, stopAt: 0.7 },
          level3: { trigger: 1.8, stopAt: 1.3 }
      },
// ==================== 分批止盈配置（日内波段优化）====================
      partialTakeProfit: {
          stage1: { trigger: 0.8, closePercent: 40 },
          stage2: { trigger: 1.2, closePercent: 40 },
          stage3: { trigger: 1.8, closePercent: 100 }
      },

      // ==================== 峰值回撤保护 ====================
      peakDrawdownProtection: 2,

       // ==================== 峰值回撤保护 ====================
       baseThreshold: 2,

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

