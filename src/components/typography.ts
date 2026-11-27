import { BodyFontFamily } from '../types/scolarite';

/** Classes Tailwind correspondant aux polices proposées pour le corps du certificat. */
export const BODY_FONT_CLASS: Record<BodyFontFamily, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  display: 'font-display',
  mono: 'font-mono',
};
