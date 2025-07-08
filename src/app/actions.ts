'use server';

import { addLog } from './logActions';
import { z } from 'zod';
import { isThisMonth, isSameMonth, subMonths } from 'date-fns';
import { summarizeReleaseNote } from '@/ai/flows/summarize-release-notes-flow';
import { complexScrapeFlow } from '@/ai/flows/complex-scrape-flow';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

// Discriminated union for different source types
export type Source =
  | { type: 'rss'; url: string }
  | { type: 'webpage'; url: string };

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  summary?: string[];
  product?: string;
  subcomponent?: string;
  category?: string;
}

const urlSchema = z.string().url({ message: 'Please enter a valid URL.' });

export function decodeHtmlEntities(text: string): string {
  // This is a basic decoder and might not cover all cases.
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

export async function fetchSource(source: Source): Promise<{ data?: FeedItem[]; error?: string }> {
  if (source.type === 'rss') {
    return fetchRssFeed(source.url);
  }
  if (source.type === 'webpage') {
    return fetchWebpage(source.url);
  }
  return { error: 'Unsupported source type' };
}

export async function fetchWebpage(url: string): Promise<{ data?: FeedItem[]; error?: string }> {
  await addLog({ level: 'info', message: `Attempting to scrape webpage with complex Genkit flow: ${url}` });
  try {
    const result = await complexScrapeFlow({ url });
    const items = result.items.map(item => ({
      ...item,
      summary: item.summary && item.summary.length > 0 ? item.summary : [item.description],
    }));
    
    const now = new Date();
    const lastMonthDate = subMonths(now, 1);
    const displayableItems = items.filter(item => {
      try {
        const itemDate = new Date(item.pubDate);
        if (isNaN(itemDate.getTime())) return false;
        return isThisMonth(itemDate) || isSameMonth(itemDate, lastMonthDate);
      } catch {
        return false;
      }
    });

    await addLog({ 
      level: 'info', 
      message: `From ${url}, ${displayableItems.length} items will be displayed.`,
      details: {
        displayed: displayableItems.length,
        notDisplayed: items.length - displayableItems.length,
        total: items.length,
      }
    });
    
    await addLog({ level: 'info', message: `Genkit scraped ${items.length} items from: ${url}` });
    return { data: displayableItems };
  } catch (error: any) {
    await addLog({ level: 'error', message: `Failed to scrape webpage with complex Genkit flow: ${url}`, details: { error: error.stack } });
    return { error: 'Failed to process webpage with complex Genkit flow.' };
  }
}

export async function fetchRssFeed(url: string): Promise<{ data?: FeedItem[]; error?: string }> {
  await addLog({ level: 'info', message: `Attempting to fetch RSS feed: ${url}` });
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    const error = validation.error.errors[0].message;
    await addLog({ level: 'error', message: `Invalid URL for RSS feed: ${url}`, details: { error } });
    return { error };
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
      const error = `Failed to fetch feed. Server responded with status: ${response.status}`;
      await addLog({ level: 'error', message: `HTTP error for RSS feed: ${url}`, details: { status: response.status } });
      return { error };
    }

    const xmlText = await response.text();
    
    const isAtom = xmlText.includes('<feed');

    const itemBlocks = isAtom
      ? xmlText.match(/<entry>([\s\S]*?)<\/entry>/g)
      : xmlText.match(/<item>([\s\S]*?)<\/item>/g);

    if (!itemBlocks) {
      if (!isAtom && !xmlText.includes('<rss')) {
         const error = 'The content does not appear to be a valid RSS or Atom feed.';
         await addLog({ level: 'warning', message: `Invalid feed format for URL: ${url}`, details: { content: xmlText.substring(0, 500) } });
         return { error };
      }
      await addLog({ level: 'info', message: `No items found in RSS feed: ${url}` });
      return { data: [] };
    }

    const processedItems: FeedItem[] = itemBlocks.flatMap(block => {
        const entryTitleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
        const entryTitle = entryTitleMatch ? entryTitleMatch[1].trim() : '';

        const linkMatch = isAtom
          ? block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"|<link[^>]*href="([^"]+)"/)
          : block.match(/<link>([\s\S]*?)<\/link>/);
        const link = linkMatch ? (isAtom ? (linkMatch[1] || linkMatch[2]).trim() : linkMatch[1].trim()) : '#';

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

        // If the description contains <h3> tags, split it into multiple items
        if (description.includes('<h3>')) {
            const subItems = description.split('<h3>').slice(1); // Remove the part before the first <h3>
            return subItems.map((subItem, index) => {
                const subTitle = subItem.match(/([\s\S]*?)<\/h3>/);
                const subDescription = '<h3>' + subItem;
                return {
                    title: subTitle ? decodeHtmlEntities(subTitle[1].trim()) : decodeHtmlEntities(entryTitle),
                    link: `${link}-${index}`,
                    pubDate,
                    description: decodeHtmlEntities(subDescription),
                };
            });
        }

        return {
          title: decodeHtmlEntities(entryTitle),
          link,
          pubDate,
          description: decodeHtmlEntities(description),
        };
    });

    const totalItemsFound = processedItems.length;
    await addLog({ level: 'info', message: `Discovered ${totalItemsFound} potential items in feed: ${url}` });

    const validItems = processedItems.filter(item => item.title && item.link && item.link !== '#');
    const invalidItemsCount = processedItems.length - validItems.length;

    const now = new Date();
    const lastMonthDate = subMonths(now, 1);
    const displayableItems = validItems.filter(item => {
      try {
        const itemDate = new Date(item.pubDate);
        if (isNaN(itemDate.getTime())) return false;
        return isThisMonth(itemDate) || isSameMonth(itemDate, lastMonthDate);
      } catch {
        return false;
      }
    });

    await addLog({ 
      level: 'info', 
      message: `From ${url}, ${displayableItems.length} items will be displayed.`,
      details: {
        displayed: displayableItems.length,
        notDisplayed: totalItemsFound - displayableItems.length,
        total: totalItemsFound,
      }
    });

    const summaryPromises = displayableItems.map(async (item) => {
      try {
        const result = await summarizeReleaseNote({ htmlContent: item.description });
        item.summary = result.summary;
        item.product = result.product;
        item.subcomponent = result.subcomponent;
        // The title and pubDate from the summarization are more accurate
        // as they are extracted from the content itself.
        item.title = result.title;
        item.pubDate = result.pubDate;
      } catch (e: any) {
        await addLog({ level: 'error', message: `Summarization failed for item in ${url}`, details: { itemTitle: item.title, error: e.message } });
        item.summary = ['Error summarizing content.'];
      }
    });

    await Promise.all(summaryPromises);

    await addLog({ level: 'info', message: `Successfully processed and summarized RSS feed: ${url}` });
    return { data: displayableItems };
  } catch (err: any) {
    console.error('Fetch RSS Error:', err);
    const errorMessage = (err instanceof TypeError && err.message.includes('fetch failed'))
      ? 'Network error or invalid domain. Please check the URL and your connection.'
      : 'An unexpected error occurred while processing the feed. It may not be a valid RSS or Atom format.';
    
    await addLog({ level: 'error', message: `General error processing RSS feed: ${url}`, details: { error: err.message, finalMessage: errorMessage } });
    return { error: errorMessage };
  }
}

