import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, FileText, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface FileListItemProps {
  /**
   * ID pliku
   */
  id: string;
  /**
   * Nazwa pliku lub tytuł
   */
  title: string;
  /**
   * Dodatkowe informacje (np. data utworzenia)
   */
  subtitle: string;
  /**
   * Opcjonalny badge (np. status)
   */
  badge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  /**
   * Czy pokazać spinner zamiast ikony
   */
  isProcessing?: boolean;
  /**
   * Czy pokazać przycisk pobierania
   */
  showDownload?: boolean;
  /**
   * Czy pokazać przycisk usuwania
   */
  showDelete?: boolean;
  /**
   * Callback pobrania
   */
  onDownload?: () => void;
  /**
   * Callback usunięcia
   */
  onDelete?: () => void;
  /**
   * Opcjonalny dodatkowy content (np. komunikat o błędzie)
   */
  additionalContent?: ReactNode;
}

/**
 * Generyczny komponent dla elementu listy plików
 * Używany zarówno dla CV jak i listów motywacyjnych
 */
export function FileListItem({
  title,
  subtitle,
  badge,
  isProcessing = false,
  showDownload = true,
  showDelete = true,
  onDownload,
  onDelete,
  additionalContent,
}: FileListItemProps) {
  return (
    <li className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isProcessing ? (
          <Loader2 className="h-5 w-5 text-muted-foreground flex-shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate" title={title}>
              {title}
            </p>
            {badge && (
              <Badge variant={badge.variant}>
                {badge.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
          {additionalContent}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {showDownload && onDownload && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            aria-label={`Pobierz: ${title}`}
          >
            <Download className="h-4 w-4" />
            Pobierz
          </Button>
        )}
        {showDelete && onDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            aria-label={`Usuń: ${title}`}
          >
            <Trash2 className="h-4 w-4" />
            Usuń
          </Button>
        )}
      </div>
    </li>
  );
}


