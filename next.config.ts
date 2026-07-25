import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'react-day-picker',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co',       port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos',       port: '', pathname: '/**' },
      { protocol: 'https', hostname: '*.supabase.co', port: '', pathname: '/storage/v1/object/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/icon-:size(\\d+).png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/:all*(svg|png|jpg|jpeg|gif|webp|ico)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
