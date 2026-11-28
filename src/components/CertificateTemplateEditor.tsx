import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Palette,
  PenLine,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Trash2,
  Type,
  Upload,
  Users,
} from 'lucide-react';
import { BODY_FONT_CLASS } from './typography';
import {
  CERTIFICATE_VARIABLES,
  DEFAULT_CERTIFICATE_PHRASE,
  DEFAULT_DOCUMENT_TEMPLATES,
  DOCUMENT_THEME_PRESETS,
  QR_PIXEL_SIZES,
  buildCertificateQrPayload,
  buildCertificateVariables,
  buildDocumentQrPayload,
  clearCertificateRegistry,
  getResolvedHeaderLines,
  loadCertificateRegistry,
  mergeDocumentTemplate,
  renderCertificateBody,
  syncHeaderLegacyFields,
} from '../services/database';
import {
  CardHeaderStyle,
  CardPhotoPosition,
  CardPhotoShape,
  CardQrPlacement,
  CertificateTokenEntry,
  DocumentFontFamily,
  DocumentKind,
  DocumentTemplate,
  EnrichedInscription,
  HeaderLayoutMode,
  HorizontalAlign,
  QrContentMode,
  QrPosition,
  QrSize,
} from '../types/scolarite';
import { BodyTypographyControls } from './BodyTypographyControls';
import {
  FreeZonesManager,
  SectionOrderManager,
  TemplateFieldManager,
} from './TemplateFieldManager';

export type InspectorTab =
  | 'structure'
  | 'contenu'
  | 'champs'
  | 'style'
  | 'signature';

export const INSPECTOR_TABS: {
  key: InspectorTab;
  label: string;
  icon: typeof Layers;
}[] = [
  { key: 'structure', label: 'Structure', icon: Layers },
  { key: 'contenu', label: 'Contenu', icon: PenLine },
  { key: 'champs', label: 'Champs', icon: ListChecks },
  { key: 'style', label: 'Style', icon: Palette },
  { key: 'signature', label: 'Signature & QR', icon: QrCode },
];

export const inputClass =
  'w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export function EditorSection({
  title,
  description,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50"
        aria-expanded={open}
      >
        {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-slate-800">
            {title}
          </span>
          {description && (
            <span className="block text-[11px] text-slate-500 mt-0.5">
              {description}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">
          {children}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-600 mb-1">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[10.5px] text-slate-500 mt-1">{hint}</span>
      )}
    </label>
  );
}

function Switch({
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
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
        />
      </span>
    </label>
  );
}

const QR_MODES: { value: QrContentMode; label: string }[] = [
  { value: 'url', label: 'URL de vérification unique' },
  { value: 'structured', label: 'Résumé structuré (nom, n°, année…)' },
  { value: 'both', label: 'URL + résumé (recommandé)' },
];

const QR_POSITIONS: { value: QrPosition; label: string }[] = [
  { value: 'bottom-left', label: 'Bas gauche' },
  { value: 'bottom-right', label: 'Bas droite' },
  { value: 'beside-signature', label: 'À côté de la signature' },
  { value: 'header', label: 'En-tête' },
  { value: 'footer', label: 'Pied de page' },
];

const QR_SIZES: { value: QrSize; label: string }[] = [
  { value: 'small', label: 'Petit (72 px)' },
  { value: 'medium', label: 'Moyen (96 px)' },
  { value: 'large', label: 'Grand (128 px)' },
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
  { key: 'includeInstitution', label: 'Établissement' },
  { key: 'includeMention', label: 'Mention' },
  { key: 'includeLevel', label: 'Niveau' },
  { key: 'includeYear', label: 'Année' },
  { key: 'includeReference', label: 'Référence / n° inscription' },
];

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

interface TemplateInspectorProps {
  kind: DocumentKind;
  tab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
  template: DocumentTemplate;
  sample: EnrichedInscription;
  patch: (partial: Partial<DocumentTemplate>) => void;
  patchSection: <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) => void;
  replaceTemplate: (next: DocumentTemplate) => void;
  selectedHeaderLineId?: string | null;
  onSelectHeaderLine?: (lineId: string | null) => void;
}

