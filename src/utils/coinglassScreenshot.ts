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
* CoinGlass 图表截图工具
* 从 CoinGlass 获取专业的加密货币图表截图
* 支持时间周期切换、智能等待、多层验证确保图表加载完成
*/




import { chromium, Browser } from 'playwright';
import { createLogger } from './loggerUtils';
import * as fs from 'fs';
import * as path from 'path';




const logger = createLogger({
name: 'coinglass-screenshot',
level: (process.env.LOG_LEVEL as any) || 'info',
});




/**
* 支持的币种映射（CoinGlass使用的币种对）
*/
const SYMBOL_MAP: Record<string, string> = {
'BTC': 'BTCUSDT',
'ETH': 'ETHUSDT',
'SOL': 'SOLUSDT',
'BNB': 'BNBUSDT',
'ADA': 'ADAUSDT',
'XRP': 'XRPUSDT'
};

/**
* 从 CoinGlass 截取图表
* @param symbol 币种代码（如：'BTC', 'ETH'）
* @param timeframe 时间周期（'1m', '5m', '15m', '30m', 不传则默认1小时）
* @param exchange 交易所（默认：'Binance'）
* @returns base64 编码的图片字符串
*/
export async function captureCoingleassChart(
symbol: string = 'BTC',
timeframe?: string,
exchange: string = 'Gate'
): Promise<string> {
let browser: Browser | undefined;
const timings: Record<string, number> = {};
const startTime = Date.now();


try {
 logger.info(`开始截取 ${symbol} 图表 (${timeframe || '1h'} 周期)`);


 const t1 = Date.now();




 // 启动浏览器（使用无头模式）
 browser = await chromium.launch({
   headless: true,
   args: [
     '--no-sandbox',
     '--disable-setuid-sandbox',
     '--disable-blink-features=AutomationControlled',
   ]
 });




 timings['启动浏览器'] = Date.now() - t1;




 const t2 = Date.now();
 const page = await browser.newPage({
   viewport: { width: 1920, height: 1080 },
   userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
 });
 timings['创建页面'] = Date.now() - t2;




 // 构建URL
 const symbolPair = SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
 const url = `https://www.coinglass.com/tv/zh/Gate_${symbolPair}`;




 logger.info(`访问页面: ${url}`);




 const t3 = Date.now();
 await page.goto(url, {
   waitUntil: 'domcontentloaded',
   timeout: 30000
 });
 timings['页面加载'] = Date.now() - t3;




 logger.info('等待页面加载完成...');




 // 策略1: 等待图表容器出现
 const t4 = Date.now();
 try {
   logger.info('等待图表容器...');
   await page.waitForSelector('iframe, canvas', { timeout: 30000 });
   logger.info('检测到图表元素');
 } catch (e) {
   logger.warn('未检测到图表元素，继续等待...');
 }
 timings['等待图表元素'] = Date.now() - t4;




 // 如果指定了时间周期，尝试切换
 if (timeframe) {
   const tTimeframe = Date.now();
   logger.info(`尝试切换到 ${timeframe} 时间周期...`);


   try {
     // 等待页面稳定
     await page.waitForTimeout(3000);


     // 15分钟需要特殊处理：先点击button[8]打开菜单，再点击菜单项
     if (timeframe === '15m') {
       logger.info('15分钟周期使用特殊处理逻辑...');


       try {
         // 步骤1: 点击 button[8] 打开下拉菜单
         const menuButtonXPath = `//*[@id="__next"]/main/div[1]/div/button[8]`;
         logger.info(`点击菜单按钮: ${menuButtonXPath}`);


         await page.waitForSelector(`xpath=${menuButtonXPath}`, { timeout: 5000 });
         await page.click(`xpath=${menuButtonXPath}`);
         logger.info('成功打开时间周期菜单');


         // 等待菜单出现
         await page.waitForTimeout(1000);


         // 步骤2: 点击菜单中的第4项（15分钟）
         const menuItemXPath = `/html/body/div[2]/div[3]/ul/li[4]`;
         logger.info(`点击菜单项: ${menuItemXPath}`);


         await page.waitForSelector(`xpath=${menuItemXPath}`, { timeout: 5000 });
         await page.click(`xpath=${menuItemXPath}`);
         logger.info('成功点击 15分钟 菜单项');


         // 等待图表重新加载
         await page.waitForTimeout(5000);
         logger.info('成功切换到 15m，等待图表重新加载...');


       } catch (e) {
         logger.warn(`15分钟切换失败: ${e}, 使用默认周期`);
       }
     } else {
       // 1m, 5m, 30m 使用原有的直接点击逻辑
       // 时间周期按钮的索引映射（根据XPath）
       // //*[@id="__next"]/main/div[1]/div/button[X]
       const timeframeButtonIndex: Record<string, number> = {
         '1m': 3,    // button[3] = 1分钟
         '5m': 4,    // button[4] = 5分钟
         '30m': 5    // button[5] = 30分钟
       };


       const buttonIndex = timeframeButtonIndex[timeframe];


       if (buttonIndex) {
         // 使用XPath定位按钮
         const xpath = `//*[@id="__next"]/main/div[1]/div/button[${buttonIndex}]`;
         logger.info(`使用XPath查找: ${xpath}`);


         try {
           // 等待按钮出现
           await page.waitForSelector(`xpath=${xpath}`, { timeout: 5000 });


           // 点击按钮
           await page.click(`xpath=${xpath}`);
           logger.info(`成功点击 ${timeframe} 按钮`);


           // 等待图表重新加载
           await page.waitForTimeout(5000);
           logger.info(`成功切换到 ${timeframe}，等待图表重新加载...`);
         } catch (e) {
           logger.warn(`XPath方式失败，尝试备用方案...`);


           // 备用方案：通过文本查找
           const found = await page.evaluate((tf) => {
             const buttons = Array.from(document.querySelectorAll('button'));
             const timeframeText: Record<string, string[]> = {
               '1m': ['1分钟', '1 分钟', '1m'],
               '5m': ['5分钟', '5 分钟', '5m'],
               '30m': ['30分钟', '30 分钟', '30m']
             };


             const searchTerms = timeframeText[tf] || [];


             for (const button of buttons) {
               const text = button.textContent?.trim() || '';
               if (searchTerms.some(term => text.includes(term))) {
                 button.click();
                 return true;
               }
             }
             return false;
           }, timeframe);


           if (found) {
             logger.info(`备用方案成功切换到 ${timeframe}`);
             await page.waitForTimeout(5000);
           } else {
             logger.warn(`未找到 ${timeframe} 时间周期按钮，使用默认周期`);
           }
         }
       } else {
         logger.warn(`不支持的时间周期: ${timeframe}，使用默认周期`);
       }
     }
   } catch (e) {
     logger.warn(`切换时间周期失败: ${e}, 使用默认周期`);
   }


   timings['切换时间周期'] = Date.now() - tTimeframe;
 }


 // 添加额外的点击操作 - 无论什么时间周期都要执行
 const tExtraClicks = Date.now();
 logger.info('执行额外的点击操作...');


 try {
   // 步骤1: 点击 button[9]
   const button9XPath = `//*[@id="__next"]/main/div[1]/div/button[9]`;
   logger.info(`点击 button[9]: ${button9XPath}`);
  
   await page.waitForSelector(`xpath=${button9XPath}`, { timeout: 5000 });
   await page.click(`xpath=${button9XPath}`);
   logger.info('成功点击 button[9]');
  
   // 等待一下让菜单展开
   await page.waitForTimeout(1000);
  
   // 步骤2: 点击 /html/body/div[2]/div[3]/div[3]/div[2]/div/ul/div[1]
   const menuItem1XPath = `/html/body/div[2]/div[3]/div[3]/div[2]/div/ul/div[1]`;
   logger.info(`点击菜单项: ${menuItem1XPath}`);
  
   await page.waitForSelector(`xpath=${menuItem1XPath}`, { timeout: 5000 });
   await page.click(`xpath=${menuItem1XPath}`);
   logger.info('成功点击第一个菜单项');
  
   // 等待一下让界面响应
   await page.waitForTimeout(1000);
  
   // 步骤3: 点击 /html/body/div[2]/div[3]/div[1]/div[2]/button
   const finalButtonXPath = `/html/body/div[2]/div[3]/div[1]/div[2]/button`;
   logger.info(`点击最终按钮: ${finalButtonXPath}`);
  
   await page.waitForSelector(`xpath=${finalButtonXPath}`, { timeout: 5000 });
   await page.click(`xpath=${finalButtonXPath}`);
   logger.info('成功点击最终按钮');
  
   // 等待图表重新加载
   await page.waitForTimeout(3000);
   logger.info('额外点击操作完成，等待图表稳定...');
  
 } catch (e) {
   logger.warn(`额外点击操作失败: ${e}, 继续截图流程...`);
 }


 timings['额外点击操作'] = Date.now() - tExtraClicks;




 // 策略2: 等待网络请求稳定（没有新的请求）
 // 优化：减少超时时间，因为CoinGlass的网络可能一直不会完全空闲
 const t5 = Date.now();
 logger.info('等待网络请求稳定...');
 await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
   logger.warn('网络未完全空闲（10秒超时），但继续...');
 });
 timings['等待网络空闲'] = Date.now() - t5;




 // 策略3: 检查页面是否还有加载动画
 const t6 = Date.now();
 logger.info('检查加载状态...');
 const hasLoadingSpinner = await page.evaluate(() => {
   const spinners = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="loader"]');
   const visibleSpinners = Array.from(spinners).filter(el => {
     const style = window.getComputedStyle(el as Element);
     return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
   });
   return visibleSpinners.length > 0;
 });




 if (hasLoadingSpinner) {
   logger.warn('检测到加载动画，额外等待15秒...');
   await page.waitForTimeout(15000);
 } else {
   logger.info('未检测到加载动画');
 }
 timings['检查加载动画'] = Date.now() - t6;




 // 策略4: 检查iframe内的图表是否真的渲染了
 const t7 = Date.now();
 logger.info('验证图表内容...');
 const chartValidation = await page.evaluate(() => {
   const canvases = document.querySelectorAll('canvas');
   let hasContent = false;


   canvases.forEach(canvas => {
     const ctx = (canvas as HTMLCanvasElement).getContext('2d');
     if (ctx) {
       try {
         const imageData = ctx.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);
         const data = imageData.data;
         for (let i = 0; i < data.length; i += 4) {
           if (data[i] !== 255 || data[i+1] !== 255 || data[i+2] !== 255 || data[i+3] !== 0) {
             hasContent = true;
             break;
           }
         }
       } catch (e) {
         // 无法读取canvas内容（可能是跨域）
       }
     }
   });


   return {
     canvasCount: canvases.length,
     hasContent: hasContent,
     iframeCount: document.querySelectorAll('iframe').length
   };
 });




 logger.info(`图表验证结果: Canvas数量=${chartValidation.canvasCount}, 有内容=${chartValidation.hasContent}, iframe数量=${chartValidation.iframeCount}`);




 // 如果是iframe图表，额外等待确保iframe内容加载
 if (chartValidation.iframeCount > 0) {
   logger.info('检测到iframe，等待iframe内容加载...');


   // 优化：减少等待时间从8秒到5秒
   await page.waitForTimeout(5000);


   const stillLoading = await page.evaluate(() => {
     const spinners = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="loader"], [class*="rotate"]');
     return Array.from(spinners).some(el => {
       const style = window.getComputedStyle(el as Element);
       return style.display !== 'none' && style.visibility !== 'hidden';
     });
   });


   if (stillLoading) {
     logger.warn('仍在加载，再等待5秒...');
     await page.waitForTimeout(5000);
   } else {
     logger.info('iframe内容已加载完成');
   }
 }




 if (chartValidation.canvasCount > 0 && !chartValidation.hasContent) {
   logger.warn('图表元素存在但可能还在渲染，额外等待10秒...');
   await page.waitForTimeout(10000);
 }
 timings['验证图表内容'] = Date.now() - t7;


 // 策略5: 最后的保险等待
 // 优化：减少保险等待时间从5秒到3秒
 const t8 = Date.now();
 logger.info('最后等待3秒确保稳定...');
 await page.waitForTimeout(3000);
 timings['保险等待'] = Date.now() - t8;


   // === 新增：在截图前拖拽图表，向左滑动一小段 ===
   const tDrag = Date.now();
   try {
       logger.info('尝试拖拽图表，向左滑动一小段...');


       // 首先尝试查找所有可能的图表容器
       const chartSelectors = [
           'canvas',
           'iframe',
           '[class*="chart"]',
           '[class*="tradingview"]',
           '[class*="canvas"]',
           'div[data-testid*="chart"]'
       ];


       let targetElement = null;
       let elementType = '';


       // 查找最合适的图表元素
       for (const selector of chartSelectors) {
           const elements = await page.$$(selector);
           if (elements.length > 0) {
               // 选择最大的那个元素（通常是主图表）
               let largestElement = null;
               let largestArea = 0;
              
               for (const element of elements) {
                   try {
                       const box = await element.boundingBox();
                       if (box && box.width > 200 && box.height > 150) { // 过滤掉太小的元素
                           const area = box.width * box.height;
                           if (area > largestArea) {
                               largestArea = area;
                               largestElement = element;
                           }
                       }
                   } catch (e) {
                       // 跳过无法获取边界的元素
                       continue;
                   }
               }
              
               if (largestElement) {
                   targetElement = largestElement;
                   elementType = selector;
                   logger.info(`找到图表元素: ${selector}, 大小: ${largestArea}px²`);
                   break;
               }
           }
       }


       if (!targetElement) {
           logger.warn('未找到合适的图表元素，尝试通过坐标进行拖拽');
          
           // 备用方案：在页面中心区域进行拖拽
           const viewport = page.viewportSize();
           if (viewport) {
               const centerX = viewport.width * 0.7;  // 偏右位置
               const centerY = viewport.height * 0.5; // 垂直中心
              
               logger.info(`使用视口中心拖拽: (${centerX}, ${centerY})`);
              
               await page.mouse.move(centerX, centerY);
               await page.mouse.down();
               await page.mouse.move(centerX - 300, centerY, { steps: 15 }); // 减少拖拽距离
               await page.mouse.up();
              
               logger.info('视口中心拖拽完成');
               await page.waitForTimeout(1000);
           }
       } else {
           // 对找到的元素进行拖拽
           const box = await targetElement.boundingBox();
           if (box) {
               // 从元素右侧开始，向左拖拽
               const startX = box.x + box.width * 0.8;   // 从元素右侧 80% 位置开始
               const startY = box.y + box.height * 0.5;  // 垂直中线
              
               logger.info(`拖拽起点: (${startX.toFixed(1)}, ${startY.toFixed(1)}), 元素类型: ${elementType}`);
              
               // 移动到起始位置
               await page.mouse.move(startX, startY);
               await page.mouse.down();
              
               // 拖拽动作：向左移动150像素，减少步数让动作更轻微
               await page.mouse.move(startX - 300, startY, { steps: 15 });
               await page.mouse.up();
              
               logger.info('图表拖拽完成');
               await page.waitForTimeout(1500); // 增加等待时间让图表稳定
           } else {
               logger.warn('无法获取元素边界，跳过拖拽');
           }
       }
      
   } catch (e) {
       logger.warn(`图表拖拽步骤失败，忽略并继续截图流程: ${e}`);
   }
   timings['拖拽图表'] = Date.now() - tDrag;
   // === 拖拽结束 ===


 // 检查是否需要保存截图到本地文件
 let saveScreenshotLocal = process.env.SAVE_COINGLASS_SCREENSHOT_LOCAL !== 'false';


 let screenshotDir: string | undefined;
 let filename: string | undefined;
 let filepath: string | undefined;


 if (saveScreenshotLocal) {
   // 创建截图目录
   screenshotDir = path.join(process.cwd(), 'coinglass-screenshots');


   try {
     if (!fs.existsSync(screenshotDir)) {
       fs.mkdirSync(screenshotDir, { recursive: true });
       logger.info(`创建截图目录: ${screenshotDir}`);
     } else {
       logger.info(`使用现有截图目录: ${screenshotDir}`);
     }
   } catch (dirError) {
     logger.warn(`截图目录创建失败: ${dirError}, 改为仅返回base64`);
     saveScreenshotLocal = false;
   }
 }


 if (saveScreenshotLocal) {
   // 生成文件名
   const timestamp = Date.now();
   filename = `coinglass_${symbol}_${timeframe || '1h'}_${timestamp}.png`;
   filepath = path.join(screenshotDir!, filename);
 }


 logger.info('开始截图...');
 const t9 = Date.now();


 // 截取截图（无论是否保存到文件都需要截图）
 const screenshotOptions: any = {
   fullPage: true,
   type: 'png'
 };


 if (saveScreenshotLocal && filepath) {
   screenshotOptions.path = filepath;
 }


 // 截取整个页面
 await page.screenshot(screenshotOptions);


 timings['截图'] = Date.now() - t9;


 let base64Image: string;
 let imageBuffer: Buffer;


 if (saveScreenshotLocal && filepath) {
   logger.info(`截图成功保存: ${filepath}`);
   // 读取文件并转换为base64
   imageBuffer = fs.readFileSync(filepath);
   base64Image = imageBuffer.toString('base64');
 } else {
   logger.info('仅返回base64格式，不保存到文件');
   // 直接从页面获取截图的base64数据
   const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
   imageBuffer = screenshotBuffer;
   base64Image = screenshotBuffer.toString('base64');
 }




 timings['总耗时'] = Date.now() - startTime;




 logger.info(`图像大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
 logger.info(`Base64长度: ${base64Image.length} 字符`);




 // 打印性能报告
 logger.info('性能报告:');
 Object.entries(timings).forEach(([name, time]) => {
   const percentage = ((time / timings['总耗时']) * 100).toFixed(1);
   logger.info(`  ${name.padEnd(15)}: ${(time/1000).toFixed(2)}s (${percentage}%)`);
 });




 return base64Image;




} catch (error) {
 logger.error('截图失败:', error);
 throw new Error(`截图失败: ${error instanceof Error ? error.message : String(error)}`);
} finally {
 if (browser) {
   logger.info('关闭浏览器...');
   await browser.close();
 }
}
}

