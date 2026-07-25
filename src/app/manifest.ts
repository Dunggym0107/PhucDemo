import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WorkFlow - Banking Performance',
    short_name: 'WorkFlow',
    description: 'Hệ thống điều hành và quản trị mục tiêu ngân hàng cao cấp.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
