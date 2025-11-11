import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import type { LoginFormValues, RegisterFormValues } from '@/lib/validation/authSchemas';
import type { ApiError } from '@/lib/api/auth';

interface LocationState {
  email?: string;
  fromRegistration?: boolean;
}

/**
 * Strona logowania użytkownika
 * Wyświetla formularz logowania i obsługuje proces uwierzytelniania
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { login } = useAuth();

  // Pokaż komunikat po rejestracji
  useEffect(() => {
    if (state?.fromRegistration) {
      toast.success('Rejestracja zakończona', {
        description: 'Możesz teraz się zalogować.',
      });
      // Wyczyść state
      window.history.replaceState({}, document.title);
    }
  }, [state?.fromRegistration]);

  const handleLogin = async (data: LoginFormValues | RegisterFormValues) => {
    // Type guard - upewnij się że to LoginFormValues
    if ('confirmPassword' in data) {
      throw new Error('Invalid form data');
    }
    // Pokaż toast z informacją o przetwarzaniu
    const loadingToast = toast.loading('Logowanie...');

    try {
      // Wywołaj login z AuthContext
      await login(data);

      // Sukces - pokaż toast
      toast.success('Zalogowano pomyślnie!', {
        id: loadingToast,
        description: 'Witaj ponownie!',
      });

      // Przekieruj do profilu
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (error) {
      // Błąd - pokaż odpowiedni toast
      const apiError = error as ApiError;

      if (apiError.statusCode === 401) {
        toast.error('Nieprawidłowe dane', {
          id: loadingToast,
          description: 'Sprawdź email i hasło i spróbuj ponownie.',
        });
      } else if (apiError.statusCode === 429) {
        toast.error('Zbyt wiele prób', {
          id: loadingToast,
          description: 'Spróbuj ponownie za kilka minut.',
        });
      } else if (apiError.statusCode === 0) {
        toast.error('Błąd połączenia', {
          id: loadingToast,
          description: 'Sprawdź połączenie internetowe i spróbuj ponownie.',
        });
      } else {
        toast.error('Błąd logowania', {
          id: loadingToast,
          description:
            apiError.message ||
            'Nie udało się zalogować. Spróbuj ponownie.',
        });
      }

      // Re-throw aby AuthForm mógł obsłużyć błąd
      throw error;
    }
  };

  const handleToggleMode = () => {
    navigate('/register');
  };

  const handleError = (error: ApiError) => {
    // Opcjonalne logowanie błędów do serwisu monitoringu (np. Sentry)
    console.error('Login error:', error);
  };

  // Domyślne wartości (email z rejestracji jeśli dostępny)
  const defaultValues = state?.email ? { email: state.email } : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <AuthForm
          mode="login"
          onSubmit={handleLogin}
          onError={handleError}
          showToggle={true}
          onToggleMode={handleToggleMode}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  );
}

