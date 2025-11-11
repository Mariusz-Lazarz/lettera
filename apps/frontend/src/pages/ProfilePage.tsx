import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

/**
 * Strona profilu użytkownika
 * Wyświetla dane zalogowanego użytkownika i przycisk wylogowania
 */
export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const loadingToast = toast.loading('Wylogowywanie...');
    
    try {
      await logout();
      toast.success('Wylogowano', {
        id: loadingToast,
        description: 'Do zobaczenia!',
      });
      navigate('/login');
    } catch {
      toast.error('Błąd wylogowania', {
        id: loadingToast,
        description: 'Spróbuj ponownie.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl pt-16">
        <Card>
          <CardHeader>
            <CardTitle>Profil Użytkownika</CardTitle>
            <CardDescription>
              Witaj w aplikacji Lettera - generator listów motywacyjnych
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dane użytkownika */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <p className="text-lg font-semibold">{user?.email}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  ID Użytkownika
                </label>
                <p className="text-sm font-mono text-muted-foreground">
                  {user?.id}
                </p>
              </div>
              
              {user?.createdAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Data Rejestracji
                  </label>
                  <p className="text-sm">
                    {new Date(user.createdAt).toLocaleDateString('pl-PL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Przycisk wylogowania */}
            <div className="pt-4 border-t">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                Wyloguj się
              </Button>
            </div>

            {/* Info placeholder */}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                🚧 Funkcje zarządzania CV i generowania listów będą dostępne wkrótce
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