export async function getSources(): Promise<Source[]> {
  if (!db) {
    return [];
  }
  const sourcesDocRef = doc(db, 'sources', 'default');
  try {
    const docSnap = await getDoc(sourcesDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return Array.isArray(data.sources) ? data.sources : [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching sources from Firestore:", error);
    return [];
  }
}

export async function saveSources(sources: Source[]): Promise<{success: boolean, error?: string}> {
  if (!db) {
    return { success: false, error: "Firestore is not configured." };
  }
  const sourcesDocRef = doc(db, 'sources', 'default');
  try {
    const sourcesToStore = sources.map(source => ({ ...source }));
    await setDoc(sourcesDocRef, { sources: sourcesToStore });
    return { success: true };
  } catch (error) {
    console.error("Error saving sources to Firestore:", error);
    return { success: false, error: "Could not save sources." };
  }
}

export async function getStoredFeedItems(): Promise<{ data?: FeedItem[]; error?: string }> {
  if (!db) {
    return { data: [] };
  }
  try {
    const itemsCollection = collection(db, 'feedItems');
    const snapshot = await getDocs(itemsCollection);
    if (snapshot.empty) {
      return { data: [] };
    }
    const items: FeedItem[] = snapshot.docs.map(doc => doc.data() as FeedItem);
    return { data: items };
  } catch (error) {
    console.error("Error fetching stored items from Firestore:", error);
    return { error: "Could not retrieve stored feed items." };
  }
}

export async function storeFeedItems(items: FeedItem[]): Promise<{success: boolean, error?: string}> {
  if (!db) {
    return { success: true };
  }
  const itemsCollection = collection(db, 'feedItems');
  try {
    const oldDocsSnapshot = await getDocs(itemsCollection);
    const deleteBatch = writeBatch(db);
    oldDocsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    
    const addBatch = writeBatch(db);
    items.forEach(item => {
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