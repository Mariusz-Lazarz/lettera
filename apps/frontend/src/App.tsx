import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute, PublicRoute } from '@/components/auth';
import { LoginPage, RegisterPage, ProfilePage, DashboardPage } from '@/pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <Routes>
          {/* Root route - Dashboard (chroniony) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          
          {/* Public routes - dostępne tylko dla niezalogowanych */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          
          {/* Protected routes - wymagają zalogowania */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          
          {/* 404 Page */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-4">404</h1>
                  <p className="text-muted-foreground">Strona nie została znaleziona</p>
                </div>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
