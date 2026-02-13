/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['iyzipay'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
