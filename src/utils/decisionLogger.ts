/**
 * 决策结论记录工具
 * 专门用于记录AI决策结论和视觉决策结论，避免主日志文件过于冗长
 */

import * as fs from 'fs';
import * as path from 'path';

// 决策日志文件路径
const DECISION_LOG_DIR = path.join(process.cwd(), 'logs');
const DECISION_LOG_FILE = path.join(DECISION_LOG_DIR, 'decision_conclusions.txt');

/**
 * 确保日志目录存在
 */
function ensureLogDirectoryExists() {
  if (!fs.existsSync(DECISION_LOG_DIR)) {
    fs.mkdirSync(DECISION_LOG_DIR, { recursive: true });
  }
}

/**
 * 记录决策结论
 * @param type 决策类型 (AI或视觉)
 * @param symbol 交易对
 * @param decisionText 决策内容
 * @param additionalInfo 额外信息
 */
export function logDecisionConclusion(
  type: 'AI' | '视觉',
  symbol: string,
  decisionText: string,
  additionalInfo?: Record<string, any>
): void {
  try {
    ensureLogDirectoryExists();
    
    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // 生成日志内容
    let logContent = `=== ${timestamp} - ${type} - ${symbol} ===\n`;
    
    // 添加额外信息
    if (additionalInfo && Object.keys(additionalInfo).length > 0) {
      logContent += `额外信息: ${JSON.stringify(additionalInfo, null, 2)}\n`;
    }
    
    // 添加决策内容
    logContent += `结论:\n${decisionText}\n`;
    
    // 添加分隔线
    logContent += '\n' + '='.repeat(80) + '\n\n';
    
    // 追加到文件
    fs.appendFileSync(DECISION_LOG_FILE, logContent, 'utf8');
    
  } catch (error) {
    console.error('记录决策结论失败:', error);
  }
}