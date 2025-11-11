#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { createGateClient } from '../src/services/gateClient';

// 加载环境变量
dotenv.config();

/**
 * 订单簿深度分析测试Demo
 * 测试新添加的analyzeOrderBookDepth功能
 */
async function testOrderBookDepth() {
  console.log('🚀 开始测试订单簿深度分析功能...\n');
  
  try {
    // 创建Gate客户端
    const gateClient = createGateClient();
    
    // 测试合约（BTC永续合约）
    const testContract = 'BTC_USDT';
    
    console.log(`📊 测试合约: ${testContract}`);
    
    // 1. 测试获取原始订单簿（原有功能）
    console.log('\n1️⃣ 测试获取原始订单簿:');
    const rawOrderBook = await gateClient.getOrderBook(testContract, 10);
    console.log('原始订单簿结构:', {
      卖盘数量: rawOrderBook?.asks?.length || 0,
      买盘数量: rawOrderBook?.bids?.length || 0,
      最新价格: rawOrderBook?.last
    });
    
    // 显示前3个买卖盘
    if (rawOrderBook?.asks?.length > 0) {
      console.log('前3个卖盘:');
      rawOrderBook.asks.slice(0, 3).forEach((ask, i) => {
        console.log(`  卖${i+1}: 价格 ${ask[0]}, 数量 ${ask[1]}`);
      });
    }
    
    if (rawOrderBook?.bids?.length > 0) {
      console.log('前3个买盘:');
      rawOrderBook.bids.slice(0, 3).forEach((bid, i) => {
        console.log(`  买${i+1}: 价格 ${bid[0]}, 数量 ${bid[1]}`);
      });
    }
    
    // 2. 测试订单簿深度分析（新功能）
    console.log('\n2️⃣ 测试订单簿深度分析:');
    const depthAnalysis = await gateClient.analyzeOrderBookDepth(testContract, 50);
    
    console.log('📈 深度分析结果:');
    console.log('- 当前价格:', depthAnalysis.currentPrice);
    console.log('- 深度比例（买/卖）:', depthAnalysis.depthRatio);
    console.log('- 卖盘总量:', depthAnalysis.totalAskAmount);
    console.log('- 买盘总量:', depthAnalysis.totalBidAmount);
    console.log('- 流动性风险:', depthAnalysis.liquidityRisk);
    
    // 3. 支撑阻力位分析
    console.log('\n🏗️ 支撑阻力位分析:');
    console.log('关键阻力位:');
    depthAnalysis.resistanceLevels.forEach((level, i) => {
      const distance = ((level - depthAnalysis.currentPrice) / depthAnalysis.currentPrice * 100).toFixed(2);
      console.log(`  ${i+1}. ${level} (+${distance}%)`);
    });
    
    console.log('关键支撑位:');
    depthAnalysis.supportLevels.forEach((level, i) => {
      const distance = ((depthAnalysis.currentPrice - level) / depthAnalysis.currentPrice * 100).toFixed(2);
      console.log(`  ${i+1}. ${level} (-${distance}%)`);
    });
    
    // 4. 大额订单分析
    console.log('\n💰 大额订单分析:');
    console.log('- 大额卖单数量:', depthAnalysis.largeOrders.askCount);
    console.log('- 大额买单数量:', depthAnalysis.largeOrders.bidCount);
    console.log('- 最大卖单数量:', depthAnalysis.largeOrders.largestAsk);
    console.log('- 最大买单数量:', depthAnalysis.largeOrders.largestBid);
    
    // 5. 清算价位估算
    console.log('\n⚠️ 清算价位估算:');
    console.log('- 多头清算估算:', depthAnalysis.liquidationEstimates.longLiquidation);
    console.log('- 空头清算估算:', depthAnalysis.liquidationEstimates.shortLiquidation);
    console.log('- 估算距离:', depthAnalysis.liquidationEstimates.distancePercentage + '%');
    
    // 6. 交易建议
    console.log('\n💡 交易建议:');
    
    // 基于深度比例的建议
    if (depthAnalysis.depthRatio > 1.2) {
      console.log('  📈 买盘深度较强，适合做多或持有');
    } else if (depthAnalysis.depthRatio < 0.8) {
      console.log('  📉 卖盘深度较强，适合做空或观望');
    } else {
      console.log('  ⚖️ 买卖盘深度均衡，市场相对稳定');
    }
    
    // 基于流动性风险的建议
    if (depthAnalysis.liquidityRisk === 'high') {
      console.log('  🔴 流动性风险高，建议小仓位操作');
    } else if (depthAnalysis.liquidityRisk === 'medium') {
      console.log('  🟡 流动性风险中等，注意仓位管理');
    } else {
      console.log('  🟢 流动性风险低，可正常操作');
    }
    
    // 基于支撑阻力位的建议
    if (depthAnalysis.resistanceLevels.length > 0) {
      const nearestResistance = depthAnalysis.resistanceLevels[0];
      const resistanceDistance = ((nearestResistance - depthAnalysis.currentPrice) / depthAnalysis.currentPrice * 100).toFixed(2);
      console.log(`  🚧 最近阻力位: ${nearestResistance} (${resistanceDistance}%)`);
    }
    
    if (depthAnalysis.supportLevels.length > 0) {
      const nearestSupport = depthAnalysis.supportLevels[0];
      const supportDistance = ((depthAnalysis.currentPrice - nearestSupport) / depthAnalysis.currentPrice * 100).toFixed(2);
      console.log(`  🛡️ 最近支撑位: ${nearestSupport} (${supportDistance}%)`);
    }
    
    console.log('\n✅ 订单簿深度分析测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testOrderBookDepth().catch(console.error);

export { testOrderBookDepth };