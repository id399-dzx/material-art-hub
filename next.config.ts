import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/reset-password",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }];
  },
};

export default nextConfig;
