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
import {Agent, Memory} from "@voltagent/core";
import {LibSQLMemoryAdapter} from "@voltagent/libsql";
import {createLogger} from "../utils/loggerUtils";
import * as tradingTools from "../tools/trading";
import {formatChinaTime} from "../utils/timeUtils";
import {RISK_PARAMS} from "../config/riskParams";
import {createOpenAIClientWithRotation} from "../utils/apiKeyManager";




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
import type {TradingStrategy, StrategyParams, StrategyPromptContext} from "../strategies";
import {getStrategyParams as getStrategyParamsBase, generateStrategySpecificPrompt} from "../strategies";




// 重新导出类型供外部使用
export type {TradingStrategy, StrategyParams};




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
   if (strategy === "conservative" || strategy === "balanced" || strategy === "aggressive" || strategy === "ultra-short" || strategy === "swing-trend" || strategy === "rebate-farming" || strategy === "ai-autonomous" || strategy === "multi-agent-consensus" || strategy === "visual-pattern") {
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
   const {
       minutesElapsed,
       iteration,
       intervalMinutes,
       marketData,
       accountInfo,
       positions,
       tradeHistory,
       recentDecisions
   } = data;
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
   const {
       minutesElapsed,
       iteration,
       intervalMinutes,
       marketData,
       accountInfo,
       positions,
       tradeHistory,
       recentDecisions
   } = data;
   const currentTime = formatChinaTime();




// 获取当前策略参数（用于每周期强调风控规则）
   const strategy = getTradingStrategy();
   const params = getStrategyParams(strategy);
// 判断是否启用自动监控止损和移动止盈（根据策略配置）
   const isCodeLevelProtectionEnabled = params.enableCodeLevelProtection;




// 如果是AI自主策略，使用完全不同的提示词格式
   if (strategy === "ai-autonomous") {
       return generateAiAutonomousPromptForCycle(data);
   }




// 如果是视觉模式策略，使用专门的提示词格式
   if (strategy === "visual-pattern") {
       return generateVisualPatternPromptForCycle(data);
   }




// 视觉模式策略专用提示词生成函数 - 作为 Agent 指令的补充
   function generateVisualPatternPromptForCycle(data: any): string {
       const {
           minutesElapsed,
           iteration,
           intervalMinutes,
           marketData,
           accountInfo,
           positions,
           tradeHistory,
           recentDecisions,
       } = data;


       const currentTime = formatChinaTime();


       let prompt = `# 视觉模式识别交易周期 #${iteration} | ${currentTime} | 周期: ${intervalMinutes} 分钟


你当前的角色和详细工作流程，已经在系统指令（Agent 的 instructions）中定义完备，这里不再重复。 
**请严格遵循系统指令中的要求**：优先调用 \`patternAnalysisTool\` 获取 Coinglass 视觉分析结论，再结合其他工具进行验证和执行，**禁止凭空假设市场数据**。


本轮提示仅为你提供“人类侧”的上下文信息：关注标的列表、账户状态、当前持仓和上一轮决策，帮助你在工具分析的基础上做出更合理的交易决策。


## 一、本轮关注的交易对列表


本轮默认关注以下交易对（如果需要，可在分析时重点筛选 1–3 个作为执行重点）：`;


       // 只列出 symbol 和一个参考价，不展开指标细节
       for (const [symbol, dataRaw] of Object.entries(marketData)) {
           const md = dataRaw as any;
           if (md && typeof md.price === "number") {
               prompt += `\n- ${symbol}（当前参考价约 ${md.price.toFixed(2)}）`;
           } else {
               prompt += `\n- ${symbol}（当前参考价未知，需通过工具查询）`;
           }
       }


       prompt += `


> ⚠️ 在后续分析中，如需具体的价格、技术指标或资金费率，请通过相应工具获取（例如：\`getMarketPriceTool\`、\`getTechnicalIndicatorsTool\`、\`getFundingRateTool\`），**而不是直接依赖本提示中的静态信息**.


## 二、账户整体状态


- 总资产: ${accountInfo.totalBalance.toFixed(2)} USDT 
- 可用余额: ${accountInfo.availableBalance.toFixed(1)} USDT 
- 账户累计收益率: ${accountInfo.returnPercent.toFixed(2)}%


这部分信息用于帮助你控制整体风险敞口和单笔仓位大小。具体仓位和风险计算，请在需要时调用 \`calculateRiskTool\`.


`;


       // 当前持仓信息
       if (positions && positions.length > 0) {
           prompt += `## 三、当前持仓（本轮优先管理对象）


`;


           for (const pos of positions) {
               const entry = pos.entry_price || 0;
               const side = pos.side === "long" ? "多" : "空";
               const leverage = pos.leverage || 1;
               let pnlPercent = 0;


               if (entry > 0 && typeof pos.current_price === "number") {
                   const priceChangePercent =
                       ((pos.current_price - entry) / entry) *
                       100 *
                       (pos.side === "long" ? 1 : -1);
                   pnlPercent = priceChangePercent * leverage;
               }


               prompt += `- ${pos.symbol} ${side} ${leverage}x | 参考浮动盈亏约: ${
                   pnlPercent >= 0 ? "+" : ""
               }${pnlPercent.toFixed(2)}%\n`;
           }


           prompt += `
请在本轮决策中，优先评估上述持仓是否需要：
- 继续持有（并调整止损/止盈）；
- 分批止盈或部分减仓；
- 直接平仓离场.


`;
       } else {
           prompt += `## 三、当前持仓


当前无持仓，本轮可以更侧重新机会的筛选和布局，但仍需**严格控制风险与仓位**，避免一次性大额建仓.


`;
       }


       // 最近一次决策信息 - 只保留关键结论，精简冗余内容
       if (recentDecisions && recentDecisions.length > 0) {
           const lastDecision = recentDecisions[0];
           const decisionText: string = lastDecision.decision || "";

           let displayText = "无决策内容";

           // 优化决策信息过滤：优先提取"得出以下综合判断"后面的所有内容
           // 这是最核心的决策部分，包含了所有关键结论
           const comprehensiveConclusionMatch = decisionText.match(/得出以下综合判断[\s\S]*$/i);
           if (comprehensiveConclusionMatch) {
               // 提取匹配内容并去掉开头的"得出以下综合判断"文本
               displayText = comprehensiveConclusionMatch[0].replace(/^得出以下综合判断/i, '').trim();
           }
           // 如果没有找到综合判断，回退到之前的模式匹配
           else {
               const keyPatterns = [
                   // 新增：提取"关键结论的简要复述"部分
                   /(?:^|\n)(?:关键结论|关键结论的简要复述)[\s\S]*?(?=\n\s*---|\n\s*##|$)/i,
                   // 1. 提取建议部分
                   /(?:^|\n)(?:我当前建议|我的建议|当前建议).*?\n(?:\n.*?核心理由[\s\S]*?)(?=\n\s*---|\n\s*##|$)/is,
                   // 2. 提取主要结论部分
                   /(?:^|\n)(?:总体结论|Overall Conclusion|综合结论|核心结论|结论)[\s\S]*?(?=\n\s*---|\n\s*##|$)/i,
                   // 3. 提取以"基于"开头的总结性句子
                   /(?:^|\n)基于[\s\S]*?$/i
               ];

               // 尝试匹配关键模式
               let foundKeyContent = false;
               for (const pattern of keyPatterns) {
                   const match = decisionText.match(pattern);
                   if (match) {
                       displayText = match[0].replace(/^[^\S\n]*\n?/, "").trim();
                       foundKeyContent = true;
                       break;
                   }
               }

               // 如果所有模式都没找到，保留最后5行作为精简内容
               if (!foundKeyContent && decisionText.trim()) {
                   const lines = decisionText.trim().split('\n');
                   displayText = lines.slice(-5).join('\n');
               }
           }


           // 保留原始换行：每行前面加两个空格以符合 Markdown 引用块内的代码风格
           const indentedText = displayText.split('\n').map(line => `  ${line}`).join('\n');


           prompt += `## 四、最近一次决策摘要


- 上次决策时间: ${formatChinaTime(new Date(lastDecision.timestamp))}
- 上次关键决策信息: 
${indentedText}


> 🔄 请参考上一轮的决策，**避免在短时间内频繁反向操作**，除非你通过 \`patternAnalysisTool\` 和其他工具确认资金结构已经发生明显逆转.


`;
       }


       prompt += `## 五、本轮执行重点与要求


请牢记，详细的形态与资金结构分析，应通过工具完成：


- **Coinglass 图表及综合资金结构**：调用 \`patternAnalysisTool\`。 
 对同一个交易对，你可以在不同时间周期上多次调用 \`patternAnalysisTool\`，用于进行“多周期共振分析”，比较短周期与中/长周期的趋势与资金结构是否共振或矛盾。
- **实时价格与技术指标**：调用 \`getMarketPriceTool\`、\`getTechnicalIndicatorsTool\`。
- **资金费率与情绪**：调用 \`getFundingRateTool\`。
- **趋势线与结构验证**：调用 \`scientificTrendlineAnalysisTool\`。
- **订单簿与流动性**：调用 \`analyzeOrderBookDepthTool\`。
- **账户与风险**：调用 \`getAccountBalanceTool\`、\`getPositionsTool\`、\`calculateRiskTool\`。
- **执行交易**：调用 \`openPositionTool\`、\`closePositionTool\`、\`cancelOrderTool\`。


当你基于 \`patternAnalysisTool\` 与上述验证工具，识别到 **A 级信号**（评分 ≥7 或明显强信号）且风险收益比合理时，应按照系统指令中的流程：**先验证 → 再计算仓位 → 最后使用 \`openPositionTool\` 执行**，而不是只做文字分析。


在分析过程中，特别是当：
- 某个交易对出现较强信号，或 
- 同一周期内部结构/资金信号存在明显矛盾时， 


你应优先考虑进行“**多周期共振分析**”：


1. 先在一个**短周期**（如 5m 或 15m）上调用 \`patternAnalysisTool\`，获取短线结构与资金行为；
2. 再在一个**中/长周期**（如 30m、1h 或 4h）上调用 \`patternAnalysisTool\`，获取更大级别结构与资金行为；
3. 在最终判断中，明确说明短周期与中/长周期之间的关系：
  - 若多个周期方向和结构**基本共振**（例如短周期与中周期都偏多或都偏空），可视为“多周期共振”，适度提高该信号的可信度和执行意愿；
  - 若短周期与中/长周期**方向矛盾**（例如短周期偏多反弹，但更大周期仍是下跌中继），通常应将短周期信号视为“反弹/回调中的机会”，降低信号等级或优先考虑观望/轻仓；
  - 若中/长周期趋势**非常明确**，而短周期只是逆势的小级别波动，你应**优先尊重大周期方向**，对逆大趋势的短周期信号保持高度谨慎。


---


## 六、本轮回复中需要给出的内容


在本轮回复中，请完成以下四点（可以清晰分段）：


### 1）总体结论
- 明确写出本轮你的总体建议：【做多 / 做空 / 观望】（只能选一个为主），以及主要针对的交易对；
- 如你在本轮分析中使用了多周期信息（例如同一交易对的 5m + 30m 或 15m + 1h 分析），请简要说明你的“多周期共振分析”结论（例如：“短周期反弹但中周期仍为下跌中继，二者不共振，因此仅考虑反弹做空机会，不追多”）。


### 2）持仓管理建议
- 对每个当前持仓，说明你建议：**继续持有 / 调整止损止盈 / 分批减仓 / 全部平仓**；
- 并给出 1–2 条最关键理由（至少包含一条与**资金结构**或**走势结构**相关）。


### 3）新机会评估
- 如你认为某些交易对存在 A/B 级别的可执行机会，请指出：
 - 标的（交易对）
 - 方向（多/空）
 - 大致结构逻辑（例如：下跌后技术性反弹、下跌中继、底部构筑等）
 - 以及你是否计划在本轮**实际执行**（调用 \`openPositionTool\`）还是只列为**后续观察对象**。


### 4）风险提示
- 指出当前市场结构中最需要警惕的 1–2 个风险点（例如：OI 高位 + 正费率极端、可能处于杀多阶段等）；
- 明确说明：**若出现哪类变化**，你会立刻建议收缩风险或反向思考（例如：某关键位被放量突破且 OI、CVD 同向爆发等）。


> ⚠️ **重要**：请先根据系统指令合理调用工具，再基于工具返回结果给出你的文字决策。**不要仅凭本提示中的静态数据直接下结论**.
`;


       return prompt;
   }




   // 生成专业交易原则框架
   const generateTradingPrinciples = () => {
       return `【专业交易原则】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━








• 趋势为王：只在明确趋势方向交易
• 风险控制：单笔最大亏损不超过总资产的2%
• 仓位管理：根据信号强度和波动率动态调整
• 止损纪律：严格执行止损，不抱侥幸心理
• 情绪控制：避免因近期盈亏影响当前决策`;
   };




// 生成策略表现分析
   const generateStrategyPerformanceAnalysis = (tradeHistory: any[]) => {
       if (!tradeHistory || tradeHistory.length === 0) {
           return `【策略表现分析】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━








最近交易历史：暂无数据`;
       }




// 计算统计数据
       const recentTrades = tradeHistory.slice(0, 10);
       const profitTrades = recentTrades.filter(t => t.type === 'close' && t.pnl > 0);
       const lossTrades = recentTrades.filter(t => t.type === 'close' && t.pnl < 0);




       const winRate = profitTrades.length + lossTrades.length > 0
           ? (profitTrades.length / (profitTrades.length + lossTrades.length) * 100)
           : 0;




       const totalProfit = profitTrades.reduce((sum, t) => sum + t.pnl, 0);
       const totalLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0));
       const avgProfit = profitTrades.length > 0 ? totalProfit / profitTrades.length : 0;
       const avgLoss = lossTrades.length > 0 ? totalLoss / lossTrades.length : 0;
       const profitLossRatio = avgLoss > 0 ? (avgProfit / avgLoss) : 0;




// 计算最大连续盈利和亏损
       let maxWinStreak = 0;
       let maxLossStreak = 0;
       let currentWinStreak = 0;
       let currentLossStreak = 0;




       for (const trade of recentTrades) {
           if (trade.type === 'close') {
               if (trade.pnl > 0) {
                   currentWinStreak++;
                   currentLossStreak = 0;
                   maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
               } else if (trade.pnl < 0) {
                   currentLossStreak++;
                   currentWinStreak = 0;
                   maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
               }
           }
       }




// 策略有效性评分
       let strategyScore = 0;
       if (winRate >= 60) strategyScore += 3;
       else if (winRate >= 50) strategyScore += 2;
       else if (winRate >= 40) strategyScore += 1;




       if (profitLossRatio >= 1.5) strategyScore += 3;
       else if (profitLossRatio >= 1.0) strategyScore += 2;
       else if (profitLossRatio >= 0.7) strategyScore += 1;




       if (maxLossStreak <= 2) strategyScore += 2;
       else if (maxLossStreak <= 3) strategyScore += 1;




       if (maxWinStreak >= 3) strategyScore += 2;
       else if (maxWinStreak >= 2) strategyScore += 1;




       return `【策略表现分析】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━








最近10笔交易统计：
• 胜率：${winRate.toFixed(1)}%
• 平均盈亏比：${profitLossRatio.toFixed(2)}
• 最大连续盈利：${maxWinStreak}笔
• 最大连续亏损：${maxLossStreak}笔
• 策略有效性评分：${strategyScore}/10








使用建议：仅作为策略参考，保持决策独立性`;
   };




// 开始构建提示词
   let prompt = `# 交易决策 #${iteration} | ${currentTime} | ${params.name}策略








## 交易原则与框架
${generateTradingPrinciples()}








## 决策优先级
1️⃣ 持仓管理（止损/止盈/峰值回撤）
2️⃣ 新开仓机会（多时间框架趋势+技术共振）
3️⃣ 加仓机会（盈利>5%且趋势强化，≤50%原仓位）








## 风险控制
- 系统强制：单笔亏损≤${RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT}% | 持仓≥${RISK_PARAMS.MAX_HOLDING_HOURS}h
- 策略止损：${params.stopLoss.low}%~${params.stopLoss.high}%（按杠杆）
- 分批止盈：+${params.partialTakeProfit.stage1.trigger}%→${params.partialTakeProfit.stage1.closePercent}% | +${params.partialTakeProfit.stage2.trigger}%→${params.partialTakeProfit.stage2.closePercent}% | +${params.partialTakeProfit.stage3.trigger}%→${params.partialTakeProfit.stage3.closePercent}%
- 峰值回撤：≥${params.peakDrawdownProtection}%立即平仓
${isCodeLevelProtectionEnabled ? `- 双重防护：代码自动监控+AI主动管理` : `- AI主动管理：监控峰值回撤`}
`;




// 市场数据展示 - 提供各币种技术指标详情，让AI基于详细数据进行自主分析
   prompt += `## 市场数据




### 技术指标说明
请基于以下各币种的详细技术指标数据进行综合分析：
- 评估各币种的趋势方向（上涨/下跌/盘整）
- 识别超买超卖信号（RSI指标）
- 分析动量变化（MACD指标）
- 判断价格相对于布林带的位置
- 考虑资金费率对持仓成本的影响
- 分析波动率（ATR指标）评估风险
- 结合成交量确认趋势强度
- 结合多时间框架数据进行综合趋势确认




### 各币种技术指标详情
`;




// 格式化输出每个币种的市场数据，为AI交易决策提供技术指标参考
// 包含：价格、EMA20、MACD、RSI7、布林带、资金费率、多时间框架分析、短期趋势判断
   for (const [symbol, dataRaw] of Object.entries(marketData)) {
       const data = dataRaw as any;




       prompt += `### ${symbol}
价格: ${data.price.toFixed(1)} | EMA20: ${data.ema20.toFixed(3)} | EMA50: ${data.ema50.toFixed(3)} | MACD: ${data.macd.toFixed(3)} | RSI7: ${data.rsi7.toFixed(3)} | RSI14: ${data.rsi14.toFixed(3)}`;




       // 布林带指标
       if (data.bbUpper && data.bbMiddle && data.bbLower) {
           prompt += ` | 布林带[${data.bbLower.toFixed(2)},${data.bbMiddle.toFixed(2)},${data.bbUpper.toFixed(2)}] 位置:${data.bbPosition?.toFixed(2)}%`;
       }




       // 资金费率
       if (data.fundingRate !== undefined) {
           prompt += ` | 资金费率:${data.fundingRate.toExponential(2)}`;
       }




       // ATR指标（波动率）
       if (data.longerTermContext && data.longerTermContext.atr14) {
           prompt += ` | ATR14: ${data.longerTermContext.atr14.toFixed(3)}`;
       }




       // 成交量
       if (data.volume !== undefined) {
           prompt += ` | 成交量: ${(data.volume / 1000).toFixed(1)}K`;
       }




       prompt += `\n`;




       // 多时间框架关键数据（简洁版）
       if (data.timeframes) {
           const keyTfs = ['3m', '5m', '15m', '1h'];
           let tfData = [];


           for (const tf of keyTfs) {
               const tfInfo = data.timeframes[tf];
               if (tfInfo) {
                   // 简洁格式：时间框架 + 关键指标
                   tfData.push(`${tf}周期: 价格${tfInfo.currentPrice.toFixed(2)} | EMA${tfInfo.ema20.toFixed(2)} | MACD${tfInfo.macd.toFixed(3)} | RSI${tfInfo.rsi7.toFixed(0)}`);
               }
           }


           if (tfData.length > 0) {
               prompt += `多时间框架数据（3分钟/5分钟/15分钟/1小时周期）:\n`;
               prompt += `  ${tfData.join('\n  ')}\n`;
           }
       }




       prompt += `\n`;
   }




// 账户信息
   prompt += `## 账户状态
总资产: ${accountInfo.totalBalance.toFixed(2)} USDT | 可用: ${accountInfo.availableBalance.toFixed(1)} | 收益率: ${accountInfo.returnPercent.toFixed(2)}%`;




// 计算所有持仓的未实现盈亏总和
   const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0);
   if (totalUnrealizedPnL !== 0) {
       prompt += ` | 浮盈: ${totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)} (${totalUnrealizedPnL >= 0 ? '+' : ''}${((totalUnrealizedPnL / accountInfo.totalBalance) * 100).toFixed(2)}%)`;
   }




   if (accountInfo.sharpeRatio !== undefined) {
       prompt += ` | 夏普: ${accountInfo.sharpeRatio.toFixed(3)}`;
   }




   prompt += `\n`;




// 当前持仓
   if (positions.length > 0) {
       prompt += `## 当前持仓\n`;




       for (const pos of positions) {
           // 计算盈亏百分比：考虑杠杆倍数
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


           // 计算峰值回撤
           const peakPnlPercent = pos.peak_pnl_percent || 0;
           const drawdownFromPeak = peakPnlPercent > 0 ? peakPnlPercent - pnlPercent : 0;


           // 风险警告
           let riskWarning = '';
           if (drawdownFromPeak >= params.peakDrawdownProtection) {
               riskWarning = ' ⚠️超限回撤';
           } else if (remainingHours < 2) {
               riskWarning = ' ⏰时间限制';
           } else if (drawdownFromPeak >= params.peakDrawdownProtection * 0.7) {
               riskWarning = ' ⚠️接近回撤';
           }


           prompt += `${pos.symbol} ${pos.side === 'long' ? '多' : '空'} ${pos.leverage}x | 盈亏: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}) | 持仓: ${holdingHours}h | 剩余: ${remainingHours.toFixed(1)}h${riskWarning}\n`;


           if (peakPnlPercent > 0) {
               prompt += `  峰值: +${peakPnlPercent.toFixed(2)}% | 回撤: ${drawdownFromPeak.toFixed(2)}%\n`;
           }
       }
   }




// 历史交易统计
   if (tradeHistory && tradeHistory.length > 0) {
       prompt += `## 交易统计\n${generateStrategyPerformanceAnalysis(tradeHistory)}\n`;
   }




// 历史决策记录（优化版）
   if (recentDecisions && recentDecisions.length > 0) {
       prompt += `## 近期决策参考\n`;




       // 显示最近10条决策，提供更全面的参考
       for (let i = 0; i < Math.min(recentDecisions.length, 10); i++) {
           const decision = recentDecisions[i];
           const timeDiff = Math.floor((new Date().getTime() - new Date(decision.timestamp).getTime()) / (1000 * 60));
           const hoursDiff = Math.floor(timeDiff / 60);
           const daysDiff = Math.floor(hoursDiff / 24);


           let displayTime;
           if (daysDiff > 0) {
               displayTime = `${daysDiff}天前`;
           } else if (hoursDiff > 0) {
               displayTime = `${hoursDiff}小时前`;
           } else {
               displayTime = `${timeDiff}分钟前`;
           }


           prompt += `#${decision.iteration} (${displayTime}): ${decision.decision.substring(0, 60)}...\n`;
       }




       prompt += `*基于当前市场数据独立判断*\n\n`;
   }




// 简洁的复盘提示
   prompt += `## 复盘要求\n`;
   prompt += `快速回顾交易表现，识别改进点，优化当前策略。\n\n`;




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








双重防护机制：








**代码级保护**（自动执行）：
- 自动止损：杠杆-8%~-5%
- 移动止盈：盈利5%→止损+2%，10%→止损+5%，15%→止损+8%
- 分批止盈：盈利8%→30%，12%→30%，18%→40%








**AI主动决策**：
- 可在自动保护前主动操作
- 主动风险管理是优秀交易员的标志








系统硬性底线：
- 单笔亏损≥${RISK_PARAMS.EXTREME_STOP_LOSS_PERCENT}%强制平仓
- 持仓≥${RISK_PARAMS.MAX_HOLDING_HOURS}小时强制平仓
- 最大杠杆：${RISK_PARAMS.MAX_LEVERAGE}倍








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
- **允许加仓**：对盈利>5%的持仓，趋势强化时可加仓
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








## 高级分析工具
- analyzeOrderBookDepth（订单簿深度分析）
- scientificTrendlineAnalysis（科学趋势线分析）
- patternAnalysis（K线图形态识别）








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
// 使用 API 密钥轮询管理器创建 OpenAI 客户端
   const openai = await createOpenAIClientWithRotation();




   const memory = new Memory({
       storage: new LibSQLMemoryAdapter({
           url: "file:./.voltagent/trading-memory.db",
           logger: logger.child({component: "libsql"}),
       }),
   });




// 获取当前策略
   const strategy = getTradingStrategy();
   logger.info(`使用交易策略: ${strategy}`);




// 如果是多Agent共识策略，创建子Agent
   let subAgents: Agent[] | undefined;
   if (strategy === "multi-agent-consensus") {
       logger.info("创建陪审团策略的子Agent（陪审团成员）...");
       const {
           createTechnicalAnalystAgent,
           createTrendAnalystAgent,
           createRiskAssessorAgent,
           createPatternRecognizerAgent
       } = await import("./analysisAgents");




       // 传递市场数据上下文给子Agent（异步创建）
       const agents = [
           createTechnicalAnalystAgent(marketDataContext),
           createTrendAnalystAgent(marketDataContext),
           createRiskAssessorAgent(marketDataContext),
       ];


       // 根据环境变量决定是否启用视觉模式识别Agent
       const enableVisualPatternAgent = process.env.ENABLE_VISUAL_PATTERN_AGENT !== 'false';
       if (enableVisualPatternAgent) {
           agents.push(createPatternRecognizerAgent(marketDataContext));
       }


       subAgents = await Promise.all(agents);
       const agentNames = enableVisualPatternAgent
           ? "技术分析Agent、趋势分析Agent、风险评估Agent、视觉模式识别Agent"
           : "技术分析Agent、趋势分析Agent、风险评估Agent";
       logger.info(`陪审团成员创建完成：${agentNames}`);
   }




// 如果是视觉模式识别策略，创建专门的视觉模式识别Agent
   if (strategy === "visual-pattern") {
       logger.info("创建视觉模式识别策略的专门Agent...");
       const {createPatternRecognizerAgent} = await import("./analysisAgents");


       // 创建专门的视觉模式识别Agent
       const agent = await createPatternRecognizerAgent(marketDataContext);


       logger.info("视觉模式识别Agent创建完成");
       return agent;
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
           tradingTools.analyzeOrderBookDepthTool,
           tradingTools.scientificTrendlineAnalysisTool,
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

