const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "officeparser"],
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

  // Turbopack config removed; webpack dev is steadier for this large E2E suite.
  // React Compiler is intentionally not enabled for this project.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
