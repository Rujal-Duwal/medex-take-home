import type { NextConfig } from "next";

// Security headers sent on every route, pages and mock API alike.
// Values follow the OWASP HTTP Headers Cheat Sheet:
// https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
// Not set here: Strict-Transport-Security (Vercel adds it on HTTPS) and a
// Content-Security-Policy (needs nonces for Next's inline scripts; see README).
const securityHeaders = [
  // Don't let the browser guess a file's type from its content.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin to other sites, never the full URL with its query flags.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Never show the app inside a frame on another site (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // The app needs none of these, so no page or embedded script can ask for them.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // Stop `next dev` writing an AGENTS.md when it detects an AI agent. CLAUDE.md is our one agent file.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Tailwind v4 runs as a Turbopack loader for CSS (the create-next-app default).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
