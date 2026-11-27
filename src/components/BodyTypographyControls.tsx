import { Bold, Italic, Type, Underline } from 'lucide-react';
import { BodyFontFamily, BodyTextAlign, BodyTypography } from '../types/scolarite';

const FONT_OPTIONS: { value: BodyFontFamily; label: string }[] = [
  { value: 'sans', label: 'Sans serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'display', label: 'Display (titres)' },
  { value: 'mono', label: 'Monospace' },
];

const selectClass =
  'px-2 py-1 text-[11px] border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

/** Réglages « police & caractère » du texte rédigé du certificat. */
export function BodyTypographyControls({
  value,
  onChange,
  compact = false,
}: {
  value: BodyTypography;
  onChange: (patch: Partial<BodyTypography>) => void;
  compact?: boolean;
}) {
  const toggle = (
    key: 'bold' | 'italic' | 'underline' | 'uppercase',
    label: string,
    icon?: React.ReactNode
  ) => {
    const active = Boolean(value[key]);
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        title={label}
        onClick={() => onChange({ [key]: !active })}
        className={`px-2 py-1 text-[11px] rounded border inline-flex items-center gap-1 ${
          active
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {icon}
        {compact ? null : label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
        <Type className="w-3.5 h-3.5 text-blue-600" />
        Police
      </span>
      <select
        value={value.fontFamily}
        onChange={(e) => onChange({ fontFamily: e.target.value as BodyFontFamily })}
        aria-label="Police du texte"
        className={selectClass}
      >
        {FONT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
        Taille
        <input
          type="number"
          min={0}
          max={32}
          value={value.fontSize}
          onChange={(e) =>
            onChange({
              fontSize: Math.max(0, Math.min(32, Number(e.target.value) || 0)),
            })
          }
          title="Taille en pixels (0 = héritée du document)"
          className={`${selectClass} w-14 font-mono`}
        />
      </label>

      <select
        value={value.align}
        onChange={(e) => onChange({ align: e.target.value as BodyTextAlign })}
        aria-label="Alignement du texte"
        className={selectClass}
      >
        <option value="justify">Justifié</option>
        <option value="left">Gauche</option>
        <option value="center">Centré</option>
      </select>

      <select
        value={String(value.lineHeight)}
        onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
        aria-label="Interligne"
        className={selectClass}
      >
        <option value="1.2">Interligne 1,2</option>
        <option value="1.5">Interligne 1,5</option>
        <option value="1.8">Interligne 1,8</option>
        <option value="2">Interligne 2</option>
      </select>

      {toggle('bold', 'Gras', <Bold className="w-3 h-3" />)}
      {toggle('italic', 'Italique', <Italic className="w-3 h-3" />)}
      {toggle('underline', 'Souligné', <Underline className="w-3 h-3" />)}
      {toggle('uppercase', 'Majuscules')}
    </div>
  );
}
