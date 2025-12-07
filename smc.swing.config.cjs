/**
 * open-nof1.ai - SMC 波段交易系统 PM2 配置
 */

require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "smc-swing-trader",
      script: "manual/smc-swing.ts", // 修正了脚本路径
      interpreter: "tsx",                      // 正确执行 TypeScript
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",

      env: {
        NODE_ENV: "production",
        ...process.env,
      },

      // 日志
      error_file: "./logs/swing-error.log",
      out_file: "./logs/swing-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // 优雅退出
      kill_timeout: 5000,

      // 每天 4 点重启以释放内存
      cron_restart: "0 4 * * *",
    },
  ],
};
