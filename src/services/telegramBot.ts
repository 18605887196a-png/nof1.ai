import { createPinoLogger } from "@voltagent/logger";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

const logger = createPinoLogger({
  name: "telegram-bot",
  level: "info",
});

// 代理配置 - 支持 HTTP/HTTPS 和 SOCKS5 代理
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
let httpsAgent: HttpsProxyAgent<any> | SocksProxyAgent | undefined;

if (PROXY_URL) {
  if (PROXY_URL.startsWith('socks://') || PROXY_URL.startsWith('socks5://') || PROXY_URL.startsWith('socks4://')) {
    // SOCKS 代理
    httpsAgent = new SocksProxyAgent(PROXY_URL);
    logger.info(`使用 SOCKS 代理: ${PROXY_URL}`);
  } else {
    // HTTP/HTTPS 代理
    httpsAgent = new HttpsProxyAgent(PROXY_URL);
    logger.info(`使用 HTTP 代理: ${PROXY_URL}`);
  }
}

type TradeNotification =
  | {
      kind: "open";
      symbol: string;
      side: "long" | "short";
      leverage: number;
      contracts: number;
      baseAmount: number;
      entryPrice: number;
      margin: number;
      notional: number;
    }
  | {
      kind: "close";
      symbol: string;
      side: "long" | "short";
      contracts: number;
      baseAmount: number;
      entryPrice: number;
      exitPrice: number;
      pnl: number;
      fee: number;
    };

/**
 * 视觉分析结论通知负载
 */
interface VisionAnalysisNotification {
  symbol: string;
  mainTimeframe: string;
  entryTimeframe: string;
  microTimeframe?: string;
  analysis: string;
  timestamp: string;
}

interface AlertNotificationPayload {
  title?: string;
  lines: string[];
  emoji?: string;
}

const TELEGRAM_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_BASE_URL = () => {
  const token = TELEGRAM_TOKEN();
  return token ? `https://api.telegram.org/bot${token}` : "";
};

const notifyChats = new Set<string>();
let botReady = false;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function parseChatList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function callTelegramApi<T = any>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  const baseUrl = TELEGRAM_BASE_URL();
  if (!baseUrl) return null;
  
  try {
    const url = `${baseUrl}/${method}`;
    logger.debug(`调用 Telegram API: ${method}, URL: ${url}`);
    
    const response = await axios.post(url, payload, {
      timeout: 35_000,
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    const data = response.data;
    if (!data || data.ok !== true) {
      logger.warn(
        `Telegram API 调用失败 (${method}): ${data?.description ?? "未知错误"}`,
      );
      return null;
    }
    return data.result as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Telegram API 调用异常 (${method}): ${errorMsg}`);
    logger.debug(`详细错误: ${JSON.stringify(error)}`);
    
    // 检查是否是网络连接问题
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT')) {
      logger.error('❌ 无法连接到 Telegram API，请检查网络连接或代理设置');
      logger.info('提示: 如果在中国大陆，可能需要配置代理才能访问 Telegram API');
      if (!httpsAgent) {
        logger.info('💡 可以通过设置环境变量来配置代理:');
        logger.info('   export HTTPS_PROXY=http://127.0.0.1:7890');
        logger.info('   或在 .env 文件中添加: HTTPS_PROXY=http://127.0.0.1:7890');
      }
    }
    
    return null;
  }
}

/**
 * 使用 FormData 调用 Telegram API（用于上传文件）
 */
async function callTelegramApiWithFormData<T = any>(
  method: string,
  formData: FormData,
): Promise<T | null> {
  const baseUrl = TELEGRAM_BASE_URL();
  if (!baseUrl) return null;
  
  try {
    const url = `${baseUrl}/${method}`;
    logger.debug(`调用 Telegram API (FormData): ${method}, URL: ${url}`);
    
    const response = await axios.post(url, formData, {
      timeout: 60_000, // 上传文件需要更长超时
      httpsAgent,
      headers: formData.getHeaders(),
    });
    
    const data = response.data;
    if (!data || data.ok !== true) {
      logger.warn(
        `Telegram API 调用失败 (${method}): ${data?.description ?? "未知错误"}`,
      );
      return null;
    }
    return data.result as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Telegram API 调用异常 (${method}): ${errorMsg}`);
    logger.debug(`详细错误: ${JSON.stringify(error)}`);
    
    // 检查是否是网络连接问题
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT')) {
      logger.error('❌ 无法连接到 Telegram API，请检查网络连接或代理设置');
      logger.info('提示: 如果在中国大陆，可能需要配置代理才能访问 Telegram API');
      if (!httpsAgent) {
        logger.info('💡 可以通过设置环境变量来配置代理:');
        logger.info('   export HTTPS_PROXY=http://127.0.0.1:7890');
        logger.info('   或在 .env 文件中添加: HTTPS_PROXY=http://127.0.0.1:7890');
      }
    }
    
    return null;
  }
}

