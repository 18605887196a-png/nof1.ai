@echo off
chcp 65001 >nul

:: ============================================
:: 重置数据库并重新启动交易系统 (Windows版本)
:: ============================================

echo 🔄 开始重置数据库和启动系统...

:: 停止正在运行的进程
echo ⏹️  停止正在运行的进程...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM tsx.exe 2>nul

:: 等待进程完全停止
timeout /t 2 /nobreak >nul

:: 备份重要数据（可选）
set BACKUP_DIR=.\backups\%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
if exist ".\voltagent" (
    echo 💾 备份现有数据...
    mkdir "%BACKUP_DIR%" 2>nul
    xcopy /E /I /Y ".voltagent" "%BACKUP_DIR%\.voltagent\" >nul
)

:: 删除数据库文件
echo 🗑️  删除数据库文件...
if exist ".voltagent\trading.db" del /F /Q ".voltagent\trading.db"
if exist ".voltagent\trading-memory.db" del /F /Q ".voltagent\trading-memory.db"
if exist ".voltagent\*.db" del /F /Q ".voltagent\*.db"

:: 清理日志文件（可选）
echo 🧹 清理日志文件...
if exist "logs\*.log" del /F /Q "logs\*.log" 2>nul

:: 重新初始化数据库
echo 🗄️  重新初始化数据库...
call npm run db:init

:: 等待数据库初始化完成
timeout /t 3 /nobreak >nul

:: 显示当前配置
echo 📋 当前配置：
for /f "tokens=2 delims==" %%a in ('findstr "REVERSE_TRADING_ENABLED" .env') do echo • 交易模式: %%a
for /f "tokens=2 delims==" %%a in ('findstr "TRADING_STRATEGY" .env') do echo • 策略: %%a
for /f "tokens=2 delims==" %%a in ('findstr "TRADING_INTERVAL_MINUTES" .env') do echo • 间隔: %%a分钟

:: 启动系统
echo 🚀 启动交易系统...
call npm run trading:start

echo ✅ 系统启动完成！
pause