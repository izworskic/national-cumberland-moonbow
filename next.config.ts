import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.star.nesdis.noaa.gov", pathname: "/WFO/jkl/**" }],
  },
  experimental: {
    optimizePackageImports: ["date-fns", "date-fns-tz"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