export function CertificateTemplateEditor({
  kind,
  tab,
  onChangeTab,
  template,
  sample,
  patch,
  patchSection,
  replaceTemplate,
  selectedHeaderLineId,
  onSelectHeaderLine,
}: TemplateInspectorProps) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [registry, setRegistry] = useState<CertificateTokenEntry[]>(() =>
    loadCertificateRegistry()
  );

  const layout =
    template.layout ?? DEFAULT_DOCUMENT_TEMPLATES[kind].layout;
  const bodyStyle =
    template.body.style ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;

  const qrPayload = useMemo(
    () =>
      kind === 'certificat'
        ? buildCertificateQrPayload(sample, template)
        : buildDocumentQrPayload(sample, template),
    [kind, sample, template]
  );

  const variables = useMemo(
    () => [
      ...CERTIFICATE_VARIABLES,
      ...template.fields
        .filter((f) => f.custom)
        .map((f) => ({ key: f.id, label: f.label })),
    ],
    [template.fields]
  );

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    const current = template.body.template ?? '';
    if (!el) {
      patchSection('body', { template: `${current}${token}` });
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    patchSection('body', { template: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const readImage = (file: File, apply: (dataUrl: string) => void) => {
    setFieldError('');
    if (file.size > 900_000) {
      setFieldError('Image trop lourde (900 Ko maximum).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const presets = DOCUMENT_THEME_PRESETS.filter((p) => p.kind === kind);

  return (
    <div className="space-y-3">
      {/* Onglets de l'inspecteur */}
      <div
        role="tablist"
        aria-label="Sections du modèle"
        className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
      >
        {INSPECTOR_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChangeTab(item.key)}
              className={`px-1.5 py-2 rounded-md text-[11px] font-medium flex flex-col items-center gap-1 transition-colors whitespace-nowrap ${
                active
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ONGLET 1 · STRUCTURE ------------------------------------------------ */}
      {tab === 'structure' && (
        <div className="space-y-3">
          {kind === 'certificat' && (
            <>
              <EditorSection
                title="Ordre & visibilité des zones"
                description="Réordonnez les blocs du document ou masquez-les en un clic"
                icon={<Layers className="w-4 h-4" />}
              >
                <SectionOrderManager
                  template={template}
                  patchSection={patchSection}
                  onFocusZone={(sec) => {
                    if (sec === 'title' || sec === 'body' || sec === 'reference') {
                      onChangeTab('contenu');
                    } else if (sec === 'signatureQr') {
                      onChangeTab('signature');
                    }
                  }}
                />
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-3">
                  <Switch
                    label="En-tête & logos"
                    checked={template.blocks.header}
                    onChange={(v) => patchSection('blocks', { header: v })}
                  />
                  <Switch
                    label="Filiation (père / mère)"
                    checked={template.blocks.filiation}
                    onChange={(v) => patchSection('blocks', { filiation: v })}
                  />
                  <Switch
                    label="QR code"
                    checked={template.blocks.qr}
                    onChange={(v) => patchSection('blocks', { qr: v })}
                  />
                  <Switch
                    label="Filigrane"
                    checked={template.blocks.watermark}
                    onChange={(v) => patchSection('blocks', { watermark: v })}
                  />
                </div>
              </EditorSection>

              <EditorSection
                title="Blocs libres personnalisés"
                description="Ajoutez des visas, mentions ou paragraphes libres n’importe où"
                icon={<Plus className="w-4 h-4" />}
                defaultOpen={layout.freeZones.length > 0}
              >
                <FreeZonesManager
                  freeZones={layout.freeZones ?? []}
                  onChange={(freeZones) => patchSection('layout', { freeZones })}
                />
              </EditorSection>
            </>
          )}

          {kind === 'carte' && (
            <EditorSection
              title="Mise en forme de la carte"
              description="Disposition photo, bandeau et blocs affichés"
              icon={<Layers className="w-4 h-4" />}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Style du bandeau">
                  <select
                    value={template.card.headerStyle ?? 'solid'}
                    onChange={(e) =>
                      patchSection('card', {
                        headerStyle: e.target.value as CardHeaderStyle,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="solid">Couleur unie</option>
                    <option value="gradient">Dégradé</option>
                    <option value="minimal">Minimaliste (ligne)</option>
                  </select>
                </Field>
                <Field label="Placement QR code">
                  <select
                    value={template.card.qrPlacement ?? 'both'}
                    onChange={(e) =>
                      patchSection('card', {
                        qrPlacement: e.target.value as CardQrPlacement,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="both">Recto &amp; Verso</option>
                    <option value="front">Recto uniquement</option>
                    <option value="back">Verso uniquement</option>
                    <option value="none">Masquer le QR</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Position photo">
                  <select
                    value={template.card.photoPosition ?? 'left'}
                    onChange={(e) =>
                      patchSection('card', {
                        photoPosition: e.target.value as CardPhotoPosition,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="left">À gauche</option>
                    <option value="right">À droite</option>
                  </select>
                </Field>
                <Field label="Forme photo">
                  <select
                    value={template.card.photoShape ?? 'rounded'}
                    onChange={(e) =>
                      patchSection('card', {
                        photoShape: e.target.value as CardPhotoShape,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="rounded">Coins arrondis</option>
                    <option value="rect">Rectangle net</option>
                    <option value="circle">Cercle</option>
                  </select>
                </Field>
              </div>
              <Switch
                label="Afficher la photo de l’étudiant"
                checked={template.card.showPhoto}
                onChange={(v) => patchSection('card', { showPhoto: v })}
              />
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-3">
                {BLOCK_LABELS.filter((b) => b.key !== 'academicTable').map((block) => (
                  <Switch
                    key={block.key}
                    label={block.label}
                    checked={template.blocks[block.key]}
                    onChange={(v) =>
                      patchSection('blocks', {
                        [block.key]: v,
                      } as Partial<DocumentTemplate['blocks']>)
                    }
                  />
                ))}
              </div>
            </EditorSection>
          )}

          <EditorSection
            title="En-tête institutionnel & logos"
            description="Disposition de l’en-tête, textes et images"
            icon={<ImageIcon className="w-4 h-4" />}
            defaultOpen
          >
            {kind === 'certificat' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Disposition de l’en-tête">
                  <select
                    value={layout.headerLayout}
                    onChange={(e) => {
                      const nextMode = e.target.value as HeaderLayoutMode;
                      const currentLines = getResolvedHeaderLines(template.header);
                      const nextAlign: HorizontalAlign =
                        nextMode === 'left' ? 'left' : 'center';
                      const nextLines =
                        nextMode === 'minimal'
                          ? currentLines
                          : currentLines.map((l) => ({ ...l, align: nextAlign }));
                      replaceTemplate({
                        ...template,
                        layout: {
                          ...layout,
                          headerLayout: nextMode,
                        },
                        header: syncHeaderLegacyFields(template.header, nextLines),
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="classic">Classique (logos latéraux)</option>
                    <option value="left">Aligné à gauche</option>
                    <option value="centered">Logos centrés au-dessus</option>
                    <option value="minimal">Compact (1 ligne)</option>
                  </select>
                </Field>
                <div className="flex items-end pb-1">
                  <Switch
                    label="Trait séparateur"
                    checked={layout.showHeaderDivider}
                    onChange={(v) =>
                      patchSection('layout', { showHeaderDivider: v })
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3">
              <Switch
                label="Logo principal"
                checked={template.header.showLogo}
                onChange={(v) => patchSection('header', { showLogo: v })}
              />
              {kind === 'certificat' && (
                <Switch
                  label="Logo de la faculté"
                  checked={template.header.showSecondaryLogo}
                  onChange={(v) =>
                    patchSection('header', { showSecondaryLogo: v })
                  }
                />
              )}
            </div>

            <Field label="Logo principal (URL ou fichier)">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={template.header.logoUrl}
                  onChange={(e) =>
                    patchSection('header', { logoUrl: e.target.value })
                  }
                  className={`${inputClass} font-mono`}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1 shrink-0"
                >
                  <Upload className="w-3 h-3" /> Importer
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      readImage(file, (url) =>
                        patchSection('header', { logoUrl: url, showLogo: true })
                      );
                    e.target.value = '';
                  }}
                />
              </div>
            </Field>

            {kind === 'certificat' && (
              <>
                <Field label="Logo de la faculté (secours si la faculté n’a pas de logo)">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={template.header.secondaryLogoUrl}
                      onChange={(e) =>
                        patchSection('header', {
                          secondaryLogoUrl: e.target.value,
                        })
                      }
                      className={`${inputClass} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => secondaryLogoInputRef.current?.click()}
                      className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1 shrink-0"
                    >
                      <Upload className="w-3 h-3" /> Importer
                    </button>
                    <input
                      ref={secondaryLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          readImage(file, (url) =>
                            patchSection('header', {
                              secondaryLogoUrl: url,
                              showSecondaryLogo: true,
                            })
                          );
                        e.target.value = '';
                      }}
                    />
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Taille logo 1 ({layout.logoSizePx} px)
                    </span>
                    <input
                      type="range"
                      min={36}
                      max={120}
                      value={layout.logoSizePx}
                      onChange={(e) =>
                        patchSection('layout', {
                          logoSizePx: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Taille logo 2 ({layout.secondaryLogoSizePx} px)
                    </span>
                    <input
                      type="range"
                      min={24}
                      max={96}
                      value={layout.secondaryLogoSizePx}
                      onChange={(e) =>
                        patchSection('layout', {
                          secondaryLogoSizePx: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </label>
                </div>
              </>
            )}

            {kind === 'certificat' ? (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {(() => {
                  const lines = getResolvedHeaderLines(template.header);
                  const updateLines = (nextLines: typeof lines) => {
                    patchSection(
                      'header',
                      syncHeaderLegacyFields(template.header, nextLines)
                    );
                  };
                  const moveLine = (idx: number, delta: -1 | 1) => {
                    const target = idx + delta;
                    if (target < 0 || target >= lines.length) return;
                    const copy = [...lines];
                    const [removed] = copy.splice(idx, 1);
                    copy.splice(target, 0, removed);
                    updateLines(copy);
                  };
                  const addLine = () => {
                    const id = `hl_${Date.now().toString(36)}`;
                    const nextLines = [
                      ...lines,
                      {
                        id,
                        label: `Ligne ${lines.length + 1}`,
                        text: 'Nouvelle ligne d’en-tête',
                        fontFamily: 'Arial',
                        fontSize: 11,
                        bold: false,
                        italic: false,
                        underline: false,
                        align:
                          layout.headerLayout === 'left'
                            ? ('left' as const)
                            : ('center' as const),
                        uppercase: false,
                        color: '#334155',
                      },
                    ];
                    updateLines(nextLines);
                    onSelectHeaderLine?.(id);
                  };
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Lignes d’en-tête ({lines.length})
                        </span>
                        <button
                          type="button"
                          onClick={addLine}
                          className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Ajouter une ligne
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {lines.map((line, idx) => {
                          const isSelected = selectedHeaderLineId === line.id;
                          return (
                            <div
                              key={line.id}
                              onClick={() => onSelectHeaderLine?.(line.id)}
                              className={`p-2 rounded-md border transition-colors space-y-1.5 cursor-pointer ${
                                isSelected
                                  ? 'border-emerald-400 bg-emerald-50/50'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10.5px] font-medium text-slate-500 truncate">
                                  {idx + 1}. {line.label || `Ligne ${idx + 1}`} ·{' '}
                                  <span className="font-mono tabular-nums">
                                    {line.fontFamily} {line.fontSize}px
                                  </span>
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveLine(idx, -1);
                                    }}
                                    title="Monter"
                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === lines.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveLine(idx, 1);
                                    }}
                                    title="Descendre"
                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={lines.length <= 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = lines.filter(
                                        (l) => l.id !== line.id
                                      );
                                      updateLines(next);
                                      if (isSelected) {
                                        onSelectHeaderLine?.(
                                          next[Math.max(0, idx - 1)]?.id ?? null
                                        );
                                      }
                                    }}
                                    title="Supprimer"
                                    className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={line.text}
                                onFocus={() => onSelectHeaderLine?.(line.id)}
                                onChange={(e) =>
                                  updateLines(
                                    lines.map((l) =>
                                      l.id === line.id
                                        ? { ...l, text: e.target.value }
                                        : l
                                    )
                                  )
                                }
                                placeholder="Texte de la ligne..."
                                className={inputClass}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Field label="Établissement / Université (bandeau)">
                  <input
                    type="text"
                    value={template.header.line4}
                    onChange={(e) =>
                      patchSection('header', { line4: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </EditorSection>

          {kind === 'certificat' && (
            <EditorSection
              title="Pied de page"
              description="Coordonnées et note affichées en bas (et sous l’en-tête)"
              defaultOpen={false}
            >
              <Switch
                label="Afficher le pied de page"
                checked={template.footer.showFooter}
                onChange={(v) => patchSection('footer', { showFooter: v })}
              />
              <Field label="Adresse">
                <input
                  type="text"
                  value={template.footer.address}
                  onChange={(e) =>
                    patchSection('footer', { address: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Contacts (téléphone, e-mail, site)">
                <input
                  type="text"
                  value={template.footer.contacts}
                  onChange={(e) =>
                    patchSection('footer', { contacts: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Note de bas de page">
                <input
                  type="text"
                  value={template.footer.note}
                  onChange={(e) =>
                    patchSection('footer', { note: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </EditorSection>
          )}
        </div>
      )}

      {/* ONGLET 2 · CONTENU -------------------------------------------------- */}
      {tab === 'contenu' && (
        <div className="space-y-3">
          {kind === 'certificat' && (
            <>
              <EditorSection
                title="Rédaction du corps"
                description="Mode phrase dynamique avec variables {{...}} ou tableau"
                icon={<PenLine className="w-4 h-4" />}
              >
                <Field label="Présentation du corps">
                  <select
                    value={template.body.mode ?? 'phrase'}
                    onChange={(e) =>
                      patchSection('body', {
                        mode: e.target.value === 'table' ? 'table' : 'phrase',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="phrase">Phrase rédigée (aucun tableau)</option>
                    <option value="table">Tableau de données</option>
                  </select>
                </Field>

                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
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

                <textarea
                  ref={bodyRef}
                  rows={8}
                  value={template.body.template}
                  placeholder={DEFAULT_CERTIFICATE_PHRASE}
                  onChange={(e) =>
                    patchSection('body', { template: e.target.value })
                  }
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded bg-white font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {template.body.template.trim().length} caractères
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      patchSection('body', {
                        template: DEFAULT_CERTIFICATE_PHRASE,
                        mode: 'phrase',
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Phrase type
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-medium text-slate-600 mb-1.5">
                    Rendu pour {sample.nom} {sample.prenom}
                  </p>
                  <div
                    className={`border border-slate-200 rounded bg-slate-50 p-3 text-slate-800 whitespace-pre-wrap ${
                      BODY_FONT_CLASS[bodyStyle.fontFamily] ?? 'font-sans'
                    }`}
                    style={{
                      fontSize: bodyStyle.fontSize
                        ? `${bodyStyle.fontSize}px`
                        : '11.5px',
                      fontWeight: bodyStyle.bold ? 700 : undefined,
                      fontStyle: bodyStyle.italic ? 'italic' : undefined,
                      textDecoration: bodyStyle.underline
                        ? 'underline'
                        : undefined,
                      textTransform: bodyStyle.uppercase
                        ? 'uppercase'
                        : undefined,
                      textAlign: bodyStyle.align,
                      lineHeight: bodyStyle.lineHeight || 1.5,
                      tabSize: 4,
                    }}
                  >
                    {renderCertificateBody(
                      template.body.template.trim()
                        ? template.body.template
                        : DEFAULT_CERTIFICATE_PHRASE,
                      buildCertificateVariables(sample, template)
                    ).replace(/\n+$/, '')}
                  </div>
                </div>
              </EditorSection>

              <EditorSection
                title="Titre, référence & mentions"
                description="Personnalisez les titres et le format de référence officielle"
                icon={<Type className="w-4 h-4" />}
              >
                <Field label="Titre du document">
                  <input
                    type="text"
                    value={template.texts.title}
                    onChange={(e) =>
                      patchSection('texts', { title: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Alignement du titre">
                    <select
                      value={layout.titleAlign}
                      onChange={(e) => {
                        const align = e.target.value as HorizontalAlign;
                        patchSection('layout', {
                          titleAlign: align,
                          elementStyles: {
                            ...(layout.elementStyles ?? {}),
                            title: {
                              ...(layout.elementStyles?.title ?? {}),
                              align,
                            },
                          },
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="center">Centré</option>
                      <option value="left">Gauche</option>
                      <option value="right">Droite</option>
                    </select>
                  </Field>
                  <Field label={`Taille titre (${layout.titleSizeEm.toFixed(2)} em)`}>
                    <input
                      type="range"
                      min={1.1}
                      max={2.4}
                      step={0.05}
                      value={layout.titleSizeEm}
                      onChange={(e) =>
                        patchSection('layout', {
                          titleSizeEm: Number(e.target.value),
                          elementStyles: {
                            ...(layout.elementStyles ?? {}),
                            title: {
                              ...(layout.elementStyles?.title ?? {}),
                              fontSize: 0,
                            },
                          },
                        })
                      }
                      className="w-full accent-blue-600 mt-1.5"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-x-3">
                  <Switch
                    label="Souligner le titre"
                    checked={layout.titleUnderline}
                    onChange={(v) =>
                      patchSection('layout', {
                        titleUnderline: v,
                        elementStyles: {
                          ...(layout.elementStyles ?? {}),
                          title: {
                            ...(layout.elementStyles?.title ?? {}),
                            underline: v,
                          },
                        },
                      })
                    }
                  />
                  <Switch
                    label="Titre en majuscules"
                    checked={layout.titleUppercase}
                    onChange={(v) =>
                      patchSection('layout', {
                        titleUppercase: v,
                        elementStyles: {
                          ...(layout.elementStyles ?? {}),
                          title: {
                            ...(layout.elementStyles?.title ?? {}),
                            uppercase: v,
                          },
                        },
                      })
                    }
                  />
                </div>
                <Field
                  label="Gabarit de référence"
                  hint="Variables : {{reference}}, {{matricule}}, {{annee}}, {{numero_certificat}}"
                >
                  <input
                    type="text"
                    value={layout.referenceTemplate}
                    onChange={(e) =>
                      patchSection('layout', {
                        referenceTemplate: e.target.value,
                      })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </Field>
                <Field label="Libellé du matricule">
                  <input
                    type="text"
                    value={layout.matriculeLabel}
                    onChange={(e) =>
                      patchSection('layout', { matriculeLabel: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                {template.body.mode === 'table' && (
                  <>
                    <Field label="Introduction (mode tableau)">
                      <textarea
                        rows={2}
                        value={template.texts.intro}
                        onChange={(e) =>
                          patchSection('texts', { intro: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Formule de clôture (mode tableau)">
                      <textarea
                        rows={2}
                        value={template.texts.closing}
                        onChange={(e) =>
                          patchSection('texts', { closing: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </>
                )}
                <Field label="Mention légale">
                  <textarea
                    rows={2}
                    value={template.texts.legalMention}
                    onChange={(e) =>
                      patchSection('texts', { legalMention: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
              </EditorSection>
            </>
          )}

          {kind === 'carte' && (
            <EditorSection
              title="Textes de la carte étudiant"
              description="Titres, pied de carte, verso et mention légale"
              icon={<Type className="w-4 h-4" />}
            >
              <Field label="Titre du document (bandeau)">
                <input
                  type="text"
                  value={template.texts.title}
                  onChange={(e) =>
                    patchSection('texts', { title: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field
                label="Pied de carte recto (vide = nom de la faculté)"
              >
                <input
                  type="text"
                  value={template.card.footerText ?? ''}
                  placeholder="Ex. Campus Maninday · Toliara"
                  onChange={(e) =>
                    patchSection('card', { footerText: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Texte si aucune photo">
                <input
                  type="text"
                  value={template.card.photoHint}
                  onChange={(e) =>
                    patchSection('card', { photoHint: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Titre du verso">
                <input
                  type="text"
                  value={template.card.backTitle}
                  onChange={(e) =>
                    patchSection('card', { backTitle: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Note du verso">
                <textarea
                  rows={3}
                  value={template.card.backNote}
                  onChange={(e) =>
                    patchSection('card', { backNote: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Mention légale (bas du verso)">
                <textarea
                  rows={2}
                  value={template.texts.legalMention}
                  onChange={(e) =>
                    patchSection('texts', { legalMention: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </EditorSection>
          )}
        </div>
      )}

      {/* ONGLET 3 · CHAMPS --------------------------------------------------- */}
      {tab === 'champs' && (
        <EditorSection
          title={
            kind === 'carte'
              ? 'Champs recto, verso & variables'
              : 'Champs personnalisés & tableau'
          }
          description="Activez, renommez, réordonnez ou créez de nouveaux champs"
          icon={<ListChecks className="w-4 h-4" />}
        >
          <TemplateFieldManager
            kind={kind}
            template={template}
            patch={patch}
            patchSection={patchSection}
          />
        </EditorSection>
      )}

      {/* ONGLET 4 · STYLE ---------------------------------------------------- */}
      {tab === 'style' && (
        <div className="space-y-3">
          <EditorSection
            title="Thèmes rapides"
            description="Appliquez un style prédéfini puis ajustez-le librement"
            icon={<Palette className="w-4 h-4" />}
          >
            <div className="grid grid-cols-1 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const next = mergeDocumentTemplate(kind, {
                      ...template,
                      ...preset.patch,
                      header: template.header,
                      signature: template.signature,
                      footer: template.footer,
                      fields: template.fields,
                      rows: template.rows,
                    });
                    replaceTemplate(next);
                  }}
                  className="w-full text-left px-3 py-2 border border-slate-200 rounded-md hover:border-blue-400 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">
                      {preset.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {preset.description}
                    </p>
                  </div>
                  <span
                    className="w-5 h-5 rounded-full border border-slate-200 shrink-0"
                    style={{
                      backgroundColor:
                        preset.patch.card?.headerColor ||
                        preset.patch.appearance?.accentColor ||
                        '#0f172a',
                    }}
                  />
                </button>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Couleurs & surface">
            <div className="grid grid-cols-2 gap-2">
              <ColorField
                label="Couleur d’accent"
                value={template.appearance.accentColor}
                onChange={(v) =>
                  patchSection('appearance', { accentColor: v })
                }
              />
              <ColorField
                label="Couleur du texte"
                value={template.appearance.textColor}
                onChange={(v) => patchSection('appearance', { textColor: v })}
              />
              <ColorField
                label="Fond du document"
                value={layout.backgroundColor || '#ffffff'}
                onChange={(v) =>
                  patchSection('layout', { backgroundColor: v })
                }
              />
              {kind === 'carte' ? (
                <ColorField
                  label="Couleur du bandeau"
                  value={template.card.headerColor}
                  onChange={(v) => patchSection('card', { headerColor: v })}
                />
              ) : (
                <ColorField
                  label="Trait d’en-tête"
                  value={
                    layout.headerDividerColor ||
                    template.appearance.accentColor
                  }
                  onChange={(v) =>
                    patchSection('layout', { headerDividerColor: v })
                  }
                />
              )}
            </div>
          </EditorSection>

          <EditorSection title="Marges & typographie">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Police globale">
                <select
                  value={template.appearance.fontFamily}
                  onChange={(e) =>
                    patchSection('appearance', {
                      fontFamily: e.target.value as DocumentFontFamily,
                    })
                  }
                  className={inputClass}
                >
                  <option value="sans">Sans serif</option>
                  <option value="display">Titres (display)</option>
                  <option value="mono">Monospace</option>
                </select>
              </Field>
              {kind === 'carte' && (
                <div className="flex items-end pb-1">
                  <Switch
                    label="Coins arrondis"
                    checked={template.card.rounded}
                    onChange={(v) => patchSection('card', { rounded: v })}
                  />
                </div>
              )}
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

            {kind === 'certificat' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Marge interne ({layout.pagePaddingPx} px)
                    </span>
                    <input
                      type="range"
                      min={16}
                      max={64}
                      step={2}
                      value={layout.pagePaddingPx}
                      onChange={(e) =>
                        patchSection('layout', {
                          pagePaddingPx: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Typographie du texte rédigé
                  </p>
                  <BodyTypographyControls
                    value={bodyStyle}
                    compact
                    onChange={(stylePatch) => {
                      const nextBodyStyle = { ...bodyStyle, ...stylePatch };
                      const nextElementBody = {
                        ...(layout.elementStyles?.body ?? {}),
                      };
                      if (stylePatch.fontFamily !== undefined) {
                        nextElementBody.fontFamily =
                          stylePatch.fontFamily === 'serif'
                            ? 'Georgia'
                            : stylePatch.fontFamily === 'mono'
                              ? 'JetBrains Mono'
                              : stylePatch.fontFamily === 'display'
                                ? 'Plus Jakarta Sans'
                                : 'Public Sans';
                      }
                      if (stylePatch.fontSize !== undefined) {
                        nextElementBody.fontSize = stylePatch.fontSize;
                      }
                      if (stylePatch.bold !== undefined) {
                        nextElementBody.bold = stylePatch.bold;
                      }
                      if (stylePatch.italic !== undefined) {
                        nextElementBody.italic = stylePatch.italic;
                      }
                      if (stylePatch.underline !== undefined) {
                        nextElementBody.underline = stylePatch.underline;
                      }
                      if (stylePatch.uppercase !== undefined) {
                        nextElementBody.uppercase = stylePatch.uppercase;
                      }
                      if (stylePatch.align !== undefined) {
                        nextElementBody.align = stylePatch.align;
                      }
                      replaceTemplate({
                        ...template,
                        body: { ...template.body, style: nextBodyStyle },
                        layout: {
                          ...layout,
                          elementStyles: {
                            ...(layout.elementStyles ?? {}),
                            body: nextElementBody,
                          },
                        },
                      });
                    }}
                  />
                </div>
              </>
            )}

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Switch
                label="Afficher le filigrane"
                checked={template.blocks.watermark}
                onChange={(v) => patchSection('blocks', { watermark: v })}
              />
              {template.blocks.watermark && (
                <>
                  <Field label="Texte du filigrane">
                    <input
                      type="text"
                      value={template.appearance.watermarkText}
                      onChange={(e) =>
                        patchSection('appearance', {
                          watermarkText: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Opacité ({Math.round(template.appearance.watermarkOpacity * 100)} %)
                    </span>
                    <input
                      type="range"
                      min={2}
                      max={30}
                      value={Math.round(
                        template.appearance.watermarkOpacity * 100
                      )}
                      onChange={(e) =>
                        patchSection('appearance', {
                          watermarkOpacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </label>
                </>
              )}
            </div>
          </EditorSection>
        </div>
      )}

      {/* ONGLET 5 · SIGNATURE, QR & IMPRESSION ------------------------------- */}
      {tab === 'signature' && (
        <div className="space-y-3">
          <EditorSection
            title="Signature & cachet"
            description="Lieu, date, signataire et image de cachet"
            icon={<Users className="w-4 h-4" />}
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Lieu">
                <input
                  type="text"
                  value={template.signature.place}
                  onChange={(e) =>
                    patchSection('signature', { place: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Alignement (certificat)">
                <select
                  value={layout.signatureAlign}
                  onChange={(e) => {
                    const align = e.target.value as HorizontalAlign;
                    patchSection('layout', {
                      signatureAlign: align,
                      elementStyles: {
                        ...(layout.elementStyles ?? {}),
                        signature: {
                          ...(layout.elementStyles?.signature ?? {}),
                          align,
                          offsetX: 0,
                        },
                      },
                    });
                  }}
                  className={inputClass}
                >
                  <option value="right">À droite</option>
                  <option value="center">Centré</option>
                  <option value="left">À gauche</option>
                </select>
              </Field>
            </div>
            {kind === 'certificat' &&
              ((layout.elementStyles?.signature?.offsetX ?? 0) !== 0 ||
                (layout.elementStyles?.signature?.offsetY ?? 0) !== 0) && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                  <span className="font-mono tabular-nums">
                    Décalage : X {layout.elementStyles?.signature?.offsetX ?? 0}px · Y{' '}
                    {layout.elementStyles?.signature?.offsetY ?? 0}px
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      patchSection('layout', {
                        elementStyles: {
                          ...(layout.elementStyles ?? {}),
                          signature: {
                            ...(layout.elementStyles?.signature ?? {}),
                            offsetX: 0,
                            offsetY: 0,
                          },
                        },
                      })
                    }
                    className="font-medium underline hover:text-emerald-700"
                  >
                    Recentrer
                  </button>
                </div>
              )}
            {kind === 'certificat' && (
              <Field
                label="Phrase de date"
                hint="Variables : {{lieu}}, {{date}}"
              >
                <input
                  type="text"
                  value={layout.datePhraseTemplate}
                  onChange={(e) =>
                    patchSection('layout', {
                      datePhraseTemplate: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="Fonction du signataire">
              <input
                type="text"
                value={template.signature.title}
                onChange={(e) =>
                  patchSection('signature', { title: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Nom du signataire (optionnel)">
              <input
                type="text"
                value={template.signature.name}
                onChange={(e) =>
                  patchSection('signature', { name: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-x-3">
              <Switch
                label="Afficher la date"
                checked={template.signature.showDate}
                onChange={(v) => patchSection('signature', { showDate: v })}
              />
              {kind === 'certificat' && (
                <Switch
                  label="Signature / cachet image"
                  checked={template.signature.showImage}
                  onChange={(v) => patchSection('signature', { showImage: v })}
                />
              )}
            </div>
            {kind === 'certificat' && (
              <>
                <Field label="Image de signature ou cachet">
                  <div className="flex items-center gap-2">
                    {template.signature.imageUrl ? (
                      <img
                        src={template.signature.imageUrl}
                        alt="Signature"
                        className="h-10 w-20 object-contain border border-slate-200 rounded bg-white"
                      />
                    ) : (
                      <span className="h-10 w-20 border border-dashed border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400">
                        Aucune
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => signatureInputRef.current?.click()}
                      className="px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Importer
                    </button>
                    {template.signature.imageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          patchSection('signature', { imageUrl: '' })
                        }
                        className="px-2 py-1.5 text-[11px] font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50"
                      >
                        Retirer
                      </button>
                    )}
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          readImage(file, (url) =>
                            patchSection('signature', {
                              imageUrl: url,
                              showImage: true,
                            })
                          );
                        e.target.value = '';
                      }}
                    />
                  </div>
                </Field>
                {template.signature.imageUrl && (
                  <label className="block">
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">
                      Hauteur de la signature ({layout.signatureImageHeightPx} px)
                    </span>
                    <input
                      type="range"
                      min={28}
                      max={110}
                      value={layout.signatureImageHeightPx}
                      onChange={(e) =>
                        patchSection('layout', {
                          signatureImageHeightPx: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </label>
                )}
              </>
            )}
          </EditorSection>

          <EditorSection
            title="QR code de vérification"
            description="Contenu encodé, position et taille"
            icon={<QrCode className="w-4 h-4" />}
          >
            <Switch
              label="Activer le QR code"
              checked={template.qr.enabled}
              onChange={(v) => patchSection('qr', { enabled: v })}
            />
            {kind === 'certificat' ? (
              <>
                <Field label="Contenu encodé">
                  <select
                    value={template.qr.mode}
                    onChange={(e) =>
                      patchSection('qr', {
                        mode: e.target.value as QrContentMode,
                      })
                    }
                    className={inputClass}
                  >
                    {QR_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Gabarit d’URL de vérification"
                  hint="Variables : {{token}}, {{numero_certificat}}"
                >
                  <input
                    type="text"
                    value={template.qr.urlTemplate}
                    onChange={(e) =>
                      patchSection('qr', { urlTemplate: e.target.value })
                    }
                    disabled={template.qr.mode === 'structured'}
                    className={`${inputClass} font-mono disabled:opacity-50`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Position">
                    <select
                      value={template.qr.position}
                      onChange={(e) =>
                        patchSection('qr', {
                          position: e.target.value as QrPosition,
                        })
                      }
                      className={inputClass}
                    >
                      {QR_POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Taille">
                    <select
                      value={template.qr.preset}
                      onChange={(e) => {
                        const preset = e.target.value as QrSize;
                        patchSection('qr', {
                          preset,
                          size: QR_PIXEL_SIZES[preset],
                        });
                      }}
                      className={inputClass}
                    >
                      {QR_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Libellé sous le QR code">
                  <input
                    type="text"
                    value={template.qr.label}
                    onChange={(e) =>
                      patchSection('qr', { label: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Switch
                  label="Afficher le libellé"
                  checked={template.qr.showLabel}
                  onChange={(v) => patchSection('qr', { showLabel: v })}
                />
              </>
            ) : (
              <>
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-600 mb-1">
                    Taille ({template.qr.size} px)
                  </span>
                  <input
                    type="range"
                    min={48}
                    max={140}
                    step={4}
                    value={template.qr.size}
                    onChange={(e) =>
                      patchSection('qr', { size: Number(e.target.value) })
                    }
                    className="w-full accent-blue-600"
                  />
                </label>
                <Field label="En-tête du contenu">
                  <input
                    type="text"
                    value={template.qr.header}
                    onChange={(e) =>
                      patchSection('qr', { header: e.target.value })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-x-3">
                  {QR_FIELD_LABELS.map((field) => (
                    <Switch
                      key={field.key}
                      label={field.label}
                      checked={template.qr[field.key]}
                      onChange={(v) =>
                        patchSection('qr', {
                          [field.key]: v,
                        } as Partial<DocumentTemplate['qr']>)
                      }
                    />
                  ))}
                </div>
              </>
            )}

            <div>
              <p className="text-[11px] font-medium text-slate-600 mb-1">
                Aperçu du contenu encodé
              </p>
              <pre className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-600 whitespace-pre-wrap max-h-28 overflow-auto">
                {qrPayload || '—'}
              </pre>
            </div>
          </EditorSection>

          <EditorSection
            title="Impression & format"
            icon={<Printer className="w-4 h-4" />}
            defaultOpen={false}
          >
            {kind === 'certificat' ? (
              <>
                <p className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
                  <span className="font-semibold">Automatique :</span> 1 destinataire = 1 certificat par page A4 · plusieurs destinataires = 2 par page A4
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Marges d’impression (mm)">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={template.print.marginMm}
                      onChange={(e) =>
                        patchSection('print', {
                          marginMm: Number(e.target.value) || 0,
                        })
                      }
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                </div>
                <Switch
                  label="Ligne de découpe en pointillés"
                  checked={template.print.cutLine}
                  onChange={(v) => patchSection('print', { cutLine: v })}
                />
              </>
            ) : (
              <>
                <Field label="Impression recto / verso">
                  <select
                    value={template.card.printMode}
                    onChange={(e) =>
                      patchSection('card', {
                        printMode: e.target.value === 'side' ? 'side' : 'fold',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="fold">Côte à côte (feuille pliée en 2)</option>
                    <option value="side">Recto puis verso (2 pages)</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <Switch
                    label="Afficher la validité"
                    checked={template.card.showValidity}
                    onChange={(v) =>
                      patchSection('card', { showValidity: v })
                    }
                  />
                  <Field label="Durée (années)">
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
                      className={inputClass}
                    />
                  </Field>
                </div>
              </>
            )}
          </EditorSection>

          {kind === 'certificat' && (
            <EditorSection
              title={`Certificats émis (${registry.length})`}
              description="Jetons et numéros enregistrés dans ce navigateur"
              defaultOpen={false}
            >
              {registry.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Aucun certificat émis pour le moment.
                </p>
              ) : (
                <>
                  <div className="max-h-48 overflow-auto border border-slate-200 rounded">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="text-left text-slate-500">
                          <th className="px-2 py-1.5 font-medium">Étudiant</th>
                          <th className="px-2 py-1.5 font-medium">N° certificat</th>
                          <th className="px-2 py-1.5 font-medium">Jeton</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registry.slice(0, 50).map((entry) => (
                          <tr
                            key={entry.token}
                            className="border-t border-slate-100"
                          >
                            <td className="px-2 py-1.5">
                              {entry.nom} {entry.prenom}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {entry.numeroCertificat}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {entry.token}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearCertificateRegistry();
                      setRegistry([]);
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Vider l’historique local
                  </button>
                </>
              )}
            </EditorSection>
          )}
        </div>
      )}

      {fieldError && (
        <div className="px-3 py-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 shrink-0" />
          {fieldError}
        </div>
      )}
    </div>
  );
}
