import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Props dla PublicRoute
 */
interface PublicRouteProps {
  /**
   * Dzieci (komponenty) do renderowania jeśli użytkownik NIE jest zalogowany
   */
  children: ReactNode;
  /**
   * Ścieżka do przekierowania jeśli użytkownik JUŻ JEST zalogowany
   * @default "/"
   */
  redirectTo?: string;
}

/**
 * Komponent dla tras publicznych (login, register)
 * Przekierowuje zalogowanych użytkowników do strony głównej aplikacji
 */
export function PublicRoute({
  children,
  redirectTo = '/',
}: PublicRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Podczas ładowania - pokaż loader
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

  // Jeśli zalogowany - przekieruj do app
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Jeśli niezalogowany - pokaż zawartość (formularz logowania/rejestracji)
  return <>{children}</>;
}

