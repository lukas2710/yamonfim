interface MediaItem {
  id: string
  title: string
  type: 'movie' | 'series'
  poster: string
  url: string
  description: string
  created_at: string
}

class LocalSupabaseMock {
  from(table: string) {
    return {
      select: (columns?: string) => {
        return {
          order: async (column: string, options?: { ascending: boolean }) => {
            try {
              const data = JSON.parse(localStorage.getItem('yamonfim_media') || '[]')
              return { data, error: null }
            } catch (err: any) {
              return { data: [], error: err }
            }
          }
        }
      },
      insert: async (items: Partial<MediaItem>[]) => {
        try {
          const current = JSON.parse(localStorage.getItem('yamonfim_media') || '[]')
          const newItem: MediaItem = {
            id: Date.now().toString(),
            title: items[0].title || '',
            type: items[0].type || 'movie',
            poster: items[0].poster || '',
            url: items[0].url || '',
            description: items[0].description || '',
            created_at: new Date().toISOString()
          }
          current.unshift(newItem)
          localStorage.setItem('yamonfim_media', JSON.stringify(current))
          return { error: null }
        } catch (err: any) {
          return { error: err }
        }
      },
      update: (updatedData: Partial<MediaItem>) => {
        return {
          eq: async (column: string, value: string) => {
            try {
              let current: MediaItem[] = JSON.parse(localStorage.getItem('yamonfim_media') || '[]')
              current = current.map(item => item.id === value ? { ...item, ...updatedData } : item)
              localStorage.setItem('yamonfim_media', JSON.stringify(current))
              return { error: null }
            } catch (err: any) {
              return { error: err }
            }
          }
        }
      },
      delete: () => {
        return {
          eq: async (column: string, value: string) => {
            try {
              let current: MediaItem[] = JSON.parse(localStorage.getItem('yamonfim_media') || '[]')
              current = current.filter(item => item.id !== value)
              localStorage.setItem('yamonfim_media', JSON.stringify(current))
              return { error: null }
            } catch (err: any) {
              return { error: err }
            }
          }
        }
      }
    }
  }
}

export const supabase = new LocalSupabaseMock() as any