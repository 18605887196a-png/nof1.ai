import 'dotenv/config';
import { getTechnicalIndicatorsTool } from './src/tools/trading/marketData';

async function testBollingerBands() {
  console.log('🧪 测试布林带功能...\n');
  
  try {
    // 测试技术指标工具
    const result = await getTechnicalIndicatorsTool.execute({
      symbol: 'BTC',
      interval: '5m',
      limit: 50
    });
    
    console.log('✅ 技术指标工具调用成功');
    console.log(`📊 返回指标数量: ${Object.keys(result).length}`);
    
    // 检查布林带相关指标
    const bollingerKeys = ['bbUpper', 'bbMiddle', 'bbLower', 'bbBandwidth', 'bbPosition'];
    const foundBollingerKeys = bollingerKeys.filter(key => key in result);
    
    console.log(`🎯 布林带指标检测: ${foundBollingerKeys.length}/${bollingerKeys.length} 个指标存在`);
    
    if (foundBollingerKeys.length > 0) {
      console.log('\n📈 布林带指标详情:');
      foundBollingerKeys.forEach(key => {
        const value = result[key];
        console.log(`   ${key}: ${typeof value === 'number' ? value.toFixed(4) : value}`);
      });
      
      // 验证布林带逻辑
      if (result.bbUpper && result.bbMiddle && result.bbLower) {
        const upper = result.bbUpper;
        const middle = result.bbMiddle;
        const lower = result.bbLower;
        
        console.log('\n🔍 布林带逻辑验证:');
        console.log(`   上轨 > 中轨: ${upper > middle ? '✅' : '❌'} (${upper} > ${middle})`);
        console.log(`   中轨 > 下轨: ${middle > lower ? '✅' : '❌'} (${middle} > ${lower})`);
        console.log(`   带宽合理性: ${result.bbBandwidth > 0 ? '✅' : '❌'} (${result.bbBandwidth?.toFixed(4)})`);
        console.log(`   位置范围: ${result.bbPosition >= 0 && result.bbPosition <= 100 ? '✅' : '❌'} (${result.bbPosition?.toFixed(2)}%)`);
      }
    }
    
    // 显示其他重要指标
    console.log('\n📊 其他技术指标:');
    const importantIndicators = ['ema20', 'ema50', 'macd', 'rsi7', 'rsi14', 'atr3', 'atr14'];
    importantIndicators.forEach(indicator => {
      if (result[indicator]) {
        console.log(`   ${indicator}: ${result[indicator]?.toFixed(4)}`);
      }
    });
    
    console.log('\n🎉 布林带功能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testBollingerBands();