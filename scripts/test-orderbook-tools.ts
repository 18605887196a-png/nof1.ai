#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { getOrderBookTool, analyzeOrderBookDepthTool } from '../src/tools/trading/marketData';

// 加载环境变量
dotenv.config();

/**
 * 订单簿深度工具测试Demo
 * 测试新添加的订单簿深度工具功能
 */
async function testOrderBookTools() {
  console.log('🚀 开始测试订单簿深度工具功能...\n');
  
  try {
    // 测试合约（BTC永续合约）
    const testSymbol = 'BTC';
    
    console.log(`📊 测试币种: ${testSymbol}`);
    
    // 1. 测试获取原始订单簿数据
    console.log('\n1️⃣ 测试获取原始订单簿数据:');
    const rawOrderBook = await getOrderBookTool.execute({ symbol: testSymbol, limit: 10 });
    
    console.log('原始订单簿结构:');
    console.log('- 合约:', rawOrderBook.contract);
    console.log('- 卖盘数量:', rawOrderBook.bids?.length || 0);
    console.log('- 买盘数量:', rawOrderBook.asks?.length || 0);
    console.log('- 最新价格:', rawOrderBook.last);
    
    // 显示前3个买卖盘（使用对象格式的p和s字段）
    if (rawOrderBook.bids?.length > 0) {
      console.log('\n前3个买盘:');
      rawOrderBook.bids.slice(0, 3).forEach((bid, i) => {
        console.log(`  买${i+1}: 价格 ${bid.p}, 数量 ${bid.s}`);
      });
    }
    
    if (rawOrderBook.asks?.length > 0) {
      console.log('\n前3个卖盘:');
      rawOrderBook.asks.slice(0, 3).forEach((ask, i) => {
        console.log(`  卖${i+1}: 价格 ${ask.p}, 数量 ${ask.s}`);
      });
    }
    
    // 2. 测试订单簿深度分析工具
    console.log('\n2️⃣ 测试订单簿深度分析工具:');
    const depthAnalysis = await analyzeOrderBookDepthTool.execute({ symbol: testSymbol, depthLimit: 50 });
    
    if (depthAnalysis.error) {
      console.log('❌ 分析失败:', depthAnalysis.error);
      return;
    }
    
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
    console.log('- 多头清算价位:', depthAnalysis.liquidationEstimates.longLiquidation);
    console.log('- 空头清算价位:', depthAnalysis.liquidationEstimates.shortLiquidation);
    console.log('- 距离当前价格:', depthAnalysis.liquidationEstimates.distancePercentage + '%');
    
    // 6. 风险评估
    console.log('\n🔍 风险评估:');
    if (depthAnalysis.liquidityRisk === 'high') {
      console.log('  🔴 高流动性风险：订单簿深度不足，大额交易可能影响价格');
    } else if (depthAnalysis.liquidityRisk === 'medium') {
      console.log('  🟡 中等流动性风险：订单簿深度一般，需注意交易规模');
    } else {
      console.log('  🟢 低流动性风险：订单簿深度充足，适合交易');
    }
    
    if (depthAnalysis.depthRatio > 1.2) {
      console.log('  📈 买盘力量较强：深度比例大于1.2，多头情绪占优');
    } else if (depthAnalysis.depthRatio < 0.8) {
      console.log('  📉 卖盘压力较大：深度比例小于0.8，空头情绪占优');
    } else {
      console.log('  ➡️ 买卖力量均衡：深度比例在0.8-1.2之间，市场相对平衡');
    }
    
    console.log('\n✅ 订单簿深度工具测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testOrderBookTools().catch(console.error);

export { testOrderBookTools };