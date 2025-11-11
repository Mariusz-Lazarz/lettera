import { z } from 'zod';

/**
 * Schema walidacji dla formularza logowania
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email jest wymagany')
    .email('Podaj poprawny adres email')
    .max(254, 'Email jest zbyt długi'),
  password: z
    .string()
    .min(1, 'Hasło jest wymagane')
    .min(8, 'Hasło musi mieć co najmniej 8 znaków'),
});

/**
 * Schema walidacji dla formularza rejestracji
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email jest wymagany')
      .email('Podaj poprawny adres email')
      .max(254, 'Email jest zbyt długi'),
    password: z
      .string()
      .min(1, 'Hasło jest wymagane')
      .min(8, 'Hasło musi mieć co najmniej 8 znaków'),
    confirmPassword: z
      .string()
      .min(1, 'Potwierdzenie hasła jest wymagane')
      .min(8, 'Hasło musi mieć co najmniej 8 znaków'),
    acceptTerms: z
      .boolean()
      .optional()
      .refine((val) => val === true || val === undefined, {
        message: 'Musisz zaakceptować regulamin',
      }),
  })
  .superRefine((data, ctx) => {
    // Walidacja zgodności hasła z potwierdzeniem
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hasła muszą być identyczne',
        path: ['confirmPassword'],
      });
    }
  });

/**
 * Typy inferred z schematów
 */
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

/**
 * Typy dla request payload (bez confirmPassword dla backendu)
 */
export type LoginRequestDto = LoginFormValues;
export type RegisterRequestDto = Omit<
  RegisterFormValues,
  'confirmPassword' | 'acceptTerms'
>;

