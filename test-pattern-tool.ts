// 测试patternRecognition.ts中的patternAnalysisTool
import dotenv from 'dotenv';
import { patternAnalysisTool } from './src/tools/trading/patternRecognition';

// 加载环境变量 - 强制重新加载并指定路径
dotenv.config({ path: '.env' });

// 测试模式分析工具
async function testPatternAnalysisTool() {
  try {
    console.log('=== 开始测试patternAnalysisTool ===');
    console.log('环境变量已加载:', Object.keys(process.env).filter(k => k.startsWith('VISION_')).length > 0 ? '是' : '否');
    console.log('SAVE_PATTERN_IMAGE_LOCAL:', process.env.SAVE_PATTERN_IMAGE_LOCAL);
    
    // 设置测试参数
    const params = {
      symbol: 'BTC',
      timeframe: '15m'
    };
    
    console.log(`测试参数: symbol=${params.symbol}, timeframe=${params.timeframe}`);
    
    // 执行工具
    const result = await patternAnalysisTool.execute(params);
    
    console.log('=== 测试结果 ===');
    console.log('成功:', result.success);
    
    if (result.success) {
      console.log('symbol:', result.symbol);
      console.log('timeframe:', result.timeframe);
      console.log('chart数据长度:', result.chart ? result.chart.length : '无数据');
      console.log('analysis内容:', result.analysis ? result.analysis : '无数据');
      console.log('timestamp:', result.timestamp);
      
      if (result.chart) {
        // 验证chart是有效的base64
        const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(result.chart);
        console.log('chart是否为base64:', isBase64 ? '是' : '否');
        
        // 检查是否为PNG格式
        if (result.chart.startsWith('iVBOR')) {
          console.log('chart格式: PNG (有效)');
        } else if (result.chart.startsWith('<svg')) {
          console.log('chart格式: SVG');
        } else {
          console.log('chart格式: 未知');
        }
      }
    } else {
      console.error('错误信息:', result.error);
    }
    
    console.log('=== 测试完成 ===');
  } catch (error) {
    console.error('测试过程中出现未捕获的错误:', error);
  }
}

// 运行测试
testPatternAnalysisTool();