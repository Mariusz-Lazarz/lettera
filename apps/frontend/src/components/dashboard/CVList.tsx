import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileListItem } from './FileListItem';
import type { CvViewModel } from '@/types/dashboard';
import { FileText } from 'lucide-react';

interface CVListProps {
  /**
   * Lista CV użytkownika
   */
  items: CvViewModel[];
  /**
   * Czy dane są ładowane
   */
  isLoading?: boolean;
  /**
   * Callback usunięcia CV
   */
  onDelete: (id: string) => void;
  /**
   * Callback pobrania CV
   */
  onDownload: (id: string, filename: string) => void;
}

/**
 * Formatuje datę na czytelny format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Lista CV użytkownika z akcjami
 */
export function CVList({ items, isLoading = false, onDelete, onDownload }: CVListProps) {
  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Twoje CV</CardTitle>
          <CardDescription>
            Nie masz jeszcze żadnego CV. Dodaj swoje pierwsze CV, aby móc generować listy
            motywacyjne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Możesz dodać maksymalnie 5 CV. Każde CV może mieć do 10MB.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Twoje CV</CardTitle>
          <CardDescription>Ładowanie...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Twoje CV</CardTitle>
        <CardDescription>
          {items.length} / 5 CV {items.length === 5 && '(limit osiągnięty)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" role="list" aria-label="Lista CV">
          {items.map((cv) => (
            <FileListItem
              key={cv.id}
              id={cv.id}
              title={cv.filename}
              subtitle={`Dodano: ${formatDate(cv.createdAt)}`}
              showDownload={true}
              showDelete={true}
              onDownload={() => onDownload(cv.id, cv.filename)}
              onDelete={() => onDelete(cv.id)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

