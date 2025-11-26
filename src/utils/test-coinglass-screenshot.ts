import { captureCoingleassChart } from './coinglassScreenshot';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 在ES模块中获取__dirname的替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试函数
export async function runCoinglassTest() {
  console.log('开始测试CoinGlass截图功能...');
  
  try {
    // 测试BTC的15分钟图表
    console.log('正在获取BTC 15分钟图表...');
    const startTime = Date.now();
    const base64Image = await captureCoingleassChart('BTC', '15m', 'Gate');
    const endTime = Date.now();
    
    // 检查base64Image是否有效
    if (!base64Image || typeof base64Image !== 'string') {
      console.error('错误: captureCoingleassChart返回了无效的base64数据:', base64Image);
      return;
    }
    
    console.log(`截图成功！耗时: ${(endTime - startTime) / 1000} 秒`);
    console.log(`返回的base64字符串长度: ${base64Image.length} 字符`);
    
    // 将base64图片保存为文件
    const outputDir = path.join(__dirname, '../../screenshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `coinglass_btc_15m_${timestamp}.png`);
    
    try {
      // 解码base64并保存
      const buffer = Buffer.from(base64Image, 'base64');
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`图片已保存到: ${outputPath}`);
      console.log(`图片大小: ${(buffer.length / 1024).toFixed(2)} KB`);
    } catch (bufferError) {
      console.error('保存图片时出错:', bufferError);
      
      // 保存base64字符串到文本文件以便调试
      const base64Path = outputPath.replace('.png', '.txt');
      fs.writeFileSync(base64Path, base64Image);
      console.log(`base64数据已保存到: ${base64Path}`);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 直接运行测试
runCoinglassTest();