// swing-btc-eth-v2.ts
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {schedule} from 'node-cron';
import {captureCoingleassChart} from '../src/utils/coinglassScreenshot';
import {initTelegramBot, sendAlertNotification} from '../src/services/telegramBot';
import {initializeApiKeyManager, getApiKeyManager} from '../src/utils/apiKeyManager';

// 加载环境变量
dotenv.config();

// ==========================================
// 核心配置：波段交易模式 (Swing Trading)
// ==========================================
const CONFIG = {
    symbols: ['BTC'] as const,
    // 频率：每60分钟运行一次 (每天仅24次调用，极大节省成本)
    intervalMinutes: 60,

    // 时间框架组合：放大周期
    timeframes: {
        trend: '4h',    // 宏观趋势：4小时图
        decision: '1h', // 关键决策：1小时图
        entry: '15m'    // 精确入场：15分钟图
    },

    chartOffsets: {
        '4h': 600,
        '1h': 600,
        '15m': 600
    },

    // 视觉模型配置
    visionApiConfig: {
        model: 'gemini-3-pro-preview-thinking', // 建议尝试 gemini-2.0-flash-exp 以进一步降低成本
        baseURL: 'https://apicn.unifyllm.top/v1',
        apiKey: 'sk-rAdh4YcBeMmI7txSskNBOVSzkWZFzjC46tPHIxt6YYJ8TGnZ'
    },
    // 文本模型配置
    textApiConfig: {
        model: 'deepseek-reasoner',
        baseURL: 'https://api.deepseek.com/v3.2_speciale_expires_on_20251215',
    }
} as const;

// 颜色输出
const COLORS = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
} as const;

