'use client';

import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchRssFeed, type RssItem } from './actions';
import { differenceInDays } from 'date-fns';
import { Rss, Loader2, AlertCircle } from 'lucide-react';
import { ReleaseNotesTable } from '@/components/release-notes-table';

export default function Home() {
  const [urls, setUrls] = useState('https://cloud.google.com/feeds/gemini-codeassist-release-notes.xml');
  const [items, setItems] = useState<RssItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = useCallback(async (feeds: string) => {
    setIsLoading(true);
    setError(null);
    setItems([]);

    const feedUrls = feeds.split('\n').map(url => url.trim()).filter(Boolean);

    if (feedUrls.length === 0) {
      setError("Please enter at least one RSS feed URL.");
      setIsLoading(false);
      return;
    }

    const results = await Promise.all(feedUrls.map(url => fetchRssFeed(url)));
    
    const allItems: RssItem[] = [];
    const allErrors: string[] = [];

    results.forEach((result, index) => {
      if (result.data) {
        allItems.push(...result.data);
      }
      if (result.error) {
        allErrors.push(`Feed "${feedUrls[index]}": ${result.error}`);
      }
    });
    
    if (allErrors.length > 0) {
      setError(allErrors.join('\n'));
    }
    
    setItems(allItems);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Fetch initial URL on mount
    handleFetch(urls);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleFetch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleFetch(urls);
  };

  const { thisWeekItems, lastWeekItems } = useMemo(() => {
    const now = new Date();
    const thisWeek: RssItem[] = [];
    const lastWeek: RssItem[] = [];

    items.forEach(item => {
      if (!item.pubDate) return;
      try {
        const itemDate = new Date(item.pubDate);
        if (isNaN(itemDate.getTime())) return;

        const daysAgo = differenceInDays(now, itemDate);
        if (daysAgo >= 0 && daysAgo <= 7) {
          thisWeek.push(item);
        } else if (daysAgo > 7 && daysAgo <= 14) {
          lastWeek.push(item);
        }
      } catch (e) {
        // Ignore items with invalid dates
      }
    });

    // Sort by date, newest first
    const sortByDate = (a: RssItem, b: RssItem) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    thisWeek.sort(sortByDate);
    lastWeek.sort(sortByDate);

    return { thisWeekItems: thisWeek, lastWeekItems: lastWeek };
  }, [items]);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-4">
            <Rss className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold font-headline text-primary">
              Brew News
            </h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Your daily brew of release notes. Enter one or more RSS feed URLs to get the latest updates.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-12">
          <div className="grid w-full gap-4">
            <Textarea
              placeholder="Enter one or more RSS feed URLs, one per line..."
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              className="flex-grow bg-card/80 border-primary/30 focus:border-accent focus:ring-accent min-h-[100px]"
              disabled={isLoading}
              aria-label="RSS Feed URLs"
            />
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground justify-self-end" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                'Get Updates'
              )}
            </Button>
          </div>
        </form>

        {isLoading && (
          <div className="text-center py-10">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Fetching the freshest news...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (
          <div className="animate-in fade-in-50 duration-500 space-y-12">
            {thisWeekItems.length > 0 && (
              <section>
                <h2 className="text-3xl font-headline font-bold text-primary mb-6 border-b-2 border-accent/50 pb-2">
                  This Week
                </h2>
                <ReleaseNotesTable items={thisWeekItems} />
              </section>
            )}

            {lastWeekItems.length > 0 && (
              <section>
                <h2 className="text-3xl font-headline font-bold text-primary mb-6 border-b-2 border-accent/50 pb-2">
                  Last Week
                </h2>
                <ReleaseNotesTable items={lastWeekItems} />
              </section>
            )}
            
            {thisWeekItems.length === 0 && lastWeekItems.length === 0 && items.length > 0 && (
               <div className="text-center py-10">
                <p className="text-muted-foreground">No new updates from the last two weeks.</p>
               </div>
            )}
             {items.length === 0 && (
               <div className="text-center py-10">
                <p className="text-muted-foreground">No items found in this feed. Try another URL.</p>
               </div>
            )}
          </div>
        )}
      </main>
      <footer className="text-center py-6 border-t border-primary/10 mt-12">
        <p className="text-sm text-muted-foreground">
          Brew News &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
