import * as React from 'react';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import type { LoginFormValues } from '@/lib/validation/authSchemas';

export interface LoginFieldsProps {
  /**
   * Funkcja register z react-hook-form
   */
  register: UseFormRegister<LoginFormValues>;
  /**
   * Błędy walidacji z react-hook-form
   */
  errors: FieldErrors<LoginFormValues>;
  /**
   * Czy pokazać link do resetu hasła
   */
  showForgotPassword?: boolean;
}

/**
 * Komponent z polami specyficznymi dla formularza logowania
 * Zawiera: email, password (z toggle pokazywania hasła)
 */
export function LoginFields({
  register,
  errors,
  showForgotPassword = false,
}: LoginFieldsProps) {
  const [showPassword, setShowPassword] = React.useState(false);

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
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
          </button>
          {showForgotPassword && (
            <a
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Zapomniałeś hasła?
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

