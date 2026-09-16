import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Next.js injects inline scripts for hydration, so 'unsafe-inline' stays on
// script-src until a nonce pipeline exists; 'wasm-unsafe-eval' is what the in-browser Typst compiler
// needs. Everything else is same-origin: fonts are self-hosted by next/font, the pdf.js worker and the
// Typst wasm come from /public, avatars from Google. Dev needs 'unsafe-eval' for React Refresh.
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
    reactCompiler: true,
    poweredByHeader: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                pathname: '/a/**',
            },
        ],
    },
    async headers() {
        return [
            { source: "/:path*", headers: securityHeaders },
            // Nothing under the signed-in area or the API may be cached by a shared cache.
            { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
            { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
        ];
    },
};

export default nextConfig;
