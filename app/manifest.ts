import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'YAMONFILM',
    short_name: 'YAMONFILM',
    description: 'Regarde tes films et séries préférés en streaming.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
