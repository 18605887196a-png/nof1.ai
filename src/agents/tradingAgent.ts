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

/**
 * 交易 Agent 配置（极简版）
 */
import { Agent, Memory } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createLogger } from "../utils/loggerUtils";
import { createOpenAI } from "@ai-sdk/openai";
import * as tradingTools from "../tools/trading";
import { formatChinaTime } from "../utils/timeUtils";
import { RISK_PARAMS } from "../config/riskParams";

/**
 * 账户风险配置
 */
export interface AccountRiskConfig {
  stopLossUsdt: number;
  takeProfitUsdt: number;
  syncOnStartup: boolean;
}

/**
 * 从环境变量读取账户风险配置
 */
export function getAccountRiskConfig(): AccountRiskConfig {
  return {
    stopLossUsdt: Number.parseFloat(process.env.ACCOUNT_STOP_LOSS_USDT || "50"),
    takeProfitUsdt: Number.parseFloat(process.env.ACCOUNT_TAKE_PROFIT_USDT || "10000"),
    syncOnStartup: process.env.SYNC_CONFIG_ON_STARTUP === "true",
  };
}

/**
 * 导入策略类型和参数
 */
import type { TradingStrategy, StrategyParams, StrategyPromptContext } from "../strategies";
import { getStrategyParams as getStrategyParamsBase, generateStrategySpecificPrompt } from "../strategies";

// 重新导出类型供外部使用
export type { TradingStrategy, StrategyParams };

/**
 * 获取策略参数（包装函数，自动传入 MAX_LEVERAGE）
 */
export function getStrategyParams(strategy: TradingStrategy): StrategyParams {
  return getStrategyParamsBase(strategy, RISK_PARAMS.MAX_LEVERAGE);
}

const logger = createLogger({
  name: "trading-agent",
  level: "debug",
});

/**
 * 从环境变量读取交易策略
 */
export function getTradingStrategy(): TradingStrategy {
  const strategy = process.env.TRADING_STRATEGY || "balanced";
  if (strategy === "conservative" || strategy === "balanced" || strategy === "aggressive" || strategy === "ultra-short" || strategy === "swing-trend" || strategy === "rebate-farming" || strategy === "ai-autonomous" || strategy === "multi-agent-consensus") {
    return strategy;
  }
  logger.warn(`未知的交易策略: ${strategy}，使用默认策略: balanced`);
  return "balanced";
}

/**
 * 生成AI自主策略的交易提示词（极简版，只提供数据和工具）
 */
function generateAiAutonomousPromptForCycle(data: {
  minutesElapsed: number;
  iteration: number;
  intervalMinutes: number;
  marketData: any;
  accountInfo: any;
  positions: any[];
  tradeHistory?: any[];
  recentDecisions?: any[];
}): string {
  const { minutesElapsed, iteration, intervalMinutes, marketData, accountInfo, positions, tradeHistory, recentDecisions } = data;
  const currentTime = formatChinaTime();
  
  let prompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【交易周期 #${iteration}】${currentTime}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

已运行: ${minutesElapsed} 分钟
执行周期: 每 ${intervalMinutes} 分钟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【系统硬性风控底线】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 单笔亏损 ≤ ${RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT}%：系统强制平仓
• 持仓时间 ≥ ${RISK_PARAMS.MAX_HOLDING_HOURS} 小时：系统强制平仓
• 最大杠杆：${RISK_PARAMS.MAX_LEVERAGE} 倍
• 最大持仓数：${RISK_PARAMS.MAX_POSITIONS} 个
• 可交易币种：${RISK_PARAMS.TRADING_SYMBOLS.join(", ")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【当前账户状态】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

总资产: ${(accountInfo?.totalBalance ?? 0).toFixed(2)} USDT
可用余额: ${(accountInfo?.availableBalance ?? 0).toFixed(2)} USDT
未实现盈亏: ${(accountInfo?.unrealisedPnl ?? 0) >= 0 ? '+' : ''}${(accountInfo?.unrealisedPnl ?? 0).toFixed(2)} USDT
持仓数量: ${positions?.length ?? 0} 个

`;

  // 输出持仓信息
  if (positions && positions.length > 0) {
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【当前持仓】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    for (const pos of positions) {
      const holdingMinutes = Math.floor((new Date().getTime() - new Date(pos.opened_at).getTime()) / (1000 * 60));
      const holdingHours = (holdingMinutes / 60).toFixed(1);
      
      // 计算盈亏百分比
      const entryPrice = pos.entry_price ?? 0;
      const currentPrice = pos.current_price ?? 0;
      const unrealizedPnl = pos.unrealized_pnl ?? 0;
      let pnlPercent = 0;
      
      if (entryPrice > 0 && currentPrice > 0) {
        if (pos.side === 'long') {
          pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100 * (pos.leverage ?? 1);
        } else {
          pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100 * (pos.leverage ?? 1);
        }
      }
      
      prompt += `${pos.contract} ${pos.side === 'long' ? '做多' : '做空'}:\n`;
      
      prompt += `  持仓量: ${pos.quantity ?? 0} 张\n`;
      prompt += `  杠杆: ${pos.leverage ?? 1}x\n`;
      prompt += `  入场价: ${entryPrice.toFixed(2)}\n`;
      prompt += `  当前价: ${currentPrice.toFixed(2)}\n`;
      prompt += `  盈亏: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} USDT)\n`;
      prompt += `  持仓时间: ${holdingHours} 小时\n\n`;
    }
  } else {
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【当前持仓】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

无持仓

`;
  }

  // 输出市场数据
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【市场数据】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

注意：所有价格和指标数据按时间顺序排列（最旧 → 最新）

