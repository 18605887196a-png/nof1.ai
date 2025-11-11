#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { createGateClient } from '../src/services/gateClient';
import { analyzeFundingRateTrendTool } from '../src/tools/trading/marketData';

// 加载环境变量
dotenv.config();

/**
 * 资金费率历史测试Demo
 * 测试新添加的getFundingRateHistory功能
 */
async function testFundingRateHistory() {
  console.log('🚀 开始测试资金费率历史功能...\n');
  
  try {
    // 创建Gate客户端
    const gateClient = createGateClient();
    
    // 测试合约（BTC永续合约）
    const testContract = 'BTC_USDT';
    
    console.log(`📊 测试合约: ${testContract}`);
    
    // 1. 测试获取最新资金费率（原有功能）
    console.log('\n1️⃣ 测试获取最新资金费率:');
    const latestRate = await gateClient.getFundingRate(testContract);
    console.log('最新资金费率:', {
      费率: latestRate?.rate,
      时间: latestRate?.time ? new Date(latestRate.time * 1000).toLocaleString() : 'N/A'
    });
    
    // 2. 测试分析资金费率趋势（新功能）
    console.log('\n2️⃣ 测试分析资金费率趋势（24小时）:');
    const fundingHistory = await analyzeFundingRateTrendTool.execute({ symbol: 'BTC', hours: 24 });
    
    console.log('📈 资金费率历史分析结果:');
    console.log('- 当前费率:', fundingHistory.currentRate);
    console.log('- 24小时平均费率:', fundingHistory.avg24h.toFixed(6));
    console.log('- 费率趋势:', fundingHistory.trend);
    console.log('- 费率波动率:', fundingHistory.volatility.toFixed(6));
    console.log('- 历史数据点数:', fundingHistory.history.length);
    
    // 显示前5个历史记录
    console.log('\n📅 前5个历史记录:');
    fundingHistory.history.slice(0, 5).forEach((record, index) => {
      console.log(`  ${index + 1}. 费率: ${record.rate}, 时间: ${new Date(record.time * 1000).toLocaleString()}`);
    });
    
    // 3. 分析趋势判断
    console.log('\n🔍 趋势分析:');
    if (fundingHistory.trend === 'increasing') {
      console.log('  📈 资金费率呈上升趋势，可能表示多头情绪增强');
    } else if (fundingHistory.trend === 'decreasing') {
      console.log('  📉 资金费率呈下降趋势，可能表示空头情绪增强');
    } else {
      console.log('  ➡️ 资金费率趋势中性');
    }
    
    // 4. 风险评估
    console.log('\n⚠️ 风险评估:');
    const absRate = Math.abs(fundingHistory.currentRate);
    if (absRate > 0.001) {
      console.log('  🔴 高费率风险：当前费率绝对值较高，需注意持仓成本');
    } else if (absRate > 0.0005) {
      console.log('  🟡 中等费率风险：费率在正常范围内');
    } else {
      console.log('  🟢 低费率风险：费率较低，持仓成本可控');
    }
    
    if (fundingHistory.volatility > 0.0005) {
      console.log('  🔴 高波动风险：费率波动较大，需注意风险');
    }
    
    console.log('\n✅ 资金费率历史测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testFundingRateHistory().catch(console.error);

export { testFundingRateHistory };