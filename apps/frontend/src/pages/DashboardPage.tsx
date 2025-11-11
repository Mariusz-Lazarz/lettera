import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { CVList } from '@/components/dashboard/CVList';
import { LettersList } from '@/components/dashboard/LettersList';
import { LimitWarningBanner } from '@/components/dashboard/LimitWarningBanner';
import { UploadCVModal } from '@/components/dashboard/UploadCVModal';
import { GenerateLetterModal } from '@/components/dashboard/GenerateLetterModal';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ToastArea } from '@/components/shared/ToastArea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, LogOut } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Maksymalny limit CV na użytkownika
 */
const MAX_CV_LIMIT = 5;

/**
 * Strona Dashboard / Profile
 * Główny widok użytkownika z listą CV i wygenerowanych listów motywacyjnych
 */
export function DashboardPage() {
  const { user, logout } = useAuth();
  const {
    cvs,
    letters,
    isLoading,
    isError,
    error,
    deleteCv,
    downloadCv,
    uploadCv,
    downloadLetter,
    deleteLetter,
    createLetter,
  } = useDashboardData();

  // State dla ConfirmModal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // State dla UploadCVModal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // State dla GenerateLetterModal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Obsługa wylogowania
   */
  const handleLogout = async () => {
    const loadingToast = toast.loading('Wylogowywanie...');
    try {
      await logout();
      toast.success('Wylogowano pomyślnie', {
        id: loadingToast,
      });
    } catch {
      toast.error('Błąd wylogowania', {
        id: loadingToast,
        description: 'Spróbuj ponownie',
      });
    }
  };

  /**
   * Obsługa usunięcia CV
   */
  const handleDeleteCv = (id: string) => {
    const cv = cvs.find((c) => c.id === id);
    if (!cv) return;

    setConfirmModal({
      isOpen: true,
      title: 'Usuń CV',
      description: `Czy na pewno chcesz usunąć CV "${cv.filename}"? Ta operacja jest nieodwracalna.`,
      onConfirm: async () => {
        setConfirmModal(null);
        await deleteCv(id);
      },
    });
  };

  /**
   * Obsługa pobrania CV
   */
  const handleDownloadCv = async (id: string, filename: string) => {
    await downloadCv(id, filename);
  };

  /**
   * Obsługa pobrania listu
   */
  const handleDownloadLetter = async (id: string) => {
    await downloadLetter(id);
  };

  /**
   * Obsługa usunięcia listu
   */
  const handleDeleteLetter = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Usuń list motywacyjny',
      description: 'Czy na pewno chcesz usunąć ten list motywacyjny? Ta operacja jest nieodwracalna.',
      onConfirm: async () => {
        setConfirmModal(null);
        await deleteLetter(id);
      },
    });
  };

  /**
   * Obsługa kliknięcia "Upload CV" - otwiera modal
   */
  const handleUploadCvClick = () => {
    if (cvs.length >= MAX_CV_LIMIT) {
      toast.error('Osiągnięto limit CV', {
        description: `Możesz mieć maksymalnie ${MAX_CV_LIMIT} CV. Usuń jedno z istniejących, aby dodać nowe.`,
      });
      return;
    }

    setIsUploadModalOpen(true);
  };

  /**
   * Obsługa uploadu CV z modalu
   */
  const handleUploadCv = async (file: File, filename?: string) => {
    setIsUploading(true);
    try {
      await uploadCv(file, filename);
      setIsUploadModalOpen(false);
    } catch (err) {
      // Błąd został już obsłużony przez hook (toast)
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Obsługa kliknięcia "Generuj list" - otwiera modal
   */
  const handleGenerateLetterClick = () => {
    if (cvs.length === 0) {
      toast.error('Brak CV', {
        description: 'Dodaj najpierw CV, aby móc wygenerować list motywacyjny.',
      });
      return;
    }

    if (letters.length >= 5) {
      toast.error('Osiągnięto limit listów', {
        description: 'Możesz mieć maksymalnie 5 listów. Usuń jeden z istniejących, aby wygenerować nowy.',
      });
      return;
    }

    setIsGenerateModalOpen(true);
  };

  /**
   * Obsługa generowania listu z modalu
   */
  const handleGenerateLetter = async (
    cvId: string,
    jobTitle: string,
    jobDescription: string
  ) => {
    setIsGenerating(true);
    try {
      const newLetter = await createLetter(cvId, jobTitle, jobDescription);
      if (newLetter) {
        setIsGenerateModalOpen(false);
      }
    } catch (err) {
      // Błąd został już obsłużony przez hook (toast)
      console.error('Generate error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Lettera</h1>
              <p className="text-sm text-muted-foreground">
                Witaj, {user?.email || 'użytkowniku'}
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Wyloguj
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Error state */}
        {isError && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive">
            <p className="font-medium">Wystąpił błąd</p>
            <p className="text-sm">{error || 'Nie udało się załadować danych'}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={handleUploadCvClick}
            disabled={cvs.length >= MAX_CV_LIMIT}
            title={
              cvs.length >= MAX_CV_LIMIT
                ? `Osiągnięto limit ${MAX_CV_LIMIT} CV`
                : 'Dodaj nowe CV'
            }
          >
            <Plus className="h-4 w-4" />
            Dodaj CV
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateLetterClick}
            disabled={cvs.length === 0 || letters.length >= 5}
            title={
              cvs.length === 0
                ? 'Najpierw dodaj CV'
                : letters.length >= 5
                  ? 'Osiągnięto limit 5 listów'
                  : 'Wygeneruj list motywacyjny'
            }
          >
            <Plus className="h-4 w-4" />
            Generuj list
          </Button>
        </div>

        {/* Limit Warning Banner */}
        <LimitWarningBanner count={cvs.length} limit={MAX_CV_LIMIT} />

        {/* CV Section */}
        <section className="mb-8" aria-labelledby="cv-section-title">
          <h2 id="cv-section-title" className="sr-only">
            Twoje CV
          </h2>
          <CVList
            items={cvs}
            isLoading={isLoading}
            onDelete={handleDeleteCv}
            onDownload={handleDownloadCv}
          />
        </section>

        {/* Letters Section */}
        <section aria-labelledby="letters-section-title">
          <h2 id="letters-section-title" className="sr-only">
            Wygenerowane listy motywacyjne
          </h2>
          <LettersList
            items={letters}
            isLoading={isLoading}
            onDownload={handleDownloadLetter}
            onDelete={handleDeleteLetter}
          />
        </section>
      </main>

      {/* Toast Area with aria-live */}
      <ToastArea />

      {/* Upload CV Modal */}
      <UploadCVModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUploadCv}
        isUploading={isUploading}
      />

      {/* Generate Letter Modal */}
      <GenerateLetterModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerateLetter}
        cvs={cvs}
        isGenerating={isGenerating}
      />

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          description={confirmModal.description}
          confirmText="Usuń"
          cancelText="Anuluj"
          destructive
        />
      )}
    </div>
  );
}