// ========== 视觉分析函数 (适配波段策略) ==========
async function analyzeChart(symbol: string, timeframe: string, chartBase64: string): Promise<string> {
    console.log(`${COLORS.cyan}[分析] ${symbol} ${timeframe}图分析${COLORS.reset}`);

    const client = new OpenAI({
        apiKey: CONFIG.visionApiConfig.apiKey,
        baseURL: CONFIG.visionApiConfig.baseURL
    });

    // 波段交易专用 Prompt
    const getPrompt = (tf: string) => {
        const prompts = {
            // 宏观趋势 (4H)
            '4h': `你是一位SMC波段交易员(Swing Trader)。这是${symbol}的4小时图(HTF)。
请分析宏观背景，忽略短期噪音：
1. 市场结构：主要趋势是 HH/HL (看涨) 还是 LH/LL (看跌)？
2. 溢价/折价：价格是否处于4H级别的极值区域？
3. 关键POI：找出未测试的 4H Order Block 或 FVG。
输出格式：
宏观方向：[看涨/看跌/震荡]
关键POI：[价格区间]
分析结论：[寻找做多机会/寻找做空机会/观望]`,

            // 决策结构 (1H)
            '1h': `你是一位SMC交易员。这是${symbol}的1小时图(MTF)。
我们需要确认4H趋势是否在1H图上得到结构支持：
1. 内部结构：1H图是否与4H趋势一致？
2. 流动性：近期是否猎杀(Sweep)了前一天的最高/最低点(PDH/PDL)？
3. 目标：如果入场，最近的流动性池在哪里？
输出格式：
中期结构：[与4H共振/背离]
流动性状态：[猎杀完成/待猎杀]
关注区域：[1H OB/FVG 价格]`,

            // 精确入场 (15m)
            '15m': `你是一位SMC交易员。这是${symbol}的15分钟图(LTF)。
寻找精准的入场触发器(Entry Trigger)：
1. 结构破坏(CHoCH)：价格触及1H POI后，是否有15m级别的反转信号？
2. 入场位：识别最近的15m FVG或Breaker Block。
3. 盈亏比：是否有至少 1:3 的盈亏比空间？
输出格式：
微观信号：[确认CHoCH/无信号]
入场建议：[具体价格 / 挂单建议]
止损位置：[价格]
SMC置信度：[高/中/低]`
        };
        // 映射配置中的key到prompt key
        if (tf === CONFIG.timeframes.trend) return prompts['4h'];
        if (tf === CONFIG.timeframes.decision) return prompts['1h'];
        if (tf === CONFIG.timeframes.entry) return prompts['15m'];
        return prompts['4h'];
    };

    try {
        const response = await client.chat.completions.create({
            model: CONFIG.visionApiConfig.model,
            temperature: 0.1,
            max_completion_tokens: 2000, // 稍微降低token数省钱
            messages: [
                {role: 'system', content: getPrompt(timeframe)},
                {
                    role: 'user',
                    content: [
                        {type: 'text', text: `分析 ${symbol} ${timeframe} 图表：`},
                        {type: 'image_url', image_url: {url: `data:image/png;base64,${chartBase64}`}}
                    ]
                }
            ]
        });
        const content = response.choices[0]?.message?.content || `${timeframe}图分析失败`;
        
        // ========== 调试日志：输出视觉模型返回内容 ==========
        console.log(`${COLORS.green}[分析] ✓ ${timeframe}图分析完成${COLORS.reset}`);
        console.log(`${COLORS.cyan}[调试] ${timeframe}图返回内容长度: ${content.length} 字符${COLORS.reset}`);
        console.log(`${COLORS.cyan}[调试] ${timeframe}图返回内容前200字符:${COLORS.reset}`);
        console.log(`${COLORS.white}${content.substring(0, 200)}...${COLORS.reset}`);
        console.log(`${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
        
        return content;
    } catch (error: any) {
        console.error(`${COLORS.red}[分析] ✗ ${timeframe}图分析失败: ${error.message}${COLORS.reset}`);
        return `${timeframe}图分析错误: ${error.message}`;
    }
}

// ========== DeepSeek 汇总 (波段逻辑) ==========
async function summarizeWithDeepSeek(symbol: string, analyses: {
    trend: string,
    decision: string,
    entry: string
}): Promise<string> {
    const manager = getApiKeyManager();
    const apiKey = await manager.getAvailableKey();

    const client = new OpenAI({
        apiKey,
        baseURL: CONFIG.textApiConfig.baseURL
    });

    const now = new Date();

    const systemPrompt = `
你是一名 SMC 波段交易专家 (Swing Trader)。你需要综合 4H, 1H, 15m 三个周期的分析，给出一份稳健的交易计划。

【当前环境】
币种：${symbol}
时间：${now.toLocaleString('zh-CN')}
模式：波段交易 (Swing Trading)

【市场数据】
4H (宏观趋势)：
${analyses.trend}

1H (结构确认)：
${analyses.decision}

15m (入场触发)：
${analyses.entry}

【决策逻辑】
1. **顺大势**：如果 4H 是看涨，严禁在没有到达 4H 关键阻力前做空。
2. **等待确认**：波段交易不追求买在最低点，追求确定性。必须等待 1H 结构与 4H 方向一致。
3. **入场条件**：
   - 价格必须进入 4H/1H 的 POI (OB 或 FVG)。
   - 15m 必须出现明确的 CHoCH (结构破坏)。
4. **过滤震荡**：如果 4H 处于震荡区间中间，坚决给出“观望”建议。

【输出格式要求】
🌊 ${symbol} SMC 波段交易报告
════════════════════════════
⏰ 时间：${now.toLocaleString('zh-CN')}

🌍 宏观大势 (4H)：
   • 趋势方向：[看涨/看跌/震荡]
   • 关键位置：[价格]

⚡ 结构确认 (1H)：
   • 结构状态：[是否配合宏观趋势]
   • 流动性：[是否已完成猎杀]

🎯 最终决策：
   • 策略：[做多/做空/观望]
   • 建议操作：[如：在 65000 挂 Limit 单 / 现价入场 / 设置 66000 价格预警]
   • 核心理由：[一句话概括]

📝 交易计划 (如有)：
   • 入场区 (Entry)：[价格区间]
   • 止损 (SL)：[价格]
   • 第一止盈 (TP1)：[价格]
   • 盈亏比：[数值]

⚠️ 风险提示：
   • [主要风险点]
════════════════════════════
`;

    try {
        const response = await client.chat.completions.create({
            model: CONFIG.textApiConfig.model,
            temperature: 0.1,
            max_completion_tokens: 8000,
            messages: [{role: 'system', content: systemPrompt}]
        });
        const content = response.choices[0]?.message?.content || 'DeepSeek汇总失败';
        console.log(`${COLORS.green}[汇总] ✓ DeepSeek分析完成${COLORS.reset}`);
        return content;
    } catch (error: any) {
        console.error(`${COLORS.red}[汇总] ✗ DeepSeek分析失败: ${error.message}${COLORS.reset}`);
        return `DeepSeek汇总错误: ${error.message}`;
    }
}

// ========== 主分析流程 ==========
async function analyzeIntradayTrade(symbol: string): Promise<{
    summary: string;
    analyses: Record<string, string>;
    success: boolean;
}> {
    console.log(`${COLORS.cyan}[系统] ${symbol} 开始波段策略分析...${COLORS.reset}`);
    let success = true;
    const analyses: Record<string, string> = {};

    try {
        // 1. 获取图表 (4h, 1h, 15m)
        console.log(`${COLORS.blue}[图表] 获取图表 (4h, 1h, 15m)...${COLORS.reset}`);
        const [chartTrend, chartDecision, chartEntry] = await Promise.all([
            captureChart(symbol, CONFIG.timeframes.trend),
            captureChart(symbol, CONFIG.timeframes.decision),
            captureChart(symbol, CONFIG.timeframes.entry)
        ]);
        console.log(`${COLORS.green}[图表] ✓ 三张图表获取完成${COLORS.reset}`);

        // 2. 视觉分析
        console.log(`${COLORS.blue}[分析] AI 视觉分析中...${COLORS.reset}`);
        const [analysisTrend, analysisDecision, analysisEntry] = await Promise.all([
            analyzeChart(symbol, CONFIG.timeframes.trend, chartTrend),
            analyzeChart(symbol, CONFIG.timeframes.decision, chartDecision),
            analyzeChart(symbol, CONFIG.timeframes.entry, chartEntry)
        ]);

        // ========== 调试日志：确认视觉分析结果 ==========
        console.log(`${COLORS.cyan}[调试] 视觉分析结果汇总:${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - trend 分析: ${analysisTrend ? '✓ 已获取' : '✗ 失败'} (${analysisTrend?.length || 0} 字符)${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - decision 分析: ${analysisDecision ? '✓ 已获取' : '✗ 失败'} (${analysisDecision?.length || 0} 字符)${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - entry 分析: ${analysisEntry ? '✓ 已获取' : '✗ 失败'} (${analysisEntry?.length || 0} 字符)${COLORS.reset}`);

        analyses['trend'] = analysisTrend;
        analyses['decision'] = analysisDecision;
        analyses['entry'] = analysisEntry;
        
        console.log(`${COLORS.cyan}[调试] analyses 对象已构建，包含 ${Object.keys(analyses).length} 个键${COLORS.reset}`);

        // 3. 智能汇总
        console.log(`${COLORS.blue}[汇总] 开始 DeepSeek 智能汇总...${COLORS.reset}`);
        const summary = await summarizeWithDeepSeek(symbol, {
            trend: analysisTrend,
            decision: analysisDecision,
            entry: analysisEntry
        });
        
        console.log(`${COLORS.cyan}[调试] summary 长度: ${summary?.length || 0} 字符${COLORS.reset}`);
        console.log(`${COLORS.green}[系统] ✓ ${symbol} 完整分析流程完成${COLORS.reset}`);

        return { summary, analyses, success };

    } catch (error: any) {
        console.error(`${COLORS.red}[系统] ${symbol} 分析失败: ${error.message}${COLORS.reset}`);
        console.error(`${COLORS.red}[系统] 错误堆栈: ${error.stack}${COLORS.reset}`);
        return { summary: `分析失败: ${error.message}`, analyses: {}, success: false };
    }
}

// ========== 通知与保存（发送完整分析报告） ==========
async function sendTelegramNotification(
    symbol: string, 
    summary: string, 
    analyses: Record<string, string>,
    success: boolean
) {
    if (!success) {
        console.log(`${COLORS.yellow}[通知] 分析失败，跳过Telegram通知${COLORS.reset}`);
        return;
    }

    try {
        console.log(`${COLORS.cyan}[通知] 开始构建Telegram消息...${COLORS.reset}`);
        
        // 提取方向
        let direction = '';
        if (summary.includes('策略：做多') || summary.includes('方向：做多')) direction = '做多';
        else if (summary.includes('策略：做空') || summary.includes('方向：做空')) direction = '做空';
        else if (summary.includes('策略：观望') || summary.includes('观望')) direction = '观望';

        console.log(`${COLORS.cyan}[通知] 检测到交易方向: ${direction || '未知'}${COLORS.reset}`);

        const emoji = direction === '做多' ? '📈' : direction === '做空' ? '📉' : '👀';
        const lines: string[] = [];
        
        // 清理markdown符号
        const cleanSummary = summary.replace(/\*\*/g, '').replace(/###/g, '');
        const summaryLines = cleanSummary.split('\n').filter(line => line.trim() !== '');
        
        lines.push('【综合决策】');
        lines.push('');
        summaryLines.forEach(line => {
            if (line.trim()) {
                lines.push(line);
                // 在重要部分后添加空行
                if (line.includes('🌊') || line.includes('宏观大势') || 
                    line.includes('⚡') || line.includes('结构确认') ||
                    line.includes('🎯') || line.includes('最终决策') ||
                    line.includes('📝') || line.includes('交易计划') ||
                    line.includes('⚠️') || line.includes('风险提示')) {
                    lines.push('');
                }
            }
        });
        lines.push('');
        
        // ========== 第二部分：三个视觉模型的原始分析 ==========
        lines.push('【原始图像分析结论】');
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 4H 宏观趋势
        if (analyses.trend) {
            lines.push('🌍 4小时图 (宏观趋势)：');
            lines.push('');
            const trendLines = analyses.trend.split('\n').slice(0, 15); // 取前15行
            trendLines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    lines.push(`   • ${trimmed.substring(0, 100)}`);
                }
            });
            lines.push('');
            lines.push('');
        }

        // 1H 结构确认
        if (analyses.decision) {
            lines.push('⚡ 1小时图 (结构确认)：');
            lines.push('');
            const decisionLines = analyses.decision.split('\n').slice(0, 12); // 取前12行
            decisionLines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    lines.push(`   • ${trimmed.substring(0, 100)}`);
                }
            });
            lines.push('');
            lines.push('');
        }

        // 15m 入场触发
        if (analyses.entry) {
            lines.push('🎯 15分钟图 (入场触发)：');
            lines.push('');
            const entryLines = analyses.entry.split('\n').slice(0, 12); // 取前12行
            entryLines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    lines.push(`   • ${trimmed.substring(0, 100)}`);
                }
            });
        }
        
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');

        console.log(`${COLORS.cyan}[通知] 消息构建完成，共 ${lines.length} 行${COLORS.reset}`);
        console.log(`${COLORS.cyan}[通知] 准备发送到Telegram...${COLORS.reset}`);

        // 发送通知
        const notificationData = {
            title: `${emoji} ${symbol} SMC 波段信号（每小时播报一次）`,
            lines: lines,
            emoji: emoji
        };

        console.log(`${COLORS.cyan}[通知] 调用 sendAlertNotification，参数:${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - title: ${notificationData.title}${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - lines count: ${notificationData.lines.length}${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - emoji: ${notificationData.emoji}${COLORS.reset}`);

        await sendAlertNotification(notificationData);
        
        console.log(`${COLORS.green}[通知] ✓ Telegram发送成功！${COLORS.reset}`);
        
    } catch (error: any) {
        console.error(`${COLORS.red}[通知] ✗ Telegram发送失败:${COLORS.reset}`);
        console.error(`${COLORS.red}  错误类型: ${error.constructor.name}${COLORS.reset}`);
        console.error(`${COLORS.red}  错误信息: ${error.message}${COLORS.reset}`);
        if (error.stack) {
            console.error(`${COLORS.red}  堆栈信息: ${error.stack}${COLORS.reset}`);
        }
    }
}

function saveAnalysisResults(symbol: string, data: any) {
    try {
        console.log(`${COLORS.cyan}[保存] 开始保存分析结果...${COLORS.reset}`);
        
        const now = new Date();
        const dir = path.join(process.cwd(), 'swing-logs', now.toISOString().split('T')[0]);
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
            console.log(`${COLORS.cyan}[保存] 创建目录: ${dir}${COLORS.reset}`);
        }
        
        const filename = `${symbol}_${now.toTimeString().split(' ')[0].replace(/:/g, '-')}.txt`;
        const filepath = path.join(dir, filename);
        
        // ========== 调试日志：检查数据结构 ==========
        console.log(`${COLORS.cyan}[调试] 检查数据结构:${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - summary 长度: ${data.summary?.length || 0} 字符${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - analyses.trend 长度: ${data.analyses?.trend?.length || 0} 字符${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - analyses.decision 长度: ${data.analyses?.decision?.length || 0} 字符${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - analyses.entry 长度: ${data.analyses?.entry?.length || 0} 字符${COLORS.reset}`);
        console.log(`${COLORS.cyan}  - success: ${data.success}${COLORS.reset}`);
        
        // 构建完整内容
        const content = `=== ${symbol} 波段分析 ===
时间: ${now.toLocaleString('zh-CN')}
状态: ${data.success ? '成功' : '失败'}

## DeepSeek 综合决策
${data.summary || '无'}

## 三个视觉模型原始分析

### 4小时图 (宏观趋势)
${data.analyses?.trend || '无'}

### 1小时图 (结构确认)
${data.analyses?.decision || '无'}

### 15分钟图 (入场触发)
${data.analyses?.entry || '无'}
`;
        
        fs.writeFileSync(filepath, content, 'utf8');
        
        console.log(`${COLORS.green}[保存] ✓ 日志已保存到: ${filepath}${COLORS.reset}`);
        console.log(`${COLORS.cyan}[保存] 文件大小: ${(content.length / 1024).toFixed(2)} KB${COLORS.reset}`);
    } catch (error: any) {
        console.error(`${COLORS.red}[保存] ✗ 保存失败: ${error.message}${COLORS.reset}`);
        console.error(error.stack);
    }
}

async function captureChart(symbol: string, timeframe: string): Promise<string> {
    // 包装原始截图函数
    return await captureCoingleassChart(symbol, timeframe, 'Gate', CONFIG.chartOffsets[timeframe as keyof typeof CONFIG.chartOffsets]);
}

// ========== 调度与启动 ==========
async function main() {
    console.log(`${COLORS.white}策略: 4H趋势 + 1H结构 + 15m入场${COLORS.reset}`);
    console.log(`${COLORS.white}频率: 每 60 分钟${COLORS.reset}`);

    await initializeApiKeyManager();
    await initTelegramBot();

    const run = async () => {
        console.log(`${COLORS.blue}[运行] 开始执行波段分析任务...${COLORS.reset}`);
        for (const sym of CONFIG.symbols) {
            console.log(`${COLORS.cyan}[${sym}] 开始分析${COLORS.reset}`);
            const result = await analyzeIntradayTrade(sym);
            
            console.log(`${COLORS.cyan}[${sym}] 保存分析结果...${COLORS.reset}`);
            saveAnalysisResults(sym, result);
            
            console.log(`${COLORS.cyan}[${sym}] 发送Telegram通知...${COLORS.reset}`);
            await sendTelegramNotification(sym, result.summary, result.analyses, result.success);
            
            console.log(`${COLORS.green}[${sym}] 分析完成${COLORS.reset}`);
        }
        console.log(`${COLORS.green}[运行] 本轮分析任务完成${COLORS.reset}`);
    };

    if (process.argv.includes('--test')) {
        await run();
    } else {
        // 立即运行一次
        await run();
        // 每小时运行一次
        schedule('0 * * * *', async () => {
            console.log(`${COLORS.blue}[调度] 定时任务触发，开始新一轮分析${COLORS.reset}`);
            await run();
        });
        console.log(`${COLORS.green}[调度] 定时任务已设置，每小时整点执行${COLORS.reset}`);
    }
}

main().catch(error => {
    console.error(`${COLORS.red}[致命错误] 主程序异常: ${error.message}${COLORS.reset}`);
    console.error(error.stack);
    process.exit(1);
});

