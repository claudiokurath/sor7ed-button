import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // widget.js is a static public asset — no special rewrite needed.
};

export default nextConfig;
