import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Menus you just visited re-open instantly from the client router cache for 30s; live data (leads, bookings,
    // chat, notifications) is kept fresh by Realtime, and every mutation updates its own page state directly.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      // Landing images/fonts are content-hashed file names: cache them for a year.
      { source: "/landing-assets/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
