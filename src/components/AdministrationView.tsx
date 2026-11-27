import { ChangeEvent, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileBadge,
  LayoutTemplate,
  Maximize2,
  Printer,
  RotateCcw,
  Save,
  Type,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_DOCUMENT_TEMPLATES,
  buildDocumentQrPayload,
  getSampleInscription,
  loadDocumentTemplates,
  mergeDocumentTemplate,
  resetDocumentTemplate,
  saveDocumentTemplates,
} from '../services/database';
import {
  DocumentBorderStyle,
  DocumentFontFamily,
  DocumentKind,
  DocumentTemplate,
  DocumentTemplates,
  ScolariteDatabase,
} from '../types/scolarite';
import { CertificateDocument } from './CertificateDocument';
import { CertificatePageModal } from './CertificatePageModal';
import { CertificatePrintSheets } from './CertificatePrintSheets';
import { CertificateTemplateEditor } from './CertificateTemplateEditor';
import { BodyTypographyControls } from './BodyTypographyControls';
import { StudentCardDocument } from './StudentCardDocument';
import { StudentCardPrintSheets } from './StudentCardPrintSheets';

interface AdministrationViewProps {
  db: ScolariteDatabase;
  anneeActive: string;
}

const BLOCK_LABELS: { key: keyof DocumentTemplate['blocks']; label: string }[] = [
  { key: 'header', label: 'En-tête institutionnel & logos' },
  { key: 'reference', label: 'Ligne de référence / n° inscription' },
  { key: 'title', label: 'Titre du document' },
  { key: 'identity', label: 'Identité de l’étudiant' },
  { key: 'filiation', label: 'Filiation (père / mère)' },
  { key: 'academicTable', label: 'Tableau académique' },
  { key: 'qr', label: 'QR code de vérification' },
  { key: 'signature', label: 'Bloc signature' },
  { key: 'watermark', label: 'Filigrane' },
  { key: 'legalMention', label: 'Mention légale' },
];

const QR_FIELD_LABELS: {
  key:
    | 'includeName'
    | 'includeInstitution'
    | 'includeMention'
    | 'includeLevel'
    | 'includeYear'
    | 'includeReference';
  label: string;
}[] = [
  { key: 'includeName', label: 'Nom et prénom(s)' },
  { key: 'includeInstitution', label: 'Faculté / institution' },
  { key: 'includeMention', label: 'Mention' },
  { key: 'includeLevel', label: 'Niveau' },
  { key: 'includeYear', label: 'Année universitaire' },
  { key: 'includeReference', label: 'Référence / n° inscription' },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg">
      <header className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h3>
        {description && (
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        )}
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-600 mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-600 mb-1">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-slate-300 text-blue-600"
      />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {hint && (
          <span className="block text-[11px] text-slate-500">{hint}</span>
        )}
      </span>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-600 mb-1">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0f172a'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 p-0.5 border border-slate-300 rounded bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
        />
      </span>
    </label>
  );
}