`;

  // 输出每个币种的市场数据
  if (marketData) {
    for (const [symbol, dataRaw] of Object.entries(marketData)) {
      const data = dataRaw as any;
      
      prompt += `\n【${symbol}】\n`;
      prompt += `当前价格: ${(data?.price ?? 0).toFixed(1)}\n`;
      prompt += `EMA20: ${(data?.ema20 ?? 0).toFixed(3)}\n`;
      prompt += `MACD: ${(data?.macd ?? 0).toFixed(3)}\n`;
      prompt += `RSI(7): ${(data?.rsi7 ?? 0).toFixed(3)}\n`;
      
      if (data?.fundingRate !== undefined) {
        prompt += `资金费率: ${data.fundingRate.toExponential(2)}\n`;
      }
      
      prompt += `\n`;
      
      // 输出多时间框架数据
      if (data?.multiTimeframe) {
        for (const [timeframe, tfData] of Object.entries(data.multiTimeframe)) {
          const tf = tfData as any;
          prompt += `${timeframe} 时间框架:\n`;
          prompt += `  价格序列: ${(tf?.prices ?? []).map((p: number) => p.toFixed(1)).join(', ')}\n`;
          prompt += `  EMA20序列: ${(tf?.ema20 ?? []).map((e: number) => e.toFixed(2)).join(', ')}\n`;
          prompt += `  MACD序列: ${(tf?.macd ?? []).map((m: number) => m.toFixed(3)).join(', ')}\n`;
          prompt += `  RSI序列: ${(tf?.rsi ?? []).map((r: number) => r.toFixed(1)).join(', ')}\n`;
          prompt += `  成交量序列: ${(tf?.volumes ?? []).map((v: number) => v.toFixed(0)).join(', ')}\n\n`;
        }
      }
    }
  }

  // 输出历史交易记录（如果有）
  if (tradeHistory && tradeHistory.length > 0) {
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【最近交易记录】（最近10笔）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    let profitCount = 0;
    let lossCount = 0;
    let totalProfit = 0;
    
    for (const trade of tradeHistory.slice(0, 10)) {
      const tradeTime = formatChinaTime(trade.timestamp);
      const pnl = trade?.pnl ?? 0;
      
      // 计算收益率（如果有pnl和价格信息）
      let pnlPercent = 0;
      if (pnl !== 0 && trade.price && trade.quantity && trade.leverage) {
        const positionValue = trade.price * trade.quantity / trade.leverage;
        if (positionValue > 0) {
          pnlPercent = (pnl / positionValue) * 100;
        }
      }
      
      prompt += `${trade.symbol}_USDT ${trade.side === 'long' ? '做多' : '做空'}:\n`;
      prompt += `  时间: ${tradeTime}\n`;
      prompt += `  盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT\n`;
      if (pnlPercent !== 0) {
        prompt += `  收益率: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n`;
      }
      prompt += `\n`;
      
      if (pnl > 0) {
        profitCount++;
      } else if (pnl < 0) {
        lossCount++;
      }
      totalProfit += pnl;
    }
    
    // 添加统计信息
    if (profitCount > 0 || lossCount > 0) {
      const winRate = profitCount / (profitCount + lossCount) * 100;
      prompt += `最近10笔交易统计:\n`;
      prompt += `  胜率: ${winRate.toFixed(1)}%\n`;
      prompt += `  盈利交易: ${profitCount}笔\n`;
      prompt += `  亏损交易: ${lossCount}笔\n`;
      prompt += `  净盈亏: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} USDT\n\n`;
    }
  }

  // 输出历史决策记录（如果有）
  if (recentDecisions && recentDecisions.length > 0) {
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【历史决策记录】（最近5次）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    for (let i = 0; i < Math.min(5, recentDecisions.length); i++) {
      const decision = recentDecisions[i];
      const decisionTime = formatChinaTime(decision.timestamp);
      const timeDiff = Math.floor((new Date().getTime() - new Date(decision.timestamp).getTime()) / (1000 * 60));
      
      prompt += `周期 #${decision.iteration} (${decisionTime}，${timeDiff}分钟前):\n`;
      prompt += `  账户价值: ${(decision?.account_value ?? 0).toFixed(2)} USDT\n`;
      prompt += `  持仓数量: ${decision?.positions_count ?? 0}\n`;
      prompt += `  决策内容: ${decision?.decision ?? '无'}\n\n`;
    }
    
    prompt += `注意：以上是历史决策记录，仅供参考。请基于当前最新数据独立判断。\n\n`;
  }
  
  // 添加自我复盘要求
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【自我复盘要求】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

在做出交易决策之前，请先进行自我复盘：

1. **回顾最近交易表现**：
   - 分析最近的盈利交易：什么做对了？（入场时机、杠杆选择、止盈策略等）
   - 分析最近的亏损交易：什么做错了？（入场过早/过晚、杠杆过高、止损不及时等）
   - 当前胜率如何？是否需要调整策略？

2. **评估当前策略有效性**：
   - 当前使用的交易策略是否适应市场环境？
   - 杠杆和仓位管理是否合理？
   - 是否存在重复犯错的模式？

3. **识别改进空间**：
   - 哪些方面可以做得更好？
   - 是否需要调整风险管理方式？
   - 是否需要改变交易频率或持仓时间？

4. **制定改进计划**：
   - 基于复盘结果，本次交易应该如何调整策略？
   - 需要避免哪些之前犯过的错误？
   - 如何提高交易质量？

**复盘输出格式**：
在做出交易决策前，请先输出你的复盘思考（用文字描述），然后再执行交易操作。

例如：
\`\`\`
【复盘思考】
- 最近3笔交易中，2笔盈利1笔亏损，胜率66.7%
- 盈利交易的共同点：都是在多时间框架共振时入场，使用了适中的杠杆（10-15倍）
- 亏损交易的问题：入场过早，没有等待足够的确认信号，且使用了过高的杠杆（20倍）
- 改进计划：本次交易将更加耐心等待信号确认，杠杆控制在15倍以内
- 当前市场环境：BTC处于震荡区间，应该降低交易频率，只在明确信号时入场

【本次交易决策】
（然后再执行具体的交易操作）
\`\`\`

`;

  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【可用工具】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• openPosition: 开仓（做多或做空）
  - 参数: symbol（币种）, side（long/short）, leverage（杠杆）, amountUsdt（金额）
  - 手续费: 约 0.05%