export function isTelegramReady(): boolean {
  return botReady;
}

async function sendMessage(
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
) {
  if (!botReady) return;
  const baseUrl = TELEGRAM_BASE_URL();
  if (!baseUrl) return;
  
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

async function broadcastMessage(
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
) {
  if (!botReady) {
    logger.warn("broadcastMessage: Telegram 机器人未就绪");
    return;
  }
  if (notifyChats.size === 0) {
    logger.warn("Telegram 通知已丢弃：未配置可通知的 chat id");
    return;
  }
  
  logger.info(`broadcastMessage: 准备向 ${notifyChats.size} 个聊天发送消息`);
  const chatIds = Array.from(notifyChats);
  
  await Promise.all(
    chatIds.map((chatId) => {
      logger.debug(`正在发送消息到 chatId: ${chatId}`);
      return sendMessage(chatId, text, parseMode).catch((error) => {
        logger.warn(
          `发送 Telegram 消息到 ${chatId} 失败: ${(error as Error).message}`,
        );
      });
    }),
  );
  
  logger.info(`broadcastMessage: 消息发送完成`);
}

export async function initTelegramBot(): Promise<void> {
  logger.info("开始初始化 Telegram 机器人...");
  
  const token = TELEGRAM_TOKEN();
  if (!token) {
    logger.info("未配置 TELEGRAM_BOT_TOKEN，跳过 Telegram 机器人初始化。");
    logger.info("请在环境变量中设置 TELEGRAM_BOT_TOKEN 以启用 Telegram 通知");
    return;
  }
  
  if (botReady) {
    logger.info("Telegram 机器人已初始化，无需重复启动。");
    return;
  }

  const chatIds = parseChatList(
    process.env.TELEGRAM_NOTIFY_CHAT_IDS ??
      process.env.TELEGRAM_CHAT_IDS,
  );
  
  logger.info(`从环境变量解析到 ${chatIds.length} 个聊天ID`);
  
  chatIds.forEach((chatId) => {
    notifyChats.add(chatId);
    logger.debug(`添加聊天ID: ${chatId}`);
  });

  botReady = true;
  logger.info(`Telegram 机器人已启动（仅通知模式）。已配置 ${notifyChats.size} 个通知目标`);
}

export async function stopTelegramBot(): Promise<void> {
  if (!botReady) return;
  botReady = false;
  logger.info("Telegram 机器人已关闭。");
}

export async function sendTradeNotification(payload: TradeNotification) {
  if (!botReady) return;
  if (payload.kind === "open") {
    const text = [
      `<b>📈 开仓通知</b>`,
      `<b>合约：</b>${escapeHtml(payload.symbol)} | <b>方向：</b>${payload.side.toUpperCase()}`,
      `<b>杠杆：</b>${payload.leverage.toFixed(0)}x | <b>保证金：</b>${payload.margin.toFixed(2)} USDT`,
      `<b>成交价：</b>${payload.entryPrice.toFixed(4)} USDT`,
      `<b>合约张数：</b>${payload.contracts.toString()} | <b>名义价值：</b>${payload.notional.toFixed(2)} USDT`,
      `<b>基础数量：</b>${payload.baseAmount.toFixed(payload.baseAmount < 1 ? 4 : 2)}`,
    ].join("\n");
    await broadcastMessage(text);
  } else {
    const pnlLabel = `${payload.pnl >= 0 ? "+" : ""}${payload.pnl.toFixed(2)} USDT`;
    const text = [
      `<b>📉 平仓通知</b>`,
      `<b>合约：</b>${escapeHtml(payload.symbol)} | <b>方向：</b>${payload.side.toUpperCase()}`,
      `<b>平仓价：</b>${payload.exitPrice.toFixed(4)} USDT`,
      `<b>持仓成本：</b>${payload.entryPrice.toFixed(4)} USDT`,
      `<b>合约张数：</b>${payload.contracts.toString()} | <b>基础数量：</b>${payload.baseAmount.toFixed(payload.baseAmount < 1 ? 4 : 2)}`,
      `<b>盈亏：</b>${pnlLabel} (含手续费 ${payload.fee.toFixed(2)} USDT)`,
    ].join("\n");
    await broadcastMessage(text);
  }
}

interface AlertNotificationPayload {
  title?: string;
  lines: string[];
  emoji?: string;
}

export async function sendAlertNotification(payload: AlertNotificationPayload) {
  if (!botReady) {
    logger.warn("Telegram 机器人未就绪，跳过通知发送");
    return;
  }
  
  if (notifyChats.size === 0) {
    logger.warn("Telegram 通知已丢弃：未配置可通知的 chat id");
    return;
  }
  
  const emoji = payload.emoji ?? "⚡";
  const title = payload.title ?? "系统通知";
  const header = `<b>${escapeHtml(`${emoji} ${title}`)}</b>`;
  const body = payload.lines
    .map((line) => escapeHtml(line))
    .join("\n");
  const text = [header, body].filter(Boolean).join("\n");
  
  logger.info(`准备发送 Telegram 通知: ${title} 到 ${notifyChats.size} 个聊天`);
  logger.debug(`通知内容: ${text.substring(0, 200)}...`);
  
  await broadcastMessage(text);
}

/**
 * 解析视觉分析文本，提取关键信息
 */
function parseVisionAnalysis(analysis: string): {
  patternJudgment?: string;  // 模式判定
  mainTrend?: string;
  entryStructure?: string;
  primaryStrategy?: string;  // 主要策略
  secondaryStrategy?: string;  // 次要策略
  microConfirm?: string;
  fundingStructure?: string;
  signalRating?: string;
  recommendation?: string;
  entryZone?: string;
  entryArea?: string;  // 入场区
  risks?: string[];
} {
  const result: any = {};
  
  try {
    // 提取【模式判定】
    const patternMatch = analysis.match(/【模式判定】([\s\S]*?)(?=【|$)/);
    if (patternMatch) {
      result.patternJudgment = patternMatch[1].trim();
    }
    
    // 提取【1h 主趋势结构】
    const mainTrendMatch = analysis.match(/【1h 主趋势结构】([\s\S]*?)(?=【|$)/);
    if (mainTrendMatch) {
      result.mainTrend = mainTrendMatch[1].trim().replace(/\n+/g, ' | ');
    }
    
    // 提取【15m 入场结构】
    const entryMatch = analysis.match(/【15m 入场结构】([\s\S]*?)(?=【|$)/);
    if (entryMatch) {
      result.entryStructure = entryMatch[1].trim().replace(/\n+/g, ' | ');
    }
    
    // 提取Primary策略
    const primaryMatch = analysis.match(/Primary：([\s\S]*?)(?=Secondary|【|$)/);
    if (primaryMatch) {
      result.primaryStrategy = primaryMatch[1].trim();
    }
    
    // 提取Secondary策略
    const secondaryMatch = analysis.match(/Secondary：([\s\S]*?)(?=【|$)/);
    if (secondaryMatch) {
      result.secondaryStrategy = secondaryMatch[1].trim();
    }
    
    // 提取【5m 微确认】
    const microMatch = analysis.match(/【5m 微确认】([\s\S]*?)(?=【|$)/);
    if (microMatch) {
      result.microConfirm = microMatch[1].trim();
    }
    
    // 提取【资金结构简述】
    const fundingMatch = analysis.match(/【资金结构简述】([\s\S]*?)(?=【|$)/);
    if (fundingMatch) {
      result.fundingStructure = fundingMatch[1].trim();
    }
    
    // 提取【信号评级】
    const ratingMatch = analysis.match(/【信号评级】([\s\S]*?)(?=【|$)/);
    if (ratingMatch) {
      result.signalRating = ratingMatch[1].trim();
    }
    
    // 提取【建议方向】
    const recommendMatch = analysis.match(/【建议方向】([\s\S]*?)(?=【|$)/);
    if (recommendMatch) {
      result.recommendation = recommendMatch[1].trim();
    }
    
    // 提取【入场区间】
    const zoneMatch = analysis.match(/【入场区间】([\s\S]*?)(?=【|$)/);
    if (zoneMatch) {
      result.entryZone = zoneMatch[1].trim();
    }
    
    // 提取【入场区】
    const areaMatch = analysis.match(/【入场区】([\s\S]*?)(?=【|$)/);
    if (areaMatch) {
      result.entryArea = areaMatch[1].trim();
    }
    
    // 提取【风险提示】
    const riskMatch = analysis.match(/【风险提示】([\s\S]*?)(?=【|$)/);
    if (riskMatch) {
      const riskText = riskMatch[1].trim();
      result.risks = riskText
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.startsWith('-') || line.startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, ''));
    }
  } catch (error) {
    logger.warn(`解析视觉分析文本失败: ${(error as Error).message}`);
  }
  
  return result;
}

