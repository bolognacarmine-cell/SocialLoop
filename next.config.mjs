/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Pin the tracing root to this repo. Without it Next picks the nearest
  // lockfile walking upwards — a stray package-lock.json above the project
  // makes it choose that directory, nesting standalone output at
  // .next/standalone/<path>/server.js instead of .next/standalone/server.js,
  // which breaks `CMD ["node", "server.js"]` in the image.
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ["bullmq", "ioredis", "@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