• closePosition: 平仓
  - 参数: symbol（币种）, closePercent（平仓百分比，默认100%）
  - 手续费: 约 0.05%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【开始交易】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请基于以上市场数据和账户信息，完全自主地分析市场并做出交易决策。
你可以选择：
1. 开新仓位（做多或做空）
2. 平掉现有仓位
3. 继续持有
4. 观望不交易

记住：
- 没有任何策略建议和限制（除了系统硬性风控底线）
- 完全由你自主决定交易策略
- 完全由你自主决定风险管理
- 完全由你自主决定何时交易

现在请做出你的决策并执行。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return prompt;
}

/**
 * 生成交易提示词（参照 1.md 格式）
 */
export function generateTradingPrompt(data: {
  minutesElapsed: number;
  iteration: number;
  intervalMinutes: number;
  marketData: any;
  accountInfo: any;
  positions: any[];
  tradeHistory?: any[];
  recentDecisions?: any[];
}): string {
  const { minutesElapsed, iteration, intervalMinutes, marketData, accountInfo, positions, tradeHistory, recentDecisions } = data;
  const currentTime = formatChinaTime();
  
  // 获取当前策略参数（用于每周期强调风控规则）
  const strategy = getTradingStrategy();
  const params = getStrategyParams(strategy);
  // 判断是否启用自动监控止损和移动止盈（根据策略配置）
  const isCodeLevelProtectionEnabled = params.enableCodeLevelProtection;
  // 判断是否允许AI在代码级保护之外继续主动操作（双重防护模式）
  const allowAiOverride = params.allowAiOverrideProtection === true;
  
  // 如果是AI自主策略，使用完全不同的提示词格式
  if (strategy === "ai-autonomous") {
    return generateAiAutonomousPromptForCycle(data);
  }
  
  // 生成止损规则描述（基于 stopLoss 配置和杠杆范围）
  const generateStopLossDescriptions = () => {
    const levMin = params.leverageMin;
    const levMax = params.leverageMax;
    const lowThreshold = Math.ceil(levMin + (levMax - levMin) * 0.33);
    const midThreshold = Math.ceil(levMin + (levMax - levMin) * 0.67);
    return [
      `${levMin}-${lowThreshold}倍杠杆，亏损 ${params.stopLoss.low}% 时止损`,
      `${lowThreshold + 1}-${midThreshold}倍杠杆，亏损 ${params.stopLoss.mid}% 时止损`,
      `${midThreshold + 1}倍以上杠杆，亏损 ${params.stopLoss.high}% 时止损`,
    ];
  };
  const stopLossDescriptions = generateStopLossDescriptions();
  
  let prompt = `【交易周期 #${iteration}】${currentTime}
已运行 ${minutesElapsed} 分钟，执行周期 ${intervalMinutes} 分钟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
当前策略：${params.name}（${params.description}）
目标月回报：${params.name === '稳健' ? '10-20%' : params.name === '平衡' ? '20-40%' : params.name === '激进' ? '30-50%（频繁小盈利累积）' : '20-30%'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【硬性风控底线 - 系统强制执行】
┌─────────────────────────────────────────┐
│ 单笔亏损 ≤ ${RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT}%：强制平仓               │
│ 持仓时间 ≥ ${RISK_PARAMS.MAX_HOLDING_HOURS}小时：强制平仓             │
└─────────────────────────────────────────┘

【AI战术决策 - 强烈建议遵守】
┌─────────────────────────────────────────┐
│ 策略止损：${params.stopLoss.low}% ~ ${params.stopLoss.high}%（根据杠杆）│
│ 分批止盈：                               │
│   • 盈利≥+${params.partialTakeProfit.stage1.trigger}% → 平仓${params.partialTakeProfit.stage1.closePercent}%  │
│   • 盈利≥+${params.partialTakeProfit.stage2.trigger}% → 平仓${params.partialTakeProfit.stage2.closePercent}%  │
│   • 盈利≥+${params.partialTakeProfit.stage3.trigger}% → 平仓${params.partialTakeProfit.stage3.closePercent}% │
│ 峰值回撤：≥${params.peakDrawdownProtection}% → 危险信号，立即平仓 │
${isCodeLevelProtectionEnabled ? (allowAiOverride ? `│                                         │
│ 双重防护模式：                          │
│   • 代码自动监控（每10秒）作为安全网   │
│   • Level1: 峰值${params.trailingStop.level1.trigger}%→止损线${params.trailingStop.level1.stopAt}% │
│   • Level2: 峰值${params.trailingStop.level2.trigger}%→止损线${params.trailingStop.level2.stopAt}% │
│   • Level3: 峰值${params.trailingStop.level3.trigger}%→止损线${params.trailingStop.level3.stopAt}% │
│   • 你可以主动止损止盈，不必等待自动   │
│   • 主动管理风险是优秀交易员的标志     │` : `│                                         │
│ 注意：移动止盈由自动监控执行（每10秒） │
│   • Level1: 峰值${params.trailingStop.level1.trigger}%→止损线${params.trailingStop.level1.stopAt}% │
│   • Level2: 峰值${params.trailingStop.level2.trigger}%→止损线${params.trailingStop.level2.stopAt}% │
│   • Level3: 峰值${params.trailingStop.level3.trigger}%→止损线${params.trailingStop.level3.stopAt}% │
│   • 无需AI手动执行移动止盈              │`) : `│                                         │
│ 注意：当前策略未启用自动监控移动止盈      │
│   • AI需主动监控峰值回撤并执行止盈      │
│   • 盈利${params.trailingStop.level1.trigger}%→止损线${params.trailingStop.level1.stopAt}%   │
│   • 盈利${params.trailingStop.level2.trigger}%→止损线${params.trailingStop.level2.stopAt}%   │
│   • 盈利${params.trailingStop.level3.trigger}%→止损线${params.trailingStop.level3.stopAt}%   │`}
└─────────────────────────────────────────┘

【决策流程 - 按优先级执行】
(1) 持仓管理（最优先）：
   检查每个持仓的止损/止盈/峰值回撤 → closePosition
   
(2) 新开仓评估：
   分析市场数据 → 识别双向机会（做多/做空） → openPosition
   
(3) 加仓评估：
   盈利>5%且趋势强化 → openPosition（≤50%原仓位，相同或更低杠杆）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【数据说明】
本提示词已预加载所有必需数据：
• 所有币种的市场数据和技术指标（多时间框架）
• 账户信息（余额、收益率、夏普比率）
• 当前持仓状态（盈亏、持仓时间、杠杆）
• 历史交易记录（最近10笔）

【您的任务】
直接基于上述数据做出交易决策，无需重复获取数据：
1. 分析持仓管理需求（止损/止盈/加仓）→ 调用 closePosition / openPosition 执行
2. 识别新交易机会（做多/做空）→ 调用 openPosition 执行
3. 评估风险和仓位管理 → 调用 calculateRisk 验证

关键：您必须实际调用工具执行决策，不要只停留在分析阶段！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下所有价格或信号数据按时间顺序排列：最旧 → 最新

时间框架说明：除非在章节标题中另有说明，否则日内序列以 3 分钟间隔提供。如果某个币种使用不同的间隔，将在该币种的章节中明确说明。

所有币种的当前市场状态
`;

  // 按照 1.md 格式输出每个币种的数据
  for (const [symbol, dataRaw] of Object.entries(marketData)) {
    const data = dataRaw as any;
    
    prompt += `\n所有 ${symbol} 数据\n`;
    prompt += `当前价格 = ${data.price.toFixed(1)}, 当前EMA20 = ${data.ema20.toFixed(3)}, 当前MACD = ${data.macd.toFixed(3)}, 当前RSI（7周期） = ${data.rsi7.toFixed(3)}\n`;
    
    // 布林带指标
    if (data.bbUpper && data.bbMiddle && data.bbLower) {
      prompt += `布林带: 上轨=${data.bbUpper.toFixed(2)}, 中轨=${data.bbMiddle.toFixed(2)}, 下轨=${data.bbLower.toFixed(2)}, 带宽=${data.bbBandwidth?.toFixed(4)}%, 位置=${data.bbPosition?.toFixed(2)}%\n`;
    }
    prompt += `\n`;
    
    // 资金费率
    if (data.fundingRate !== undefined) {
      prompt += `此外，这是 ${symbol} 永续合约的最新资金费率（您交易的合约类型）：\n\n`;
      prompt += `资金费率: ${data.fundingRate.toExponential(2)}\n\n`;
    }
    
    // 日内时序数据（3分钟级别）
    if (data.intradaySeries && data.intradaySeries.midPrices.length > 0) {
      const series = data.intradaySeries;
      prompt += `日内序列（按分钟，最旧 → 最新）：\n\n`;
      
      // Mid prices
      prompt += `中间价: [${series.midPrices.map((p: number) => p.toFixed(1)).join(", ")}]\n\n`;
      
      // EMA indicators (20‑period)
      prompt += `EMA指标（20周期）: [${series.ema20Series.map((e: number) => e.toFixed(3)).join(", ")}]\n\n`;
      
      // MACD indicators
      prompt += `MACD指标: [${series.macdSeries.map((m: number) => m.toFixed(3)).join(", ")}]\n\n`;
      
      // RSI indicators (7‑Period)
      prompt += `RSI指标（7周期）: [${series.rsi7Series.map((r: number) => r.toFixed(3)).join(", ")}]\n\n`;
      
      // RSI indicators (14‑Period)
      prompt += `RSI指标（14周期）: [${series.rsi14Series.map((r: number) => r.toFixed(3)).join(", ")}]\n\n`;
    }
    
    // 更长期的上下文数据（1小时级别 - 用于短线交易）
    if (data.longerTermContext) {
      const ltc = data.longerTermContext;
      prompt += `更长期上下文（1小时时间框架）：\n\n`;
      
      prompt += `20周期EMA: ${ltc.ema20.toFixed(2)} vs. 50周期EMA: ${ltc.ema50.toFixed(2)}\n\n`;
      
      if (ltc.atr3 && ltc.atr14) {
        prompt += `3周期ATR: ${ltc.atr3.toFixed(2)} vs. 14周期ATR: ${ltc.atr14.toFixed(3)}\n\n`;
      }
      
      prompt += `当前成交量: ${ltc.currentVolume.toFixed(2)} vs. 平均成交量: ${ltc.avgVolume.toFixed(3)}\n\n`;
      
      // MACD 和 RSI 时序（4小时，最近10个数据点）
      if (ltc.macdSeries && ltc.macdSeries.length > 0) {
        prompt += `MACD指标: [${ltc.macdSeries.map((m: number) => m.toFixed(3)).join(", ")}]\n\n`;
      }
      
      if (ltc.rsi14Series && ltc.rsi14Series.length > 0) {
        prompt += `RSI指标（14周期）: [${ltc.rsi14Series.map((r: number) => r.toFixed(3)).join(", ")}]\n\n`;
      }
    }
    
    // 多时间框架指标数据
    if (data.timeframes) {
      prompt += `多时间框架指标：\n\n`;
      
      const tfList = [
        { key: "1m", name: "1分钟" },
        { key: "3m", name: "3分钟" },
        { key: "5m", name: "5分钟" },
        { key: "15m", name: "15分钟" },
        { key: "30m", name: "30分钟" },
        { key: "1h", name: "1小时" },
      ];
      
      for (const tf of tfList) {
        const tfData = data.timeframes[tf.key];
        if (tfData) {
          prompt += `${tf.name}: 价格=${tfData.currentPrice.toFixed(2)}, EMA20=${tfData.ema20.toFixed(3)}, EMA50=${tfData.ema50.toFixed(3)}, MACD=${tfData.macd.toFixed(3)}, RSI7=${tfData.rsi7.toFixed(2)}, RSI14=${tfData.rsi14.toFixed(2)}, 成交量=${tfData.volume.toFixed(2)}`;
          
          // 添加布林带指标（多时间框架分析需要）
          if (tfData.bbUpper !== undefined && tfData.bbMiddle !== undefined && tfData.bbLower !== undefined) {
            prompt += `, 布林带(上轨=${tfData.bbUpper.toFixed(3)}, 中轨=${tfData.bbMiddle.toFixed(3)}, 下轨=${tfData.bbLower.toFixed(3)}, 带宽=${tfData.bbBandwidth?.toFixed(2) || 0}%, 位置=${tfData.bbPosition?.toFixed(2) || 50}%)`;
          }
          
          prompt += `\n`;
        }
      }
      prompt += `\n`;
    }
  }

  // 账户信息和表现（参照 1.md 格式）
  prompt += `\n以下是您的账户信息和表现\n`;
  
  // 计算账户回撤（如果提供了初始净值和峰值净值）
  if (accountInfo.initialBalance !== undefined && accountInfo.peakBalance !== undefined) {
    const drawdownFromPeak = ((accountInfo.peakBalance - accountInfo.totalBalance) / accountInfo.peakBalance) * 100;
    const drawdownFromInitial = ((accountInfo.initialBalance - accountInfo.totalBalance) / accountInfo.initialBalance) * 100;
    
    prompt += `初始账户净值: ${accountInfo.initialBalance.toFixed(2)} USDT\n`;
    prompt += `峰值账户净值: ${accountInfo.peakBalance.toFixed(2)} USDT\n`;
    prompt += `当前账户价值: ${accountInfo.totalBalance.toFixed(2)} USDT\n`;
    prompt += `账户回撤 (从峰值): ${drawdownFromPeak >= 0 ? '' : '+'}${(-drawdownFromPeak).toFixed(2)}%\n`;
    prompt += `账户回撤 (从初始): ${drawdownFromInitial >= 0 ? '' : '+'}${(-drawdownFromInitial).toFixed(2)}%\n\n`;
    
    // 添加风控警告（使用配置参数）
    // 注释：已移除强制清仓限制，仅保留警告提醒
    if (drawdownFromPeak >= RISK_PARAMS.ACCOUNT_DRAWDOWN_WARNING_PERCENT) {
      prompt += `提醒: 账户回撤已达到 ${drawdownFromPeak.toFixed(2)}%，请谨慎交易\n\n`;
    }
  } else {
    prompt += `当前账户价值: ${accountInfo.totalBalance.toFixed(2)} USDT\n\n`;
  }
  
  prompt += `当前总收益率: ${accountInfo.returnPercent.toFixed(2)}%\n\n`;
  
  // 计算所有持仓的未实现盈亏总和
  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0);
  
  prompt += `可用资金: ${accountInfo.availableBalance.toFixed(1)} USDT\n\n`;
  prompt += `未实现盈亏: ${totalUnrealizedPnL.toFixed(2)} USDT (${totalUnrealizedPnL >= 0 ? '+' : ''}${((totalUnrealizedPnL / accountInfo.totalBalance) * 100).toFixed(2)}%)\n\n`;
  
  // 当前持仓和表现
  if (positions.length > 0) {
    prompt += `以下是您当前的持仓信息。重要说明：\n`;
    prompt += `- 所有"盈亏百分比"都是考虑杠杆后的值，公式为：盈亏百分比 = (价格变动%) × 杠杆倍数\n`;
    prompt += `- 例如：10倍杠杆，价格上涨0.5%，则盈亏百分比 = +5%（保证金增值5%）\n`;
    prompt += `- 这样设计是为了让您直观理解实际收益：+10% 就是本金增值10%，-10% 就是本金亏损10%\n`;
    prompt += `- 请直接使用系统提供的盈亏百分比，不要自己重新计算\n\n`;
    for (const pos of positions) {
      // 计算盈亏百分比：考虑杠杆倍数
      // 对于杠杆交易：盈亏百分比 = (价格变动百分比) × 杠杆倍数
      const priceChangePercent = pos.entry_price > 0 
        ? ((pos.current_price - pos.entry_price) / pos.entry_price * 100 * (pos.side === 'long' ? 1 : -1))
        : 0;
      const pnlPercent = priceChangePercent * pos.leverage;
      
      // 计算持仓时长
      const openedTime = new Date(pos.opened_at);
      const now = new Date();
      const holdingMinutes = Math.floor((now.getTime() - openedTime.getTime()) / (1000 * 60));
      const holdingHours = (holdingMinutes / 60).toFixed(1);
      const remainingHours = Math.max(0, RISK_PARAMS.MAX_HOLDING_HOURS - parseFloat(holdingHours));
      const holdingCycles = Math.floor(holdingMinutes / intervalMinutes); // 根据实际执行周期计算
      const maxCycles = Math.floor(RISK_PARAMS.MAX_HOLDING_HOURS * 60 / intervalMinutes); // 最大持仓时间的总周期数
      const remainingCycles = Math.max(0, maxCycles - holdingCycles);
      
      // 计算峰值回撤（使用绝对回撤，即百分点）
      const peakPnlPercent = pos.peak_pnl_percent || 0;
      const drawdownFromPeak = peakPnlPercent > 0 ? peakPnlPercent - pnlPercent : 0;
      
      prompt += `当前活跃持仓: ${pos.symbol} ${pos.side === 'long' ? '做多' : '做空'}\n`;
      prompt += `  杠杆倍数: ${pos.leverage}x\n`;
      prompt += `  盈亏百分比: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (已考虑杠杆倍数)\n`;
      prompt += `  盈亏金额: ${pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)} USDT\n`;
      
      // 添加峰值盈利和回撤信息
      if (peakPnlPercent > 0) {
        prompt += `  峰值盈利: +${peakPnlPercent.toFixed(2)}% (历史最高点)\n`;
        prompt += `  峰值回撤: ${drawdownFromPeak.toFixed(2)}%\n`;
        if (drawdownFromPeak >= params.peakDrawdownProtection) {
          prompt += `  警告: 峰值回撤已达到 ${drawdownFromPeak.toFixed(2)}%，超过保护阈值 ${params.peakDrawdownProtection}%，强烈建议立即平仓！\n`;
        } else if (drawdownFromPeak >= params.peakDrawdownProtection * 0.7) {
          prompt += `  提醒: 峰值回撤接近保护阈值 (当前${drawdownFromPeak.toFixed(2)}%，阈值${params.peakDrawdownProtection}%)，需要密切关注！\n`;
        }
      }
      
      prompt += `  开仓价: ${pos.entry_price.toFixed(2)}\n`;
      prompt += `  当前价: ${pos.current_price.toFixed(2)}\n`;
      prompt += `  开仓时间: ${formatChinaTime(pos.opened_at)}\n`;
      prompt += `  已持仓: ${holdingHours} 小时 (${holdingMinutes} 分钟, ${holdingCycles} 个周期)\n`;
      prompt += `  距离${RISK_PARAMS.MAX_HOLDING_HOURS}小时限制: ${remainingHours.toFixed(1)} 小时 (${remainingCycles} 个周期)\n`;
      
      // 如果接近最大持仓时间,添加警告
      if (remainingHours < 2) {
        prompt += `  警告: 即将达到${RISK_PARAMS.MAX_HOLDING_HOURS}小时持仓限制,必须立即平仓!\n`;
      } else if (remainingHours < 4) {
        prompt += `  提醒: 距离${RISK_PARAMS.MAX_HOLDING_HOURS}小时限制不足4小时,请准备平仓\n`;
      }
      
      prompt += "\n";
    }
  }
  
  // Sharpe Ratio
  if (accountInfo.sharpeRatio !== undefined) {
    prompt += `夏普比率: ${accountInfo.sharpeRatio.toFixed(3)}\n\n`;
  }
  
  // 历史成交记录（最近10条）
  if (tradeHistory && tradeHistory.length > 0) {
    prompt += `\n最近交易历史（最近10笔交易，最旧 → 最新）：\n`;
    prompt += `重要说明：以下仅为最近10条交易的统计，用于分析近期策略表现，不代表账户总盈亏。\n`;
    prompt += `使用此信息评估近期交易质量、识别策略问题、优化决策方向。\n\n`;
    
    let totalProfit = 0;
    let profitCount = 0;
    let lossCount = 0;
    
    for (const trade of tradeHistory) {
      const tradeTime = formatChinaTime(trade.timestamp);
      
      prompt += `交易: ${trade.symbol} ${trade.type === 'open' ? '开仓' : '平仓'} ${trade.side.toUpperCase()}\n`;
      prompt += `  时间: ${tradeTime}\n`;
      prompt += `  价格: ${trade.price.toFixed(2)}, 数量: ${trade.quantity.toFixed(4)}, 杠杆: ${trade.leverage}x\n`;
      prompt += `  手续费: ${trade.fee.toFixed(4)} USDT\n`;
      
      // 对于平仓交易，总是显示盈亏金额
      if (trade.type === 'close') {
        if (trade.pnl !== undefined && trade.pnl !== null) {
          prompt += `  盈亏: ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} USDT\n`;
          totalProfit += trade.pnl;
          if (trade.pnl > 0) {
            profitCount++;
          } else if (trade.pnl < 0) {
            lossCount++;
          }
        } else {
          prompt += `  盈亏: 暂无数据\n`;
        }
      }
      
      prompt += `\n`;
    }
    
    if (profitCount > 0 || lossCount > 0) {
      const winRate = profitCount / (profitCount + lossCount) * 100;
      prompt += `最近10条交易统计（仅供参考）:\n`;
      prompt += `  - 胜率: ${winRate.toFixed(1)}%\n`;
      prompt += `  - 盈利交易: ${profitCount}笔\n`;
      prompt += `  - 亏损交易: ${lossCount}笔\n`;
      prompt += `  - 最近10条净盈亏: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} USDT\n`;
      prompt += `\n注意：此数值仅为最近10笔交易统计，用于评估近期策略有效性，不是账户总盈亏。\n`;
      prompt += `账户真实盈亏请参考上方"当前账户状态"中的收益率和总资产变化。\n\n`;
    }
  }

  // 上一次的AI决策记录（仅供参考，不是当前状态）
  if (recentDecisions && recentDecisions.length > 0) {
    prompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `【历史决策记录 - 仅供参考】\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    prompt += `重要提醒：以下是历史决策记录，仅作为参考，不代表当前状态！\n`;
    prompt += `当前市场数据和持仓信息请参考上方实时数据。\n\n`;
    
    for (let i = 0; i < recentDecisions.length; i++) {
      const decision = recentDecisions[i];
      const decisionTime = formatChinaTime(decision.timestamp);
      const timeDiff = Math.floor((new Date().getTime() - new Date(decision.timestamp).getTime()) / (1000 * 60));
      
      prompt += `【历史】决策 #${decision.iteration} (${decisionTime}，${timeDiff}分钟前):\n`;
      prompt += `  当时账户价值: ${decision.account_value.toFixed(2)} USDT\n`;
      prompt += `  当时持仓数量: ${decision.positions_count}\n`;
      prompt += `  当时决策内容: ${decision.decision}\n\n`;
    }
    
    prompt += `\n使用建议：\n`;
    prompt += `- 仅作为决策连续性参考，不要被历史决策束缚\n`;
    prompt += `- 市场已经变化，请基于当前最新数据独立判断\n`;
    prompt += `- 如果市场条件改变，应该果断调整策略\n\n`;
  }

  return prompt;
}

