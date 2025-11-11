import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmModalProps {
  /**
   * Czy modal jest otwarty
   */
  isOpen: boolean;
  /**
   * Callback zamknięcia modala
   */
  onClose: () => void;
  /**
   * Callback potwierdzenia akcji
   */
  onConfirm: () => void;
  /**
   * Tytuł modala
   */
  title: string;
  /**
   * Opis/treść modala
   */
  description: string;
  /**
   * Tekst przycisku potwierdzenia
   */
  confirmText?: string;
  /**
   * Tekst przycisku anulowania
   */
  cancelText?: string;
  /**
   * Czy akcja jest destrukcyjna (czerwony przycisk)
   */
  destructive?: boolean;
  /**
   * Czy akcja jest w trakcie wykonywania (loading state)
   */
  isLoading?: boolean;
}

/**
 * Uniwersalny modal potwierdzenia akcji
 * Używany do potwierdzania operacji destrukcyjnych (usuwanie, itp.)
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Potwierdź',
  cancelText = 'Anuluj',
  destructive = false,
  isLoading = false,
}: ConfirmModalProps) {
  /**
   * Obsługa potwierdzenia
   */
  const handleConfirm = () => {
    onConfirm();
    // Modal zostanie zamknięty przez parent component po zakończeniu akcji
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isLoading ? 'Przetwarzanie...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

