module.exports = {
  apps: [
    {
      name: 'dropshipping-server',
      cwd: '/root/MP',
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
        PORT: 3001,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'dropshipping_db',
        DB_USER: 'dropshipping',
        DB_PASSWORD: 'KeyOfWorld2025',
        JWT_SECRET: 'KeyOfWorld2025',
        JWT_EXPIRES_IN: '7d',
        CLIENT_URL: 'https://telematius.ru'
      },
      error_file: '/var/log/pm2/dropshipping-server-error.log',
      out_file: '/var/log/pm2/dropshipping-server-out.log',
      time: true
    },
    {
      name: 'dropshipping-client',
      cwd: '/root/MP/client',
      script: 'node',
      args: '.next/standalone/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_API_URL: 'https://telematius.ru/api'
      },
      error_file: '/var/log/pm2/dropshipping-client-error.log',
      out_file: '/var/log/pm2/dropshipping-client-out.log',
      time: true
    }
  ]
};
