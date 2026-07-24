import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js 는 브라우저에서만 로드한다 (서버 번들에서 제외)
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
