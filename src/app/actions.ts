'use server';

import { z } from 'zod';
import { summarizeReleaseNote } from '@/ai/flows/summarize-release-notes-flow';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  summary?: string[];
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

    const summaryPromises = items.map(async (item) => {
      const result = await summarizeReleaseNote({ htmlContent: item.description });
      item.summary = result.summary;
    });

    await Promise.all(summaryPromises);

    return { data: items };
  } catch (err) {
    console.error('Fetch RSS Error:', err);
    if (err instanceof TypeError && err.message.includes('fetch failed')) {
        return { error: 'Network error or invalid domain. Please check the URL and your connection.'};
    }
    return { error: 'An unexpected error occurred while processing the feed. It may not be a valid RSS or Atom format.' };
  }
}

export async function getFeedUrls(): Promise<string[]> {
  if (!db) {
    // If Firestore isn't configured, there are no URLs.
    return [];
  }
  const urlsDocRef = doc(db, 'feeds', 'default');
  try {
    const docSnap = await getDoc(urlsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure it returns an array, even if it's empty
      return Array.isArray(data.urls) ? data.urls : [];
    }
    // If the document doesn't exist, there are no URLs.
    return [];
  } catch (error) {
    console.error("Error fetching URLs from Firestore:", error);
    // Return empty array on error
    return [];
  }
}

export async function saveFeedUrls(urls: string[]): Promise<{success: boolean, error?: string}> {
  if (!db) {
    return { success: false, error: "Firestore is not configured. Please add your Firebase credentials to the .env file." };
  }
  const urlsDocRef = doc(db, 'feeds', 'default');
  try {
    await setDoc(urlsDocRef, { urls });
    return { success: true };
  } catch (error) {
    console.error("Error saving URLs to Firestore:", error);
    return { success: false, error: "Could not save URLs. Please check your Firestore security rules and Firebase config." };
  }
}

export async function getStoredFeedItems(): Promise<{ data?: RssItem[]; error?: string }> {
  if (!db) {
    // If firestore is not configured, return empty data.
    // The app will then proceed to fetch live data.
    return { data: [] };
  }
  try {
    const itemsCollection = collection(db, 'feedItems');
    const snapshot = await getDocs(itemsCollection);
    if (snapshot.empty) {
      return { data: [] };
    }
    const items: RssItem[] = snapshot.docs.map(doc => doc.data() as RssItem);
    return { data: items };
  } catch (error) {
    console.error("Error fetching stored items from Firestore:", error);
    return { error: "Could not retrieve stored feed items. Please check your Firestore security rules." };
  }
}

export async function storeFeedItems(items: RssItem[]): Promise<{success: boolean, error?: string}> {
  if (!db) {
    // Silently fail if firestore is not configured.
    // This allows the app to function without persistence.
    return { success: true };
  }
  const itemsCollection = collection(db, 'feedItems');
  try {
    // Clear the existing items
    const oldDocsSnapshot = await getDocs(itemsCollection);
    const deleteBatch = writeBatch(db);
    oldDocsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    
    // Write the new items
    const addBatch = writeBatch(db);
    items.forEach(item => {
      // Use a URL-safe base64 encoding of the link as the document ID
      const docId = Buffer.from(item.link).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const docRef = doc(itemsCollection, docId);
      addBatch.set(docRef, item);
    });
    await addBatch.commit();

    return { success: true };
  } catch (error) {
    console.error("Error storing items to Firestore:", error);
    return { success: false, error: "Could not save items to the database." };
  }
}
