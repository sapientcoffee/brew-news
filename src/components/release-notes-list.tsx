import type { RssItem } from '@/app/actions';
import { ReleaseNoteCard } from './release-note-card';

type ReleaseNotesListProps = {
  title: string;
  items: RssItem[];
};

export function ReleaseNotesList({ title, items }: ReleaseNotesListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <h2 className="text-3xl font-headline font-bold text-primary mb-6 border-b-2 border-accent/50 pb-2">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {items.map((item, index) => (
          <ReleaseNoteCard key={`${item.link}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}
