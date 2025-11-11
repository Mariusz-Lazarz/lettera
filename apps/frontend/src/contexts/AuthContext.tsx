import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/auth';
import type { LoginFormValues, RegisterFormValues } from '@/lib/validation/authSchemas';

/**
 * Stan autoryzacji
 */
interface AuthState {
  /**
   * Aktualnie zalogowany użytkownik (null jeśli niezalogowany)
   */
  user: AuthUser | null;
  /**
   * Czy trwa ładowanie danych użytkownika
   */
  isLoading: boolean;
  /**
   * Czy użytkownik jest zalogowany
   */
  isAuthenticated: boolean;
}

/**
 * Kontekst autoryzacji
 */
interface AuthContextValue extends AuthState {
  /**
   * Logowanie użytkownika
   */
  login: (credentials: LoginFormValues) => Promise<void>;
  /**
   * Rejestracja nowego użytkownika
   */
  register: (payload: RegisterFormValues) => Promise<authApi.RegisterResponseDto>;
  /**
   * Wylogowanie użytkownika
   */
  logout: () => Promise<void>;
  /**
   * Sprawdzenie aktualnej sesji (pobranie danych użytkownika)
   */
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props dla AuthProvider
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider kontekstu autoryzacji
 * Zarządza stanem zalogowanego użytkownika i metodami auth
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Sprawdź aktualną sesję przy montowaniu komponentu
   */
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch {
      // Jeśli błąd 401 lub inne - użytkownik niezalogowany
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logowanie użytkownika
   */
  const login = useCallback(async (credentials: LoginFormValues) => {
    const response = await authApi.login(credentials);
    setUser(response.user);
  }, []);

  /**
   * Rejestracja użytkownika
   */
  const register = useCallback(async (payload: RegisterFormValues): Promise<authApi.RegisterResponseDto> => {
    // Usuń pola frontendowe przed wysłaniem
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, acceptTerms, ...apiPayload } = payload;
    const response = await authApi.register(apiPayload);
    // Po rejestracji NIE loguj automatycznie - użytkownik musi przejść do logowania
    // setUser(response.user);
    return response;
  }, []);

  /**
   * Wylogowanie użytkownika
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignoruj błędy wylogowania - i tak czyścimy stan lokalny
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  /**
   * Sprawdź sesję przy montowaniu
   */
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook do używania kontekstu autoryzacji
 * Musi być użyty wewnątrz AuthProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

