import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import type { RegisterFormValues, LoginFormValues } from '@/lib/validation/authSchemas';
import type { ApiError } from '@/lib/api/auth';

/**
 * Strona rejestracji użytkownika
 * Wyświetla formularz rejestracji i obsługuje proces tworzenia konta
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleRegister = async (data: RegisterFormValues | LoginFormValues) => {
    // Type guard - upewnij się że to RegisterFormValues
    if (!('confirmPassword' in data)) {
      throw new Error('Invalid form data');
    }
    // Pokaż toast z informacją o przetwarzaniu
    const loadingToast = toast.loading('Tworzenie konta...');

    try {
      // Wywołaj register z AuthContext (automatycznie usuwa confirmPassword i acceptTerms)
      const response = await register(data);

      // Sukces - pokaż toast
      toast.success('Konto zostało utworzone!', {
        id: loadingToast,
        description: 'Za chwilę zostaniesz przekierowany do logowania.',
      });

      // Zapisz informację o pomyślnej rejestracji (opcjonalnie)
      const userEmail = response?.user?.email || '';
      if (userEmail) {
        sessionStorage.setItem('registrationEmail', userEmail);
      }

      // Przekieruj do strony logowania po krótkim opóźnieniu
      setTimeout(() => {
        navigate('/login', {
          state: { email: userEmail, fromRegistration: true },
        });
      }, 1500);
    } catch (error) {
      // Błąd - pokaż odpowiedni toast
      const apiError = error as ApiError;

      if (apiError.statusCode === 409) {
        toast.error('Email już zajęty', {
          id: loadingToast,
          description: 'Użytkownik z tym adresem email już istnieje.',
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
        toast.error('Błąd rejestracji', {
          id: loadingToast,
          description:
            apiError.message || 'Nie udało się utworzyć konta. Spróbuj ponownie.',
        });
      }

      // Re-throw aby AuthForm mógł obsłużyć błąd
      throw error;
    }
  };

  const handleToggleMode = () => {
    navigate('/login');
  };

  const handleError = (error: ApiError) => {
    // Opcjonalne logowanie błędów do serwisu monitoringu (np. Sentry)
    console.error('Registration error:', error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <AuthForm
          mode="register"
          onSubmit={handleRegister}
          onError={handleError}
          showToggle={true}
          onToggleMode={handleToggleMode}
          requireTerms={false} // Ustaw true jeśli wymagane
        />
      </div>
    </div>
  );
}

