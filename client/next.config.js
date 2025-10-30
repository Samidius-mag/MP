/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'vgk-perv.ru', 'www.vgk-perv.ru']
    }
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://vgk-perv.ru/api'}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;