/**
 * 发送视觉分析结论通知到 Telegram（完整版）
 */
export async function sendVisionAnalysisNotification(payload: VisionAnalysisNotification) {
  if (!botReady) {
    logger.warn("Telegram 机器人未就绪，跳过视觉分析通知");
    return;
  }
  
  // 解析分析结果
  const parsed = parseVisionAnalysis(payload.analysis);
  
  // 过滤震荡/观望信号 - 只发送明确的做多/做空趋势信号
  if (parsed.recommendation) {
    const rec = parsed.recommendation.toLowerCase();
    if (rec.includes('观望') || rec.includes('震荡') || rec.includes('等待') || rec.includes('暂不')) {
      logger.info(`跳过震荡/观望信号通知: ${payload.symbol} - ${parsed.recommendation}`);
      return;
    }
  }
  
  const lines: string[] = [];
  
  // ════════════════════════════
  // 标题区
  // ════════════════════════════
  lines.push(`<b>🔍 ${escapeHtml(payload.symbol)} 视觉分析</b>`);
  const timeframes = payload.microTimeframe 
    ? `${payload.mainTimeframe}+${payload.entryTimeframe}+${payload.microTimeframe}`
    : `${payload.mainTimeframe}+${payload.entryTimeframe}`;
  lines.push(`⏱ ${timeframes}`);
  lines.push('');
  
  // 模式判定（重要信息）
  if (parsed.patternJudgment) {
    lines.push(`<b>🔶 模式判定</b>`);
    lines.push(`  ${escapeHtml(parsed.patternJudgment)}`);
    lines.push('');
  }
  
  // ════════════════════════════
  // 核心决策（高亮）
  // ════════════════════════════
  if (parsed.recommendation) {
    const emoji = parsed.recommendation.includes('做多') ? '📈' 
                : parsed.recommendation.includes('做空') ? '📉' 
                : '⏸️';
    lines.push(`╔═══════════════════╗`);
    lines.push(`║ <b>${emoji} 建议方向</b>`);
    lines.push(`║ ${escapeHtml(parsed.recommendation)}`);
    if (parsed.signalRating) {
      lines.push(`║ ⭐ ${escapeHtml(parsed.signalRating)}`);
    }
    lines.push(`╚═══════════════════╝`);
    lines.push('');
  }
  
  // ════════════════════════════
  // 入场区间
  // ════════════════════════════
  if (parsed.entryZone) {
    lines.push(`<b>🎯 入场区间</b>`);
    const entryLines = parsed.entryZone.split('\n').filter(l => l.trim());
    entryLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('建议在')) {
        const priceMatch = trimmed.match(/\$[\d,]+\s*-\s*\$[\d,]+/);
        if (priceMatch) {
          lines.push(`  💰 ${priceMatch[0]}`);
        } else {
          lines.push(`  💰 ${escapeHtml(trimmed)}`);
        }
      } else if (trimmed.includes('激进')) {
        lines.push(`  ⚡ ${escapeHtml(trimmed)}`);
      } else if (trimmed.includes('稳健')) {
        lines.push(`  🛡 ${escapeHtml(trimmed)}`);
      } else if (trimmed) {
        lines.push(`  💰 ${escapeHtml(trimmed)}`);
      }
    });
    lines.push('');
  }
  
  // ════════════════════════════
  // 入场区和策略（完整展示）
  // ════════════════════════════
  if (parsed.entryArea && parsed.entryArea !== '无') {
    lines.push(`<b>📍 入场区</b>`);
    const areaLines = parsed.entryArea.split('\n').filter(l => l.trim());
    areaLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('Primary：')) {
        lines.push(`  <b>🔷 ${escapeHtml(trimmed)}</b>`);
      } else if (trimmed.startsWith('Secondary：')) {
        lines.push(`  <b>🔶 ${escapeHtml(trimmed)}</b>`);
      } else if (trimmed) {
        lines.push(`  ${escapeHtml(trimmed)}`);
      }
    });
    lines.push('');
  }
  
  // 策略详情（Primary和Secondary）
  if (parsed.primaryStrategy || parsed.secondaryStrategy) {
    lines.push(`<b>📋 策略详情</b>`);
    if (parsed.primaryStrategy) {
      const primaryLines = parsed.primaryStrategy.split('\n').filter(l => l.trim());
      primaryLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (idx === 0) {
          lines.push(`  <b>🔷 Primary：</b>${escapeHtml(trimmed)}`);
        } else {
          lines.push(`    ${escapeHtml(trimmed)}`);
        }
      });
    }
    if (parsed.secondaryStrategy) {
      const secondaryLines = parsed.secondaryStrategy.split('\n').filter(l => l.trim());
      secondaryLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (idx === 0) {
          lines.push(`  <b>🔶 Secondary：</b>${escapeHtml(trimmed)}`);
        } else {
          lines.push(`    ${escapeHtml(trimmed)}`);
        }
      });
    }
    lines.push('');
  }
  
  // ════════════════════════════
  // 分析过程（完整展示）
  // ════════════════════════════
  lines.push(`<b>📊 分析过程</b>`);
  
  // 1h 主趋势 - 完整显示
  if (parsed.mainTrend) {
    const trendParts = parsed.mainTrend.split('|').map(p => p.trim());
    lines.push(`<b>• 1h 主趋势</b>`);
    trendParts.forEach((part, idx) => {
      if (part) { // 完整显示所有要点，不再限制数量
        lines.push(`  ${escapeHtml(part)}`);
      }
    });
  }
  
  // 15m 入场结构 - 完整显示
  if (parsed.entryStructure) {
    lines.push('');  // 15m 前加空行
    const entryParts = parsed.entryStructure.split('|').map(p => p.trim());
    lines.push(`<b>• 15m 入场结构</b>`);
    entryParts.forEach((part) => {
      if (part) { // 完整显示所有要点，不再限制数量和截断
        lines.push(`  ${escapeHtml(part)}`);
      }
    });
  }
  
  // 5m 微确认 - 完整显示
  if (parsed.microConfirm) {
    const microLines = parsed.microConfirm.split('\n').filter(l => l.trim());
    if (microLines.length > 0) {
      lines.push('');  // 5m 前加空行
      lines.push(`<b>• 5m 微确认</b>`);
      microLines.forEach(line => { // 完整显示所有微确认信息
        const trimmed = line.trim();
        lines.push(`  ${escapeHtml(trimmed)}`);
      });
    }
  }
  
  // 资金结构 - 完整显示
  if (parsed.fundingStructure) {
    const fundingLines = parsed.fundingStructure.split('\n').filter(l => l.trim());
    if (fundingLines.length > 0) {
      lines.push('');  // 资金结构前加空行
      lines.push(`<b>• 💰 资金结构</b>`);
      fundingLines.forEach(line => { // 完整显示所有资金结构信息
        const trimmed = line.trim();
        lines.push(`  ${escapeHtml(trimmed)}`);
      });
    }
  }
  lines.push('');
  
  // ════════════════════════════
  // 风险提示
  // ════════════════════════════
  if (parsed.risks && parsed.risks.length > 0) {
    lines.push(`<b>⚠️ 风险提示</b>`);
    parsed.risks.forEach(risk => {
      lines.push(`  • ${escapeHtml(risk)}`);
    });
    lines.push('');
  }
  
  // ════════════════════════════
  // 时间戳
  // ════════════════════════════
  const time = new Date(payload.timestamp).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  lines.push(`📅 ${time}`);
  
  const text = lines.join('\n');
  
  // 广播消息
  await broadcastMessage(text);
  
  logger.info(`视觉分析通知已发送: ${payload.symbol} ${parsed.recommendation || 'N/A'}`);
}

