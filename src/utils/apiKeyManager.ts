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
 * API 密钥轮询管理器
 * 支持从多个API密钥中自动选择可用密钥，实现故障转移
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from './loggerUtils';

const logger = createLogger({
  name: "api-key-manager",
  level: "info",
});

interface ApiKeyStatus {
  key: string;
  lastUsed: Date;
  lastChecked: Date;
  isActive: boolean;
  errorCount: number;
  successCount: number;
  responseTime: number;
}

interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}

class ApiKeyManager {
  private apiKeys: string[];
  private keyStatuses: Map<string, ApiKeyStatus>;
  private currentIndex: number;
  private baseURL: string;
  private modelName: string;
  private healthCheckInterval: number;
  private isHealthChecking: boolean;

  constructor(apiKeys: string[], baseURL: string, modelName: string = "deepseek-chat") {
    this.apiKeys = [...apiKeys]; // 复制数组避免修改原数组
    this.baseURL = baseURL;
    this.modelName = modelName;
    this.currentIndex = 0;
    this.keyStatuses = new Map();
    this.healthCheckInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.isHealthChecking = false;

    // 初始化所有密钥状态
    this.apiKeys.forEach(key => {
      this.keyStatuses.set(key, {
        key,
        lastUsed: new Date(0),
        lastChecked: new Date(0),
        isActive: true,
        errorCount: 0,
        successCount: 0,
        responseTime: 0
      });
    });

    // 启动健康检查
    this.startHealthCheck();
  }

  /**
   * 获取当前可用的API密钥
   */
  async getAvailableKey(): Promise<string> {
    const startTime = Date.now();
    
    // 尝试所有密钥，直到找到可用的
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const key = this.getNextKey();
      const status = this.keyStatuses.get(key)!;
      
      // 如果密钥不活跃，跳过
      if (!status.isActive) {
        logger.debug(`跳过不活跃密钥: ${this.maskKey(key)}`);
        continue;
      }

      // 如果最近检查过且健康，直接使用
      if (Date.now() - status.lastChecked.getTime() < this.healthCheckInterval) {
        logger.debug(`使用已验证密钥: ${this.maskKey(key)}`);
        status.lastUsed = new Date();
        return key;
      }

      // 否则进行健康检查
      try {
        const healthResult = await this.healthCheck(key);
        status.lastChecked = new Date();
        status.responseTime = healthResult.responseTime;
        
        if (healthResult.isHealthy) {
          status.isActive = true;
          status.errorCount = 0;
          status.successCount++;
          status.lastUsed = new Date();
          
          logger.info(`使用健康密钥: ${this.maskKey(key)}, 响应时间: ${healthResult.responseTime}ms`);
          return key;
        } else {
          status.isActive = false;
          status.errorCount++;
          logger.warn(`密钥不健康: ${this.maskKey(key)}, 错误: ${healthResult.error}`);
        }
      } catch (error) {
        status.isActive = false;
        status.errorCount++;
        logger.error(`健康检查失败: ${this.maskKey(key)}, 错误: ${error}`);
      }
    }

