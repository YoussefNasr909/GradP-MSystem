import path from "node:path";
import { fileURLToPath } from "node:url";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
  unoptimized: false,
  formats: ["image/avif", "image/webp"],
  minimumCacheTTL: 60 * 60 * 24,
  remotePatterns: [
    { protocol: "https", hostname: "randomuser.me", pathname: "/api/portraits/**" },
    { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
  ],
},

  turbopack: {
    root: projectRoot,
    resolveAlias: {
      "@": "./*",
    },
  },
  reactCompiler: true,

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