/**
 * 发送图片到 Telegram
 * @param chatId 聊天 ID
 * @param photoPath 图片文件路径或 Buffer
 * @param caption 图片说明（可选）
 */
async function sendPhoto(
  chatId: string,
  photoPath: string | Buffer,
  caption?: string,
) {
  if (!botReady) return;
  const baseUrl = TELEGRAM_BASE_URL();
  if (!baseUrl) return;

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);

    if (typeof photoPath === "string") {
      // 文件路径
      if (!fs.existsSync(photoPath)) {
        logger.warn(`图片文件不存在: ${photoPath}`);
        return;
      }
      formData.append("photo", fs.createReadStream(photoPath));
    } else {
      // Buffer
      formData.append("photo", photoPath, { filename: "image.png" });
    }

    if (caption) {
      formData.append("caption", caption);
      formData.append("parse_mode", "HTML");
    }

    await callTelegramApiWithFormData("sendPhoto", formData);
  } catch (error) {
    logger.warn(`发送图片失败: ${(error as Error).message}`);
  }
}

/**
 * 发送多张图片（媒体组）到 Telegram
 * @param chatId 聊天 ID
 * @param photos 图片路径数组或 Buffer 数组
 * @param caption 第一张图片的说明（可选）
 */
async function sendMediaGroup(
  chatId: string,
  photos: (string | Buffer)[],
  caption?: string,
) {
  if (!botReady) return;
  const baseUrl = TELEGRAM_BASE_URL();
  if (!baseUrl) return;
  
  if (photos.length === 0) {
    logger.warn("没有图片可发送");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);

    const media: any[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const attachName = `photo${i}`;

      if (typeof photo === "string") {
        // 文件路径
        if (!fs.existsSync(photo)) {
          logger.warn(`图片文件不存在: ${photo}`);
          continue;
        }
        formData.append(attachName, fs.createReadStream(photo));
      } else {
        // Buffer
        formData.append(attachName, photo, { filename: `image${i}.png` });
      }

      media.push({
        type: "photo",
        media: `attach://${attachName}`,
        ...(i === 0 && caption ? { caption, parse_mode: "HTML" } : {}),
      });
    }

    if (media.length === 0) {
      logger.warn("没有有效的图片可发送");
      return;
    }

    formData.append("media", JSON.stringify(media));

    await callTelegramApiWithFormData("sendMediaGroup", formData);
  } catch (error) {
    logger.warn(`发送媒体组失败: ${(error as Error).message}`);
  }
}

