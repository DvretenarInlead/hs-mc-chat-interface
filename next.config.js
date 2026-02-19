/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@modelcontextprotocol/sdk'],
  },
}

module.exports = nextConfig
