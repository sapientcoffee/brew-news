'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { getFeedUrls, saveFeedUrls } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, PlusCircle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
    }
  }, [auth.loading, auth.user, router]);

  useEffect(() => {
    async function loadUrls() {
      if (auth.role === 'admin') {
        setIsLoading(true);
        const fetchedUrls = await getFeedUrls();
        setUrls(fetchedUrls);
        setIsLoading(false);
      }
    }
    if (!auth.loading && auth.user) {
        loadUrls();
    }
  }, [auth.loading, auth.user, auth.role]);

  const handleAddUrl = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUrl || isSaving) return;

    try {
        new URL(newUrl);
    } catch (_) {
        toast({
            variant: "destructive",
            title: "Invalid URL",
            description: "Please enter a valid URL.",
        });
        return;
    }

    if (urls.includes(newUrl)) {
      toast({
        variant: "destructive",
        title: "Duplicate URL",
        description: "This URL already exists in the list.",
      });
      return;
    }

    const updatedUrls = [...urls, newUrl];
    await handleSave(updatedUrls);
    setNewUrl('');
  };

  const handleRemoveUrl = async (urlToRemove: string) => {
    if (isSaving) return;
    const updatedUrls = urls.filter(url => url !== urlToRemove);
    await handleSave(updatedUrls);
  };

  const handleSave = async (updatedUrls: string[]) => {
    setIsSaving(true);
    const result = await saveFeedUrls(updatedUrls);
    if (result.success) {
      setUrls(updatedUrls);
      toast({
        title: "Success",
        description: "Feed list updated.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Failed to save URLs.",
      });
    }
    setIsSaving(false);
  };

  if (auth.loading || !auth.user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (auth.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center bg-background">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="mb-12">
           <h1 className="text-4xl font-bold font-headline text-primary">Admin - Manage Feeds</h1>
           <p className="mt-2 text-lg text-muted-foreground">Add or remove RSS feed URLs from your list.</p>
           <Button asChild variant="link" className="p-0 mt-4">
            <Link href="/">Back to Home</Link>
           </Button>
        </header>

        <div className="max-w-2xl mx-auto space-y-8">
            <section>
                 <h2 className="text-2xl font-headline font-bold text-primary mb-4">Add New Feed</h2>
                 <form onSubmit={handleAddUrl} className="flex gap-2">
                    <Input
                        type="url"
                        placeholder="https://example.com/feed.xml"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        disabled={isSaving}
                        className="flex-grow bg-card/80 border-primary/30"
                    />
                    <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={isSaving || !newUrl}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                        <span className="ml-2 hidden sm:inline">Add Feed</span>
                    </Button>
                 </form>
            </section>
            
            <section>
                <h2 className="text-2xl font-headline font-bold text-primary mb-4">Current Feeds</h2>
                {isLoading ? (
                    <div className="text-center py-10">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">Loading feeds...</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {urls.length > 0 ? (
                             urls.map(url => (
                                <div key={url} className="flex items-center justify-between p-3 bg-card rounded-md border border-primary/20">
                                    <p className="text-sm text-foreground/90 truncate mr-4">{url}</p>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveUrl(url)} disabled={isSaving} aria-label={`Remove ${url}`}>
                                        <Trash2 className="h-4 w-4 text-destructive/80 hover:text-destructive" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-4">No feeds added yet.</p>
                        )}
                    </div>
                )}
            </section>
        </div>
      </main>
    </div>
  );
}
