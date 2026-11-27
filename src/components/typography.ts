import { BodyFontFamily } from '../types/scolarite';

/** Classes Tailwind correspondant aux polices proposées pour le corps du certificat. */
export const BODY_FONT_CLASS: Record<BodyFontFamily, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  display: 'font-display',
  mono: 'font-mono',
};

/** Polices disponibles pour l'éditeur de lignes d'en-tête. */
export const HEADER_FONT_OPTIONS: {
  value: string;
  label: string;
  stack: string;
}[] = [
  { value: 'Arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  {
    value: 'Plus Jakarta Sans',
    label: 'Plus Jakarta Sans',
    stack: '"Plus Jakarta Sans", Arial, sans-serif',
  },
  {
    value: 'Public Sans',
    label: 'Public Sans',
    stack: '"Public Sans", Arial, sans-serif',
  },
  {
    value: 'Times New Roman',
    label: 'Times New Roman',
    stack: '"Times New Roman", Times, serif',
  },
  { value: 'Georgia', label: 'Georgia', stack: 'Georgia, serif' },
  {
    value: 'Verdana',
    label: 'Verdana',
    stack: 'Verdana, Geneva, sans-serif',
  },
  {
    value: 'JetBrains Mono',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", monospace',
  },
];

export function resolveHeaderFontStack(fontFamily: string | undefined): string {
  if (!fontFamily) return 'Arial, Helvetica, sans-serif';
  return (
    HEADER_FONT_OPTIONS.find((opt) => opt.value === fontFamily)?.stack ??
    `${fontFamily}, sans-serif`
  );
}
