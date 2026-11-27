import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Italic,
  Move,
  RotateCcw,
  Trash2,
  Underline,
} from 'lucide-react';
import {
  ElementTypography,
  PageTextAlign,
  QrPosition,
  QrSize,
} from '../types/scolarite';
import { HEADER_FONT_OPTIONS } from './typography';

interface PageElementToolbarProps {
  kicker: string;
  title: string;
  value?: ElementTypography;
  allowJustify?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  deleteTitle?: string;
  positionControls?: {
    x: number;
    y: number;
    onChange: (x: number, y: number) => void;
    onReset: () => void;
  };
  qrControls?: {
    position: QrPosition;
    preset: QrSize;
    onChangePosition: (position: QrPosition) => void;
    onChangeSize: (preset: QrSize) => void;
  };
  onUpdate?: (patch: Partial<ElementTypography>) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}

/**
 * Barre d'édition contextuelle unifiée pour tout élément de la page
 * (lignes d'en-tête, référence, titre, corps, blocs libres, signature, QR, pied de page, mention).
 */
export function PageElementToolbar({
  kicker,
  title,
  value,
  allowJustify = false,
  canMoveUp,
  canMoveDown,
  canDelete,
  deleteTitle = 'Supprimer ou masquer cet élément',
  positionControls,
  qrControls,
  onUpdate,
  onMove,
  onDelete,
}: PageElementToolbarProps) {
  const toggleBtnClass = (active: boolean) =>
    `w-8 h-8 rounded-lg border inline-flex items-center justify-center text-xs transition-colors shrink-0 ${
      active
        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  const actionBtnClass =
    'w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:pointer-events-none inline-flex items-center justify-center transition-colors shrink-0';

  const alignOptions: {
    value: PageTextAlign;
    label: string;
    icon: typeof AlignLeft;
  }[] = [
    { value: 'left', label: 'Aligner à gauche', icon: AlignLeft },
    { value: 'center', label: 'Centrer', icon: AlignCenter },
    { value: 'right', label: 'Aligner à droite', icon: AlignRight },
    ...(allowJustify
      ? [{ value: 'justify' as const, label: 'Justifier', icon: AlignJustify }]
      : []),
  ];

  const hasOffset =
    Boolean(positionControls) &&
    (Math.round(positionControls?.x ?? 0) !== 0 ||
      Math.round(positionControls?.y ?? 0) !== 0);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="no-print bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase leading-none">
          {kicker}
        </p>
        <p className="text-xs font-semibold text-slate-900 tabular-nums mt-1 truncate">
          {title}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {value && onUpdate && (
          <>
            <select
              value={value.fontFamily || 'Arial'}
              onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              aria-label="Police de l'élément"
              className="h-8 px-2.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              {HEADER_FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={7}
              max={44}
              value={value.fontSize || 12}
              onChange={(e) => {
                const nextSize = Math.max(
                  7,
                  Math.min(44, Number(e.target.value) || 12)
                );
                onUpdate({ fontSize: nextSize });
              }}
              aria-label="Taille de police en pixels"
              title="Taille (px)"
              className="h-8 w-14 px-2 text-xs text-center font-mono tabular-nums border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />

            <button
              type="button"
              aria-pressed={value.bold}
              title="Gras"
              onClick={() => onUpdate({ bold: !value.bold })}
              className={toggleBtnClass(value.bold)}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={value.italic}
              title="Italique"
              onClick={() => onUpdate({ italic: !value.italic })}
              className={toggleBtnClass(value.italic)}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={value.underline}
              title="Souligné"
              onClick={() => onUpdate({ underline: !value.underline })}
              className={toggleBtnClass(value.underline)}
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={value.uppercase}
              title="Majuscules"
              onClick={() => onUpdate({ uppercase: !value.uppercase })}
              className={toggleBtnClass(value.uppercase)}
            >
              <span className="text-[10px] font-bold tracking-tight">AA</span>
            </button>

            <span className="h-5 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

            {alignOptions.map((opt) => {
              const Icon = opt.icon;
              const active = value.align === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  title={opt.label}
                  onClick={() => onUpdate({ align: opt.value })}
                  className={toggleBtnClass(active)}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </>
        )}

        {qrControls && (
          <>
            <select
              value={qrControls.position}
              onChange={(e) =>
                qrControls.onChangePosition(e.target.value as QrPosition)
              }
              aria-label="Emplacement du QR code"
              className="h-8 px-2.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              <option value="bottom-left">Bas gauche</option>
              <option value="bottom-right">Bas droite</option>
              <option value="beside-signature">À côté signature</option>
              <option value="header">En-tête</option>
              <option value="footer">Pied de page</option>
            </select>
            <select
              value={qrControls.preset}
              onChange={(e) => qrControls.onChangeSize(e.target.value as QrSize)}
              aria-label="Taille du QR code"
              className="h-8 px-2.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              <option value="small">Petit (72 px)</option>
              <option value="medium">Moyen (96 px)</option>
              <option value="large">Grand (128 px)</option>
            </select>
          </>
        )}

        {positionControls && (
          <>
            <span className="h-5 w-px bg-slate-200 mx-0.5" aria-hidden="true" />
            <div
              className="inline-flex items-center gap-1"
              title="Décalage X / Y (glissez l'élément sur la page ou ajustez en pixels)"
            >
              <Move className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
                X
                <input
                  type="number"
                  step={4}
                  min={-500}
                  max={500}
                  value={Math.round(positionControls.x)}
                  onChange={(e) =>
                    positionControls.onChange(
                      Math.max(-500, Math.min(500, Number(e.target.value) || 0)),
                      positionControls.y
                    )
                  }
                  aria-label="Décalage horizontal X en pixels"
                  className="h-8 w-12 px-1.5 text-xs text-center font-mono tabular-nums border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                />
              </label>
              <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
                Y
                <input
                  type="number"
                  step={4}
                  min={-500}
                  max={500}
                  value={Math.round(positionControls.y)}
                  onChange={(e) =>
                    positionControls.onChange(
                      positionControls.x,
                      Math.max(-500, Math.min(500, Number(e.target.value) || 0))
                    )
                  }
                  aria-label="Décalage vertical Y en pixels"
                  className="h-8 w-12 px-1.5 text-xs text-center font-mono tabular-nums border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                />
              </label>
              {hasOffset && (
                <button
                  type="button"
                  onClick={positionControls.onReset}
                  title="Réinitialiser la position (0, 0)"
                  className={actionBtnClass}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        )}

        <span className="h-5 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          title="Monter"
          className={actionBtnClass}
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          title="Descendre"
          className={actionBtnClass}
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!canDelete}
          onClick={onDelete}
          title={deleteTitle}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-35 disabled:pointer-events-none inline-flex items-center justify-center transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
