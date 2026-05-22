/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Clickjacking protection
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Stop sending Referer to cross-origin destinations
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Enforce HTTPS for 1 year (enable only after confirming HTTPS-only deploy)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Restrict browser feature access
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=()',
          },
          // Content Security Policy
          // unsafe-eval required for MediaPipe's new Function() dynamic import workaround
          // unsafe-inline required for Next.js inline styles injected at hydration
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self + jsDelivr (MediaPipe) + unsafe-eval (MediaPipe WASM bootstrap) + wasm-unsafe-eval (WASM instantiation)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
              // Styles: self + Google Fonts + inline (Next.js)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs
              "img-src 'self' data: blob:",
              // Media: camera/blob
              "media-src 'self' blob:",
              // Fetch/XHR: Supabase, USDA, OpenRouter, Google Storage (MediaPipe model), Google Fonts (service worker re-fetch)
              [
                "connect-src 'self'",
                'https://*.supabase.co',
                'wss://*.supabase.co',
                'https://api.nal.usda.gov',
                'https://openrouter.ai',
                'https://storage.googleapis.com',
                'https://cdn.jsdelivr.net',
                'https://fonts.googleapis.com',
                'https://fonts.gstatic.com',
              ].join(' '),
              // Frames: YouTube embeds only
              "frame-src https://www.youtube.com",
              // Workers: self (service worker)
              "worker-src 'self'",
            ].join('; '),
          },
        ],
      },
      // Cache-control: never cache API routes
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default nextConfig;