/**
 * 根据策略生成交易指令
 */
function generateInstructions(strategy: TradingStrategy, intervalMinutes: number): string {
  const params = getStrategyParams(strategy);
  
  // 如果是AI自主策略，返回极简的系统提示词
  if (strategy === "ai-autonomous") {
    return `你是一个完全自主的AI加密货币交易员，具备自我学习和持续改进的能力。

你的任务是基于提供的市场数据和账户信息，完全自主地分析市场并做出交易决策。

你拥有的能力：
- 分析多时间框架的市场数据（价格、技术指标、成交量等）
- 开仓（做多或做空）
- 平仓（部分或全部）
- 自主决定交易策略、风险管理、仓位大小、杠杆倍数
- **自我复盘和持续改进**：从历史交易中学习，识别成功模式和失败原因

双重防护机制（保护你的交易安全）：

**第一层：代码级自动保护**（每10秒监控，自动执行）
- 自动止损：低杠杆-8%、中杠杆-6%、高杠杆-5%
- 自动移动止盈：盈利5%→止损线+2%、盈利10%→止损线+5%、盈利15%→止损线+8%
- 自动分批止盈：盈利8%→平仓30%、盈利12%→平仓30%、盈利18%→平仓40%

**第二层：AI主动决策**（你的灵活操作权）
- 你可以在代码自动保护触发**之前**主动止损止盈
- 你可以根据市场情况灵活调整，不必等待自动触发
- 代码保护是最后的安全网，你有完全的主动权
- **建议**：看到不利信号时主动止损，看到获利机会时主动止盈

系统硬性风控底线（防止极端风险）：
- 单笔亏损达到 ${RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT}% 时，系统会强制平仓（防止爆仓）
- 持仓时间超过 ${RISK_PARAMS.MAX_HOLDING_HOURS} 小时，系统会强制平仓（释放资金）
- 最大杠杆：${RISK_PARAMS.MAX_LEVERAGE} 倍
- 最大持仓数：${RISK_PARAMS.MAX_POSITIONS} 个

重要提醒：
- 没有任何策略建议或限制（除了上述双重防护和系统硬性底线）
- 完全由你自主决定如何交易
- 完全由你自主决定风险管理
- 你可以选择任何你认为合适的交易策略和风格
- 不要过度依赖自动保护，主动管理风险才是优秀交易员的标志

交易成本：
- 开仓手续费：约 0.05%
- 平仓手续费：约 0.05%
- 往返交易成本：约 0.1%

双向交易：
- 做多（long）：预期价格上涨时开多单
- 做空（short）：预期价格下跌时开空单
- 永续合约做空无需借币

**自我复盘机制**：
每个交易周期，你都应该：
1. 回顾最近的交易表现（盈利和亏损）
2. 分析成功和失败的原因
3. 识别可以改进的地方
4. 制定本次交易的改进计划
5. 然后再执行交易决策

这种持续的自我复盘和改进是你成为优秀交易员的关键。

现在，请基于每个周期提供的市场数据，先进行自我复盘，然后再做出交易决策。`;
  }
  
  // 判断是否启用自动监控止损和移动止盈（根据策略配置）
  const isCodeLevelProtectionEnabled = params.enableCodeLevelProtection;
  
  // 生成止损规则描述（基于 stopLoss 配置和杠杆范围）
  const generateStopLossDescriptions = () => {
    const levMin = params.leverageMin;
    const levMax = params.leverageMax;
    const lowThreshold = Math.ceil(levMin + (levMax - levMin) * 0.33);
    const midThreshold = Math.ceil(levMin + (levMax - levMin) * 0.67);
    return [
      `${levMin}-${lowThreshold}倍杠杆，亏损 ${params.stopLoss.low}% 时止损`,
      `${lowThreshold + 1}-${midThreshold}倍杠杆，亏损 ${params.stopLoss.mid}% 时止损`,
      `${midThreshold + 1}倍以上杠杆，亏损 ${params.stopLoss.high}% 时止损`,
    ];
  };
  const stopLossDescriptions = generateStopLossDescriptions();
  
  // 构建策略提示词上下文
  const promptContext: StrategyPromptContext = {
    intervalMinutes,
    maxPositions: RISK_PARAMS.MAX_POSITIONS,
    extremeStopLossPercent: RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT,
    maxHoldingHours: RISK_PARAMS.MAX_HOLDING_HOURS,
    tradingSymbols: RISK_PARAMS.TRADING_SYMBOLS,
  };
  
  // 生成策略特定提示词（来自各个策略文件）
  const strategySpecificContent = generateStrategySpecificPrompt(strategy, params, promptContext);
  
  return `# 核心身份与使命

您是世界顶级的专业量化交易员，当前执行【${params.name}】策略。

**身份定位**：世界顶级专业量化交易员
**核心使命**：通过系统化、纪律严明的交易，最大化风险调整后的收益（夏普比率≥2.0）
**策略执行**：${params.name}策略，每${intervalMinutes}分钟执行一次

# 交易框架与市场环境

## 交易品种与参数
- **交易品种**：${RISK_PARAMS.TRADING_SYMBOLS.join('、')}永续合约
- **风险偏好**：${params.riskTolerance}
- **最大持仓**：${RISK_PARAMS.MAX_POSITIONS}个币种，${RISK_PARAMS.MAX_HOLDING_HOURS}小时强制平仓
- **交易机制**：永续期货合约，支持双向交易

## 操作空间定义
每个决策周期内，您有四种可能的操作：
1. **买入入场**：建立新的多头头寸（押注价格上涨）
2. **卖出入场**：建立新的空头头寸（押注价格下跌）
3. **持有**：维持现有头寸不变
4. **平仓**：完全退出现有头寸

# 策略核心原则与入场条件

${strategySpecificContent}

**入场条件**：必须满足 ${params.entryCondition}

# 专业风险管理体系

## 风控底线（强制执行）
- **单笔亏损**：≤${RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT}% 强制平仓
- **持仓时间**：≥${RISK_PARAMS.MAX_HOLDING_HOURS}小时 强制平仓

## 交易风险管理（专业要求）
对于每一笔交易决策，您必须明确以下信息：

1. **止盈目标**（浮点数）：设定止盈的确切价格水平
   - 应至少提供2:1的风险回报比
   - 基于技术阻力位、斐波那契扩展位或波动率区间

2. **止损位**（浮点数）：设定止损的确切价格水平
   - 应将每笔交易的损失限制在账户价值的1-3%以内
   - 设置在近期支撑位/阻力位之外，以避免过早止损

3. **失效条件**（字符串）：使您的交易策略失效的特定市场信号
   - 示例："价格跌破关键支撑位"、"RSI出现背离信号"、"技术形态失效"
   - 必须客观且可观察

4. **信心指数**（浮动值，0-1）：您对这笔交易的信心程度
   - 0.0-0.3：信心较低（避免交易或使用最小仓位）
   - 0.3-0.6：信心中等（标准仓位）
   - 0.6-0.8：信心较高（可接受较大仓位）
   - 0.8-1.0：信心极高（谨慎使用，谨防过度自信）

# 专业交易员智慧与决策框架

## 技术分析体系
- **核心指标**：价格、EMA、MACD、RSI、布林带
- **时间框架**：多时间框架综合分析（1h、30m、15m、5m）
- **辅助数据**：根据需要调用 getFundingRate 和 getOrderBook

## 专业交易理念
- **行情识别**：单边行情积极把握，震荡行情谨慎防守
- **趋势为王**：顺应趋势是核心，但警惕3个时间框架反转信号
- **严格止损**：亏损交易果断止损，保护本金第一位
- **灵活止盈**：盈利交易让利润奔跑，但保护已实现利润
- **概率思维**：基于技术指标和概率分析做专业决策
- **数据驱动**：基于多时间框架技术指标做出客观判断

## 仓位管理规则
- **严禁双向持仓**：同一币种不能同时持有多单和空单
- **允许加仓**：对盈利>5%的持仓，趋势强化时可加仓≤50%，最多2次
- **双向交易**：做多和做空都能赚钱，不要只盯着做多机会

# 关键决策流程

## 四步决策法
1. **账户检查**：调用 getAccountBalance 检查账户状态
2. **持仓管理**：调用 getPositions 检查现有持仓
3. **市场分析**：调用 getTechnicalIndicators 分析技术指标
4. **交易决策**：基于分析结果做出开仓/平仓决策

# 执行要求与专业素养

## 立即行动原则
- **不要只说"我会开仓"**，而是立即调用工具执行
- **决策必须落地**：每个决策都要转化为实际的工具调用
- **专业判断优先**：基于数据分析和专业经验做最优决策

## 灵活调整能力
- 在风控底线内根据市场情况灵活调整策略
- 策略框架是参考基准，您有权根据市场实际情况灵活调整
- 但风控底线绝不妥协

# 可用工具与数据

## 市场数据工具
- getMarketPrice、getTechnicalIndicators、getFundingRate、getOrderBook

## 持仓管理工具
- openPosition（市价单）、closePosition（市价单）、cancelOrder

## 账户信息工具
- getAccountBalance、getPositions、getOpenOrders

市场数据按时间顺序排列（最旧 → 最新），跨多个时间框架。使用此数据识别多时间框架趋势和关键水平。`;
}

