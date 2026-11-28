import { Loader2 } from 'lucide-react';

interface LoadingWaitModalProps {
  open: boolean;
  title?: string;
  message?: string;
  processed?: number;
  total?: number;
  onCancel?: () => void;
}

/**
 * Utilitaire pour céder le thread principal au navigateur afin qu'il puisse
 * peindre l'écran "Veuillez patienter" et éviter l'alerte "Page ne répondant pas".
 */
export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function LoadingWaitModal({
  open,
  title = 'Veuillez patienter...',
  message = "Chargement de l'état en cours...",
  processed,
  total,
  onCancel,
}: LoadingWaitModalProps) {
  if (!open) return null;

  const hasProgress =
    typeof total === 'number' && total > 0 && typeof processed === 'number';
  const percent = hasProgress
    ? Math.min(100, Math.round((processed / total) * 100))
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed inset-0 z-[80] bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-slate-900 font-display">
            {title}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
        </div>

        {hasProgress && (
          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-slate-500 tabular-nums">
              {processed.toLocaleString('fr-FR')} /{' '}
              {total.toLocaleString('fr-FR')} ({percent}%)
            </p>
          </div>
        )}

        {onCancel && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
