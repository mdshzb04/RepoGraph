import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@excalidraw/excalidraw", "@engintel/telemetry"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  devIndicators: false,
};

export default nextConfig;
