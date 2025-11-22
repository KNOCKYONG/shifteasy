const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Ensure path alias `@/*` resolves to `src/*` during webpack build (Vercel included)
  // NOTE: Avoid aliasing bare '@' because it collides with scoped packages like '@supabase/*'.
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@/': path.resolve(__dirname, 'src/')
    };

    // Optimize bundle splitting for better caching and smaller initial loads
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor libraries (node_modules)
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                // Create chunk names based on package name
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                return `npm.${packageName?.replace('@', '')}`;
              },
              priority: 10,
            },
            // React/Next.js core
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              name: 'react-vendor',
              priority: 20,
            },
            // UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|framer-motion)[\\/]/,
              name: 'ui-vendor',
              priority: 15,
            },
            // tRPC and React Query
            trpc: {
              test: /[\\/]node_modules[\\/](@trpc|@tanstack)[\\/]/,
              name: 'trpc-vendor',
              priority: 15,
            },
            // Common components
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
              name: 'common',
            },
          },
        },
      };
    }

    return config;
  },
  // Allow cross-origin requests from local network
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
