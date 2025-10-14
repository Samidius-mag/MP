module.exports = {
  apps: [
    {
      name: 'dropshipping-server',
      cwd: '/var/www/dropshipping',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/dropshipping-server-error.log',
      out_file: '/var/log/pm2/dropshipping-server-out.log',
      time: true
    },
    {
      name: 'dropshipping-client',
      cwd: '/var/www/dropshipping/client',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/dropshipping-client-error.log',
      out_file: '/var/log/pm2/dropshipping-client-out.log',
      time: true
    }
  ]
};
