import * as React from 'react';
import { Label } from './label';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface FormFieldProps
  extends Omit<React.ComponentProps<'input'>, 'id'> {
  /**
   * Identyfikator pola (używany dla id i htmlFor)
   */
  name: string;
  /**
   * Etykieta pola
   */
  label: string;
  /**
   * Komunikat błędu walidacji
   */
  error?: string;
  /**
   * Czy pole jest wymagane (dodaje wizualny wskaźnik *)
   */
  required?: boolean;
  /**
   * Dodatkowa klasa CSS dla wrappera
   */
  wrapperClassName?: string;
  /**
   * Opis pomocniczy pod polem
   */
  helperText?: string;
}

/**
 * Komponent FormField łączący Label, Input i komunikat błędu
 * Wspiera pełną dostępność (ARIA) i walidację
 */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      name,
      label,
      error,
      required,
      wrapperClassName,
      helperText,
      className,
      ...inputProps
    },
    ref
  ) => {
    const fieldId = `field-${name}`;
    const errorId = `${fieldId}-error`;
    const helperId = `${fieldId}-helper`;

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        <Label htmlFor={fieldId} className="flex items-center gap-1">
          {label}
          {required && (
            <span className="text-destructive" aria-label="wymagane">
              *
            </span>
          )}
        </Label>
        <Input
          id={fieldId}
          name={name}
          ref={ref}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(error && 'border-destructive', className)}
          {...inputProps}
        />
        {helperText && !error && (
          <p
            id={helperId}
            className="text-sm text-muted-foreground"
            role="note"
          >
            {helperText}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="text-sm font-medium text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

