import * as React from 'react';
import type { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import type { RegisterFormValues } from '@/lib/validation/authSchemas';

export interface RegisterFieldsProps {
  /**
   * Funkcja register z react-hook-form
   */
  register: UseFormRegister<RegisterFormValues>;
  /**
   * Błędy walidacji z react-hook-form
   */
  errors: FieldErrors<RegisterFormValues>;
  /**
   * Funkcja watch z react-hook-form (do obserwacji pól)
   */
  watch: UseFormWatch<RegisterFormValues>;
  /**
   * Czy wymagać akceptacji regulaminu
   */
  requireTerms?: boolean;
}

/**
 * Komponent z polami specyficznymi dla formularza rejestracji
 * Zawiera: email, password, confirmPassword, acceptTerms (opcjonalnie)
 */
export function RegisterFields({
  register,
  errors,
  requireTerms = false,
}: RegisterFieldsProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  return (
    <div className="space-y-4">
      {/* Email */}
      <FormField
        {...register('email')}
        name="email"
        label="Email"
        type="email"
        placeholder="twoj@email.com"
        error={errors.email?.message}
        required
        autoComplete="email"
      />

      {/* Password */}
      <div className="space-y-2">
        <FormField
          {...register('password')}
          name="password"
          label="Hasło"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          error={errors.password?.message}
          required
          autoComplete="new-password"
          helperText="Minimum 8 znaków"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
        >
          {showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
        </button>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <FormField
          {...register('confirmPassword')}
          name="confirmPassword"
          label="Potwierdź hasło"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          required
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label={
            showConfirmPassword ? 'Ukryj hasło' : 'Pokaż hasło'
          }
        >
          {showConfirmPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
        </button>
      </div>

      {/* Accept Terms (opcjonalne) */}
      {requireTerms && (
        <div className="flex items-start space-x-2">
          <input
            {...register('acceptTerms')}
            type="checkbox"
            id="acceptTerms"
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-1 focus:ring-ring"
            aria-describedby={
              errors.acceptTerms ? 'acceptTerms-error' : undefined
            }
            aria-invalid={errors.acceptTerms ? 'true' : 'false'}
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="acceptTerms"
              className="text-sm font-normal cursor-pointer"
            >
              Akceptuję{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                regulamin
              </a>{' '}
              i{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                politykę prywatności
              </a>
              <span className="text-destructive ml-1" aria-label="wymagane">
                *
              </span>
            </Label>
            {errors.acceptTerms && (
              <p
                id="acceptTerms-error"
                className="text-sm font-medium text-destructive"
                role="alert"
              >
                {errors.acceptTerms.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

