const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: "zyon-tech-solutions",
  project: "zyon-holomenu",
  silent: true,
  widenClientFileUpload: true,
});