    // 所有密钥都不可用
    const elapsedTime = Date.now() - startTime;
    throw new Error(`所有API密钥均不可用，检查耗时: ${elapsedTime}ms`);
  }

  /**
   * 获取下一个密钥（轮询算法）
   */
  private getNextKey(): string {
    const key = this.apiKeys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * 健康检查 - 验证API密钥是否可用
   */
  private async healthCheck(apiKey: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const openai = createOpenAI({
        apiKey,
        baseURL: this.baseURL,
      });

      // 发送一个简单的测试请求 - 使用正确的API调用方式
      const response = await openai.chat(this.modelName).generate({
        messages: [
          { role: "user", content: "Hello" }
        ],
        maxTokens: 10,
        temperature: 0.1,
      });

      const responseTime = Date.now() - startTime;
      
      if (response.text) {
        return {
          isHealthy: true,
          responseTime
        };
      } else {
        return {
          isHealthy: false,
          responseTime,
          error: "API返回空响应"
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: false,
        responseTime,
        error: error.message || "未知错误"
      };
    }
  }

  /**
   * 启动定期健康检查
   */
  private startHealthCheck() {
    setInterval(async () => {
      if (this.isHealthChecking) return;
      
      this.isHealthChecking = true;
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error(`定期健康检查失败: ${error}`);
      } finally {
        this.isHealthChecking = false;
      }
    }, this.healthCheckInterval);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck() {
    logger.debug("开始定期健康检查...");
    
    const checkPromises = this.apiKeys.map(async (key) => {
      const status = this.keyStatuses.get(key)!;
      
      try {
        const result = await this.healthCheck(key);
        status.lastChecked = new Date();
        status.responseTime = result.responseTime;
        
        if (result.isHealthy) {
          if (!status.isActive) {
            logger.info(`密钥恢复健康: ${this.maskKey(key)}`);
          }
          status.isActive = true;
          status.errorCount = 0;
          status.successCount++;
        } else {
          status.isActive = false;
          status.errorCount++;
          logger.warn(`密钥健康检查失败: ${this.maskKey(key)}, 错误: ${result.error}`);
        }
      } catch (error) {
        status.isActive = false;
        status.errorCount++;
        logger.error(`健康检查异常: ${this.maskKey(key)}, 错误: ${error}`);
      }
    });

    await Promise.allSettled(checkPromises);
    
    // 统计健康状态
    const activeKeys = Array.from(this.keyStatuses.values()).filter(s => s.isActive).length;
    const totalKeys = this.apiKeys.length;
    
    logger.info(`健康检查完成: ${activeKeys}/${totalKeys} 个密钥健康`);
  }

  /**
   * 获取密钥状态统计
   */
  getStatus(): {
    totalKeys: number;
    activeKeys: number;
    inactiveKeys: number;
    averageResponseTime: number;
    keyStatuses: Array<{
      key: string;
      maskedKey: string;
      isActive: boolean;
      lastUsed: Date;
      lastChecked: Date;
      errorCount: number;
      successCount: number;
      responseTime: number;
    }>;
  } {
    const statuses = Array.from(this.keyStatuses.values());
    const activeKeys = statuses.filter(s => s.isActive).length;
    const totalResponseTime = statuses.reduce((sum, s) => sum + s.responseTime, 0);
    const averageResponseTime = statuses.length > 0 ? totalResponseTime / statuses.length : 0;

    return {
      totalKeys: this.apiKeys.length,
      activeKeys,
      inactiveKeys: this.apiKeys.length - activeKeys,
      averageResponseTime,
      keyStatuses: statuses.map(s => ({
        key: s.key,
        maskedKey: this.maskKey(s.key),
        isActive: s.isActive,
        lastUsed: s.lastUsed,
        lastChecked: s.lastChecked,
        errorCount: s.errorCount,
        successCount: s.successCount,
        responseTime: s.responseTime
      }))
    };
  }

  /**
   * 掩码显示API密钥（保护敏感信息）
   */
  private maskKey(key: string): string {
    if (key.length <= 8) return "***";
    return key.substring(0, 4) + "***" + key.substring(key.length - 4);
  }

  /**
   * 添加新的API密钥
   */
  addKey(newKey: string): void {
    if (this.apiKeys.includes(newKey)) {
      logger.warn(`密钥已存在: ${this.maskKey(newKey)}`);
      return;
    }

    this.apiKeys.push(newKey);
    this.keyStatuses.set(newKey, {
      key: newKey,
      lastUsed: new Date(0),
      lastChecked: new Date(0),
      isActive: true,
      errorCount: 0,
      successCount: 0,
      responseTime: 0
    });

    logger.info(`添加新密钥: ${this.maskKey(newKey)}`);
  }

  /**
   * 移除API密钥
   */
  removeKey(keyToRemove: string): boolean {
    const index = this.apiKeys.indexOf(keyToRemove);
    if (index === -1) return false;

    this.apiKeys.splice(index, 1);
    this.keyStatuses.delete(keyToRemove);
    
    // 调整当前索引
    if (this.currentIndex >= this.apiKeys.length) {
      this.currentIndex = 0;
    }

    logger.info(`移除密钥: ${this.maskKey(keyToRemove)}`);
    return true;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 清理资源
    this.keyStatuses.clear();
    logger.info("API密钥管理器已销毁");
  }
}

// 创建全局实例
let globalApiKeyManager: ApiKeyManager | null = null;

/**
 * 初始化全局API密钥管理器
 */
export function initializeApiKeyManager(
  apiKeys: string[], 
  baseURL: string = process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
  modelName: string = process.env.AI_MODEL_NAME || "deepseek-chat"
): ApiKeyManager {
  if (globalApiKeyManager) {
    globalApiKeyManager.destroy();
  }

  globalApiKeyManager = new ApiKeyManager(apiKeys, baseURL, modelName);
  return globalApiKeyManager;
}

/**
 * 获取全局API密钥管理器
 */
export function getApiKeyManager(): ApiKeyManager {
  if (!globalApiKeyManager) {
    throw new Error("API密钥管理器未初始化，请先调用 initializeApiKeyManager");
  }
  return globalApiKeyManager;
}

/**
 * 创建OpenAI客户端（使用轮询机制）
 */
export async function createOpenAIClientWithRotation() {
  const manager = getApiKeyManager();
  const apiKey = await manager.getAvailableKey();
  
  return createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
  });
}

export { ApiKeyManager };