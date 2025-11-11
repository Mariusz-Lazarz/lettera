import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RegisterFields } from './RegisterFields';
import { LoginFields } from './LoginFields';
import {
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '@/lib/validation/authSchemas';
import type { ApiError } from '@/lib/api/auth';

export type AuthMode = 'login' | 'register';

export interface AuthFormProps {
  /**
   * Tryb formularza (login lub register)
   */
  mode: AuthMode;
  /**
   * Callback po udanym submit (po pomyślnej walidacji)
   */
  onSubmit: (data: LoginFormValues | RegisterFormValues) => Promise<void>;
  /**
   * Callback po błędzie API
   */
  onError?: (error: ApiError) => void;
  /**
   * Czy pokazać przełącznik do drugiego trybu
   */
  showToggle?: boolean;
  /**
   * Callback do przełączenia trybu
   */
  onToggleMode?: () => void;
  /**
   * Czy wymagać akceptacji regulaminu (tylko dla register)
   */
  requireTerms?: boolean;
  /**
   * Domyślne wartości formularza
   */
  defaultValues?: Partial<LoginFormValues | RegisterFormValues>;
  /**
   * Dodatkowa klasa CSS
   */
  className?: string;
}

/**
 * Główny komponent formularza autoryzacji
 * Obsługuje zarówno logowanie jak i rejestrację
 */
export function AuthForm({
  mode,
  onSubmit,
  onError,
  showToggle = true,
  onToggleMode,
  requireTerms = false,
  defaultValues,
  className,
}: AuthFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Wybór schematu walidacji w zależności od trybu
  const schema = mode === 'register' ? registerSchema : loginSchema;

  // Inicjalizacja react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues | RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {},
    mode: 'onBlur', // Walidacja przy blur dla lepszego UX
  });

  // Tytuły i opisy w zależności od trybu
  const title = mode === 'register' ? 'Utwórz konto' : 'Zaloguj się';
  const description =
    mode === 'register'
      ? 'Wprowadź swoje dane, aby utworzyć konto'
      : 'Wprowadź swoje dane, aby się zalogować';
  const submitLabel = mode === 'register' ? 'Zarejestruj się' : 'Zaloguj się';
  const toggleText =
    mode === 'register' ? 'Masz już konto?' : 'Nie masz jeszcze konta?';
  const toggleLabel = mode === 'register' ? 'Zaloguj się' : 'Zarejestruj się';

  // Handler submit z obsługą błędów
  const handleFormSubmit = async (
    data: LoginFormValues | RegisterFormValues
  ) => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      await onSubmit(data);
    } catch (error) {
      // Obsługa błędów API
      const apiError = error as ApiError;
      
      // Wywołaj callback onError jeśli istnieje
      onError?.(apiError);

      // Ustaw komunikat błędu do wyświetlenia
      if (apiError.statusCode === 409) {
        setServerError('Użytkownik z tym adresem email już istnieje');
        setFocus('email'); // Fokus na pole email
      } else if (apiError.statusCode === 401) {
        setServerError('Nieprawidłowy email lub hasło');
        setFocus('password'); // Fokus na pole password
      } else if (apiError.statusCode === 429) {
        setServerError(
          'Zbyt wiele prób. Spróbuj ponownie za kilka minut.'
        );
      } else if (apiError.statusCode === 0) {
        setServerError(
          'Błąd połączenia z serwerem. Sprawdź połączenie internetowe.'
        );
      } else {
        setServerError(
          apiError.message || 'Wystąpił błąd. Spróbuj ponownie później.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fokus na pierwsze błędne pole przy błędach walidacji
  React.useEffect(() => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      setFocus(firstError as keyof (LoginFormValues | RegisterFormValues));
    }
  }, [errors, setFocus]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          {/* Błąd serwera (globalny) */}
          {serverError && (
            <div
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20"
              role="alert"
            >
              {serverError}
            </div>
          )}

          {/* Pola formularza w zależności od trybu */}
          {mode === 'register' ? (
            <RegisterFields
              register={register as UseFormRegister<RegisterFormValues>}
              errors={errors as FieldErrors<RegisterFormValues>}
              watch={watch as UseFormWatch<RegisterFormValues>}
              requireTerms={requireTerms}
            />
          ) : (
            <LoginFields
              register={register as UseFormRegister<LoginFormValues>}
              errors={errors as FieldErrors<LoginFormValues>}
              showForgotPassword={false} // Można włączyć gdy będzie endpoint
            />
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          {/* Przycisk submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Proszę czekać...' : submitLabel}
          </Button>

          {/* Przełącznik trybu */}
          {showToggle && onToggleMode && (
            <div className="text-sm text-center text-muted-foreground">
              {toggleText}{' '}
              <button
                type="button"
                onClick={onToggleMode}
                className="text-primary hover:underline font-medium"
              >
                {toggleLabel}
              </button>
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

// Import typów dla poprawnego typowania
import type { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';

