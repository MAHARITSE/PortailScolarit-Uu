import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Bold,
  Check,
  FileBadge,
  ImagePlus,
  Italic,
  Landmark,
  Pencil,
  Printer,
  Ruler,
  Type,
  Underline,
  X,
} from 'lucide-react';
import {
  CERTIFICATE_VARIABLES,
  DEFAULT_CERTIFICATE_PHRASE,
  DEFAULT_DOCUMENT_TEMPLATES,
} from '../services/database';
import {
  BodyTextAlign,
  CertificateSettings,
  DocumentTemplate,
  EnrichedInscription,
} from '../types/scolarite';
import { CertificateDocument } from './CertificateDocument';

interface CertificatePageModalProps {
  template: DocumentTemplate;
  record: EnrichedInscription;
  settings?: CertificateSettings;
  patchSection: <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) => void;
  onPrint: () => void;
  onClose: () => void;
}

type RibbonTab = 'accueil' | 'insertion' | 'mise-en-page' | 'affichage';

const TABS: { key: RibbonTab; label: string }[] = [
  { key: 'accueil', label: 'Accueil' },
  { key: 'insertion', label: 'Insertion' },
  { key: 'mise-en-page', label: 'Mise en page' },
  { key: 'affichage', label: 'Affichage' },
];

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const CM_TO_PX = 37.795;

const WORD_RIBBON_BTN =
  'px-1.5 py-1 rounded text-[11px] text-slate-700 hover:bg-slate-200/70 inline-flex items-center gap-1';
const WORD_SELECT =
  'px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500';

function RibbonGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between px-2.5 border-r border-slate-200 last:border-r-0 min-h-[72px]">
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <p className="text-[9px] uppercase tracking-wider text-slate-400 text-center mt-1.5">
        {label}
      </p>
    </div>
  );
}

/**
 * Feuille A4 en vue « traitement de texte » (style Word / WordCraft) : ruban
 * à onglets, galerie de styles, règle, volet de navigation et barre d'état.
 * L'en-tête, le texte et le pied de page s'éditent directement sur la page.
 */
