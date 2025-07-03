import type { RssItem } from '@/app/actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import { LinkIcon } from 'lucide-react';

type ReleaseNotesTableProps = {
  items: RssItem[];
};

function parseSummary(summary: string) {
  const match = summary.match(/^\[(.*?)]\s*(.*)/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
    const lowerType = type.toLowerCase();

    if (lowerType === 'feature') {
      badgeVariant = 'default';
    } else if (lowerType === 'fixed') {
      badgeVariant = 'secondary';
    }
    
    return {
      type: type,
      description: match[2],
      variant: badgeVariant,
    };
  }
  return { type: null, description: summary, variant: 'outline' as const };
}

function highlightProduct(text: string) {
  const products = ['Gemini Code Assist Standard and Enterprise Edition', 'Gemini Code Assist', 'Gemini', 'VS Code', 'IntelliJ'];
  let highlightedText = text;
  products.forEach(product => {
    const regex = new RegExp(`\\b(${product})\\b`, 'gi');
    highlightedText = highlightedText.replace(regex, `<strong class="text-accent font-semibold">$1</strong>`);
  });
  return { __html: highlightedText };
}


export function ReleaseNotesTable({ items }: ReleaseNotesTableProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/20 overflow-hidden">
      <Table className="bg-card/80">
        <TableHeader>
          <TableRow className="border-primary/20 hover:bg-card">
            <TableHead className="w-[120px] font-bold text-foreground">Date</TableHead>
            <TableHead className="font-bold text-foreground">Release</TableHead>
            <TableHead className="font-bold text-foreground">Updates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            let publicationDate: Date | null = null;
            try {
              if (item.pubDate) {
                const date = new Date(item.pubDate);
                if (!isNaN(date.getTime())) {
                  publicationDate = date;
                }
              }
            } catch (e) {}

            const hasSummary = item.summary && item.summary.length > 0 && item.summary.join('').trim() !== '';

            return (
              <TableRow key={`${item.link}-${index}`} className="border-primary/20">
                <TableCell className="font-medium text-muted-foreground align-top pt-4">
                  {publicationDate ? format(publicationDate, 'MMM d, yyyy') : 'N/A'}
                </TableCell>
                <TableCell className="font-headline align-top pt-4">
                  <Link href={item.link} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                    {item.title}
                    <LinkIcon className="ml-1 h-3 w-3 inline-block" />
                  </Link>
                </TableCell>
                <TableCell className="pt-4">
                  {hasSummary ? (
                    <ul className="space-y-3">
                      {item.summary!.map((point, pointIndex) => {
                        const { type, description, variant } = parseSummary(point);
                        return (
                          <li key={pointIndex} className="flex items-start gap-3">
                            {type && (
                              <Badge variant={variant} className="whitespace-nowrap mt-1">
                                {type}
                              </Badge>
                            )}
                            <p className="text-foreground/80" dangerouslySetInnerHTML={highlightProduct(description)}></p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div
                      className="description-truncate text-sm text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
