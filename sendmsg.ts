// quick-telegram-test.ts - 快速Telegram测试
import * as dotenv from 'dotenv';

// 首先加载环境变量
dotenv.config();

// 然后导入依赖环境变量的模块
import {initTelegramBot, sendAlertNotification} from './src/services/telegramBot';

async function quickTest() {
    console.log('🧪 快速Telegram测试...\n');
    
    try {
        // 初始化
        console.log('1️⃣ 初始化Bot...');
        await initTelegramBot();
        console.log('✅ 初始化成功\n');
        
        // 发送测试消息
        console.log('2️⃣ 发送测试消息...');
        await sendAlertNotification({
            title: '🧪 Telegram测试',
            lines: [
                '这是一条测试消息',
                '时间: ' + new Date().toLocaleString('zh-CN'),
                '',
                '如果你能看到这条消息，说明Telegram配置正常！',
                '',
                '✅ 测试成功'
            ],
            emoji: '✅'
        });
        console.log('✅ 消息发送成功！\n');
        
        console.log('🎉 测试完成！请检查你的Telegram');
        
    } catch (error: any) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('\n请检查:');
        console.error('  - .env 文件中的 TELEGRAM_BOT_TOKEN');
        console.error('  - .env 文件中的 TELEGRAM_CHAT_ID');
        process.exit(1);
    }
}

quickTest();
