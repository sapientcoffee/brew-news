import type { RssItem } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

type ReleaseNoteCardProps = {
  item: RssItem;
};

export function ReleaseNoteCard({ item }: ReleaseNoteCardProps) {
  let publicationDate: Date | null = null;
  try {
    if (item.pubDate) {
      const date = new Date(item.pubDate);
      if (!isNaN(date.getTime())) {
        publicationDate = date;
      }
    }
  } catch (e) {
    // Invalid date format, leave as null
  }

  return (
    <Card className="flex flex-col h-full bg-card/80 backdrop-blur-sm border-primary/20 hover:border-accent/40 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-1">
      <CardHeader>
        <CardTitle className="font-headline text-lg leading-snug">{item.title}</CardTitle>
        {publicationDate && (
          <CardDescription className="text-xs text-muted-foreground pt-1">
            {format(publicationDate, 'MMMM d, yyyy')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        <div
          className="description-truncate text-sm text-foreground/80"
          dangerouslySetInnerHTML={{ __html: item.description }}
        />
      </CardContent>
      <CardFooter>
        <Button asChild variant="link" className="text-accent hover:text-accent/80 p-0 h-auto">
          <Link href={item.link} target="_blank" rel="noopener noreferrer">
            Read More
            <LinkIcon className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
