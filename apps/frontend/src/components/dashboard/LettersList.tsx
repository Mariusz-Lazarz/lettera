import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileListItem } from './FileListItem';
import type { LetterViewModel } from '@/types/dashboard';
import { FileText } from 'lucide-react';

interface LettersListProps {
  /**
   * Lista wygenerowanych listów
   */
  items: LetterViewModel[];
  /**
   * Czy dane są ładowane
   */
  isLoading?: boolean;
  /**
   * Callback pobrania listu
   */
  onDownload: (id: string) => void;
  /**
   * Callback usunięcia listu (opcjonalnie)
   */
  onDelete?: (id: string) => void;
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
 * Lista wygenerowanych listów motywacyjnych z akcjami
 */
export function LettersList({ items, isLoading = false, onDownload, onDelete }: LettersListProps) {
  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wygenerowane listy</CardTitle>
          <CardDescription>
            Nie masz jeszcze żadnego wygenerowanego listu motywacyjnego.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Dodaj CV i opis stanowiska, aby wygenerować swój pierwszy list motywacyjny.
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
          <CardTitle>Wygenerowane listy</CardTitle>
          <CardDescription>Ładowanie...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wygenerowane listy</CardTitle>
        <CardDescription>
          {items.length} / 5 {items.length === 1 ? 'list' : 'listów'} {items.length === 5 && '(limit osiągnięty)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" role="list" aria-label="Lista wygenerowanych listów motywacyjnych">
          {items.map((letter) => {
            const subtitle = `Utworzono: ${formatDate(letter.createdAt)} • Zaktualizowano: ${formatDate(letter.updatedAt)}`;

            return (
              <FileListItem
                key={letter.id}
                id={letter.id}
                title="List motywacyjny"
                subtitle={subtitle}
                showDownload={true}
                showDelete={!!onDelete}
                onDownload={() => onDownload(letter.id)}
                onDelete={onDelete ? () => onDelete(letter.id) : undefined}
              />
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

