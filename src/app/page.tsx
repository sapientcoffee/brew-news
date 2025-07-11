'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchRssFeed, type RssItem, getFeedUrls, getStoredFeedItems, storeFeedItems } from './actions';
import { differenceInDays } from 'date-fns';
import { Rss, Loader2, AlertCircle, Settings, RefreshCw, LogOut } from 'lucide-react';
import { ReleaseNotesTable } from '@/components/release-notes-table';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [items, setItems] = useState<RssItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUrls, setHasUrls] = useState(false);

  const auth = useAuth();
  const router = useRouter();

  const loadFeeds = useCallback(async (fromCache: boolean) => {
    setIsLoading(true);
    setError(null);
    
    const feedUrls = await getFeedUrls();
    setHasUrls(feedUrls.length > 0);

    if (feedUrls.length === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    if (fromCache) {
      const { data: storedItems, error: storeError } = await getStoredFeedItems();
      if (storeError) {
        setError(storeError);
      }
      if (storedItems && storedItems.length > 0) {
        setItems(storedItems);
        setIsLoading(false);
        return; // Exit if we successfully loaded from the database
      }
    }

    // If not loading from the database, or if the database was empty, fetch fresh data from all feeds.
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

    // Set UI with all fresh items, and then update the database
    setItems(allItems);

    const now = new Date();
    const itemsToStore = allItems.filter(item => {
      if (!item.pubDate) return false;
      try {
        const itemDate = new Date(item.pubDate);
        if (isNaN(itemDate.getTime())) return false;
        const daysAgo = differenceInDays(now, itemDate);
        return daysAgo >= 0 && daysAgo <= 14;
      } catch (e) {
        return false;
      }
    });
    
    await storeFeedItems(itemsToStore);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
    }
  }, [auth.loading, auth.user, router]);
  
  useEffect(() => {
    if (auth.user) {
        loadFeeds(true);
    }
  }, [auth.user, loadFeeds]);


  const { thisWeekItems, lastWeekItems } = (() => {
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
  })();

  if (auth.loading || !auth.user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="flex justify-between items-start mb-12">
            <div className="text-left">
              <div className="inline-flex items-center gap-4">
                <Rss className="h-12 w-12 text-primary" />
                <h1 className="text-5xl font-bold font-headline text-primary">
                  Brew News
                </h1>
              </div>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
                Your daily brew of release notes from your favorite feeds.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => loadFeeds(false)} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Feeds
              </Button>
              {auth.role === 'admin' && (
                <Button asChild variant="outline">
                  <Link href="/admin">
                    <Settings className="mr-2" />
                    Manage Feeds
                  </Link>
                </Button>
              )}
               <Button variant="ghost" onClick={auth.signOut}>
                <LogOut className="mr-2" />
                Sign Out
              </Button>
            </div>
        </header>


        {isLoading && (
          <div className="text-center py-10">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Fetching the freshest news...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-4xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Fetching Feeds</AlertTitle>
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
             {!isLoading && !hasUrls && auth.role === 'admin' && (
               <div className="text-center py-10 border border-dashed rounded-lg">
                <h3 className="text-lg font-semibold text-primary">Welcome to Brew News!</h3>
                <p className="text-muted-foreground mt-2 mb-4">You haven't added any RSS feeds yet.</p>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Link href="/admin">
                        <Settings className="mr-2"/>
                        Go to Admin to add feeds
                    </Link>
                </Button>
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