export function CertificatePageModal({
  template,
  record,
  settings,
  patchSection,
  onPrint,
  onClose,
}: CertificatePageModalProps) {
  const [tab, setTab] = useState<RibbonTab>('accueil');
  const [zoom, setZoom] = useState(0.8);
  const [showNav, setShowNav] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [editingBody, setEditingBody] = useState(false);
  const [saved, setSaved] = useState(false);

  const [lines, setLines] = useState({
    line1: template.header.line1,
    line2: template.header.line2,
    line3: template.header.line3,
    line4: template.header.line4,
    line5: template.header.line5,
  });
  const [footer, setFooter] = useState({
    address: template.footer.address,
    contacts: template.footer.contacts,
    note: template.footer.note,
  });
  const [bodyText, setBodyText] = useState(template.body.template);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  const bodyStyle =
    template.body.style ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const commitHeader = () => {
    patchSection('header', lines);
    flashSaved();
  };

  const commitFooter = () => {
    patchSection('footer', footer);
    flashSaved();
  };

  const commitBody = () => {
    patchSection('body', { template: bodyText });
    flashSaved();
  };

  const setStyle = (stylePatch: Partial<typeof bodyStyle>) => {
    patchSection('body', { style: { ...bodyStyle, ...stylePatch } });
    flashSaved();
  };

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = document.querySelector<HTMLTextAreaElement>("textarea[data-page-body]");
    if (!el) {
      setBodyText((prev) => `${prev}${token}`);
      return;
    }
    const start = el.selectionStart ?? bodyText.length;
    const end = el.selectionEnd ?? bodyText.length;
    setBodyText(`${bodyText.slice(0, start)}${token}${bodyText.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const wordCount = useMemo(
    () =>
      bodyText
        .replace(/\{\{[^}]*\}\}/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    [bodyText]
  );

  const scrollTo = (target: 'header' | 'body' | 'footer') => {
    const el =
      target === 'header' ? headerRef.current : target === 'body' ? bodyRef.current : footerRef.current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const importImage = (
    file: File | undefined,
    apply: (dataUrl: string) => void
  ) => {
    if (!file || file.size > 900_000) return;
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const headerInputClass =
    'w-full bg-transparent text-center outline-none rounded px-1 py-0.5 hover:bg-blue-50/70 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300';

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-800/70 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Feuille A4 du certificat"
    >
      {/* Barre de titre */}
      <div className="bg-[#2b579a] text-white px-4 py-1.5 flex items-center gap-3 shrink-0">
        <FileBadge className="w-4 h-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight">
            {template.texts.title || 'Certificat de scolarité'}
          </p>
          <p className="text-[10px] text-white/70 truncate">
            Modèle du certificat · Université de Toliara
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10.5px] inline-flex items-center gap-1 text-white/80">
            {saved ? <Check className="w-3 h-3" /> : null}
            {saved ? 'Enregistré' : 'Enregistrement automatique'}
          </span>
          <button
            type="button"
            onClick={onPrint}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#2b579a] bg-white rounded hover:bg-blue-50 inline-flex items-center gap-1"
          >
            <Printer className="w-3 h-3" /> Imprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la feuille"
            className="p-1 rounded hover:bg-white/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ruban */}
      <div className="bg-[#f3f3f3] border-b border-slate-300 shrink-0">
        <div className="flex items-end gap-0.5 px-2 pt-1">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-3 py-1 text-[11.5px] rounded-t-md border border-b-0 ${
                  active
                    ? 'bg-white border-slate-300 text-[#2b579a] font-semibold'
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-white/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="bg-white border-t border-slate-300 px-1 py-2 flex flex-wrap items-stretch gap-0.5">
          {tab === 'accueil' && (
            <>
              <RibbonGroup label="Police">
                <select
                  value={bodyStyle.fontFamily}
                  onChange={(e) =>
                    setStyle({
                      fontFamily: e.target.value as typeof bodyStyle.fontFamily,
                    })
                  }
                  aria-label="Police du texte"
                  className={`${WORD_SELECT} w-28`}
                >
                  <option value="sans">Sans serif</option>
                  <option value="serif">Serif</option>
                  <option value="display">Display</option>
                  <option value="mono">Monospace</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={32}
                  value={bodyStyle.fontSize}
                  onChange={(e) =>
                    setStyle({
                      fontSize: Math.max(0, Math.min(32, Number(e.target.value) || 0)),
                    })
                  }
                  title="Taille en pixels (0 = taille héritée)"
                  aria-label="Taille du texte"
                  className={`${WORD_SELECT} w-12 font-mono`}
                />
                <span className="w-px h-6 bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  aria-pressed={bodyStyle.bold}
                  title="Gras"
                  onClick={() => setStyle({ bold: !bodyStyle.bold })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.bold ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-pressed={bodyStyle.italic}
                  title="Italique"
                  onClick={() => setStyle({ italic: !bodyStyle.italic })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.italic ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-pressed={bodyStyle.underline}
                  title="Souligné"
                  onClick={() => setStyle({ underline: !bodyStyle.underline })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.underline ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-pressed={bodyStyle.uppercase}
                  title="Majuscules"
                  onClick={() => setStyle({ uppercase: !bodyStyle.uppercase })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.uppercase ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <span className="text-[10px] font-semibold">AA</span>
                </button>
              </RibbonGroup>

              <RibbonGroup label="Paragraphe">
                <button
                  type="button"
                  title="Aligner à gauche"
                  onClick={() => setStyle({ align: 'left' })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.align === 'left' ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Centrer"
                  onClick={() => setStyle({ align: 'center' })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.align === 'center' ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Justifier"
                  onClick={() => setStyle({ align: 'justify' })}
                  className={`${WORD_RIBBON_BTN} ${bodyStyle.align === 'justify' ? 'bg-blue-100 text-[#2b579a]' : ''}`}
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
                <select
                  value={String(bodyStyle.lineHeight)}
                  onChange={(e) => setStyle({ lineHeight: Number(e.target.value) })}
                  aria-label="Interligne"
                  className={WORD_SELECT}
                >
                  <option value="1.2">Interligne 1,2</option>
                  <option value="1.5">Interligne 1,5</option>
                  <option value="1.8">Interligne 1,8</option>
                  <option value="2">Interligne 2</option>
                </select>
              </RibbonGroup>

              <RibbonGroup label="Styles">
                {(
                  [
                    {
                      key: 'normal',
                      label: 'Normale',
                      style: { fontSize: 0, bold: false, italic: false, align: 'justify' as BodyTextAlign },
                    },
                    {
                      key: 'accent',
                      label: 'Accentuée',
                      style: { fontSize: 14, bold: true, align: 'center' as BodyTextAlign },
                    },
                    {
                      key: 'caps',
                      label: 'Majuscules',
                      style: { uppercase: true, bold: false },
                    },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setStyle(preset.style)}
                    className="px-2 py-1 min-w-[76px] text-[11px] bg-white border border-slate-300 rounded hover:border-[#2b579a] hover:text-[#2b579a] text-left"
                  >
                    {preset.label}
                  </button>
                ))}
              </RibbonGroup>

              <RibbonGroup label="Édition">
                <button
                  type="button"
                  onClick={() => setEditingBody((v) => !v)}
                  className={`${WORD_RIBBON_BTN} border border-slate-300`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingBody ? 'Voir le rendu' : 'Modifier le texte'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBodyText(DEFAULT_CERTIFICATE_PHRASE);
                    patchSection('body', {
                      template: DEFAULT_CERTIFICATE_PHRASE,
                      mode: 'phrase',
                    });
                    flashSaved();
                  }}
                  className={`${WORD_RIBBON_BTN} border border-slate-300`}
                >
                  Phrase type
                </button>
              </RibbonGroup>
            </>
          )}

          {tab === 'insertion' && (
            <>
              <RibbonGroup label="Champs du certificat">
                <div className="flex flex-wrap gap-1 max-w-[560px]">
                  {CERTIFICATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => {
                        setEditingBody(true);
                        insertVariable(v.key);
                      }}
                      title={v.label}
                      className="px-1.5 py-0.5 text-[10.5px] font-mono bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </RibbonGroup>

              <RibbonGroup label="Images">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className={`${WORD_RIBBON_BTN} border border-slate-300`}
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Logo
                </button>
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className={`${WORD_RIBBON_BTN} border border-slate-300`}
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Signature / cachet
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    importImage(e.target.files?.[0], (url) => {
                      patchSection('header', { logoUrl: url, showLogo: true });
                      flashSaved();
                    });
                    e.target.value = '';
                  }}
                />
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    importImage(e.target.files?.[0], (url) => {
                      patchSection('signature', { imageUrl: url, showImage: true });
                      flashSaved();
                    });
                    e.target.value = '';
                  }}
                />
              </RibbonGroup>

              <RibbonGroup label="En-tête & pied de page">
                <button
                  type="button"
                  onClick={() => scrollTo('header')}
                  className={`${WORD_RIBBON_BTN} border border-slate-300`}
                >
                  <Landmark className="w-3.5 h-3.5" /> En-tête
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo('footer')}
                  className={`${WORD_RIBBON_BTN} border border-slate-300`}
                >
                  <Landmark className="w-3.5 h-3.5" /> Pied de page
                </button>
              </RibbonGroup>
            </>
          )}

          {tab === 'mise-en-page' && (
            <>
              <RibbonGroup label="Mise en page">
                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                  Orientation
                  <select
                    value={template.print.orientation}
                    onChange={(e) =>
                      patchSection('print', {
                        orientation:
                          e.target.value === 'landscape' ? 'landscape' : 'portrait',
                      })
                    }
                    className={WORD_SELECT}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Paysage</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                  Marges
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={template.print.marginMm}
                    onChange={(e) =>
                      patchSection('print', { marginMm: Number(e.target.value) || 0 })
                    }
                    className={`${WORD_SELECT} w-14 font-mono`}
                  />
                  mm
                </label>
              </RibbonGroup>

              <RibbonGroup label="En-tête / pied de page">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={template.blocks.header}
                    onChange={(e) =>
                      patchSection('blocks', { header: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  En-tête
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={template.footer.showFooter}
                    onChange={(e) =>
                      patchSection('footer', { showFooter: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Pied de page
                </label>
              </RibbonGroup>
            </>
          )}

          {tab === 'affichage' && (
            <>
              <RibbonGroup label="Zoom">
                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5">
                  <input
                    type="range"
                    min={40}
                    max={120}
                    step={5}
                    value={Math.round(zoom * 100)}
                    onChange={(e) => setZoom(Number(e.target.value) / 100)}
                    className="w-28 accent-[#2b579a]"
                  />
                  <span className="font-mono tabular-nums w-9 text-right">
                    {Math.round(zoom * 100)}%
                  </span>
                </label>
              </RibbonGroup>

              <RibbonGroup label="Afficher">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={showRuler}
                    onChange={(e) => setShowRuler(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <Ruler className="w-3.5 h-3.5" /> Règle
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={showNav}
                    onChange={(e) => setShowNav(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Volet de navigation
                </label>
              </RibbonGroup>
            </>
          )}
        </div>
      </div>

      {/* Navigation + page */}
      <div className="flex-1 flex min-h-0">
        {showNav && (
          <nav className="w-52 shrink-0 bg-[#fafafa] border-r border-slate-300 overflow-auto px-2 py-3 hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 px-2 mb-2">
              Navigation
            </p>
            {(
              [
                ['header', 'En-tête', Landmark],
                ['body', 'Texte du certificat', Type],
                ['footer', 'Pied de page', Landmark],
              ] as const
            ).map(([target, label, Icon]) => (
              <button
                key={target}
                type="button"
                onClick={() => scrollTo(target)}
                className="w-full text-left px-2 py-1.5 rounded text-[11.5px] text-slate-700 hover:bg-slate-200/70 inline-flex items-center gap-2"
              >
                <Icon className="w-3.5 h-3.5 text-[#2b579a]" />
                {label}
              </button>
            ))}
            <div className="mt-3 px-2 text-[10.5px] text-slate-500 leading-relaxed">
              Cliquez directement dans l’en-tête, le texte ou le pied de page pour
              les modifier.
            </div>
          </nav>
        )}

        <div className="flex-1 overflow-auto bg-[#8a8a8a] p-4 sm:p-6">
          <div style={{ zoom }} className="mx-auto w-fit">
            {showRuler && (
              <div
                className="relative h-6 mb-2 bg-[#f7f7f7] border border-slate-300 rounded-sm overflow-hidden"
                style={{ width: `${PAGE_WIDTH_PX}px` }}
                aria-hidden="true"
              >
                <div
                  className="absolute inset-x-0 bottom-0 h-2.5"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to right, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 18.9px)',
                  }}
                />
                {Array.from({ length: 11 }, (_, i) => (
                  <span
                    key={i}
                    className="absolute text-[8.5px] text-slate-500 font-mono"
                    style={{ left: `${i * 2 * CM_TO_PX + 2}px`, top: '1px' }}
                  >
                    {i * 2}
                  </span>
                ))}
              </div>
            )}

            <div
              className="bg-white shadow-2xl ring-1 ring-black/20"
              style={{
                width: `${PAGE_WIDTH_PX}px`,
                minHeight: `${PAGE_HEIGHT_PX}px`,
                padding: '40px 44px',
              }}
            >
              {/* En-tête */}
              <div ref={headerRef} className="group relative mb-4">
                <span className="absolute -top-4 left-0 text-[10px] uppercase tracking-widest text-[#2b579a] opacity-0 group-hover:opacity-100 transition-opacity">
                  En-tête
                </span>
                <div className="flex items-start gap-4">
                  <div className="w-20 shrink-0 flex flex-col items-center gap-1">
                    {template.header.showLogo && template.header.logoUrl ? (
                      <img
                        src={template.header.logoUrl}
                        alt="Logo"
                        className="w-16 h-16 object-contain"
                      />
                    ) : (
                      <div className="w-16 h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400">
                        Logo
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <input
                      value={lines.line1}
                      onChange={(e) => setLines({ ...lines, line1: e.target.value })}
                      onBlur={commitHeader}
                      placeholder="République · devise"
                      aria-label="En-tête ligne 1"
                      className={`${headerInputClass} text-[0.72em] font-semibold uppercase tracking-wider text-slate-700`}
                    />
                    <input
                      value={lines.line2}
                      onChange={(e) => setLines({ ...lines, line2: e.target.value })}
                      onBlur={commitHeader}
                      placeholder="Devise"
                      aria-label="En-tête ligne 2"
                      className={`${headerInputClass} text-[0.68em] italic text-slate-500`}
                    />
                    <input
                      value={lines.line3}
                      onChange={(e) => setLines({ ...lines, line3: e.target.value })}
                      onBlur={commitHeader}
                      placeholder="Ministère"
                      aria-label="En-tête ligne 3"
                      className={`${headerInputClass} text-[0.78em] font-semibold uppercase text-slate-800 pt-1`}
                    />
                    <input
                      value={lines.line4}
                      onChange={(e) => setLines({ ...lines, line4: e.target.value })}
                      onBlur={commitHeader}
                      placeholder="Université"
                      aria-label="En-tête ligne 4"
                      className={`${headerInputClass} text-[1.3em] font-bold uppercase tracking-tight`}
                      style={{ color: template.appearance.accentColor }}
                    />
                    <input
                      value={lines.line5}
                      onChange={(e) => setLines({ ...lines, line5: e.target.value })}
                      onBlur={commitHeader}
                      placeholder="Direction / service"
                      aria-label="En-tête ligne 5"
                      className={`${headerInputClass} text-[0.78em] font-medium text-slate-700`}
                    />
                  </div>

                  <div className="w-16 shrink-0" />
                </div>
                <div
                  className="mt-3 border-b-2"
                  style={{ borderColor: template.appearance.accentColor }}
                />
              </div>

              {/* Corps */}
              <div ref={bodyRef}>
                {editingBody ? (
                  <div className="space-y-3">
                    <textarea
                      data-page-body
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      onBlur={commitBody}
                      rows={16}
                      aria-label="Texte du certificat"
                      className="w-full border border-blue-200 rounded p-3 text-[13px] leading-relaxed font-mono outline-none focus:ring-2 focus:ring-blue-400/30 resize-y"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] text-slate-500">
                        Les variables entre accolades sont remplacées par les données
                        de l’étudiant.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          commitBody();
                          setEditingBody(false);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#2b579a] rounded hover:bg-[#24497f]"
                      >
                        Terminer la saisie
                      </button>
                    </div>
                  </div>
                ) : (
                  <CertificateDocument
                    record={record}
                    settings={settings}
                    template={template}
                    token={record.certificateToken}
                    hideHeader
                    hideFooter
                    embedded
                  />
                )}
              </div>

              {/* Pied de page */}
              <div ref={footerRef} className="group relative mt-6">
                <span className="absolute -top-4 left-0 text-[10px] uppercase tracking-widest text-[#2b579a] opacity-0 group-hover:opacity-100 transition-opacity">
                  Pied de page
                </span>
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={template.footer.showFooter}
                      onChange={(e) =>
                        patchSection('footer', { showFooter: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-600"
                    />
                    Afficher le pied de page
                  </label>
                  <input
                    value={footer.address}
                    onChange={(e) => setFooter({ ...footer, address: e.target.value })}
                    onBlur={commitFooter}
                    placeholder="Adresse de l’établissement"
                    aria-label="Adresse du pied de page"
                    className="w-full bg-transparent text-[10.5px] text-slate-600 outline-none rounded px-1 py-0.5 hover:bg-blue-50/70 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
                  />
                  <input
                    value={footer.contacts}
                    onChange={(e) => setFooter({ ...footer, contacts: e.target.value })}
                    onBlur={commitFooter}
                    placeholder="Téléphone · e-mail · site"
                    aria-label="Coordonnées du pied de page"
                    className="w-full bg-transparent text-[10.5px] text-slate-600 outline-none rounded px-1 py-0.5 hover:bg-blue-50/70 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
                  />
                  <input
                    value={footer.note}
                    onChange={(e) => setFooter({ ...footer, note: e.target.value })}
                    onBlur={commitFooter}
                    placeholder="Note de bas de page"
                    aria-label="Note du pied de page"
                    className="w-full bg-transparent text-[10.5px] text-slate-500 outline-none rounded px-1 py-0.5 hover:bg-blue-50/70 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barre d'état */}
      <div className="bg-[#2b579a] text-white px-4 py-1 flex items-center gap-4 text-[10.5px] shrink-0">
        <span>Page 1 sur 1</span>
        <span>{wordCount} mot{wordCount > 1 ? 's' : ''}</span>
        <span className="hidden sm:inline">
          {template.print.orientation === 'landscape' ? 'A4 paysage' : 'A4 portrait'} ·{' '}
          marges {template.print.marginMm} mm
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
            className="px-1.5 rounded hover:bg-white/15"
            aria-label="Réduire le zoom"
          >
            −
          </button>
          <span className="font-mono tabular-nums w-9 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
            className="px-1.5 rounded hover:bg-white/15"
            aria-label="Augmenter le zoom"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
