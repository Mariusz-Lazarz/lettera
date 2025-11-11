import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as dashboardApi from '@/lib/api/dashboard';
import type { CvViewModel, LetterViewModel } from '@/types/dashboard';
import { ApiError } from '@/lib/api/auth';

/**
 * Wartość zwracana przez hook useDashboardData
 */
export interface UseDashboardDataReturn {
  /** Lista CV użytkownika */
  cvs: CvViewModel[];
  /** Lista wygenerowanych listów */
  letters: LetterViewModel[];
  /** Czy dane są ładowane */
  isLoading: boolean;
  /** Czy wystąpił błąd podczas ładowania */
  isError: boolean;
  /** Komunikat błędu */
  error: string | null;
  /** Funkcja do odświeżenia danych */
  refetch: () => Promise<void>;
  /** Funkcja do usunięcia CV */
  deleteCv: (id: string) => Promise<boolean>;
  /** Funkcja do pobrania CV */
  downloadCv: (id: string, filename: string) => Promise<void>;
  /** Funkcja do przesłania CV */
  uploadCv: (file: File, filename?: string) => Promise<CvViewModel | null>;
  /** Funkcja do pobrania listu */
  downloadLetter: (id: string) => Promise<void>;
  /** Funkcja do usunięcia listu */
  deleteLetter: (id: string) => Promise<boolean>;
  /** Funkcja do wygenerowania nowego listu */
  createLetter: (cvId: string, jobTitle: string, jobDescription: string) => Promise<LetterViewModel | null>;
}

/**
 * Custom hook do zarządzania danymi Dashboard
 * Pobiera CV i Letters, obsługuje CRUD operacje z optimistic updates
 */
