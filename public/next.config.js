/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['leaflet', 'react-leaflet'],
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
