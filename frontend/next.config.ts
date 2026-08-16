import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the backend is already public HTTP (Lambda Function
  // URLs, AuthType NONE, CORS open) so there's nothing an SSR layer would
  // add -- Amplify just serves the built files, no server compute.
  output: "export",
};

export default nextConfig;
