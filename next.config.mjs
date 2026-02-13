/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['iyzipay', 'postman-request'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/iyzipay/**/*', './node_modules/postman-request/**/*'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
