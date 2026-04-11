/**
 * PM2 Ecosystem Config — Diraschool API
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs          # start all
 *   pm2 restart ecosystem.config.cjs        # rolling restart
 *   pm2 stop ecosystem.config.cjs           # stop all
 *   pm2 logs                                # tail all logs
 *   pm2 save && pm2 startup                 # auto-start on reboot
 *
 * Requires: NODE_ENV, MONGO_URI, REDIS_URL, JWT_SECRET, CLIENT_URL
 * set in /etc/environment or passed via --env
 */

module.exports = {
  apps: [
    // ── REST API ──────────────────────────────────────────────────────────────
    {
      name: 'diraschool-api',
      script: 'src/server.js',
      cwd: '/var/www/diraschool/apps/api',
      instances: 'max',          // one process per CPU core
      exec_mode: 'cluster',      // enables load balancing across cores
      node_args: '--experimental-vm-modules',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Log config — PM2 writes its own logs alongside Winston
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Restart policy
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
    },

    // ── BullMQ Worker ─────────────────────────────────────────────────────────
    {
      name: 'diraschool-worker',
      script: 'src/jobs/worker.entry.js',
      cwd: '/var/www/diraschool/apps/api',
      instances: 1,              // single worker — avoid duplicate job processing
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: 'logs/pm2-worker-out.log',
      error_file: 'logs/pm2-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '256M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
