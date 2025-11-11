import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface LimitWarningBannerProps {
  /**
   * Aktualna liczba CV
   */
  count: number;
  /**
   * Maksymalny limit CV
   */
  limit?: number;
}

/**
 * Banner ostrzegawczy wyświetlany gdy użytkownik osiągnie limit CV
 */
export function LimitWarningBanner({ count, limit = 5 }: LimitWarningBannerProps) {
  // Pokaż banner tylko gdy osiągnięto limit
  if (count < limit) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Osiągnięto limit CV</AlertTitle>
      <AlertDescription>
        Masz już maksymalną liczbę CV ({limit}). Aby dodać nowe CV, usuń najpierw
        jedno z istniejących.
      </AlertDescription>
    </Alert>
  );
}