/**
 * 创建交易 Agent
 * @param intervalMinutes 交易间隔（分钟）
 * @param marketDataContext 市场数据上下文（可选，用于子Agent）
 */
export async function createTradingAgent(intervalMinutes: number = 5, marketDataContext?: any) {
  // 使用 OpenAI SDK，通过配置 baseURL 兼容 OpenRouter 或其他供应商
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  });

  const memory = new Memory({
    storage: new LibSQLMemoryAdapter({
      url: "file:./.voltagent/trading-memory.db",
      logger: logger.child({ component: "libsql" }),
    }),
  });
  
  // 获取当前策略
  const strategy = getTradingStrategy();
  logger.info(`使用交易策略: ${strategy}`);

  // 如果是多Agent共识策略，创建子Agent
  let subAgents: Agent[] | undefined;
  if (strategy === "multi-agent-consensus") {
    logger.info("创建陪审团策略的子Agent（陪审团成员）...");
    const { createTechnicalAnalystAgent, createTrendAnalystAgent, createRiskAssessorAgent } = await import("./analysisAgents");
    
    // 传递市场数据上下文给子Agent
    subAgents = [
      createTechnicalAnalystAgent(marketDataContext),
      createTrendAnalystAgent(marketDataContext),
      createRiskAssessorAgent(marketDataContext),
    ];
    logger.info("陪审团成员创建完成：技术分析Agent、趋势分析Agent、风险评估Agent");
  }

  const agent = new Agent({
    name: "trading-agent",
    instructions: generateInstructions(strategy, intervalMinutes),
    model: openai.chat(process.env.AI_MODEL_NAME || "deepseek/deepseek-v3.2-exp"),
    tools: [
      tradingTools.getMarketPriceTool,
      tradingTools.getTechnicalIndicatorsTool,
      tradingTools.getFundingRateTool,
      tradingTools.getOrderBookTool,
      tradingTools.openPositionTool,
      tradingTools.closePositionTool,
      tradingTools.cancelOrderTool,
      tradingTools.getAccountBalanceTool,
      tradingTools.getPositionsTool,
      tradingTools.getOpenOrdersTool,
      tradingTools.checkOrderStatusTool,
      tradingTools.calculateRiskTool,
      tradingTools.syncPositionsTool,
    ],
    subAgents,
    memory,
    logger
  });

  return agent;
}
