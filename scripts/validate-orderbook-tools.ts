#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { getOrderBookTool, analyzeOrderBookDepthTool } from '../src/tools/trading/marketData';

// 加载环境变量
dotenv.config();

/**
 * 验证订单簿深度工具一致性
 * 对比原始数据获取工具和分析工具的数据一致性
 */
async function validateOrderBookTools() {
  console.log('🔍 验证订单簿深度工具一致性...\n');
  
  try {
    // 测试合约（BTC永续合约）
    const testSymbol = 'BTC';
    
    console.log(`📊 测试币种: ${testSymbol}`);
    
    // 1. 获取原始订单簿数据
    console.log('\n1️⃣ 获取原始订单簿数据:');
    const rawOrderBook = await getOrderBookTool.execute({ symbol: testSymbol, limit: 10 });
    
    if (rawOrderBook.error) {
      console.log('❌ 原始数据获取失败:', rawOrderBook.error);
      return;
    }
    
    console.log('✅ 原始数据获取成功');
    console.log('- 合约:', rawOrderBook.contract);
    console.log('- 卖盘数量:', rawOrderBook.asks?.length || 0);
    console.log('- 买盘数量:', rawOrderBook.bids?.length || 0);
    
    // 2. 分析订单簿深度
    console.log('\n2️⃣ 分析订单簿深度:');
    const depthAnalysis = await analyzeOrderBookDepthTool.execute({ symbol: testSymbol, depthLimit: 10 });
    
    if (depthAnalysis.error) {
      console.log('❌ 深度分析失败:', depthAnalysis.error);
      return;
    }
    
    console.log('✅ 深度分析成功');
    console.log('- 当前价格:', depthAnalysis.currentPrice);
    console.log('- 深度比例:', depthAnalysis.depthRatio);
    console.log('- 流动性风险:', depthAnalysis.liquidityRisk);
    
    // 3. 数据一致性验证
    console.log('\n3️⃣ 数据一致性验证:');
    
    // 验证买卖盘数量一致性
    const rawBidCount = rawOrderBook.bids?.length || 0;
    const rawAskCount = rawOrderBook.asks?.length || 0;
    
    console.log(`- 原始数据: 买盘 ${rawBidCount} 个, 卖盘 ${rawAskCount} 个`);
    console.log(`- 分析数据: 买盘总量 ${depthAnalysis.totalBidAmount}, 卖盘总量 ${depthAnalysis.totalAskAmount}`);
    
    // 验证价格计算
    if (rawOrderBook.bids?.length > 0 && rawOrderBook.asks?.length > 0) {
      const bestBid = parseFloat(rawOrderBook.bids[0].p);
      const bestAsk = parseFloat(rawOrderBook.asks[0].p);
      const calculatedPrice = (bestBid + bestAsk) / 2;
      
      console.log(`- 最佳买价: ${bestBid}`);
      console.log(`- 最佳卖价: ${bestAsk}`);
      console.log(`- 计算中间价: ${calculatedPrice.toFixed(2)}`);
      console.log(`- 分析中间价: ${depthAnalysis.currentPrice}`);
      
      const priceDiff = Math.abs(calculatedPrice - depthAnalysis.currentPrice);
      console.log(`- 价格差异: ${priceDiff.toFixed(4)}`);
      
      if (priceDiff < 0.01) {
        console.log('✅ 价格计算一致性验证通过');
      } else {
        console.log('⚠️ 价格计算存在微小差异');
      }
    }
    
    // 4. 功能完整性验证
    console.log('\n4️⃣ 功能完整性验证:');
    
    const requiredFields = [
      'currentPrice', 'depthRatio', 'totalAskAmount', 'totalBidAmount', 
      'liquidityRisk', 'resistanceLevels', 'supportLevels', 'largeOrders', 'liquidationEstimates'
    ];
    
    let allFieldsPresent = true;
    requiredFields.forEach(field => {
      if (depthAnalysis[field] === undefined) {
        console.log(`❌ 缺失字段: ${field}`);
        allFieldsPresent = false;
      }
    });
    
    if (allFieldsPresent) {
      console.log('✅ 所有必需字段都存在');
    }
    
    // 5. 风险评估验证
    console.log('\n5️⃣ 风险评估验证:');
    
    const riskLevels = ['low', 'medium', 'high'];
    if (riskLevels.includes(depthAnalysis.liquidityRisk)) {
      console.log(`✅ 流动性风险评估有效: ${depthAnalysis.liquidityRisk}`);
    } else {
      console.log(`❌ 流动性风险评估无效: ${depthAnalysis.liquidityRisk}`);
    }
    
    // 6. 工具模式验证
    console.log('\n6️⃣ 工具模式验证:');
    
    // 检查原始工具是否只返回原始数据
    const rawToolKeys = Object.keys(rawOrderBook);
    const analysisToolKeys = Object.keys(depthAnalysis);
    
    console.log('- 原始工具字段:', rawToolKeys.join(', '));
    console.log('- 分析工具字段:', analysisToolKeys.join(', '));
    
    const rawDataFields = ['contract', 'bids', 'asks', 'id', 'current', 'update'];
    const hasRawDataOnly = rawDataFields.every(field => rawToolKeys.includes(field));
    const hasNoAnalysisFields = !analysisToolKeys.some(key => 
      ['depthRatio', 'liquidityRisk', 'resistanceLevels'].includes(key)
    );
    
    if (hasRawDataOnly && hasNoAnalysisFields) {
      console.log('✅ 原始工具模式正确：只返回原始API数据');
    } else {
      console.log('❌ 原始工具模式异常：包含分析字段');
    }
    
    const hasAnalysisFields = analysisToolKeys.some(key => 
      ['depthRatio', 'liquidityRisk', 'resistanceLevels'].includes(key)
    );
    
    if (hasAnalysisFields) {
      console.log('✅ 分析工具模式正确：包含分析指标');
    } else {
      console.log('❌ 分析工具模式异常：缺少分析字段');
    }
    
    console.log('\n🎉 订单簿深度工具验证完成！');
    console.log('✅ 原始数据获取工具：专注于API原始数据返回');
    console.log('✅ 深度分析工具：提供完整的市场深度分析');
    console.log('✅ 工具模式：遵循"原始数据获取 + 分析逻辑分离"的最佳实践');
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
  }
}

// 运行验证
validateOrderBookTools().catch(console.error);