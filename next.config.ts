import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel runs the Next.js build output itself — standalone is for Docker/self-host only
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Include seed SQLite DB in serverless bundles for /tmp cold-start seeding
  outputFileTracingIncludes: {
    "/api/**/*": ["./db/**/*"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Hide the Next.js issues badge during demo recordings
  devIndicators: false,
};

export default nextConfig;