/**
 * 广播图片到所有通知聊天
 * @param photoPath 图片文件路径或 Buffer
 * @param caption 图片说明（可选）
 */
async function broadcastPhoto(
  photoPath: string | Buffer,
  caption?: string,
) {
  if (!botReady) return;
  if (notifyChats.size === 0) {
    logger.warn("Telegram 通知已丢弃：未配置可通知的 chat id");
    return;
  }
  await Promise.all(
    [...notifyChats].map((chatId) =>
      sendPhoto(chatId, photoPath, caption).catch((error) => {
        logger.warn(
          `发送图片到 ${chatId} 失败: ${(error as Error).message}`,
        );
      }),
    ),
  );
}

/**
 * 广播媒体组（多张图片）到所有通知聊天
 * @param photos 图片路径数组或 Buffer 数组
 * @param caption 第一张图片的说明（可选）
 */
async function broadcastMediaGroup(
  photos: (string | Buffer)[],
  caption?: string,
) {
  if (!botReady) return;
  if (notifyChats.size === 0) {
    logger.warn("Telegram 通知已丢弃：未配置可通知的 chat id");
    return;
  }
  await Promise.all(
    [...notifyChats].map((chatId) =>
      sendMediaGroup(chatId, photos, caption).catch((error) => {
        logger.warn(
          `发送媒体组到 ${chatId} 失败: ${(error as Error).message}`,
        );
      }),
    ),
  );
}

