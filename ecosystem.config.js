module.exports = {
  apps: [{
    name: 'dropshipping-app',
    script: 'server/index.js',
    cwd: '/var/www/dropshipping',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/dropshipping-error.log',
    out_file: '/var/log/pm2/dropshipping-out.log',
    log_file: '/var/log/pm2/dropshipping-combined.log',
    time: true
  }]
};
