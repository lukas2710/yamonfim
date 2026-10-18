import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YAMONFILM',
    short_name: 'YAMONFILM',
    description: 'Regarde tes films et séries préférés en streaming.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      {
        src: '/icone.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}