export function useDashboardData(): UseDashboardDataReturn {
  const [cvs, setCvs] = useState<CvViewModel[]>([]);
  const [letters, setLetters] = useState<LetterViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pobiera dane z API (CV i Letters)
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const [cvsData, lettersData] = await Promise.all([
        dashboardApi.getCvs(),
        dashboardApi.getLetters(),
      ]);

      setCvs(cvsData);
      setLetters(lettersData);
    } catch (err) {
      setIsError(true);
      const errorMessage =
        err instanceof ApiError ? err.message : 'Nie udało się załadować danych';
      setError(errorMessage);

      toast.error('Błąd ładowania', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Usuwa CV z optimistic update
   */
  const deleteCv = useCallback(
    async (id: string): Promise<boolean> => {
      // Znajdź CV do usunięcia (dla rollback)
      const cvToDelete = cvs.find((cv) => cv.id === id);
      if (!cvToDelete) {
        toast.error('Błąd', { description: 'Nie znaleziono CV do usunięcia' });
        return false;
      }

      // Optimistic update - usuń lokalnie
      setCvs((prev) => prev.filter((cv) => cv.id !== id));

      const loadingToast = toast.loading('Usuwanie CV...');

      try {
        await dashboardApi.deleteCv(id);

        toast.success('CV zostało usunięte', {
          id: loadingToast,
          description: `Plik "${cvToDelete.filename}" został usunięty`,
        });

        return true;
      } catch (err) {
        // Rollback - przywróć CV
        setCvs((prev) => [...prev, cvToDelete].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));

        let errorMessage = 'Nie udało się usunąć CV';
        if (err instanceof ApiError) {
          if (err.statusCode === 403) {
            errorMessage = 'Brak uprawnień do usunięcia tego CV';
          } else if (err.statusCode === 404) {
            errorMessage = 'CV nie istnieje';
          } else if (err.statusCode === 500) {
            errorMessage = 'Błąd serwera podczas usuwania CV';
          }
        }

        toast.error('Błąd usuwania', {
          id: loadingToast,
          description: errorMessage,
        });

        return false;
      }
    },
    [cvs]
  );

  /**
   * Pobiera CV jako plik PDF
   */
  const downloadCv = useCallback(async (id: string, filename: string): Promise<void> => {
    const loadingToast = toast.loading('Pobieranie CV...');

    try {
      const blob = await dashboardApi.downloadCv(id);

      // Utwórz link do pobrania
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('CV pobrano pomyślnie', {
        id: loadingToast,
      });
    } catch (err) {
      let errorMessage = 'Nie udało się pobrać CV';
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          errorMessage = 'Brak uprawnień do pobrania tego CV';
        } else if (err.statusCode === 404) {
          errorMessage = 'CV nie istnieje';
        }
      }

      toast.error('Błąd pobierania', {
        id: loadingToast,
        description: errorMessage,
      });
    }
  }, []);

  /**
   * Przesyła nowe CV
   */
  const uploadCv = useCallback(
    async (file: File, filename?: string): Promise<CvViewModel | null> => {
      const loadingToast = toast.loading('Przesyłanie CV...');

      try {
        const newCv = await dashboardApi.uploadCv(file, filename);

        // Dodaj do listy
        setCvs((prev) => [newCv, ...prev]);

        toast.success('CV zostało przesłane', {
          id: loadingToast,
          description: `Plik "${file.name}" został dodany`,
        });

        return newCv;
      } catch (err) {
        let errorMessage = 'Nie udało się przesłać CV';
        if (err instanceof ApiError) {
          if (err.statusCode === 400) {
            errorMessage = 'Nieprawidłowy plik. Wymagany format PDF.';
          } else if (err.statusCode === 403) {
            errorMessage = 'Osiągnięto limit 5 CV. Usuń jedno z istniejących.';
          } else if (err.statusCode === 422) {
            errorMessage = 'Walidacja pliku nie powiodła się. Spróbuj innego pliku.';
          } else if (err.statusCode === 413) {
            errorMessage = 'Plik jest za duży. Maksymalny rozmiar to 10MB.';
          }
        }

        toast.error('Błąd przesyłania', {
          id: loadingToast,
          description: errorMessage,
        });

        throw err; // Throw error aby modal mógł go obsłużyć
      }
    },
    []
  );

  /**
   * Pobiera list motywacyjny jako PDF
   */
  const downloadLetter = useCallback(async (id: string): Promise<void> => {
    const loadingToast = toast.loading('Pobieranie listu...');

    try {
      const blob = await dashboardApi.downloadLetter(id);

      // Utwórz link do pobrania
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `list-motywacyjny-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('List pobrano pomyślnie', {
        id: loadingToast,
      });
    } catch (err) {
      let errorMessage = 'Nie udało się pobrać listu';
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          errorMessage = 'Brak uprawnień do pobrania tego listu';
        } else if (err.statusCode === 404) {
          errorMessage = 'List nie istnieje';
        }
      }

      toast.error('Błąd pobierania', {
        id: loadingToast,
        description: errorMessage,
      });
    }
  }, []);

  /**
   * Usuwa list motywacyjny z optimistic update
   */
  const deleteLetter = useCallback(
    async (id: string): Promise<boolean> => {
      // Znajdź list do usunięcia (dla rollback)
      const letterToDelete = letters.find((letter) => letter.id === id);
      if (!letterToDelete) {
        toast.error('Błąd', { description: 'Nie znaleziono listu do usunięcia' });
        return false;
      }

      // Optimistic update - usuń lokalnie
      setLetters((prev) => prev.filter((letter) => letter.id !== id));

      const loadingToast = toast.loading('Usuwanie listu...');

      try {
        await dashboardApi.deleteLetter(id);

        toast.success('List został usunięty', {
          id: loadingToast,
        });

        return true;
      } catch (err) {
        // Rollback - przywróć list
        setLetters((prev) => [...prev, letterToDelete].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));

        let errorMessage = 'Nie udało się usunąć listu';
        if (err instanceof ApiError) {
          if (err.statusCode === 403) {
            errorMessage = 'Brak uprawnień do usunięcia tego listu';
          } else if (err.statusCode === 404) {
            errorMessage = 'List nie istnieje';
          } else if (err.statusCode === 500) {
            errorMessage = 'Błąd serwera podczas usuwania listu';
          }
        }

        toast.error('Błąd usuwania', {
          id: loadingToast,
          description: errorMessage,
        });

        return false;
      }
    },
    [letters]
  );

  /**
   * Tworzy nowy list motywacyjny (generuje na podstawie CV i opisu stanowiska)
   */
  const createLetter = useCallback(
    async (cvId: string, jobTitle: string, jobDescription: string): Promise<LetterViewModel | null> => {
      const loadingToast = toast.loading('Generowanie listu motywacyjnego...', {
        description: 'To może potrwać kilka sekund',
      });

      try {
        const newLetter = await dashboardApi.createLetter(cvId, jobTitle, jobDescription);

        // Dodaj nowy list do listy (optimistic update)
        setLetters((prev) => [newLetter, ...prev].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));

        toast.success('List motywacyjny został wygenerowany', {
          id: loadingToast,
          description: 'Możesz teraz pobrać swój list',
        });

        return newLetter;
      } catch (err) {
        let errorMessage = 'Nie udało się wygenerować listu motywacyjnego';
        
        if (err instanceof ApiError) {
          if (err.statusCode === 400) {
            errorMessage = 'Nieprawidłowe dane. Sprawdź, czy CV istnieje i opis stanowiska ma odpowiednią długość (1000-10000 znaków)';
          } else if (err.statusCode === 403) {
            errorMessage = 'Osiągnięto limit listów motywacyjnych (maksymalnie 5). Usuń jeden z istniejących, aby wygenerować nowy';
          } else if (err.statusCode === 422) {
            errorMessage = 'Błąd generowania przez AI. Spróbuj ponownie za chwilę';
          }
        }

        toast.error('Błąd generowania', {
          id: loadingToast,
          description: errorMessage,
        });

        return null;
      }
    },
    []
  );

  /**
   * Funkcja refetch do odświeżenia danych
   */
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Pobierz dane przy montowaniu
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    cvs,
    letters,
    isLoading,
    isError,
    error,
    refetch,
    deleteCv,
    downloadCv,
    uploadCv,
    downloadLetter,
    deleteLetter,
    createLetter,
  };
}

