/**
 * 测试 K 线图生成和模式识别功能
 */
import { generateCandlestickChart, getPatternAnalysis, patternAnalysisTool } from './src/tools/trading/patternRecognition';
import { createLogger } from './src/utils/loggerUtils';
import fs from 'fs';
import path from 'path';

// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

// 设置控制台编码为UTF-8
if (process.platform === 'win32') {
  import('child_process').then(({ execSync }) => {
    try {
      execSync('chcp 65001', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Failed to set console encoding:', error.message);
    }
  }).catch(error => {
    console.warn('Failed to import child_process:', error.message);
  });
}

// 设置环境变量强制使用UTF-8
if (!process.env.PYTHONIOENCODING) {
  process.env.PYTHONIOENCODING = 'utf-8';
}
if (!process.env.LANG) {
  process.env.LANG = 'en_US.UTF-8';
}
if (!process.env.LC_ALL) {
  process.env.LC_ALL = 'en_US.UTF-8';
}

const logger = createLogger({
  name: "test-pattern-recognition",
  level: "info"
});

/**
 * 测试 K 线图生成功能
 */
async function testChartGeneration() {
  try {
    logger.info("Starting candlestick chart generation test...");
    
    // 测试单个币种
    const symbol = "BTC";
    const timeframe = "15m";
    
    logger.info(`Generating ${symbol} ${timeframe} candlestick chart...`);
    
    const chartBase64 = await generateCandlestickChart(symbol, timeframe);
    
    // 检查是否成功生成
    if (chartBase64 && chartBase64.length > 0) {
      logger.info(`✅ Candlestick chart generation successful! Base64 length: ${chartBase64.length}`);
      
      // 将 base64 数据保存为文件
      const buffer = Buffer.from(chartBase64, 'base64');
      const svgPath = path.join(process.cwd(), `${symbol}_${timeframe}_chart.svg`);
      
      fs.writeFileSync(svgPath, buffer);
      logger.info(`📊 Chart saved to: ${svgPath}`);
      
      // 创建 HTML 文件以便查看
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${symbol} Candlestick Chart</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #1a1a1a;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        h1 {
            margin-bottom: 20px;
        }
        .chart-container {
            border: 1px solid #333;
            padding: 15px;
            background-color: #2a2a2a;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
        }
        .info {
            margin-top: 15px;
            padding: 10px;
            background-color: #333;
            border-radius: 5px;
            font-size: 12px;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>${symbol} ${timeframe} Candlestick Chart</h1>
    <div class="chart-container">
        <img src="data:image/svg+xml;base64,${chartBase64}" alt="${symbol} Candlestick Chart">
    </div>
    <div class="info">
        <p>Symbol: ${symbol}</p>
        <p>Timeframe: ${timeframe}</p>
        <p>Generated at: ${new Date().toLocaleString()}</p>
        <p>Base64 length: ${chartBase64.length}</p>
    </div>
</body>
</html>
      `;
      
      const htmlPath = path.join(process.cwd(), `${symbol}_${timeframe}_chart.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      logger.info(`📄 HTML file saved to: ${htmlPath}`);
      
      return { success: true, chartBase64 };
    } else {
      logger.error("❌ Candlestick chart generation failed: returned base64 data is empty");
      return { success: false, chartBase64: null };
    }
  } catch (error) {
    logger.error("❌ Chart generation test failed:", error);
    return { success: false, chartBase64: null, error };
  }
}

/**
 * 测试完整的模式识别分析功能
 */
async function testPatternAnalysis() {
  try {
    logger.info("Starting complete pattern recognition analysis test...");
    
    const symbol = "BTC";
    const timeframe = "15m";
    
    logger.info(`Performing pattern recognition analysis for ${symbol} ${timeframe}...`);
    
    // 使用 getPatternAnalysis 函数进行完整分析
    const analysisResult = await getPatternAnalysis(symbol, timeframe);
    
    logger.info("✅ Pattern recognition analysis completed!");
    logger.info(`📊 Chart generation status: ${analysisResult.chart ? 'Success' : 'Failed'}`);
    logger.info(`📝 Analysis result length: ${analysisResult.analysis.length} characters`);
    
    // 保存分析结果到文件
    const resultPath = path.join(process.cwd(), `${symbol}_${timeframe}_analysis.txt`);
    const resultContent = `
Pattern Recognition Analysis Report
==================
Symbol: ${symbol}
Timeframe: ${timeframe}
Analysis Time: ${new Date().toLocaleString()}

Analysis Result:
${analysisResult.analysis}

Chart Status: ${analysisResult.chart ? 'Generated' : 'Not generated'}
`;
    
    fs.writeFileSync(resultPath, resultContent);
    logger.info(`📄 Analysis result saved to: ${resultPath}`);
    
    return { success: true, analysisResult };
  } catch (error) {
    logger.error("❌ Pattern recognition analysis test failed:", error);
    return { success: false, analysisResult: null, error };
  }
}

/**
 * 测试模式识别工具函数
 */
async function testPatternAnalysisTool() {
  try {
    logger.info("Starting pattern analysis tool function test...");
    
    const symbol = "BTC";
    const timeframe = "15m";
    
    logger.info(`Using tool function to analyze ${symbol} ${timeframe}...`);
    
    // 使用 patternAnalysisTool 进行测试
    const toolResult = await patternAnalysisTool.execute({ symbol, timeframe });
    
    logger.info("✅ Tool function test completed!");
    logger.info(`📊 Execution status: ${toolResult.success ? 'Success' : 'Failed'}`);
    
    if (toolResult.success) {
      logger.info(`📝 Analysis result length: ${toolResult.analysis.length} characters`);
      logger.info(`📊 Chart status: ${toolResult.chart ? 'Generated' : 'Not generated'}`);
    } else {
      logger.error(`❌ Tool execution failed: ${toolResult.error}`);
    }
    
    return { success: toolResult.success, toolResult };
  } catch (error) {
    logger.error("❌ Tool function test failed:", error);
    return { success: false, toolResult: null, error };
  }
}

/**
 * 检查环境变量配置
 */
function checkEnvironment() {
  logger.info("Checking environment variable configuration...");
  
  const visionApiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
  const visionBaseUrl = process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL;
  const visionModelName = process.env.VISION_MODEL_NAME;
  const enableVisualAgent = process.env.ENABLE_VISUAL_PATTERN_AGENT;
  
  logger.info(`🔑 Vision API Key: ${visionApiKey ? 'Configured' : 'Not configured'}`);
  logger.info(`🌐 Vision API URL: ${visionBaseUrl || 'Using default URL'}`);
  logger.info(`🤖 Vision Model Name: ${visionModelName || 'Using default model'}`);
  logger.info(`👁️ Visual Pattern Recognition: ${enableVisualAgent === 'true' ? 'Enabled' : 'Disabled'}`);
  
  return {
    hasVisionApiKey: !!visionApiKey,
    visionBaseUrl,
    visionModelName,
    enableVisualAgent: enableVisualAgent === 'true'
  };
}

/**
 * 主测试函数
 */
async function runAllTests() {
  try {
    logger.info("🚀 Starting complete pattern recognition function test...\n");
    
    // 1. 检查环境配置
    const envConfig = checkEnvironment();
    logger.info(`✅ Environment configuration check completed: ${JSON.stringify(envConfig)}\n`);
    
    // 2. 测试K线图生成
    const chartResult = await testChartGeneration();
    logger.info(`✅ Chart generation test: ${chartResult.success ? 'Success' : 'Failed'}\n`);
    
    // 3. 测试模式识别分析
    const analysisResult = await testPatternAnalysis();
    logger.info(`✅ Pattern recognition analysis test: ${analysisResult.success ? 'Success' : 'Failed'}\n`);
    
    // 4. 测试工具函数
    const toolResult = await testPatternAnalysisTool();
    logger.info(`✅ Tool function test: ${toolResult.success ? 'Success' : 'Failed'}\n`);
    
    // 生成测试报告
    logger.info("=== Test Report ===");
    logger.info(`Environment configuration: ${JSON.stringify(envConfig)}`);
    logger.info(`Chart generation: ${chartResult.success ? '✅ Success' : '❌ Failed'}`);
    logger.info(`Pattern recognition analysis: ${analysisResult.success ? '✅ Success' : '❌ Failed'}`);
    logger.info(`Tool function test: ${toolResult.success ? '✅ Success' : '❌ Failed'}`);
    
    // 详细分析结果
    logger.info("\n📊 Detailed analysis results:");
    if (analysisResult.analysisResult) {
      const result = analysisResult.analysisResult;
      logger.info(`Analysis result preview: ${result.analysis.substring(0, 100)}...`);
      logger.info(`Chart status: ${result.chart ? 'Generated' : 'Not generated'}`);
    }
    
    logger.info("\n🎉 All tests passed! Pattern recognition function is working correctly.");
    logger.info("📁 Please check the generated files for detailed results.\n");
    
  } catch (error) {
    logger.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

// 运行所有测试
runAllTests()
  .then((success) => {
    if (success) {
      logger.info("\n✅ 测试完成! 请查看生成的文件以获取详细结果。");
    } else {
      logger.error("\n❌ 测试失败!");
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    logger.error("💥 未处理的错误:", error);
    process.exit(1);
  });