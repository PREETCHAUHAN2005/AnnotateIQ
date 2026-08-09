import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel runs the Next.js build output itself — standalone is for Docker/self-host only
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
