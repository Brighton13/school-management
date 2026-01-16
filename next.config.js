/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are now stable in Next.js 14
  output: 'standalone',
  images: {
    domains: ['localhost', 'nginx'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3012',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'nginx',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
        pathname: '/uploads/**',
      }
    ],
  },
  // Allow connections to the fileserver
  async rewrites() {
    return [
      {
        source: '/fileserver/:path*',
        destination: `${process.env.FILESERVER_URL || 'http://fileserver:3012'}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig

