const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(process.cwd(), 'src');
    return config;
  },
}

module.exports = nextConfig
