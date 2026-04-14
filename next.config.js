/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['leaflet', 'react-leaflet'],
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
