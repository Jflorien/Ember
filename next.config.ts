import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // `next build` and `next dev` share `.next` by default, so running a
  // verification build while the dev server is live corrupts its cached
  // chunks (missing-module / JSON-parse errors in the browser until the
  // dev server is restarted). Setting NEXT_BUILD_DIR redirects a
  // verification build to its own directory instead — CI and real builds
  // don't set it, so they still use the standard `.next`.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
};

export default nextConfig;
