import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import type { CvViewModel } from '@/types/dashboard';

interface GenerateLetterModalProps {
  /**
   * Czy modal jest otwarty
   */
  isOpen: boolean;
  /**
   * Callback zamknięcia modala
   */
  onClose: () => void;
  /**
   * Callback generowania listu
   */
  onGenerate: (cvId: string, jobTitle: string, jobDescription: string) => Promise<void>;
  /**
   * Lista CV użytkownika do wyboru
   */
  cvs: CvViewModel[];
  /**
   * Czy generowanie jest w trakcie
   */
  isGenerating?: boolean;
}

const MIN_JOB_DESC_LENGTH = 1000;
const MAX_JOB_DESC_LENGTH = 10000;

/**
 * Modal do generowania listu motywacyjnego
 * Umożliwia wybór CV, wpisanie tytułu stanowiska i opisu
 */
export function GenerateLetterModal({
  isOpen,
  onClose,
  onGenerate,
  cvs,
  isGenerating = false,
}: GenerateLetterModalProps) {
  const [selectedCvId, setSelectedCvId] = useState<string>('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // Reset formularza po zamknięciu
  useEffect(() => {
    if (!isOpen) {
      setSelectedCvId('');
      setJobTitle('');
      setJobDescription('');
      setValidationError(null);
    }
  }, [isOpen]);

  // Debug: log CVs when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 GenerateLetterModal - CVs received:', cvs);
      console.log('🔍 CVs length:', cvs.length);
      console.log('🔍 CVs data:', JSON.stringify(cvs, null, 2));
    }
  }, [isOpen, cvs]);

  /**
   * Walidacja formularza
   */
  const validateForm = (): boolean => {
    setValidationError(null);

    if (!selectedCvId) {
      setValidationError('Wybierz CV');
      return false;
    }

    if (!jobTitle.trim()) {
      setValidationError('Wpisz tytuł stanowiska');
      return false;
    }

    if (jobTitle.trim().length < 3) {
      setValidationError('Tytuł stanowiska musi mieć minimum 3 znaki');
      return false;
    }

    if (!jobDescription.trim()) {
      setValidationError('Wpisz opis stanowiska');
      return false;
    }

    const descLength = jobDescription.trim().length;
    if (descLength < MIN_JOB_DESC_LENGTH) {
      setValidationError(
        `Opis stanowiska jest za krótki (${descLength} / ${MIN_JOB_DESC_LENGTH} znaków)`
      );
      return false;
    }

    if (descLength > MAX_JOB_DESC_LENGTH) {
      setValidationError(
        `Opis stanowiska jest za długi (${descLength} / ${MAX_JOB_DESC_LENGTH} znaków)`
      );
      return false;
    }

    return true;
  };

  /**
   * Obsługa generowania
   */
  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!validateForm()) {
      return;
    }

    await onGenerate(selectedCvId, jobTitle.trim(), jobDescription.trim());
  };

  /**
   * Obsługa zamknięcia modala
   */
  const handleClose = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (isGenerating) {
      return; // Nie pozwalaj zamknąć podczas generowania
    }

    onClose();
  };

  const descLength = jobDescription.length;
  const isDescValid =
    descLength >= MIN_JOB_DESC_LENGTH && descLength <= MAX_JOB_DESC_LENGTH;
  const isFormValid = selectedCvId && jobTitle.trim() && isDescValid;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isGenerating) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generuj list motywacyjny
          </DialogTitle>
          <DialogDescription>
            Wybierz CV, wpisz tytuł stanowiska i opis, aby wygenerować spersonalizowany list
            motywacyjny.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Wybór CV */}
          <div className="space-y-2">
            <Label htmlFor="cv-select">
              Wybierz CV * <span className="text-xs text-muted-foreground">({cvs.length} dostępnych)</span>
            </Label>
            <Select 
              value={selectedCvId} 
              onValueChange={(value) => {
                console.log('🔍 Select value changed:', value);
                setSelectedCvId(value);
              }}
              open={isSelectOpen}
              onOpenChange={(open) => {
                console.log('🔍 Select open changed:', open);
                setIsSelectOpen(open);
              }}
              disabled={isGenerating}
            >
              <SelectTrigger 
                id="cv-select" 
                className="w-full"
                onClick={() => {
                  console.log('🔍 SelectTrigger clicked');
                }}
              >
                <SelectValue placeholder="Wybierz CV..." />
              </SelectTrigger>
              <SelectContent>
                {cvs.length === 0 ? (
                  <SelectItem value="no-cv" disabled>
                    Brak dostępnych CV. Dodaj CV najpierw.
                  </SelectItem>
                ) : (
                  cvs.map((cv) => (
                    <SelectItem key={cv.id} value={cv.id}>
                      {cv.filename}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Tytuł stanowiska */}
          <div className="space-y-2">
            <Label htmlFor="job-title">Tytuł stanowiska *</Label>
            <Input
              id="job-title"
              type="text"
              placeholder="np. Senior Backend Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              disabled={isGenerating}
              maxLength={200}
            />
          </div>

          {/* Opis stanowiska */}
          <div className="space-y-2">
            <Label htmlFor="job-description">
              Opis stanowiska *
              <span
                className={`ml-2 text-xs ${
                  isDescValid
                    ? 'text-green-600'
                    : descLength > 0
                      ? 'text-orange-600'
                      : 'text-muted-foreground'
                }`}
              >
                ({descLength} / {MIN_JOB_DESC_LENGTH}-{MAX_JOB_DESC_LENGTH} znaków)
              </span>
            </Label>
            <Textarea
              id="job-description"
              placeholder="Wklej tutaj pełny opis stanowiska z ogłoszenia o pracę..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isGenerating}
              rows={12}
              maxLength={MAX_JOB_DESC_LENGTH}
              className="resize-y font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Opis musi zawierać od {MIN_JOB_DESC_LENGTH.toLocaleString()} do{' '}
              {MAX_JOB_DESC_LENGTH.toLocaleString()} znaków
            </p>
          </div>

          {/* Błąd walidacji */}
          {validationError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {validationError}
            </div>
          )}

          {/* Przyciski akcji */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Generowanie...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generuj list
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

