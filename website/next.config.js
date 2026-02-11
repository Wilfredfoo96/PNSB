/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['convex'],
  },
  images: {
    domains: ['images.clerk.dev'],
  },
  async rewrites() {
    return [
      // Block WordPress scanner bots by returning 404 for common WordPress paths
      {
        source: '/wp-admin/:path*',
        destination: '/404',
      },
      {
        source: '/wordpress/:path*',
        destination: '/404',
      },
      {
        source: '/wp-login.php',
        destination: '/404',
      },
      {
        source: '/wp-content/:path*',
        destination: '/404',
      },
    ]
  },
}

module.exports = nextConfig
