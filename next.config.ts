import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/reset-password",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }, {
      source: "/echarts-official/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
  async rewrites() {
    // Public sample assets only, pinned to the same upstream revision as the gallery.
    // A rewrite streams large GPS datasets without putting them in a server function.
    const upstream = "https://raw.githubusercontent.com/apache/echarts-examples/88ca004030e999073a15303e5fe32462b8fefae2/public";
    return ["data", "data-gl"].map((folder) => ({
      source: `/echarts-official/${folder}/asset/:path*`,
      destination: `${upstream}/${folder}/asset/:path*`,
    }));
  },
};

export default nextConfig;
