/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
