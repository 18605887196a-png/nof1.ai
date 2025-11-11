#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { createGateClient } from '../src/services/gateClient';

// 加载环境变量
dotenv.config();

/**
 * 调试订单簿API返回的数据结构
 */
async function debugOrderBook() {
  console.log('🔍 调试订单簿API数据结构...\n');
  
  try {
    // 创建客户端
    const client = createGateClient();
    
    // 测试合约（BTC永续合约）
    const testContract = 'BTC_USDT';
    
    console.log(`📊 测试合约: ${testContract}`);
    
    // 直接调用getOrderBook方法
    console.log('\n1️⃣ 调用getOrderBook方法:');
    const orderBook = await client.getOrderBook(testContract, 10);
    
    console.log('API返回的完整数据结构:');
    console.log(JSON.stringify(orderBook, null, 2));
    
    // 检查关键字段
    console.log('\n🔍 关键字段检查:');
    console.log('- bids 类型:', typeof orderBook.bids);
    console.log('- bids 长度:', orderBook.bids?.length || 0);
    console.log('- asks 类型:', typeof orderBook.asks);
    console.log('- asks 长度:', orderBook.asks?.length || 0);
    
    if (orderBook.bids && orderBook.bids.length > 0) {
      console.log('\n📋 第一个买盘数据:');
      console.log('- 数据类型:', typeof orderBook.bids[0]);
      console.log('- 数据值:', orderBook.bids[0]);
      console.log('- 数组长度:', orderBook.bids[0]?.length || 0);
      
      if (orderBook.bids[0] && Array.isArray(orderBook.bids[0])) {
        console.log('- 价格字段:', orderBook.bids[0][0]);
        console.log('- 数量字段:', orderBook.bids[0][1]);
      }
    }
    
    if (orderBook.asks && orderBook.asks.length > 0) {
      console.log('\n📋 第一个卖盘数据:');
      console.log('- 数据类型:', typeof orderBook.asks[0]);
      console.log('- 数据值:', orderBook.asks[0]);
      console.log('- 数组长度:', orderBook.asks[0]?.length || 0);
      
      if (orderBook.asks[0] && Array.isArray(orderBook.asks[0])) {
        console.log('- 价格字段:', orderBook.asks[0][0]);
        console.log('- 数量字段:', orderBook.asks[0][1]);
      }
    }
    
    // 检查其他字段
    console.log('\n📋 其他字段:');
    Object.keys(orderBook).forEach(key => {
      if (!['bids', 'asks'].includes(key)) {
        console.log(`- ${key}:`, orderBook[key]);
      }
    });
    
    console.log('\n✅ 调试完成！');
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 运行调试
debugOrderBook().catch(console.error);