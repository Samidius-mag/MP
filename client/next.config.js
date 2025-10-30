/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'telematius.ru', 'www.telematius.ru']
    }
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://telematius.ru/api'}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;


