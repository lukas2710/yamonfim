import { supabase } from './supabase';

export interface Avatar { id: string; name: string; category: string; image_url: string; }

// Vrais liens d'images stables classés par catégories (Disney, Super-héros, Gaming)
export const DEFAULT_AVATAR_CATEGORIES = [
  {
    category: 'Disney & Princesses',
    avatars: [
      { name: 'Raiponce', url: 'https://static.wikia.nocookie.net/heros/images/4/42/Raiponce_Infobox.jpg/revision/latest?cb=20200723185055&path-prefix=fr' },
      { name: 'Mickey', url: 'https://avatarfiles.alphacoders.com/214/214614.jpg' },
      { name: 'Reine des Neiges', url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz5Y10-MulAuvwLsp9t3wrzWVcXY5o2vfv3gnwPB2sJkKn0hBlTWzAo0-9&s=10' },
      { name: 'Le Roi Lion', url: 'https://journaldemickey.com/wp-content/uploads/2024/06/roi-lion-personnages.jpg' },
    ],
  },
  {
    category: 'Super-Héros & Comics',
    avatars: [
      { name: 'Spider-Man', url: 'https://avatarfiles.alphacoders.com/375/thumb-350-375896.webp' },
      { name: 'Batman', url: 'https://image.api.playstation.com/cdn/UP1018/CUSA00133_00/Dz5i57ktol8qBJsWEVdjNy8wj3Tc5fF0Y2MyX0Poi4lAniOaUpfjH5IU2vVejxey.png' },
      { name: 'Joker', url: 'https://img.magnific.com/free-vector/scary-clown-head-with-blue-hair-vector_43623-1371.jpg?semt=ais_hybrid&w=740&q=80' },
      { name: 'Marvel', url: 'https://avatarfiles.alphacoders.com/604/60402.jpg' },
    ],
  },
  {
    category: 'Gaming & Séries',
    avatars: [
      { name: 'Mario', url: 'https://pbs.twimg.com/profile_images/1929549617441521664/dn4udfbC_400x400.jpg' },
      { name: 'Stranger Things', url: 'https://cf-images.assettype.com/cinemaexpress%2F2026-01-01%2Fbr0w32gz%2FST5-1.jpg?w=480&auto=format%2Ccompress' },
      { name: 'Anime', url: 'https://www.projectxparis.com/cdn/shop/articles/344_75d7d802-3d2c-42ca-b360-afcc41033d8d.jpg?v=1759397750' },
      { name: 'Gaming Neon', url: 'https://cdn.dribbble.com/userupload/5333469/file/original-d913e65193d78f79999f30fce27114c8.png?resize=752x&vertical=center' },
    ],
  },
];


export async function fetchAvatars(): Promise<Avatar[]> {
  const { data, error } = await supabase.from('profile_avatars').select('id,name,category,image_url').order('category').order('name');
  if (error) throw error;
  return data || [];
}

export function avatarCategories(avatars: Avatar[]) {
  const groups = DEFAULT_AVATAR_CATEGORIES.map(group => ({ ...group, avatars: [...group.avatars] }));
  for (const avatar of avatars) {
    let group = groups.find(item => item.category === avatar.category);
    if (!group) { group = { category: avatar.category, avatars: [] }; groups.push(group); }
    group.avatars.push({ name: avatar.name, url: avatar.image_url });
  }
  return groups;
}

export async function fetchAvatarCategoryNames(): Promise<string[]> {
  const { data, error } = await supabase.from('avatar_categories').select('name').order('name');
  if (error) throw error;
  return (data || []).map(row => row.name as string);
}
