import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';
import * as AuthContext from '@/contexts/AuthContext';
import type { ApiError } from '@/lib/api/auth';

const mockNavigate = vi.fn();
const mockRegister = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
  login: vi.fn(),
  register: mockRegister,
  logout: vi.fn(),
  checkAuth: vi.fn(),
  user: null,
  isLoading: false,
  isAuthenticated: false,
});

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders register form', () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Utwórz konto')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/hasło/i).length).toBeGreaterThan(0);
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const submitButton = screen.getByRole('button', { name: /zarejestruj się/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email jest wymagany/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/podaj poprawny adres email/i)).toBeInTheDocument();
    });
  });

  it('validates password length', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], '1234567');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/hasło musi mieć co najmniej 8 znaków/i)).toBeInTheDocument();
    });
  });

  it('validates password confirmation match', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);

    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password456');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/hasła muszą być identyczne/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com', createdAt: new Date().toISOString() },
    });

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /zarejestruj się/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
    });
  });

  it('handles 409 error (email already exists)', async () => {
    const user = userEvent.setup();
    const error: ApiError = {
      statusCode: 409,
      message: 'Email already exists',
      error: 'Conflict',
    };
    mockRegister.mockRejectedValueOnce(error);

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /zarejestruj się/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('handles 429 error (rate limit)', async () => {
    const user = userEvent.setup();
    const error: ApiError = {
      statusCode: 429,
      message: 'Too many requests',
      error: 'Too Many Requests',
    };
    mockRegister.mockRejectedValueOnce(error);

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /zarejestruj się/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('handles network error', async () => {
    const user = userEvent.setup();
    const error: ApiError = {
      statusCode: 0,
      message: 'Network error',
      error: 'Network error',
    };
    mockRegister.mockRejectedValueOnce(error);

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /zarejestruj się/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('navigates to login page when toggle clicked', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const toggleButton = screen.getByText(/zaloguj się/i);
    await user.click(toggleButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to login page after successful registration', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com', createdAt: new Date().toISOString() },
    });

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /zarejestruj się/i }));

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          state: { email: 'test@example.com', fromRegistration: true },
        });
      },
      { timeout: 2000 }
    );
  });

  it('stores registration email in sessionStorage', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    mockRegister.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com', createdAt: new Date().toISOString() },
    });

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    await user.type(passwordInputs[0], 'password123');
    await user.type(passwordInputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /zarejestruj się/i }));

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith('registrationEmail', 'test@example.com');
    });

    setItemSpy.mockRestore();
  });
});

