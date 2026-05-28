import "@harvverse-copernicus-hackathon/env/web";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  allowedDevOrigins: ["192.168.195.107"],
  experimental: {
    optimizePackageImports: [
      "@clerk/nextjs",
      "@clerk/ui",
      "@clerk/shared",
      "lucide-react",
      "@tanstack/react-query",
      "@harvverse-copernicus-hackathon/ui",
    ],
  },
};

export default withNextIntl(nextConfig);
