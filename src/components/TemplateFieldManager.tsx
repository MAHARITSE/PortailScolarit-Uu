import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CARD_FRONT_FIELD_OPTIONS,
  DEFAULT_SECTION_ORDER,
} from '../services/database';
import {
  CertificateSectionKey,
  DocumentFreeZone,
  DocumentKind,
  DocumentTemplate,
  DocumentTemplateRow,
  FieldDefinition,
  FieldInputType,
  HorizontalAlign,
} from '../types/scolarite';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

const SECTION_META: Record<
  CertificateSectionKey,
  { label: string; blockKey?: keyof DocumentTemplate['blocks'] }
> = {
  reference: { label: 'Référence & Matricule', blockKey: 'reference' },
  title: { label: 'Titre du document', blockKey: 'title' },
  body: { label: 'Corps rédigé / Tableau', blockKey: 'identity' },
  signatureQr: { label: 'Signature & QR Code', blockKey: 'signature' },
  footer: { label: 'Pied de page (adresse / contacts)' },
  legalMention: { label: 'Mention légale', blockKey: 'legalMention' },
};

function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= list.length) return list;
  const copy = [...list];
  const [removed] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, removed);
  return copy;
}

export function SectionOrderManager({
  template,
  patchSection,
  onFocusZone,
}: {
  template: DocumentTemplate;
  patchSection: <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) => void;
  onFocusZone?: (section: CertificateSectionKey) => void;
}) {
  const order =
    template.layout?.sectionOrder?.length > 0
      ? template.layout.sectionOrder
      : DEFAULT_SECTION_ORDER;

  const isSectionVisible = (key: CertificateSectionKey): boolean => {
    if (key === 'footer') return template.footer.showFooter;
    if (key === 'signatureQr') {
      return template.blocks.signature || (template.blocks.qr && template.qr.enabled);
    }
    const blockKey = SECTION_META[key]?.blockKey;
    return blockKey ? template.blocks[blockKey] : true;
  };

  const toggleSection = (key: CertificateSectionKey) => {
    if (key === 'footer') {
      patchSection('footer', { showFooter: !template.footer.showFooter });
      return;
    }
    if (key === 'signatureQr') {
      const next = !template.blocks.signature;
      patchSection('blocks', { signature: next });
      return;
    }
    const blockKey = SECTION_META[key]?.blockKey;
    if (blockKey) {
      patchSection('blocks', { [blockKey]: !template.blocks[blockKey] });
    }
  };

  return (
    <div className="space-y-1.5">
      {order.map((secKey, idx) => {
        const meta = SECTION_META[secKey];
        if (!meta) return null;
        const visible = isSectionVisible(secKey);
        return (
          <div
            key={secKey}
            className="flex items-center gap-2 px-2.5 py-2 border border-slate-200 rounded-md bg-white"
          >
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-4">
              {idx + 1}.
            </span>
            <button
              type="button"
              onClick={() => onFocusZone?.(secKey)}
              className={`flex-1 min-w-0 text-left text-xs font-medium truncate hover:text-blue-700 ${
                visible ? 'text-slate-800' : 'text-slate-400 line-through'
              }`}
            >
              {meta.label}
            </button>
            <button
              type="button"
              onClick={() => toggleSection(secKey)}
              title={visible ? 'Masquer cette zone' : 'Afficher cette zone'}
              className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              {visible ? (
                <Eye className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
            <button
              type="button"
              disabled={idx === 0}
              onClick={() =>
                patchSection('layout', {
                  sectionOrder: moveItem(order, idx, -1),
                })
              }
              title="Monter"
              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === order.length - 1}
              onClick={() =>
                patchSection('layout', {
                  sectionOrder: moveItem(order, idx, 1),
                })
              }
              title="Descendre"
              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FreeZonesManager({
  freeZones,
  onChange,
}: {
  freeZones: DocumentFreeZone[];
  onChange: (next: DocumentFreeZone[]) => void;
}) {
  const addZone = () => {
    const id = `zone_${Date.now().toString(36)}`;
    onChange([
      ...freeZones,
      {
        id,
        label: `Bloc libre ${freeZones.length + 1}`,
        text: 'Mention complémentaire : {{annee_scolaire}}',
        position: 'bottom',
        align: 'left',
        enabled: true,
        bold: false,
        italic: false,
        uppercase: false,
        fontSize: 0,
        boxed: false,
      },
    ]);
  };

  const updateZone = (id: string, patch: Partial<DocumentFreeZone>) => {
    onChange(freeZones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  };

  return (
    <div className="space-y-2.5">
      {freeZones.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Ajoutez des zones de texte libres (visa, observation, mention facultative) avec variables {'{{...}}'}.
        </p>
      ) : (
        freeZones.map((zone) => (
          <div
            key={zone.id}
            className="p-2.5 border border-slate-200 rounded-md bg-slate-50/70 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={zone.enabled}
                onChange={(e) => updateZone(zone.id, { enabled: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <input
                type="text"
                value={zone.label}
                onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                className="flex-1 min-w-0 px-2 py-1 text-xs font-medium border border-slate-300 rounded bg-white"
              />
              <button
                type="button"
                onClick={() => onChange(freeZones.filter((z) => z.id !== zone.id))}
                title="Supprimer ce bloc"
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              rows={2}
              value={zone.text}
              onChange={(e) => updateZone(zone.id, { text: e.target.value })}
              placeholder="Texte ou variables {{nom_complet}}, {{mention}}..."
              className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded bg-white"
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <select
                value={zone.position}
                onChange={(e) =>
                  updateZone(zone.id, {
                    position: e.target.value as DocumentFreeZone['position'],
                  })
                }
                className="px-2 py-1 border border-slate-300 rounded bg-white"
              >
                <option value="top">Sous l’en-tête</option>
                <option value="body">Avant le texte</option>
                <option value="bottom">En bas de page</option>
              </select>
              <select
                value={zone.align}
                onChange={(e) =>
                  updateZone(zone.id, { align: e.target.value as HorizontalAlign })
                }
                className="px-2 py-1 border border-slate-300 rounded bg-white"
              >
                <option value="left">Gauche</option>
                <option value="center">Centré</option>
                <option value="right">Droite</option>
              </select>
              <label className="inline-flex items-center gap-1 text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(zone.bold)}
                  onChange={(e) => updateZone(zone.id, { bold: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                Gras
              </label>
              <label className="inline-flex items-center gap-1 text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(zone.boxed)}
                  onChange={(e) => updateZone(zone.id, { boxed: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                Encadré
              </label>
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={addZone}
        className="w-full px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Ajouter un bloc libre
      </button>
    </div>
  );
}

export function TemplateFieldManager({
  kind,
  template,
  patch,
  patchSection,
}: {
  kind: DocumentKind;
  template: DocumentTemplate;
  patch: (partial: Partial<DocumentTemplate>) => void;
  patchSection: <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldInputType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newUppercase, setNewUppercase] = useState(false);

  const addCustomField = () => {
    const cleanLabel = newLabel.trim();
    if (!cleanLabel) return;
    const slugBase =
      cleanLabel
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'champ';
    let id = slugBase;
    let suffix = 2;
    while (template.fields.some((f) => f.id === id)) {
      id = `${slugBase}_${suffix++}`;
    }
    const created: FieldDefinition = {
      id,
      label: cleanLabel,
      type: newType,
      enabled: true,
      required: false,
      custom: true,
      uppercase: newUppercase,
      dateFormat: 'JJ/MM/AAAA',
      mask: '',
      options:
        newType === 'select'
          ? newOptions
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
      help: '',
      fullWidth: false,
    };
    const nextRows: DocumentTemplateRow[] = [
      ...template.rows,
      { id, label: cleanLabel, enabled: false },
    ];
    patch({
      fields: [...template.fields, created],
      rows: nextRows,
    });
    setNewLabel('');
    setNewOptions('');
    setNewUppercase(false);
  };

  const frontFields = template.card?.frontFields ?? [];

  const toggleFrontField = (id: string) => {
    const next = frontFields.includes(id)
      ? frontFields.filter((f) => f !== id)
      : [...frontFields, id];
    patchSection('card', { frontFields: next });
  };

  const availableFrontOptions = [
    ...CARD_FRONT_FIELD_OPTIONS,
    ...template.fields
      .filter((f) => f.custom)
      .map((f) => ({ id: f.id, label: f.label })),
  ];

  return (
    <div className="space-y-4">
      {kind === 'carte' && (
        <div className="space-y-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">
              Champs affichés au recto (max 6)
            </h4>
            <p className="text-[11px] text-slate-500">
              Cochez et réordonnez les informations visibles sur le devant de la carte.
            </p>
          </div>
          {frontFields.length > 0 && (
            <div className="space-y-1">
              {frontFields.map((id, idx) => {
                const label =
                  availableFrontOptions.find((o) => o.id === id)?.label ?? id;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 px-2 py-1.5 border border-blue-200 bg-blue-50/40 rounded text-xs"
                  >
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleFrontField(id)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="flex-1 truncate font-medium text-slate-800">
                      {label}
                    </span>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        patchSection('card', {
                          frontFields: moveItem(frontFields, idx, -1),
                        })
                      }
                      className="p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === frontFields.length - 1}
                      onClick={() =>
                        patchSection('card', {
                          frontFields: moveItem(frontFields, idx, 1),
                        })
                      }
                      className="p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {availableFrontOptions
              .filter((o) => !frontFields.includes(o.id))
              .map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-1.5 px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleFrontField(opt.id)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
          </div>
        </div>
      )}

      {/* Lignes du tableau / verso de la carte */}
      <div className="space-y-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-800">
            {kind === 'carte' ? 'Lignes du verso' : 'Lignes du tableau académique'}
          </h4>
          <p className="text-[11px] text-slate-500">
            {kind === 'carte'
              ? 'Activez, renommez et réordonnez les lignes imprimées au dos de la carte.'
              : 'Utilisé lorsque le corps est en mode « Tableau de données ».'}
          </p>
        </div>
        <div className="space-y-1.5">
          {template.rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-1.5">
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
              <button
                type="button"
                disabled={index === 0}
                onClick={() => patch({ rows: moveItem(template.rows, index, -1) })}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={index === template.rows.length - 1}
                onClick={() => patch({ rows: moveItem(template.rows, index, 1) })}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Champs du formulaire & variables personnalisées */}
      <div className="space-y-2 pt-3 border-t border-slate-200">
        <div>
          <h4 className="text-xs font-semibold text-slate-800">
            Champs du formulaire &amp; variables ({template.fields.length})
          </h4>
          <p className="text-[11px] text-slate-500">
            Tout champ personnalisé créé ici devient une variable {'{{id}}'} insérable dans le texte et un champ saisissable lors d’une inscription.
          </p>
        </div>

        <div className="p-2.5 border border-slate-200 rounded-md bg-slate-50/70 space-y-2">
          <p className="text-[11px] font-semibold text-slate-700">
            Nouveau champ personnalisé
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ex. Numéro de table"
              className={inputClass}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as FieldInputType)}
              className={inputClass}
            >
              <option value="text">Texte</option>
              <option value="date">Date</option>
              <option value="number">Nombre</option>
              <option value="select">Liste déroulante</option>
            </select>
          </div>
          {newType === 'select' && (
            <input
              type="text"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options séparées par des virgules"
              className={inputClass}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={newUppercase}
                onChange={(e) => setNewUppercase(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Forcer en majuscules
            </label>
            <button
              type="button"
              disabled={!newLabel.trim()}
              onClick={addCustomField}
              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
          {template.fields.map((field, index) => (
            <div
              key={field.id}
              className="flex items-center gap-1.5 px-2 py-1.5 border border-slate-200 rounded bg-white"
            >
              <input
                type="checkbox"
                checked={field.enabled}
                onChange={(e) => {
                  const fields = template.fields.map((f, i) =>
                    i === index ? { ...f, enabled: e.target.checked } : f
                  );
                  patch({ fields });
                }}
                className="rounded border-slate-300 text-blue-600 shrink-0"
              />
              <input
                type="text"
                value={field.label}
                onChange={(e) => {
                  const fields = template.fields.map((f, i) =>
                    i === index ? { ...f, label: e.target.value } : f
                  );
                  patch({ fields });
                }}
                className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                {`{{${field.id}}}`}
              </span>
              <button
                type="button"
                title="Champ obligatoire"
                onClick={() => {
                  const fields = template.fields.map((f, i) =>
                    i === index ? { ...f, required: !f.required } : f
                  );
                  patch({ fields });
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                  field.required
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                Req
              </button>
              <button
                type="button"
                disabled={index === 0}
                onClick={() =>
                  patch({ fields: moveItem(template.fields, index, -1) })
                }
                className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === template.fields.length - 1}
                onClick={() =>
                  patch({ fields: moveItem(template.fields, index, 1) })
                }
                className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
              {field.custom && (
                <button
                  type="button"
                  title="Supprimer ce champ personnalisé"
                  onClick={() =>
                    patch({
                      fields: template.fields.filter((f) => f.id !== field.id),
                      rows: template.rows.filter((r) => r.id !== field.id),
                    })
                  }
                  className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
