/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["bullmq", "ioredis", "@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
