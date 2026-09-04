import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/assistant": ["./skills/**/*.md"],
  },
};

export default nextConfig;
