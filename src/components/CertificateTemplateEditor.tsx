import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Plus,
  QrCode,
  Trash2,
  Type,
  Upload,
  Users,
} from 'lucide-react';
import {
  CERTIFICATE_VARIABLES,
  QR_PIXEL_SIZES,
  buildCertificateQrPayload,
  clearCertificateRegistry,
  getSampleInscription,
  loadCertificateRegistry,
} from '../services/database';
import {
  CertificateTokenEntry,
  DocumentTemplate,
  FieldDefinition,
  FieldInputType,
  QrContentMode,
  QrPosition,
  QrSize,
  ScolariteDatabase,
} from '../types/scolarite';

/* ------------------------------- primitives -------------------------------- */

export function EditorSection({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
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
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-slate-50"
        aria-expanded={open}
      >
        {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
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
      {open && <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">{children}</div>}
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
      <span className="block text-[11px] font-medium text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10.5px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

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
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

const INPUT_TYPE_LABELS: Record<FieldInputType, string> = {
  text: 'Texte court',
  textarea: 'Texte long',
  date: 'Date',
  number: 'Nombre',
  select: 'Liste déroulante',
};

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

/* --------------------------------- editor ---------------------------------- */

interface CertificateTemplateEditorProps {
  db: ScolariteDatabase;
  template: DocumentTemplate;
  patch: (partial: Partial<DocumentTemplate>) => void;
  patchSection: <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) => void;
}

export function CertificateTemplateEditor({
  db,
  template,
  patch,
  patchSection,
}: CertificateTemplateEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldInputType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const [registry, setRegistry] = useState<CertificateTokenEntry[]>(() =>
    loadCertificateRegistry()
  );

  const sample = useMemo(() => getSampleInscription(db), [db]);
  const qrPayload = useMemo(
    () => buildCertificateQrPayload(sample, template),
    [sample, template]
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

  const setFields = (fields: FieldDefinition[]) => patch({ fields });

  const updateField = (id: string, partial: Partial<FieldDefinition>) =>
    setFields(template.fields.map((f) => (f.id === id ? { ...f, ...partial } : f)));

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= template.fields.length) return;
    const fields = [...template.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    setFields(fields);
  };

  const slugify = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'champ';

  const addCustomField = () => {
    const label = newFieldLabel.trim();
    if (!label) {
      setFieldError('Renseignez un libellé pour le champ personnalisé.');
      return;
    }
    let id = slugify(label);
    let suffix = 2;
    while (template.fields.some((f) => f.id === id)) {
      id = `${slugify(label)}_${suffix++}`;
    }
    const field: FieldDefinition = {
      id,
      label,
      type: newFieldType,
      enabled: true,
      required: false,
      custom: true,
      uppercase: false,
      dateFormat: 'JJ/MM/AAAA',
      mask: '',
      options:
        newFieldType === 'select'
          ? newFieldOptions
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
      help: '',
      fullWidth: newFieldType === 'textarea',
    };
    setFields([...template.fields, field]);
    setNewFieldLabel('');
    setNewFieldOptions('');
    setNewFieldType('text');
    setFieldError('');
    setExpandedField(id);
  };

  const removeField = (id: string) => {
    setFields(template.fields.filter((f) => f.id !== id));
    if (expandedField === id) setExpandedField(null);
  };

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
    if (file.size > 900_000) {
      setFieldError('Image trop lourde (900 Ko maximum).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* 1 · Champs du formulaire ------------------------------------------- */}
      <EditorSection
        title="Champs du formulaire & du certificat"
        description="Activez, renommez et ordonnez les champs · ajoutez des champs personnalisés"
        icon={<Type className="w-4 h-4" />}
        defaultOpen
      >
        <div className="space-y-2">
          {template.fields.map((field, index) => {
            const expanded = expandedField === field.id;
            return (
              <div
                key={field.id}
                className={`border rounded-md ${
                  field.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      aria-label={`Monter ${field.label}`}
                      className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, 1)}
                      disabled={index === template.fields.length - 1}
                      aria-label={`Descendre ${field.label}`}
                      className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    aria-label={`Activer ${field.label}`}
                    onChange={(e) => updateField(field.id, { enabled: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 shrink-0"
                  />
                  <input
                    type="text"
                    value={field.label}
                    aria-label="Libellé du champ"
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                  />
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      field.custom
                        ? 'bg-violet-50 text-violet-700 border border-violet-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {field.custom ? `{{${field.id}}}` : field.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedField(expanded ? null : field.id)}
                    className="p-1 text-slate-400 hover:text-blue-600 shrink-0"
                    aria-label={`Options de ${field.label}`}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {field.custom && (
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="p-1 text-slate-400 hover:text-red-600 shrink-0"
                      aria-label={`Supprimer ${field.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Type de saisie">
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(field.id, {
                              type: e.target.value as FieldInputType,
                            })
                          }
                          className={inputClass}
                        >
                          {(Object.keys(INPUT_TYPE_LABELS) as FieldInputType[]).map((key) => (
                            <option key={key} value={key}>
                              {INPUT_TYPE_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Affichage de la date">
                        <select
                          value={field.dateFormat}
                          onChange={(e) =>
                            updateField(field.id, {
                              dateFormat: e.target.value === 'AAAA-MM-JJ' ? 'AAAA-MM-JJ' : 'JJ/MM/AAAA',
                            })
                          }
                          disabled={field.type !== 'date'}
                          className={`${inputClass} disabled:opacity-50`}
                        >
                          <option value="JJ/MM/AAAA">JJ/MM/AAAA</option>
                          <option value="AAAA-MM-JJ">AAAA-MM-JJ</option>
                        </select>
                      </Field>
                      <Field label="Masque de saisie (9 = chiffre)">
                        <input
                          type="text"
                          value={field.mask}
                          placeholder="Ex : 999 999 999 999"
                          onChange={(e) => updateField(field.id, { mask: e.target.value })}
                          className={`${inputClass} font-mono`}
                        />
                      </Field>
                      <Field label="Aide affichée dans le formulaire">
                        <input
                          type="text"
                          value={field.help}
                          onChange={(e) => updateField(field.id, { help: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    {field.type === 'select' && (
                      <Field label="Options (séparées par des virgules)">
                        <input
                          type="text"
                          value={field.options.join(', ')}
                          onChange={(e) =>
                            updateField(field.id, {
                              options: e.target.value
                                .split(',')
                                .map((o) => o.trim())
                                .filter(Boolean),
                            })
                          }
                          className={inputClass}
                        />
                      </Field>
                    )}
                    <div className="grid grid-cols-2 gap-x-3">
                      <Switch
                        label="Obligatoire"
                        checked={field.required}
                        onChange={(v) => updateField(field.id, { required: v })}
                      />
                      <Switch
                        label="Majuscules"
                        checked={field.uppercase}
                        onChange={(v) => updateField(field.id, { uppercase: v })}
                      />
                      <Switch
                        label="Pleine largeur"
                        checked={field.fullWidth}
                        onChange={(v) => updateField(field.id, { fullWidth: v })}
                      />
                      <Switch
                        label="Affiché sur le certificat"
                        checked={field.enabled}
                        onChange={(v) => updateField(field.id, { enabled: v })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 p-3 border border-dashed border-violet-300 bg-violet-50/50 rounded-md space-y-2">
          <p className="text-[11px] font-semibold text-violet-900">
            Ajouter un champ personnalisé
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="Libellé (ex : Numéro de table)"
              className={inputClass}
            />
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as FieldInputType)}
              className={inputClass}
            >
              {(Object.keys(INPUT_TYPE_LABELS) as FieldInputType[]).map((key) => (
                <option key={key} value={key}>
                  {INPUT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          {newFieldType === 'select' && (
            <input
              type="text"
              value={newFieldOptions}
              onChange={(e) => setNewFieldOptions(e.target.value)}
              placeholder="Options séparées par des virgules"
              className={inputClass}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-red-700">{fieldError}</span>
            <button
              type="button"
              onClick={addCustomField}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-md hover:bg-violet-700 inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter le champ
            </button>
          </div>
        </div>
      </EditorSection>

      {/* 2 · Corps du document ---------------------------------------------- */}
      <EditorSection
        title="Corps du certificat (variables)"
        description="Cliquez sur une variable pour l’insérer dans le texte"
        icon={<Type className="w-4 h-4" />}
      >
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
          onChange={(e) => patchSection('body', { template: e.target.value })}
          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded bg-white font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        <Field label="Titre du document">
          <input
            type="text"
            value={template.texts.title}
            onChange={(e) => patchSection('texts', { title: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Mention légale">
          <textarea
            rows={2}
            value={template.texts.legalMention}
            onChange={(e) => patchSection('texts', { legalMention: e.target.value })}
            className={inputClass}
          />
        </Field>
      </EditorSection>

      {/* 3 · En-tête & pied de page ----------------------------------------- */}
      <EditorSection
        title="En-tête & pied de page"
        description="Établissement, devise, logo, adresse et coordonnées"
        icon={<ImageIcon className="w-4 h-4" />}
      >
        <div className="grid grid-cols-2 gap-x-3">
          <Switch
            label="Logo principal"
            checked={template.header.showLogo}
            onChange={(v) => patchSection('header', { showLogo: v })}
          />
          <Switch
            label="Logo secondaire"
            checked={template.header.showSecondaryLogo}
            onChange={(v) => patchSection('header', { showSecondaryLogo: v })}
          />
        </div>
        <Field label="Logo principal (URL ou fichier importé)">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={template.header.logoUrl}
              onChange={(e) => patchSection('header', { logoUrl: e.target.value })}
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1 shrink-0"
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
                if (file) readImage(file, (url) => patchSection('header', { logoUrl: url, showLogo: true }));
                e.target.value = '';
              }}
            />
          </div>
        </Field>
        <Field label="Logo secondaire (URL)">
          <input
            type="text"
            value={template.header.secondaryLogoUrl}
            onChange={(e) => patchSection('header', { secondaryLogoUrl: e.target.value })}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <div className="grid grid-cols-1 gap-2">
          <Field label="Ligne 1 · République">
            <input
              type="text"
              value={template.header.line1}
              onChange={(e) => patchSection('header', { line1: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Ligne 2 · Devise">
            <input
              type="text"
              value={template.header.line2}
              onChange={(e) => patchSection('header', { line2: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Ligne 3 · Ministère">
            <input
              type="text"
              value={template.header.line3}
              onChange={(e) => patchSection('header', { line3: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Ligne 4 · Université">
            <input
              type="text"
              value={template.header.line4}
              onChange={(e) => patchSection('header', { line4: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Ligne 5 · Direction / service">
            <input
              type="text"
              value={template.header.line5}
              onChange={(e) => patchSection('header', { line5: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <Switch
            label="Afficher le pied de page"
            checked={template.footer.showFooter}
            onChange={(v) => patchSection('footer', { showFooter: v })}
          />
          <Field label="Adresse">
            <input
              type="text"
              value={template.footer.address}
              onChange={(e) => patchSection('footer', { address: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Coordonnées (téléphone · e-mail · site)">
            <input
              type="text"
              value={template.footer.contacts}
              onChange={(e) => patchSection('footer', { contacts: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Note de bas de page">
            <input
              type="text"
              value={template.footer.note}
              onChange={(e) => patchSection('footer', { note: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </EditorSection>

      {/* 4 · Signature -------------------------------------------------------- */}
      <EditorSection
        title="Signature & cachet"
        description="Lieu, qualité du signataire et image de signature"
        icon={<Users className="w-4 h-4" />}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lieu">
            <input
              type="text"
              value={template.signature.place}
              onChange={(e) => patchSection('signature', { place: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Titre du signataire">
            <input
              type="text"
              value={template.signature.title}
              onChange={(e) => patchSection('signature', { title: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Nom du signataire (optionnel)">
          <input
            type="text"
            value={template.signature.name}
            onChange={(e) => patchSection('signature', { name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-x-3">
          <Switch
            label="Afficher la date"
            checked={template.signature.showDate}
            onChange={(v) => patchSection('signature', { showDate: v })}
          />
          <Switch
            label="Afficher la signature / cachet"
            checked={template.signature.showImage}
            onChange={(v) => patchSection('signature', { showImage: v })}
          />
        </div>
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
                onClick={() => patchSection('signature', { imageUrl: '' })}
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
                    patchSection('signature', { imageUrl: url, showImage: true })
                  );
                e.target.value = '';
              }}
            />
          </div>
        </Field>
      </EditorSection>

      {/* 5 · QR code ---------------------------------------------------------- */}
      <EditorSection
        title="QR code de vérification"
        description="Contenu, position, taille et jeton unique par certificat"
        icon={<QrCode className="w-4 h-4" />}
      >
        <Switch
          label="Activer le QR code"
          checked={template.qr.enabled}
          onChange={(v) => patchSection('qr', { enabled: v })}
        />
        <Field label="Contenu encodé">
          <select
            value={template.qr.mode}
            onChange={(e) => patchSection('qr', { mode: e.target.value as QrContentMode })}
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
          hint="Variables disponibles : {{token}} et {{numero_certificat}}"
        >
          <input
            type="text"
            value={template.qr.urlTemplate}
            onChange={(e) => patchSection('qr', { urlTemplate: e.target.value })}
            disabled={template.qr.mode === 'structured'}
            className={`${inputClass} font-mono disabled:opacity-50`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Position">
            <select
              value={template.qr.position}
              onChange={(e) => patchSection('qr', { position: e.target.value as QrPosition })}
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
                patchSection('qr', { preset, size: QR_PIXEL_SIZES[preset] });
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
            onChange={(e) => patchSection('qr', { label: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Switch
          label="Afficher le libellé"
          checked={template.qr.showLabel}
          onChange={(v) => patchSection('qr', { showLabel: v })}
        />
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-medium text-slate-600 mb-1">
            Champs inclus dans le résumé structuré
          </p>
          <div className="grid grid-cols-2 gap-x-3">
            {(
              [
                ['includeName', 'Nom et prénom(s)'],
                ['includeInstitution', 'Établissement'],
                ['includeMention', 'Mention'],
                ['includeLevel', 'Niveau'],
                ['includeYear', 'Année'],
                ['includeReference', 'Référence / n° inscription'],
              ] as const
            ).map(([key, label]) => (
              <Switch
                key={key}
                label={label}
                checked={template.qr[key]}
                onChange={(v) => patchSection('qr', { [key]: v } as Partial<DocumentTemplate['qr']>)}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-600 mb-1">
            Aperçu du contenu encodé
          </p>
          <pre className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-600 whitespace-pre-wrap max-h-32 overflow-auto">
            {qrPayload || '—'}
          </pre>
        </div>
      </EditorSection>

      {/* 6 · Impression ------------------------------------------------------- */}
      <EditorSection
        title="Mise en page d’impression"
        description="1 ou 2 certificats par feuille A4, marges et ligne de découpe"
        icon={<QrCode className="w-4 h-4" />}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Certificats par feuille">
            <select
              value={template.print.perSheet}
              onChange={(e) =>
                patchSection('print', { perSheet: Number(e.target.value) === 2 ? 2 : 1 })
              }
              className={inputClass}
            >
              <option value={1}>1 · A4 complet</option>
              <option value={2}>2 · A5 (souche / archive)</option>
            </select>
          </Field>
          <Field label="Orientation">
            <select
              value={template.print.orientation}
              onChange={(e) =>
                patchSection('print', {
                  orientation: e.target.value === 'landscape' ? 'landscape' : 'portrait',
                })
              }
              className={inputClass}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Paysage</option>
            </select>
          </Field>
          {template.print.perSheet === 2 && (
            <Field label="Disposition">
              <select
                value={template.print.twoUpLayout}
                onChange={(e) =>
                  patchSection('print', {
                    twoUpLayout: e.target.value === 'stacked' ? 'stacked' : 'side-by-side',
                  })
                }
                className={inputClass}
              >
                <option value="side-by-side">Côte à côte</option>
                <option value="stacked">Empilés</option>
              </select>
            </Field>
          )}
          <Field label="Marges d’impression (mm)">
            <input
              type="number"
              min={0}
              max={30}
              value={template.print.marginMm}
              onChange={(e) =>
                patchSection('print', { marginMm: Number(e.target.value) || 0 })
              }
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>
        {template.print.perSheet === 2 && (
          <>
            <Switch
              label="Dupliquer le même élève (souche / archive)"
              checked={template.print.duplicateSame}
              onChange={(v) => patchSection('print', { duplicateSame: v })}
              hint="Décoché : deux élèves consécutifs sur la même feuille"
            />
            <Switch
              label="Ligne de découpe en pointillés"
              checked={template.print.cutLine}
              onChange={(v) => patchSection('print', { cutLine: v })}
            />
          </>
        )}
        <p className="text-[11px] text-slate-500">
          Le QR code est redimensionné automatiquement en mode 2 par feuille afin
          de rester scannable.
        </p>
      </EditorSection>

      {/* 7 · Historique ------------------------------------------------------- */}
      <EditorSection
        title={`Certificats émis (${registry.length})`}
        description="Jetons et numéros enregistrés dans ce navigateur"
        icon={<QrCode className="w-4 h-4" />}
      >
        {registry.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Aucun certificat émis pour le moment. Un jeton est créé à
            l’enregistrement d’une inscription ou à l’impression d’un certificat.
          </p>
        ) : (
          <>
            <div className="max-h-56 overflow-auto border border-slate-200 rounded">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1.5 font-medium">Étudiant</th>
                    <th className="px-2 py-1.5 font-medium">N° certificat</th>
                    <th className="px-2 py-1.5 font-medium">Jeton</th>
                    <th className="px-2 py-1.5 font-medium">Émis le</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.slice(0, 50).map((entry) => (
                    <tr key={entry.token} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        {entry.nom} {entry.prenom}
                        <span className="block text-[10px] text-slate-500">
                          {entry.niveau} · {entry.annee}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono">{entry.numeroCertificat}</td>
                      <td className="px-2 py-1.5 font-mono">{entry.token}</td>
                      <td className="px-2 py-1.5 text-slate-500">
                        {new Date(entry.issuedAt).toLocaleString('fr-FR')}
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
        <p className="text-[11px] text-slate-500">
          Les certificats non imprimés ne sont pas dans cet historique ; utilisez
          « Imprimer » depuis la page Certificats pour les enregistrer.
        </p>
      </EditorSection>

      {fieldError && (
        <div className="px-3 py-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded">
          {fieldError}
        </div>
      )}
    </div>
  );
}
