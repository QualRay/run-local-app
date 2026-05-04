import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RunLocal',
    short_name: 'RunLocal',
    description: 'Find and join community runs near you',
    start_url: '/?pwa=true',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#6366f1',
    background_color: '#0a0a0a',
    categories: ['sports', 'health', 'social'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Create run',
        short_name: 'Create',
        description: 'Post a new run for others to join',
        url: '/create',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Discover',
        short_name: 'Map',
        description: 'Find runs on the map',
        url: '/discover',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
    screenshots: [],
  }
}
