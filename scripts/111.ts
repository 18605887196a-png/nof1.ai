/**
 * Coinglass 图表偏移量测试脚本
 * 用于测试不同 dragOffset 参数对截图的影响
 * 
 * 使用方法:
 * npx ts-node scripts/test-coinglass-offset.ts
 */

import { captureCoingleassChart } from '../src/utils/coinglassScreenshot';
import * as fs from 'fs';
import * as path from 'path';

// 测试配置
const TEST_CONFIG = {
    symbol: 'BTC',           // 测试币种
    timeframe: '5m',         // 测试周期
    exchange: 'Gate',        // 交易所
    offsets: [1500]  // 要测试的偏移量数组
};

async function testCoinglassOffset() {
    console.log('='.repeat(60));
    console.log('🧪 Coinglass 图表偏移量测试');
    console.log('='.repeat(60));
    console.log(`币种: ${TEST_CONFIG.symbol}`);
    console.log(`周期: ${TEST_CONFIG.timeframe}`);
    console.log(`交易所: ${TEST_CONFIG.exchange}`);
    console.log(`测试偏移量: ${TEST_CONFIG.offsets.join(', ')}`);
    console.log('='.repeat(60));
    console.log('');

    // 创建测试输出目录
    const outputDir = path.join(process.cwd(), 'test-screenshots');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`✅ 创建测试目录: ${outputDir}\n`);
    }

    const results = [];

    // 测试每个偏移量
    for (const offset of TEST_CONFIG.offsets) {
        console.log(`📸 测试偏移量: ${offset}px`);
        console.log(`   开始时间: ${new Date().toLocaleTimeString()}`);
        
        const startTime = Date.now();
        
        try {
            // 调用截图函数
            const base64Image = await captureCoingleassChart(
                TEST_CONFIG.symbol,
                TEST_CONFIG.timeframe as any,
                TEST_CONFIG.exchange as any,
                offset
            );

            const duration = Date.now() - startTime;

            // 保存截图到本地文件
            const filename = `${TEST_CONFIG.symbol}_${TEST_CONFIG.timeframe}_offset_${offset}.png`;
            const filepath = path.join(outputDir, filename);
            
            // 将 base64 转换为 buffer 并保存
            const buffer = Buffer.from(base64Image, 'base64');
            fs.writeFileSync(filepath, buffer);

            const fileSizeKB = (buffer.length / 1024).toFixed(2);

            console.log(`   ✅ 成功! 耗时: ${(duration / 1000).toFixed(2)}s`);
            console.log(`   📁 文件: ${filename}`);
            console.log(`   📊 大小: ${fileSizeKB} KB`);
            console.log('');

            results.push({
                offset,
                success: true,
                duration,
                filename,
                fileSizeKB,
                filepath
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`   ❌ 失败! 耗时: ${(duration / 1000).toFixed(2)}s`);
            console.log(`   错误: ${error instanceof Error ? error.message : String(error)}`);
            console.log('');

            results.push({
                offset,
                success: false,
                duration,
                error: error instanceof Error ? error.message : String(error)
            });
        }

        // 等待一下,避免请求过快
        if (offset !== TEST_CONFIG.offsets[TEST_CONFIG.offsets.length - 1]) {
            console.log('   ⏳ 等待 3 秒...\n');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // 打印测试总结
    console.log('='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    console.log('');

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`总测试数: ${results.length}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failCount}`);
    console.log('');

    console.log('详细结果:');
    console.log('-'.repeat(60));
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ 偏移量 ${result.offset}px: ${result.filename} (${result.fileSizeKB} KB, ${(result.duration / 1000).toFixed(2)}s)`);
        } else {
            console.log(`❌ 偏移量 ${result.offset}px: 失败 - ${result.error}`);
        }
    });
    console.log('-'.repeat(60));
    console.log('');

    if (successCount > 0) {
        console.log(`📁 所有截图已保存到: ${outputDir}`);
        console.log('');
        console.log('💡 提示:');
        console.log('   1. 打开截图文件,对比不同偏移量的效果');
        console.log('   2. 查看每张图能显示多少根K线');
        console.log('   3. 选择最适合你的偏移量值');
        console.log('   4. 在 patternRecognition.ts 中更新偏移量参数');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✨ 测试完成!');
    console.log('='.repeat(60));
}

// 运行测试
testCoinglassOffset().catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
    process.exit(1);
});

