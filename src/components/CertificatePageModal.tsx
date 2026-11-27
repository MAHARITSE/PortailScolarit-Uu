import { useEffect, useRef, useState } from 'react';
import {
  Check,
  FileBadge,
  ImagePlus,
  Pencil,
  Printer,
  X,
} from 'lucide-react';
import {
  DEFAULT_CERTIFICATE_PHRASE,
  CERTIFICATE_VARIABLES,
} from '../services/database';
import {
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

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;

/**
 * Feuille A4 en vue « page » (comme Word) : l'en-tête et le pied de page
 * s'éditent directement sur la feuille, le corps du certificat peut être
 * modifié sur place.
 */
export function CertificatePageModal({
  template,
  record,
  settings,
  patchSection,
  onPrint,
  onClose,
}: CertificatePageModalProps) {
  const [zoom, setZoom] = useState(0.8);
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

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = document.querySelector<HTMLTextAreaElement>(
      'textarea[data-certificate-body]'
    );
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

  const headerInputClass =
    'w-full bg-transparent text-center outline-none rounded px-1 py-0.5 hover:bg-blue-50/60 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300';

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-700/80 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Feuille A4 du certificat"
    >
      {/* Barre d'outils */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileBadge className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">
            Feuille A4 · Certificat
          </span>
          <span className="hidden sm:inline text-[11px] text-slate-500">
            Cliquez dans l’en-tête, le texte ou le pied de page pour les modifier
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={`text-[11px] inline-flex items-center gap-1 ${
              saved ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {saved ? <Check className="w-3 h-3" /> : null}
            {saved ? 'Enregistré' : 'Enregistrement automatique'}
          </span>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            Zoom
            <input
              type="range"
              min={40}
              max={120}
              step={5}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className="w-24 accent-blue-600"
            />
            <span className="font-mono tabular-nums w-9 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </label>

          <button
            type="button"
            onClick={() => setEditingBody((v) => !v)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded border inline-flex items-center gap-1 ${
              editingBody
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Pencil className="w-3 h-3" />
            {editingBody ? 'Voir le rendu' : 'Modifier le texte'}
          </button>

          <button
            type="button"
            onClick={onPrint}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 inline-flex items-center gap-1"
          >
            <Printer className="w-3 h-3" /> Imprimer
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la feuille"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Zone de page */}
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div style={{ zoom }} className="mx-auto w-fit">
          <div
            className="bg-white shadow-2xl ring-1 ring-black/10"
            style={{
              width: `${PAGE_WIDTH_PX}px`,
              minHeight: `${PAGE_HEIGHT_PX}px`,
              padding: '40px 44px',
            }}
          >
            {/* En-tête éditable */}
            <div className="group relative mb-4">
              <span className="absolute -top-4 left-0 text-[10px] uppercase tracking-widest text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <ImagePlus className="w-3 h-3" /> Logo
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size <= 900_000) {
                        const reader = new FileReader();
                        reader.onload = () =>
                          patchSection('header', {
                            logoUrl: String(reader.result ?? ''),
                            showLogo: true,
                          });
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />
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
            {editingBody ? (
              <div className="space-y-3">
                <textarea
                  data-certificate-body
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  onBlur={commitBody}
                  rows={16}
                  aria-label="Texte du certificat"
                  className="w-full border border-blue-200 rounded p-3 text-[13px] leading-relaxed font-mono outline-none focus:ring-2 focus:ring-blue-400/30 resize-y"
                />
                <div className="flex flex-wrap gap-1.5">
                  {CERTIFICATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      title={v.label}
                      className="px-2 py-0.5 text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setBodyText(DEFAULT_CERTIFICATE_PHRASE)}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Rétablir la phrase type
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      commitBody();
                      setEditingBody(false);
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
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

            {/* Pied de page éditable */}
            <div className="group relative mt-6">
              <span className="absolute -top-4 left-0 text-[10px] uppercase tracking-widest text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  className="w-full bg-transparent text-[10.5px] text-slate-600 outline-none rounded px-1 py-0.5 hover:bg-blue-50/60 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
                />
                <input
                  value={footer.contacts}
                  onChange={(e) => setFooter({ ...footer, contacts: e.target.value })}
                  onBlur={commitFooter}
                  placeholder="Téléphone · e-mail · site"
                  aria-label="Coordonnées du pied de page"
                  className="w-full bg-transparent text-[10.5px] text-slate-600 outline-none rounded px-1 py-0.5 hover:bg-blue-50/60 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
                />
                <input
                  value={footer.note}
                  onChange={(e) => setFooter({ ...footer, note: e.target.value })}
                  onBlur={commitFooter}
                  placeholder="Note de bas de page"
                  aria-label="Note du pied de page"
                  className="w-full bg-transparent text-[10.5px] text-slate-500 outline-none rounded px-1 py-0.5 hover:bg-blue-50/60 focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
