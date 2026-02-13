/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['iyzipay'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/iyzipay/**/*'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
