import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Props dla ProtectedRoute
 */
interface ProtectedRouteProps {
  /**
   * Dzieci (komponenty) do renderowania jeśli użytkownik jest zalogowany
   */
  children: ReactNode;
  /**
   * Ścieżka do przekierowania jeśli użytkownik NIE jest zalogowany
   * @default "/login"
   */
  redirectTo?: string;
}

/**
 * Komponent zabezpieczający trasy przed nieautoryzowanym dostępem
 * Przekierowuje niezalogowanych użytkowników do strony logowania
 */
export function ProtectedRoute({
  children,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Podczas ładowania - pokaż loader lub nic
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // Jeśli niezalogowany - przekieruj
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Jeśli zalogowany - pokaż zawartość
  return <>{children}</>;
}

