/**
 * Dedykowany komponent dla aria-live region
 * Umożliwia screen readerom ogłaszanie powiadomień systemowych
 */

/**
 * ToastArea - Aria-live region dla powiadomień
 * 
 * Komponent ten nie renderuje nic wizualnego, ale zapewnia dostępność
 * dla technologii wspomagających (screen readers).
 * 
 * Powiadomienia są obsługiwane przez bibliotekę 'sonner' (Toaster),
 * która automatycznie integruje się z aria-live regions.
 * 
 * @see https://sonner.emilkowal.ski/
 */
export function ToastArea() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      aria-label="Powiadomienia systemowe"
    >
      {/* 
        Ten region jest automatycznie wypełniany przez Sonner.
        Screen readery będą ogłaszać komunikaty pojawiające się tutaj.
      */}
    </div>
  );
}


