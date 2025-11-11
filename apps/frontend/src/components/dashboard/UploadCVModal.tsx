import { useState, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X } from 'lucide-react';

interface UploadCVModalProps {
  /**
   * Czy modal jest otwarty
   */
  isOpen: boolean;
  /**
   * Callback zamknięcia modala
   */
  onClose: () => void;
  /**
   * Callback uploadu pliku
   */
  onUpload: (file: File, filename?: string) => Promise<void>;
  /**
   * Czy upload jest w trakcie
   */
  isUploading?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Modal do uploadu CV
 * Obsługuje wybór pliku PDF, walidację i upload
 */
export function UploadCVModal({
  isOpen,
  onClose,
  onUpload,
  isUploading = false,
}: UploadCVModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Reset stanu po zamknięciu
   */
  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null);
      setCustomFilename('');
      setError(null);
      onClose();
    }
  };

  /**
   * Walidacja pliku
   */
  const validateFile = (file: File): string | null => {
    // Sprawdź typ pliku
    if (file.type !== 'application/pdf') {
      return 'Tylko pliki PDF są dozwolone';
    }

    // Sprawdź rozszerzenie
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return 'Plik musi mieć rozszerzenie .pdf';
    }

    // Sprawdź rozmiar
    if (file.size > MAX_FILE_SIZE) {
      return `Plik jest za duży. Maksymalny rozmiar to ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // Sprawdź czy plik nie jest pusty
    if (file.size === 0) {
      return 'Plik jest pusty';
    }

    return null;
  };

  /**
   * Obsługa wyboru pliku
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    
    // Ustaw domyślną nazwę (bez rozszerzenia)
    if (!customFilename) {
      const nameWithoutExt = file.name.replace(/\.pdf$/i, '');
      setCustomFilename(nameWithoutExt);
    }
  };

  /**
   * Obsługa kliknięcia przycisku wyboru pliku
   */
  const handleSelectClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    fileInputRef.current?.click();
  };

  /**
   * Obsługa uploadu
   */
  const handleUpload = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!selectedFile) {
      setError('Wybierz plik');
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await onUpload(selectedFile, customFilename || undefined);
      // Sukces - modal zostanie zamknięty przez parent
    } catch (err) {
      // Błąd - pozostaw modal otwarty aby użytkownik mógł spróbować ponownie
      console.error('Upload error:', err);
    }
  };

  /**
   * Obsługa usunięcia wybranego pliku
   */
  const handleRemoveFile = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSelectedFile(null);
    setCustomFilename('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Format rozmiaru pliku
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Dodaj CV</AlertDialogTitle>
          <AlertDialogDescription>
            Wybierz plik PDF z Twoim CV. Maksymalny rozmiar pliku to 10MB.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Input pliku (ukryty) */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />

          {/* Przycisk wyboru pliku lub podgląd wybranego */}
          {!selectedFile ? (
            <div
              onClick={handleSelectClick}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-1">
                Kliknij aby wybrać plik PDF
              </p>
              <p className="text-xs text-gray-500">lub przeciągnij plik tutaj</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  disabled={isUploading}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  aria-label="Usuń plik"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Opcjonalna nazwa pliku */}
          {selectedFile && (
            <div className="space-y-2">
              <Label htmlFor="filename">Nazwa pliku (opcjonalnie)</Label>
              <Input
                id="filename"
                type="text"
                placeholder="np. CV_Jan_Kowalski"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                disabled={isUploading}
                maxLength={100}
              />
              <p className="text-xs text-gray-500">
                Jeśli puste, zostanie użyta nazwa pliku
              </p>
            </div>
          )}

          {/* Komunikat błędu */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? 'Przesyłanie...' : 'Prześlij CV'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