/**
 * 发送带图片的视觉分析通知
 * @param payload 视觉分析数据
 * @param imagePaths 图片路径数组（可选，最多10张）
 */
export async function sendVisionAnalysisWithImages(
  payload: VisionAnalysisNotification,
  imagePaths?: string[],
) {
  if (!botReady) {
    logger.warn("Telegram 机器人未就绪，跳过视觉分析通知");
    return;
  }

  // 解析分析结果
  const parsed = parseVisionAnalysis(payload.analysis);

  // 构建通知消息
  const lines: string[] = [
    `<b>🔍 视觉分析结论</b>`,
    `<b>币种：</b>${escapeHtml(payload.symbol)}`,
  ];

  // 添加周期信息
  if (payload.microTimeframe) {
    lines.push(
      `<b>周期：</b>${payload.mainTimeframe} + ${payload.entryTimeframe} + ${payload.microTimeframe}`,
    );
  } else {
    lines.push(`<b>周期：</b>${payload.mainTimeframe} + ${payload.entryTimeframe}`);
  }

  lines.push(""); // 空行

  // 添加模式判定（重要信息）
  if (parsed.patternJudgment) {
    lines.push(`<b>🔶 模式判定：</b>${escapeHtml(parsed.patternJudgment)}`);
    lines.push(""); // 空行
  }
  
  // 添加信号评级
  if (parsed.signalRating) {
    lines.push(`<b>⭐ 信号评级：</b>${escapeHtml(parsed.signalRating)}`);
  }
  
  lines.push(""); // 空行
  
  // 添加策略信息
  if (parsed.primaryStrategy) {
    lines.push(`<b>🔷 Primary策略：</b>${escapeHtml(parsed.primaryStrategy)}`);
  }
  if (parsed.secondaryStrategy) {
    lines.push(`<b>🔶 Secondary策略：</b>${escapeHtml(parsed.secondaryStrategy)}`);
  }
  
  lines.push(""); // 空行

  // 添加入场区/入场区间
  if (parsed.entryArea && parsed.entryArea !== '无') {
    lines.push(`<b>📍 入场区：</b>${escapeHtml(parsed.entryArea)}`);
  } else if (parsed.entryZone) {
    lines.push(`<b>🎯 入场区间：</b>${escapeHtml(parsed.entryZone)}`);
  }

  // 添加时间戳
  lines.push("");
  const time = new Date(payload.timestamp).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  lines.push(`<b>📅 分析时间：</b>${time}`);

  const caption = lines.join("\n");

  // 如果有图片，发送媒体组；否则只发送文本
  if (imagePaths && imagePaths.length > 0) {
    // Telegram 媒体组最多支持10张图片
    const validPaths = imagePaths
      .slice(0, 10)
      .filter((p) => fs.existsSync(p));

    if (validPaths.length > 0) {
      logger.info(
        `发送带 ${validPaths.length} 张图片的视觉分析通知: ${payload.symbol}`,
      );
      await broadcastMediaGroup(validPaths, caption);
    } else {
      logger.warn("所有图片路径无效，仅发送文本通知");
      await broadcastMessage(caption);
    }
  } else {
    // 没有图片，只发送文本
    await broadcastMessage(caption);
  }

  logger.info(
    `视觉分析通知已发送: ${payload.symbol} ${parsed.recommendation || "N/A"}`,
  );
}

// 导出图片发送函数供外部使用
export { sendPhoto, sendMediaGroup, broadcastPhoto, broadcastMediaGroup };

