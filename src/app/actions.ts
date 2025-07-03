'use server';

import { z } from 'zod';

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

const urlSchema = z.string().url({ message: 'Please enter a valid URL.' });

function decodeHtmlEntities(text: string): string {
  // This is a basic decoder and might not cover all cases.
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

export async function fetchRssFeed(url: string): Promise<{ data?: RssItem[]; error?: string }> {
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'BrewNews/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
      },
      next: { revalidate: 3600 }, // Revalidate every hour
    });

    if (!response.ok) {
      return { error: `Failed to fetch feed. Server responded with status: ${response.status}` };
    }

    const xmlText = await response.text();
    
    const isAtom = xmlText.includes('<feed');

    const itemBlocks = isAtom
      ? xmlText.match(/<entry>([\s\S]*?)<\/entry>/g)
      : xmlText.match(/<item>([\s\S]*?)<\/item>/g);

    if (!itemBlocks) {
      if (!isAtom && !xmlText.includes('<rss')) {
         return { error: 'The content does not appear to be a valid RSS or Atom feed.' };
      }
      return { data: [] };
    }

    const items: RssItem[] = itemBlocks
      .map(block => {
        const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
        let title = titleMatch ? titleMatch[1].trim() : '';
        if (title.startsWith('<![CDATA[')) {
          title = title.slice(9, -3).trim();
        }

        let link = '#';
        if (isAtom) {
          // For Atom, find link with rel="alternate" or the first link
          const linkMatch = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"|<link[^>]*href="([^"]+)"/);
          link = linkMatch ? (linkMatch[1] || linkMatch[2]).trim() : '#';
        } else {
          const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
          link = linkMatch ? linkMatch[1].trim() : '#';
        }
        
        const pubDateMatch = isAtom 
          ? block.match(/<updated>([\s\S]*?)<\/updated>/)
          : block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString();

        const descriptionMatch = isAtom
          ? block.match(/<content[^>]*>([\s\S]*?)<\/content>/)
          : block.match(/<description>([\s\S]*?)<\/description>/);
        let description = descriptionMatch ? descriptionMatch[1].trim() : 'No description available.';
        if (description.startsWith('<![CDATA[')) {
          description = description.slice(9, -3).trim();
        }

        return {
          title: decodeHtmlEntities(title),
          link,
          pubDate,
          description: decodeHtmlEntities(description),
        };
      })
      .filter(item => item.title && item.link && item.link !== '#');

    return { data: items };
  } catch (err) {
    console.error('Fetch RSS Error:', err);
    if (err instanceof TypeError && err.message.includes('fetch failed')) {
        return { error: 'Network error or invalid domain. Please check the URL and your connection.'};
    }
    return { error: 'An unexpected error occurred while processing the feed. It may not be a valid RSS or Atom format.' };
  }
}
