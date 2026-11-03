import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.local", "10.*.*.*", "172.*.*.*", "192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites: async () => [
    { source: "/api/:path*", destination: `${process.env.API_URL || "http://127.0.0.1:28300"}/api/:path*` },
  ],
};

export default config;
