import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

function getWebSocketHost(): string {
  if (isDev) {
    return 'ws://localhost:8080 wss://localhost:8080';
  }
  const wsHost = process.env.NEXT_PUBLIC_WS_HOST;
  if (!wsHost) {
    console.error('NEXT_PUBLIC_WS_HOST environment variable is required in production');
    return "wss://localhost:8080";
  }
  return `wss://${wsHost}`;
}

const cspDirectives = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self'",
  isDev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${getWebSocketHost()}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    const headers = [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];

    if (!isDev) {
      headers[0].headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return headers;
  },
};

export default nextConfig;
