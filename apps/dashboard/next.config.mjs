/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep node-only packages out of the bundler (Next 14 key).
    serverComponentsExternalPackages: ['pg', 'bullmq', 'ioredis', '@supabase/supabase-js'],
  },
};

export default nextConfig;
