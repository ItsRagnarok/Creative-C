import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Landing images/fonts are content-hashed file names: cache them for a year.
      { source: "/landing-assets/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
