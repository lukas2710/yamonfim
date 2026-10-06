import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 })
    }

    const response = await fetch(url)
    const html = await response.text()
    const $ = cheerio.load(html)

    const links: { text: string; href: string }[] = []

    // Récupérer tous les liens et éventuelles sources vidéo de la page
    $('a, iframe, source').each((_, element) => {
      const href = $(element).attr('href') || $(element).attr('src')
      const text = $(element).text().trim() || $(element).attr('title') || 'Sans titre'

      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        // Résoudre les URL relatives si besoin
        try {
          const absoluteUrl = new URL(href, url).toString()
          links.push({ text: text.substring(0, 50), href: absoluteUrl })
        } catch {
          // Ignore les URL invalides
        }
      }
    })

    // Supprimer les doublons
    const uniqueLinks = Array.from(new Set(links.map(l => l.href)))
      .map(href => links.find(l => l.href === href)!)

    return NextResponse.json({ links: uniqueLinks })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur lors du scraping : ' + error.message }, { status: 500 })
  }
}