export function AdministrationView({ db, anneeActive }: AdministrationViewProps) {
  const [templates, setTemplates] = useState<DocumentTemplates>(() =>
    loadDocumentTemplates()
  );
  const [kind, setKind] = useState<DocumentKind>('certificat');
  const [zoom, setZoom] = useState(0.85);
  const [savedAt, setSavedAt] = useState<string>('');
  const [showBack, setShowBack] = useState(true);
  const [showPrintSheets, setShowPrintSheets] = useState(false);
  /** Feuille A4 en vue page (comme Word) : en-tête, texte et pied de page éditables */
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string>('');
  const [printTargets, setPrintTargets] = useState<DocumentKind | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const template = templates[kind];
  const certificatBodyStyle =
    templates.certificat.body.style ??
    DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;
  const sample = useMemo(() => getSampleInscription(db), [db]);
  const qrPreview = useMemo(
    () => buildDocumentQrPayload(sample, template),
    [sample, template]
  );

  const stamp = () =>
    new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  /**
   * Écrit dans l'état courant (et non dans la valeur capturée par le rendu) :
   * plusieurs modifications successives (en-tête puis pied de page…) ne
   * s'écrasent plus entre elles.
   */
  const updateTemplate = (
    mutate: (current: DocumentTemplate) => DocumentTemplate
  ) => {
    setTemplates((prev) => {
      const next: DocumentTemplates = {
        ...prev,
        [kind]: { ...mutate(prev[kind]), updatedAt: new Date().toISOString() },
      };
      saveDocumentTemplates(next);
      return next;
    });
    setSavedAt(stamp());
  };

  const commit = (nextTemplate: DocumentTemplate) =>
    updateTemplate(() => nextTemplate);

  const patch = (partial: Partial<DocumentTemplate>) =>
    updateTemplate((current) => ({ ...current, ...partial }));

  const patchSection = <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) =>
    updateTemplate((current) => ({
      ...current,
      [key]: {
        ...(current[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      },
    }));

  const handleReset = () => {
    commit(resetDocumentTemplate(kind));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modeles-documents-uu.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DocumentTemplates>;
      const next: DocumentTemplates = {
        certificat: mergeDocumentTemplate('certificat', parsed.certificat),
        carte: mergeDocumentTemplate('carte', parsed.carte),
      };
      setTemplates(next);
      saveDocumentTemplates(next);
      setImportMessage('Modèles importés et enregistrés.');
      setSavedAt(
        new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } catch {
      setImportMessage('Fichier invalide : JSON attendu.');
    } finally {
      e.target.value = '';
    }
  };

  const triggerPrint = (target: DocumentKind) => {
    setPrintTargets(target);
    setTimeout(() => {
      window.print();
      setPrintTargets(null);
    }, 120);
  };

  return (
    <div className="space-y-5">
      <div className="no-print space-y-5">
        {/* En-tête */}
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Administration · Modèles de documents
              </h2>
              <p className="text-xs text-slate-500">
                Personnalisez le certificat de scolarité et la carte étudiant ·
                aperçu en direct sur un étudiant de la base
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[11px] inline-flex items-center gap-1.5 ${
                savedAt ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {savedAt ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Enregistré à {savedAt}
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Enregistrement automatique
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Importer
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser ce modèle
            </button>
          </div>
        </div>

        {importMessage && (
          <div className="px-4 py-2.5 text-xs bg-blue-50 border border-blue-200 rounded-md text-blue-900">
            {importMessage}
          </div>
        )}

        {/* Onglets de document */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              {
                key: 'certificat' as DocumentKind,
                label: 'Certificat de scolarité',
                hint: 'A4 · 1 ou 2 par feuille',
                icon: FileBadge,
              },
              {
                key: 'carte' as DocumentKind,
                label: 'Carte étudiant',
                hint: '85,6 × 54 mm · recto/verso',
                icon: CreditCard,
              },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = kind === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setKind(tab.key)}
                className={`px-4 py-2.5 rounded-lg border text-left transition-colors inline-flex items-center gap-2.5 ${
                  active
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${active ? 'text-blue-700' : 'text-slate-400'}`}
                />
                <span>
                  <span className="block text-xs font-semibold">{tab.label}</span>
                  <span className="block text-[11px] text-slate-500">
                    {tab.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 items-start">
          {/* Panneau de réglages */}
          <div className="space-y-4">
            {kind === 'certificat' && (
              <CertificateTemplateEditor
                db={db}
                template={template}
                patch={patch}
                patchSection={patchSection}
              />
            )}

            {kind === 'carte' && (
            <Section
              title="En-tête & logos"
              description="Lignes institutionnelles affichées en haut du document"
            >
              <div className="grid grid-cols-2 gap-2">
                <Toggle
                  label="Logo principal"
                  checked={template.header.showLogo}
                  onChange={(v) => patchSection('header', { showLogo: v })}
                />
                <Toggle
                  label="Logo secondaire"
                  checked={template.header.showSecondaryLogo}
                  onChange={(v) =>
                    patchSection('header', { showSecondaryLogo: v })
                  }
                />
              </div>
              <TextField
                label="URL du logo principal"
                value={template.header.logoUrl}
                onChange={(v) => patchSection('header', { logoUrl: v })}
                mono
              />
              <TextField
                label="URL du logo secondaire"
                value={template.header.secondaryLogoUrl}
                onChange={(v) => patchSection('header', { secondaryLogoUrl: v })}
                mono
              />
              <TextField
                label="Ligne 1 (République)"
                value={template.header.line1}
                onChange={(v) => patchSection('header', { line1: v })}
              />
              <TextField
                label="Ligne 2 (devise)"
                value={template.header.line2}
                onChange={(v) => patchSection('header', { line2: v })}
              />
              <TextField
                label="Ligne 3 (ministère)"
                value={template.header.line3}
                onChange={(v) => patchSection('header', { line3: v })}
              />
              <TextField
                label="Ligne 4 (université)"
                value={template.header.line4}
                onChange={(v) => patchSection('header', { line4: v })}
              />
              <TextField
                label="Ligne 5 (direction / service)"
                value={template.header.line5}
                onChange={(v) => patchSection('header', { line5: v })}
              />
            </Section>
            )}

            {kind === 'carte' && (
            <Section title="Textes du document">
              <TextField
                label="Titre"
                value={template.texts.title}
                onChange={(v) => patchSection('texts', { title: v })}
              />
              <TextAreaField
                label="Phrase d’introduction"
                value={template.texts.intro}
                onChange={(v) => patchSection('texts', { intro: v })}
                rows={2}
              />
              <TextAreaField
                label="Formule de clôture"
                value={template.texts.closing}
                onChange={(v) => patchSection('texts', { closing: v })}
                rows={2}
              />
              <TextAreaField
                label="Mention légale"
                value={template.texts.legalMention}
                onChange={(v) => patchSection('texts', { legalMention: v })}
                rows={2}
              />
            </Section>
            )}

            <Section
              title="Blocs affichés"
              description="Décochez un bloc pour le masquer sur le document"
            >
              {BLOCK_LABELS.map((block) => (
                <Toggle
                  key={block.key}
                  label={block.label}
                  checked={template.blocks[block.key]}
                  onChange={(v) =>
                    patchSection('blocks', { [block.key]: v } as Partial<
                      DocumentTemplate['blocks']
                    >)
                  }
                />
              ))}
              {template.blocks.watermark && (
                <div className="pt-2 space-y-2 border-t border-slate-100">
                  <TextField
                    label="Texte du filigrane"
                    value={template.appearance.watermarkText}
                    onChange={(v) =>
                      patchSection('appearance', { watermarkText: v })
                    }
                  />
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Opacité ({Math.round(template.appearance.watermarkOpacity * 100)} %)
                    </span>
                    <input
                      type="range"
                      min={2}
                      max={30}
                      value={Math.round(template.appearance.watermarkOpacity * 100)}
                      onChange={(e) =>
                        patchSection('appearance', {
                          watermarkOpacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </label>
                </div>
              )}
            </Section>

            {kind === 'carte' && (
            <Section
              title="Champs & tableau"
              description="Lignes affichées (tableau du certificat, verso de la carte)"
            >
              {template.rows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    aria-label={`Afficher ${row.label}`}
                    onChange={(e) => {
                      const rows = template.rows.map((r, i) =>
                        i === index ? { ...r, enabled: e.target.checked } : r
                      );
                      patch({ rows });
                    }}
                    className="rounded border-slate-300 text-blue-600 shrink-0"
                  />
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => {
                      const rows = template.rows.map((r, i) =>
                        i === index ? { ...r, label: e.target.value } : r
                      );
                      patch({ rows });
                    }}
                    className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
              ))}
            </Section>
            )}

            {kind === 'carte' && (
            <Section title="QR code de vérification">
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-600 mb-1">
                  Taille ({template.qr.size} px)
                </span>
                <input
                  type="range"
                  min={48}
                  max={160}
                  step={4}
                  value={template.qr.size}
                  onChange={(e) =>
                    patchSection('qr', { size: Number(e.target.value) })
                  }
                  className="w-full accent-blue-600"
                />
              </label>
              <TextField
                label="Première ligne du contenu"
                value={template.qr.header}
                onChange={(v) => patchSection('qr', { header: v })}
                mono
              />
              <div className="grid grid-cols-2 gap-x-3">
                {QR_FIELD_LABELS.map((field) => (
                  <Toggle
                    key={field.key}
                    label={field.label}
                    checked={template.qr[field.key]}
                    onChange={(v) =>
                      commit({
                        ...template,
                        qr: { ...template.qr, [field.key]: v },
                      })
                    }
                  />
                ))}
              </div>
              <pre className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-600 whitespace-pre-wrap">
                {qrPreview}
              </pre>
            </Section>
            )}

            {kind === 'carte' && (
            <Section title="Signature">
              <TextField
                label="Fonction du signataire"
                value={template.signature.title}
                onChange={(v) => patchSection('signature', { title: v })}
              />
              <TextField
                label="Nom du signataire (optionnel)"
                value={template.signature.name}
                onChange={(v) => patchSection('signature', { name: v })}
              />
              <div className="grid grid-cols-2 gap-2 items-end">
                <TextField
                  label="Lieu"
                  value={template.signature.place}
                  onChange={(v) => patchSection('signature', { place: v })}
                />
                <Toggle
                  label="Afficher la date"
                  checked={template.signature.showDate}
                  onChange={(v) => patchSection('signature', { showDate: v })}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Les options d’édition de la page Certificats (date, signataire)
                restent prioritaires si elles sont remplies.
              </p>
            </Section>
            )}

            <Section title="Apparence">
              <div className="grid grid-cols-2 gap-2">
                <ColorField
                  label="Couleur d’accent"
                  value={template.appearance.accentColor}
                  onChange={(v) => patchSection('appearance', { accentColor: v })}
                />
                <ColorField
                  label="Couleur du texte"
                  value={template.appearance.textColor}
                  onChange={(v) => patchSection('appearance', { textColor: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">
                    Bordure
                  </span>
                  <select
                    value={template.appearance.borderStyle}
                    onChange={(e) =>
                      patchSection('appearance', {
                        borderStyle: e.target.value as DocumentBorderStyle,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="none">Aucune</option>
                    <option value="thin">Fine</option>
                    <option value="double">Double</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">
                    Police
                  </span>
                  <select
                    value={template.appearance.fontFamily}
                    onChange={(e) =>
                      patchSection('appearance', {
                        fontFamily: e.target.value as DocumentFontFamily,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="sans">Sans serif</option>
                    <option value="display">Titres (display)</option>
                    <option value="mono">Monospace</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-600 mb-1">
                  Taille de base ({template.appearance.fontSize} px)
                </span>
                <input
                  type="range"
                  min={10}
                  max={18}
                  value={template.appearance.fontSize}
                  onChange={(e) =>
                    patchSection('appearance', {
                      fontSize: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </label>
            </Section>

            {kind === 'carte' && (
              <Section
                title="Carte étudiant"
                description="Format CR80 · recto / verso"
              >
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">
                    Impression recto / verso
                  </span>
                  <select
                    value={template.card.printMode}
                    onChange={(e) =>
                      patchSection('card', {
                        printMode: e.target.value === 'side' ? 'side' : 'fold',
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="fold">Côte à côte (feuille pliée en 2)</option>
                    <option value="side">Recto puis verso (2 pages)</option>
                  </select>
                  <span className="block text-[10.5px] text-slate-500 mt-1">
                    {template.card.printMode === 'fold'
                      ? 'Recto à gauche, verso à droite : imprimez en taille réelle (100 %) puis pliez la feuille au centre.'
                      : 'Le recto et le verso sont imprimés sur deux pages distinctes.'}
                  </span>
                </label>
                <Toggle
                  label="Afficher la photo de l’étudiant"
                  checked={template.card.showPhoto}
                  onChange={(v) => patchSection('card', { showPhoto: v })}
                  hint="La photo se téléverse depuis la fiche étudiant"
                />
                <TextField
                  label="Texte si aucune photo"
                  value={template.card.photoHint}
                  onChange={(v) => patchSection('card', { photoHint: v })}
                />
                <ColorField
                  label="Couleur du bandeau"
                  value={template.card.headerColor}
                  onChange={(v) => patchSection('card', { headerColor: v })}
                />
                <div className="grid grid-cols-2 gap-2 items-end">
                  <Toggle
                    label="Afficher la validité"
                    checked={template.card.showValidity}
                    onChange={(v) => patchSection('card', { showValidity: v })}
                  />
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Durée (années)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={template.card.validityYears}
                      onChange={(e) =>
                        patchSection('card', {
                          validityYears: Number(e.target.value) || 1,
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </label>
                </div>
                <Toggle
                  label="Coins arrondis"
                  checked={template.card.rounded}
                  onChange={(v) => patchSection('card', { rounded: v })}
                />
                <TextField
                  label="Titre du verso"
                  value={template.card.backTitle}
                  onChange={(v) => patchSection('card', { backTitle: v })}
                />
                <TextAreaField
                  label="Note du verso"
                  value={template.card.backNote}
                  onChange={(v) => patchSection('card', { backNote: v })}
                  rows={2}
                />
              </Section>
            )}
          </div>

          {/* Aperçu */}
          <div className="xl:sticky xl:top-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Eye className="w-4 h-4 text-blue-600" />
                  Aperçu en direct
                  <span className="font-normal text-slate-500">
                    · {sample.nom} {sample.prenom} ({anneeActive || sample.annee})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {kind === 'certificat' && (
                    <button
                      type="button"
                      onClick={() => setPageModalOpen(true)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-slate-800 rounded hover:bg-slate-900 inline-flex items-center gap-1"
                    >
                      <Maximize2 className="w-3 h-3" /> Ouvrir la feuille
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPrintSheets((v) => !v)}
                      className={`px-2.5 py-1.5 text-[11px] font-medium rounded border inline-flex items-center gap-1 ${
                        showPrintSheets
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Printer className="w-3 h-3" />
                      {showPrintSheets
                        ? kind === 'carte'
                          ? 'Voir la carte'
                          : 'Voir le certificat'
                      : 'Feuille A4'}
                  </button>
                  {kind === 'carte' && (
                    <Toggle
                      label="Verso"
                      checked={showBack}
                      onChange={setShowBack}
                    />
                  )}
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    Zoom
                    <input
                      type="range"
                      min={50}
                      max={110}
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
                    onClick={() => triggerPrint(kind)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer l’aperçu
                  </button>
                </div>
              </div>

              {kind === 'certificat' && (
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-blue-600" />
                      Police &amp; caractère du texte
                    </p>
                    <span className="text-[10.5px] text-slate-500">
                      Appliqué directement au certificat ci-dessous
                    </span>
                  </div>
                  <BodyTypographyControls
                    value={certificatBodyStyle}
                    compact
                    onChange={(stylePatch) =>
                      patchSection('body', {
                        style: { ...certificatBodyStyle, ...stylePatch },
                      })
                    }
                  />
                </div>
              )}

              <div className="p-4 bg-slate-100/70 overflow-auto max-h-[70vh]">
                <div
                  style={{
                    zoom: showPrintSheets ? zoom * (kind === 'carte' ? 0.32 : 0.45) : zoom,
                  }}
                  className="mx-auto w-fit"
                >
                  {kind === 'certificat' ? (
                    showPrintSheets ? (
                      <CertificatePrintSheets records={[sample]} template={template} />
                    ) : (
                      <CertificateDocument
                        record={sample}
                        template={template}
                        token={sample.certificateToken}
                      />
                    )
                  ) : showPrintSheets ? (
                    <StudentCardPrintSheets
                      records={[sample]}
                      template={template}
                    />
                  ) : (
                    <StudentCardDocument
                      record={sample}
                      template={template}
                      side={showBack ? 'both' : 'front'}
                    />
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 px-1">
              Les modifications sont enregistrées automatiquement dans ce
              navigateur. Utilisez « Exporter (JSON) » pour les transférer vers un
              autre poste. Valeurs par défaut :{' '}
              {DEFAULT_DOCUMENT_TEMPLATES[kind].texts.title}.
            </p>
          </div>
        </div>
      </div>

      {/* Impression plein format */}
      {printTargets === 'certificat' && (
        <div className="hidden print:block">
          <CertificatePrintSheets
            records={[sample]}
            template={templates.certificat}
          />
        </div>
      )}
      {pageModalOpen && kind === 'certificat' && (
        <CertificatePageModal
          template={templates.certificat}
          record={sample}
          patchSection={(key, value) => patchSection(key, value)}
          onPrint={() => triggerPrint('certificat')}
          onClose={() => setPageModalOpen(false)}
        />
      )}
      {printTargets === 'carte' && (
        <div className="hidden print:block">
          <StudentCardPrintSheets records={[sample]} template={templates.carte} />
        </div>
      )}
    </div>
  );
}
