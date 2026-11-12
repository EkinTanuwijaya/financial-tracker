/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: require('path').join(__dirname, '../..'),
  reactStrictMode: true,
  transpilePackages: ['@finance-tracker/shared'],
};

module.exports = nextConfig;
