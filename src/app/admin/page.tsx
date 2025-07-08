'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { getSources, saveSources, fetchSource, type Source } from '@/app/actions';
import { getLogs, type LogEntry } from '@/app/logActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, PlusCircle, ShieldAlert, Rss, Globe, RefreshCw, FileText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function AdminPage() {
  type SourceStatus = 'idle' | 'loading' | 'success' | 'error';
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, { status: SourceStatus, error?: string }>>({});
  const [sources, setSources] = useState<Source[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<'rss' | 'webpage'>('rss');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const { toast } = useToast();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
    }
  }, [auth.loading, auth.user, router]);

  useEffect(() => {
    async function loadData() {
      if (auth.role === 'admin') {
        setIsLoading(true);
        const [fetchedSources, fetchedLogs] = await Promise.all([
          getSources(),
          getLogs(),
        ]);
        setSources(fetchedSources);
        setLogs(fetchedLogs);
        setIsLoading(false);

        // Initialize statuses and fetch source data
        const initialStatuses: Record<string, { status: SourceStatus, error?: string }> = {};
        fetchedSources.forEach(source => {
          initialStatuses[source.url] = { status: 'loading' };
        });
        setSourceStatuses(initialStatuses);

        fetchedSources.forEach(async (source) => {
          const result = await fetchSource(source);
          setSourceStatuses(prev => ({
            ...prev,
            [source.url]: {
              status: result.error ? 'error' : 'success',
              error: result.error,
            }
          }));
        });
      }
    }
    if (!auth.loading && auth.user) {
        loadData();
    }
  }, [auth.loading, auth.user, auth.role]);

  const handleRefreshLogs = async () => {
    setIsRefreshingLogs(true);
    const fetchedLogs = await getLogs();
    setLogs(fetchedLogs);
    setIsRefreshingLogs(false);
    toast({ title: "Logs refreshed" });
  };

  const handleAddSource = async (e: FormEvent) => {
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

    if (sources.some(source => source.url === newUrl)) {
      toast({
        variant: "destructive",
        title: "Duplicate URL",
        description: "This URL already exists in the list.",
      });
      return;
    }

    const newSource: Source = { type: newSourceType, url: newUrl };
    const updatedSources = [...sources, newSource];
    await handleSave(updatedSources);
    setNewUrl('');
  };

  const handleRemoveSource = async (sourceToRemove: Source) => {
    if (isSaving) return;
    const updatedSources = sources.filter(source => source.url !== sourceToRemove.url);
    await handleSave(updatedSources);
  };

  const handleSave = async (updatedSources: Source[]) => {
    setIsSaving(true);
    const result = await saveSources(updatedSources);
    if (result.success) {
      setSources(updatedSources);
      toast({
        title: "Success",
        description: "Source list updated.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Failed to save sources.",
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
           <h1 className="text-4xl font-bold font-headline text-primary">Admin - Manage Sources</h1>
           <p className="mt-2 text-lg text-muted-foreground">Add or remove sources from your list.</p>
           <Button asChild variant="link" className="p-0 mt-4">
            <Link href="/">Back to Home</Link>
           </Button>
        </header>

        <div className="space-y-8">
            <section className="max-w-2xl mx-auto">
                 <h2 className="text-2xl font-headline font-bold text-primary mb-4">Add New Source</h2>
                 <form onSubmit={handleAddSource} className="flex gap-2">
                    <Select value={newSourceType} onValueChange={(value: 'rss' | 'webpage') => setNewSourceType(value)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rss">RSS</SelectItem>
                        <SelectItem value="webpage">Webpage</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <span className="ml-2 hidden sm:inline">Add Source</span>
                    </Button>
                 </form>
            </section>
            
            <section className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-headline font-bold text-primary mb-4">Current Sources</h2>
                {isLoading ? (
                    <div className="text-center py-10">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">Loading sources...</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sources.length > 0 ? (
                             sources.map(source => (
                                <div key={source.url} className="flex items-center justify-between p-3 bg-card rounded-md border border-primary/20">
                                    <div className="flex items-center gap-3">
                                      {source.type === 'rss' ? <Rss className="h-5 w-5 text-primary" /> : <Globe className="h-5 w-5 text-primary" />}
                                      <p className="text-sm text-foreground/90 truncate">{source.url}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            {sourceStatuses[source.url]?.status === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                                            {sourceStatuses[source.url]?.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                            {sourceStatuses[source.url]?.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {sourceStatuses[source.url]?.status === 'loading' && 'Processing...'}
                                            {sourceStatuses[source.url]?.status === 'success' && 'Successfully processed'}
                                            {sourceStatuses[source.url]?.status === 'error' && `Error: ${sourceStatuses[source.url]?.error || 'Unknown error'}`}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <Button variant="ghost" size="icon" onClick={() => handleRemoveSource(source)} disabled={isSaving} aria-label={`Remove ${source.url}`}>
                                          <Trash2 className="h-4 w-4 text-destructive/80 hover:text-destructive" />
                                      </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-4">No sources added yet.</p>
                        )}
                    </div>
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-headline font-bold text-primary">System Logs</h2>
                    <Button variant="outline" size="sm" onClick={handleRefreshLogs} disabled={isRefreshingLogs}>
                        {isRefreshingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-2">Refresh</span>
                    </Button>
                </div>
                <div className="h-96 bg-card rounded-md border border-primary/20 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="text-center py-10">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                            <p className="mt-4 text-muted-foreground">Loading logs...</p>
                        </div>
                    ) : logs.length > 0 ? (
                        logs.map((log, index) => (
                            <Accordion type="single" collapsible key={index}>
                                <AccordionItem value={`item-${index}`} className="border-b-0">
                                    <AccordionTrigger className="p-2 hover:bg-background/50 rounded-md">
                                        <div className="flex items-center gap-3 w-full">
                                            <FileText className={`h-5 w-5 ${log.level === 'error' ? 'text-destructive' : log.level === 'warning' ? 'text-yellow-500' : 'text-primary'}`} />
                                            <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                                            <p className="text-sm font-mono truncate flex-grow text-left">{log.message}</p>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 bg-background/30 rounded-b-md">
                                        <pre className="text-xs whitespace-pre-wrap break-all">
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-center py-4">No logs available.</p>
                    )}
                </div>
            </section>
        </div>
      </main>
    </div>
  );
}