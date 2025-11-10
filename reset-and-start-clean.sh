#!/bin/bash

# ============================================
# 重置数据库并重新启动交易系统
# ============================================

echo "🔄 开始重置数据库和启动系统..."

# 停止正在运行的进程
echo "⏹️  停止正在运行的进程..."
pkill -f "node.*trading" 2>/dev/null || true
pkill -f "tsx.*src/index.ts" 2>/dev/null || true

# 等待进程完全停止
sleep 2

# 备份重要数据（可选）
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
if [ -d "./.voltagent" ]; then
    echo "💾 备份现有数据..."
    mkdir -p "$BACKUP_DIR"
    cp -r ./.voltagent "$BACKUP_DIR/" 2>/dev/null || true
fi

# 删除数据库文件
echo "🗑️  删除数据库文件..."
rm -rf ./.voltagent/trading.db
rm -rf ./.voltagent/trading-memory.db
rm -rf ./.voltagent/*.db

# 清理日志文件（可选）
echo "🧹 清理日志文件..."
rm -rf ./logs/*.log 2>/dev/null || true

# 重新初始化数据库
echo "🗄️  重新初始化数据库..."
npm run db:init

# 等待数据库初始化完成
sleep 3

# 启动系统
echo "🚀 启动交易系统..."
echo "📋 当前配置："
echo "• 交易模式: $(grep 'REVERSE_TRADING_ENABLED' .env | cut -d'=' -f2)"
echo "• 策略: $(grep 'TRADING_STRATEGY' .env | cut -d'=' -f2)"
echo "• 间隔: $(grep 'TRADING_INTERVAL_MINUTES' .env | cut -d'=' -f2)分钟"

# 使用npm启动
npm start

echo "✅ 系统启动完成！"