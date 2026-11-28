import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  enrichInscriptions,
  formatDateFR,
  generateCertificateToken,
  getDependencyInfo,
  getNextId,
  normalizePhone,
  normalizeSex,
  suggestNextAnneeLabel,
  syncCertificateRegistryForInscription,
} from '../services/database';
import { ScolariteDatabase, TableEntityKey } from '../types/scolarite';

interface TablesSaisieViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
  onOpenCreateYear?: () => void;
}

const TABLE_TABS: { key: TableEntityKey; label: string }[] = [
  { key: 'annees', label: 'Années' },
  { key: 'facultes', label: 'Facultés' },
  { key: 'domaines', label: 'Domaines' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'niveaux', label: 'Niveaux' },
  { key: 'parcours', label: 'Parcours' },
  { key: 'etudiants', label: 'Étudiants' },
  { key: 'inscriptions', label: 'Inscriptions' },
];

const PAGE_SIZE = 50;
const DEFAULT_FACULTE_LOGO = '/assets/logo-uu.jpg';

/** Resize uploaded logo client-side to <= 240x240 WebP (preserving transparency) to protect localStorage quota */
async function compressLogoFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture image impossible'));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 240;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const webp = canvas.toDataURL('image/webp', 0.86);
      if (webp.startsWith('data:image/webp')) {
        resolve(webp);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function TablesSaisieView({
  db,
  onUpdateDb,
  onOpenCreateYear,
}: TablesSaisieViewProps) {
  const [activeTable, setActiveTable] = useState<TableEntityKey>('annees');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [editingRecord, setEditingRecord] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [studentPickerQuery, setStudentPickerQuery] = useState('');
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirmation with dependency check
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    label: string;
    blocked: boolean;
    message: string;
  } | null>(null);

  const counts: Record<TableEntityKey, number> = {
    annees: db.annees.length,
    facultes: db.facultes.length,
    domaines: db.domaines.length,
    mentions: db.mentions.length,
    niveaux: db.niveaux.length,
    parcours: db.parcours.length,
    etudiants: db.etudiants.length,
    inscriptions: db.inscriptions.length,
  };

  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [activeTable]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingRecord(null);
        setPendingDelete(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const currentItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = db[activeTable] as unknown as Record<string, unknown>[];
    if (!q) return list;
    return list.filter((row) =>
      Object.values(row).some(
        (v) =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      )
    );
  }, [db, activeTable, search]);

  const totalPages = Math.max(1, Math.ceil(currentItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () =>
      currentItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [currentItems, safePage]
  );

  // Lookup maps for readable labels
  const etudiantById = useMemo(
    () => new Map(db.etudiants.map((e) => [e.id, e])),
    [db.etudiants]
  );
  const anneeById = useMemo(
    () => new Map(db.annees.map((a) => [a.id, a.annee])),
    [db.annees]
  );
  const faculteById = useMemo(
    () => new Map(db.facultes.map((f) => [f.id, f.faculte])),
    [db.facultes]
  );
  const domaineById = useMemo(
    () => new Map(db.domaines.map((d) => [d.id, d.domaine])),
    [db.domaines]
  );
  const mentionById = useMemo(
    () => new Map(db.mentions.map((m) => [m.id, m.mention])),
    [db.mentions]
  );
  const niveauById = useMemo(
    () => new Map(db.niveaux.map((n) => [n.id, n.niveau])),
    [db.niveaux]
  );
  const anneeInscriptionCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const ins of db.inscriptions) {
      map.set(ins.idAnnee, (map.get(ins.idAnnee) ?? 0) + 1);
    }
    return map;
  }, [db.inscriptions]);

  const openCreate = () => {
    if (activeTable === 'annees' && onOpenCreateYear) {
      onOpenCreateYear();
      return;
    }
    setIsCreating(true);
    setStudentPickerQuery('');
    setLogoFileName('');
    setLogoError(null);
    setIsDraggingLogo(false);
    const defaults: Record<TableEntityKey, Record<string, unknown>> = {
      annees: { annee: suggestNextAnneeLabel(db.annees) },
      facultes: {
        faculte: '',
        logo: DEFAULT_FACULTE_LOGO,
      },
      domaines: { domaine: '', idFaculte: db.facultes[0]?.id ?? 1 },
      mentions: { mention: '', idDomaine: db.domaines[0]?.id ?? 1 },
      niveaux: {
        niveau: '',
        grade: 'Licence',
      },
      parcours: {
        parcours: '',
        idMention: db.mentions[0]?.id ?? 1,
        idNiveau: db.niveaux[0]?.id ?? 1,
      },
      etudiants: {
        nom: '',
        prenom: '',
        sexe: 'M',
        dateNaissance: '',
        lieuNaissance: '',
        nationalite: 'MALAGASY',
        numeroCin: '',
        dateCin: '',
        lieuDelivrance: '',
        telephone: '',
        adresse: '',
        email: '',
        nomPere: '',
        nomMere: '',
      },
      inscriptions: {
        idEtudiant: db.etudiants[0]?.id ?? 1,
        idAnnee: db.annees[0]?.id ?? 1,
        idMention: db.mentions[0]?.id ?? 1,
        idNiveau: db.niveaux[0]?.id ?? 1,
        idParcours: null,
        numInscription: '',
        numInscriptionPedagogique: '',
        reference: '',
        numeroCertificat: '',
        dateDelivrance: '',
        certificateToken: '',
      },
    };
    setEditingRecord(defaults[activeTable]);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setIsCreating(false);
    setStudentPickerQuery('');
    setLogoFileName('');
    setLogoError(null);
    setIsDraggingLogo(false);
    setEditingRecord({ ...row });
  };

  const requestDelete = (row: Record<string, unknown>) => {
    const id = Number(row.id);
    const deps = getDependencyInfo(db, activeTable, id);
    const label =
      String(
        row.annee ??
          row.faculte ??
          row.domaine ??
          row.mention ??
          row.niveau ??
          row.parcours ??
          row.numInscription ??
          row.reference ??
          `${row.nom ?? ''} ${row.prenom ?? ''}`.trim()
      ) || `#${id}`;
    setPendingDelete({
      id,
      label,
      blocked: deps.blocked,
      message: deps.message,
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete || pendingDelete.blocked) return;
    const id = pendingDelete.id;
    const nextList = (
      db[activeTable] as unknown as Array<{ id: number }>
    ).filter((r) => r.id !== id);

    // Cascade delete inscriptions if an etudiant is deleted so no orphans remain
    const nextDb: ScolariteDatabase = {
      ...db,
      [activeTable]: nextList,
      inscriptions:
        activeTable === 'etudiants'
          ? db.inscriptions.filter((ins) => ins.idEtudiant !== id)
          : db.inscriptions,
    };

    onUpdateDb(nextDb, `Enregistrement #${id} supprimé de ${activeTable}.`);
    setPendingDelete(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const list = db[activeTable] as unknown as Array<Record<string, unknown>>;
    const recordId = isCreating
      ? getNextId(list as unknown as Array<{ id: number }>)
      : Number(editingRecord.id);

    let sanitized: Record<string, unknown> = {
      ...editingRecord,
      id: recordId,
    };

    if (activeTable === 'etudiants') {
      const normSex = normalizeSex(String(sanitized.sexe ?? ''));
      sanitized = {
        ...sanitized,
        nom: String(sanitized.nom ?? '').trim().toUpperCase(),
        prenom: String(sanitized.prenom ?? '').trim(),
        sexe: normSex === 'Autre' ? 'M' : normSex,
        telephone: normalizePhone(String(sanitized.telephone ?? '')),
        adresse: String(sanitized.adresse ?? '').trim(),
        email: String(sanitized.email ?? '').trim(),
        numeroCin: String(sanitized.numeroCin ?? '').trim(),
      };
    }

    if (activeTable === 'parcours') {
      sanitized = {
        ...sanitized,
        idMention: Number(sanitized.idMention),
        idNiveau: Number(sanitized.idNiveau),
      };
    }

    if (activeTable === 'domaines') {
      sanitized = {
        ...sanitized,
        idFaculte: Number(sanitized.idFaculte),
      };
    }

    if (activeTable === 'mentions') {
      sanitized = {
        ...sanitized,
        idDomaine: Number(sanitized.idDomaine),
      };
    }

    if (activeTable === 'inscriptions') {
      const idMention = Number(sanitized.idMention);
      const idNiveau = Number(sanitized.idNiveau);
      const rawParcours = sanitized.idParcours;
      const validParcours =
        rawParcours !== null &&
        rawParcours !== '' &&
        rawParcours !== undefined &&
        db.parcours.some(
          (p) => p.id === Number(rawParcours) && p.idMention === idMention
        )
          ? Number(rawParcours)
          : null;

      sanitized = {
        ...sanitized,
        idEtudiant: Number(sanitized.idEtudiant),
        idAnnee: Number(sanitized.idAnnee),
        idMention,
        idNiveau,
        idParcours: validParcours,
        numInscription: String(sanitized.numInscription ?? '').trim(),
        numInscriptionPedagogique: String(
          sanitized.numInscriptionPedagogique ?? ''
        ).trim(),
        reference: String(sanitized.reference ?? '').trim(),
        numeroCertificat: String(sanitized.numeroCertificat ?? '').trim(),
        dateDelivrance: String(sanitized.dateDelivrance ?? '').trim(),
        certificateToken: String(sanitized.certificateToken ?? '')
          .trim()
          .toUpperCase(),
      };
    }

    const nextList = isCreating
      ? [sanitized, ...list]
      : list.map((item) => (Number(item.id) === recordId ? sanitized : item));

    const nextDb = { ...db, [activeTable]: nextList };
    if (activeTable === 'inscriptions' || activeTable === 'etudiants') {
      const enriched = enrichInscriptions(nextDb as ScolariteDatabase);
      for (const rec of enriched) {
        if (
          (activeTable === 'inscriptions' && rec.idInscription === recordId) ||
          (activeTable === 'etudiants' && rec.idEtudiant === recordId)
        ) {
          syncCertificateRegistryForInscription(rec);
        }
      }
    }

    onUpdateDb(
      nextDb,
      isCreating
        ? `Nouvel enregistrement ajouté dans ${activeTable}.`
        : `Enregistrement #${recordId} mis à jour.`
    );
    setEditingRecord(null);
  };

  const processLogoFile = async (file: File) => {
    if (!editingRecord) return;
    if (!file.type.startsWith('image/')) {
      setLogoError(
        'Veuillez sélectionner un fichier image valide (PNG, JPG, WebP ou SVG).'
      );
      return;
    }
    setLogoError(null);
    setLogoUploading(true);
    try {
      const compressed = await compressLogoFile(file);
      setEditingRecord((prev) => (prev ? { ...prev, logo: compressed } : prev));
      setLogoFileName(file.name);
    } catch {
      setLogoError("Impossible de charger ce logo. Essayez une autre image.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processLogoFile(file);
  };

  const handleLogoDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingLogo) setIsDraggingLogo(true);
  };

  const handleLogoDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLogo(false);
  };

  const handleLogoDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processLogoFile(file);
  };

  // Filtered students for searchable student picker inside Inscriptions modal
  const matchingStudents = useMemo(() => {
    const q = studentPickerQuery.trim().toLowerCase();
    const list = db.etudiants;
    if (!q) return list.slice(0, 60);
    return list
      .filter(
        (st) =>
          st.nom.toLowerCase().includes(q) ||
          st.prenom.toLowerCase().includes(q) ||
          st.numeroCin.toLowerCase().includes(q) ||
          String(st.id) === q
      )
      .slice(0, 60);
  }, [db.etudiants, studentPickerQuery]);

  const currentSelectedStudent = useMemo(() => {
    if (activeTable !== 'inscriptions' || !editingRecord) return null;
    return etudiantById.get(Number(editingRecord.idEtudiant)) ?? null;
  }, [activeTable, editingRecord, etudiantById]);

  const parcoursForSelectedMention = useMemo(() => {
    if (activeTable !== 'inscriptions' || !editingRecord) return [];
    const mid = Number(editingRecord.idMention);
    return db.parcours.filter((p) => p.idMention === mid);
  }, [activeTable, editingRecord, db.parcours]);

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Tables de Référence &amp; Saisie Directe
              </h2>
              <p className="text-xs text-slate-500">
                Administration complète des 8 tables relationnelles avec contrôle d&apos;intégrité
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimer la table
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
        </div>

        {/* Table Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {TABLE_TABS.map((t) => {
            const active = activeTable === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTable(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-2 border transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filtrer dans ${activeTable}...`}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/70">
          <span>
            Table <strong className="text-slate-900">{activeTable}</strong> —{' '}
            {currentItems.length} enregistrement(s)
          </span>
          <span>
            Page {safePage} / {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-16">ID</th>
                <th className="py-3 px-4">Libellé principal</th>
                <th className="py-3 px-4">Détails / Relations</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-slate-400"
                  >
                    Aucun enregistrement trouvé.
                  </td>
                </tr>
              ) : (
                pagedItems.map((row) => {
                  const id = Number(row.id);
                  let primary = '';
                  let detail = '';

                  switch (activeTable) {
                    case 'annees': {
                      const insCount = anneeInscriptionCounts.get(id) ?? 0;
                      primary = String(row.annee ?? '');
                      detail = `Année universitaire · ${insCount} inscription(s)`;
                      break;
                    }
                    case 'facultes':
                      primary = String(row.faculte ?? '');
                      detail = row.logo
                        ? 'Établissement / Faculté (logo configuré)'
                        : 'Établissement / Faculté';
                      break;
                    case 'domaines':
                      primary = String(row.domaine ?? '');
                      detail = `Faculté : ${faculteById.get(Number(row.idFaculte)) ?? `#${row.idFaculte}`}`;
                      break;
                    case 'mentions':
                      primary = String(row.mention ?? '');
                      detail = `Domaine : ${domaineById.get(Number(row.idDomaine)) ?? `#${row.idDomaine}`}`;
                      break;
                    case 'niveaux':
                      primary = String(row.niveau ?? '');
                      detail = `Grade : ${row.grade ?? ''}`;
                      break;
                    case 'parcours':
                      primary = String(row.parcours ?? '');
                      detail = `Mention : ${mentionById.get(Number(row.idMention)) ?? `#${row.idMention}`} · Niveau : ${niveauById.get(Number(row.idNiveau)) ?? `#${row.idNiveau}`}`;
                      break;
                    case 'etudiants':
                      primary = `${row.nom ?? ''} ${row.prenom ?? ''}`.trim();
                      detail = `${row.sexe ?? ''} · Né(e) ${formatDateFR(String(row.dateNaissance ?? '')) || '—'} · CIN ${row.numeroCin || '—'} · Tél ${row.telephone || '—'}${row.email ? ` · ${row.email}` : ''}`;
                      break;
                    case 'inscriptions': {
                      const st = etudiantById.get(Number(row.idEtudiant));
                      primary = `${row.numInscription || row.reference || 'Sans N°'} — ${st ? `${st.nom} ${st.prenom}` : `Étudiant #${row.idEtudiant}`}`;
                      detail = `${anneeById.get(Number(row.idAnnee)) ?? ''} · ${niveauById.get(Number(row.idNiveau)) ?? ''} ${mentionById.get(Number(row.idMention)) ?? ''} · Réf: ${row.reference || '—'}${row.numInscriptionPedagogique ? ` · Péd: ${row.numInscriptionPedagogique}` : ''}`;
                      break;
                    }
                  }

                  return (
                    <tr key={id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        #{id}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {activeTable === 'facultes' ? (
                          <div className="flex items-center gap-2.5">
                            {row.logo ? (
                              <img
                                src={String(row.logo)}
                                alt={`Logo ${primary}`}
                                className="h-8 w-8 rounded border border-slate-200 bg-white object-contain p-0.5 shrink-0"
                              />
                            ) : (
                              <span className="h-8 w-8 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                <ImagePlus className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span>{primary}</span>
                          </div>
                        ) : (
                          primary
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{detail}</td>
                      <td className="py-2.5 px-4 text-right no-print">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(row)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="no-print px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/50">
            <span className="text-slate-500">
              Affichage {(safePage - 1) * PAGE_SIZE + 1} –{' '}
              {Math.min(safePage * PAGE_SIZE, currentItems.length)} sur{' '}
              {currentItems.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-300 rounded bg-white disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-slate-700">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-300 rounded bg-white disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Record Modal */}
      {editingRecord && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {isCreating ? 'Nouvel enregistrement' : 'Modifier'} —{' '}
                <span className="text-blue-700">{activeTable}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="p-6 space-y-4 overflow-y-auto text-xs"
            >
              {activeTable === 'annees' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Année universitaire *
                  </label>
                  <input
                    required
                    value={String(editingRecord.annee ?? '')}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        annee: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded"
                  />
                </div>
              )}

              {activeTable === 'facultes' && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Libellé / Nom de la Faculté / Institut *
                    </label>
                    <input
                      required
                      value={String(editingRecord.faculte ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          faculte: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1.5">
                      Logo de l&apos;établissement
                    </label>
                    <div
                      onDragOver={handleLogoDragOver}
                      onDragLeave={handleLogoDragLeave}
                      onDrop={handleLogoDrop}
                      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                        isDraggingLogo
                          ? 'border-blue-500 bg-blue-50/70'
                          : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                      }`}
                    >
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          title="Cliquer pour choisir un logo"
                          className="group relative h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-white shadow-xs flex items-center justify-center overflow-hidden hover:border-blue-400 transition-colors"
                        >
                          {logoUploading ? (
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                          ) : editingRecord.logo ? (
                            <>
                              <img
                                src={String(editingRecord.logo)}
                                alt="Aperçu logo"
                                className="h-full w-full object-contain p-1.5"
                              />
                              <span className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload className="w-4 h-4 text-white" />
                              </span>
                            </>
                          ) : (
                            <ImagePlus className="w-7 h-7 text-slate-300 group-hover:text-blue-500 transition-colors" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                          <div>
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {logoFileName
                                ? `Fichier sélectionné : ${logoFileName}`
                                : editingRecord.logo
                                  ? String(editingRecord.logo) ===
                                    DEFAULT_FACULTE_LOGO
                                    ? 'Logo institutionnel par défaut'
                                    : 'Logo personnalisé configuré'
                                  : 'Aucun logo défini'}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Glissez-déposez une image ici ou cliquez sur le
                              bouton ci-dessous (PNG, JPG, WebP, SVG · optimisé
                              automatiquement à 240 px max).
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <button
                              type="button"
                              disabled={logoUploading}
                              onClick={() => logoInputRef.current?.click()}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {editingRecord.logo
                                ? 'Changer le logo'
                                : 'Ajouter un logo'}
                            </button>

                            {String(editingRecord.logo ?? '') !==
                              DEFAULT_FACULTE_LOGO && (
                              <button
                                type="button"
                                disabled={logoUploading}
                                onClick={() => {
                                  setEditingRecord({
                                    ...editingRecord,
                                    logo: DEFAULT_FACULTE_LOGO,
                                  });
                                  setLogoFileName('');
                                  setLogoError(null);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md inline-flex items-center gap-1.5 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Par défaut
                              </button>
                            )}

                            {Boolean(editingRecord.logo) && (
                              <button
                                type="button"
                                disabled={logoUploading}
                                onClick={() => {
                                  setEditingRecord({
                                    ...editingRecord,
                                    logo: '',
                                  });
                                  setLogoFileName('');
                                  setLogoError(null);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-md inline-flex items-center gap-1.5 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Supprimer
                              </button>
                            )}
                          </div>

                          {logoError && (
                            <p className="text-[11px] text-red-600 font-medium">
                              {logoError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTable === 'domaines' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nom du Domaine *
                    </label>
                    <input
                      required
                      value={String(editingRecord.domaine ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          domaine: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Faculté de rattachement
                    </label>
                    <select
                      value={Number(editingRecord.idFaculte)}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          idFaculte: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                    >
                      {db.facultes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.faculte}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTable === 'mentions' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nom de la Mention *
                    </label>
                    <input
                      required
                      value={String(editingRecord.mention ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          mention: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Domaine de rattachement
                    </label>
                    <select
                      value={Number(editingRecord.idDomaine)}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          idDomaine: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                    >
                      {db.domaines.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.domaine}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTable === 'niveaux' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Niveau *
                    </label>
                    <input
                      required
                      value={String(editingRecord.niveau ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          niveau: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Grade *
                    </label>
                    <input
                      required
                      value={String(editingRecord.grade ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          grade: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              )}

              {activeTable === 'parcours' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nom du Parcours *
                    </label>
                    <input
                      required
                      value={String(editingRecord.parcours ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          parcours: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Mention
                    </label>
                    <select
                      value={Number(editingRecord.idMention)}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          idMention: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                    >
                      {db.mentions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.mention}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Niveau
                    </label>
                    <select
                      value={Number(editingRecord.idNiveau)}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          idNiveau: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                    >
                      {db.niveaux.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.niveau} ({n.grade})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTable === 'etudiants' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nom *
                    </label>
                    <input
                      required
                      value={String(editingRecord.nom ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          nom: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Prénom
                    </label>
                    <input
                      value={String(editingRecord.prenom ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          prenom: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Sexe
                    </label>
                    <select
                      value={
                        normalizeSex(String(editingRecord.sexe ?? 'M')) === 'F'
                          ? 'F'
                          : 'M'
                      }
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          sexe: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                    >
                      <option value="M">M (Masculin)</option>
                      <option value="F">F (Féminin)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Date de naissance
                    </label>
                    <input
                      type="date"
                      value={String(editingRecord.dateNaissance ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          dateNaissance: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Lieu de naissance
                    </label>
                    <input
                      value={String(editingRecord.lieuNaissance ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          lieuNaissance: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nationalité
                    </label>
                    <input
                      value={String(editingRecord.nationalite ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          nationalite: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Numéro CIN
                    </label>
                    <input
                      value={String(editingRecord.numeroCin ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          numeroCin: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Date délivrance CIN
                    </label>
                    <input
                      type="date"
                      value={String(editingRecord.dateCin ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          dateCin: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Lieu délivrance CIN
                    </label>
                    <input
                      value={String(editingRecord.lieuDelivrance ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          lieuDelivrance: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      value={String(editingRecord.telephone ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          telephone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={String(editingRecord.email ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          email: e.target.value,
                        })
                      }
                      placeholder="exemple@domaine.mg"
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block font-medium text-slate-700 mb-1">
                      Adresse exacte
                    </label>
                    <input
                      value={String(editingRecord.adresse ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          adresse: e.target.value,
                        })
                      }
                      placeholder="Lot, quartier, commune, ville..."
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nom du Père
                    </label>
                    <input
                      value={String(editingRecord.nomPere ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          nomPere: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nom de la Mère
                    </label>
                    <input
                      value={String(editingRecord.nomMere ?? '')}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          nomMere: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              )}

              {activeTable === 'inscriptions' && (
                <div className="space-y-3">
                  {/* Searchable student picker */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-slate-700">
                        Étudiant sélectionné
                      </label>
                      {currentSelectedStudent && (
                        <span className="font-semibold text-blue-700">
                          #{currentSelectedStudent.id} —{' '}
                          {currentSelectedStudent.nom}{' '}
                          {currentSelectedStudent.prenom}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={studentPickerQuery}
                      onChange={(e) => setStudentPickerQuery(e.target.value)}
                      placeholder="Rechercher un étudiant par nom, prénom, CIN ou #ID..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                    />
                    <select
                      value={Number(editingRecord.idEtudiant)}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          idEtudiant: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                    >
                      {currentSelectedStudent &&
                        !matchingStudents.some(
                          (s) => s.id === currentSelectedStudent.id
                        ) && (
                          <option value={currentSelectedStudent.id}>
                            #{currentSelectedStudent.id} —{' '}
                            {currentSelectedStudent.nom}{' '}
                            {currentSelectedStudent.prenom}
                          </option>
                        )}
                      {matchingStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          #{st.id} — {st.nom} {st.prenom} (
                          {st.numeroCin || 'Sans CIN'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Année universitaire
                      </label>
                      <select
                        value={Number(editingRecord.idAnnee)}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            idAnnee: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                      >
                        {db.annees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.annee}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Mention
                      </label>
                      <select
                        value={Number(editingRecord.idMention)}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            idMention: Number(e.target.value),
                            idParcours: null,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                      >
                        {db.mentions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.mention}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Niveau
                      </label>
                      <select
                        value={Number(editingRecord.idNiveau)}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            idNiveau: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                      >
                        {db.niveaux.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.niveau} ({n.grade})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Parcours (optionnel)
                      </label>
                      <select
                        value={
                          editingRecord.idParcours
                            ? String(editingRecord.idParcours)
                            : ''
                        }
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            idParcours: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                      >
                        <option value="">Aucun parcours</option>
                        {parcoursForSelectedMention.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.parcours}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        N° de référence
                      </label>
                      <input
                        value={String(editingRecord.reference ?? '')}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            reference: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        N° inscription administrative
                      </label>
                      <input
                        value={String(editingRecord.numInscription ?? '')}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            numInscription: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-medium text-slate-700 mb-1">
                        N° inscription pédagogique
                      </label>
                      <input
                        value={String(
                          editingRecord.numInscriptionPedagogique ?? ''
                        )}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            numInscriptionPedagogique: e.target.value,
                          })
                        }
                        placeholder="Ex : PED-2025-0001"
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Numéro de certificat
                      </label>
                      <input
                        value={String(editingRecord.numeroCertificat ?? '')}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            numeroCertificat: e.target.value,
                          })
                        }
                        placeholder="Généré à l'édition si vide"
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Date de délivrance certificat
                      </label>
                      <input
                        type="date"
                        value={String(editingRecord.dateDelivrance ?? '')}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            dateDelivrance: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-medium text-slate-700">
                          Jeton de vérification (QR Code)
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingRecord({
                              ...editingRecord,
                              certificateToken: generateCertificateToken(),
                            })
                          }
                          className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Régénérer
                        </button>
                      </div>
                      <input
                        value={String(editingRecord.certificateToken ?? '')}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            certificateToken: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="Généré automatiquement si vide"
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono tracking-wider"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Dependency Check */}
      {pendingDelete && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-full shrink-0 ${
                  pendingDelete.blocked
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {pendingDelete.blocked ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1.5 text-xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  {pendingDelete.blocked
                    ? 'Suppression bloquée par intégrité référentielle'
                    : 'Confirmer la suppression'}
                </h3>
                <p className="text-slate-600">
                  Enregistrement : <strong>{pendingDelete.label}</strong> (#
                  {pendingDelete.id}) dans <strong>{activeTable}</strong>.
                </p>
                {pendingDelete.message && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800">
                    {pendingDelete.message}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Fermer
              </button>
              {!pendingDelete.blocked && (
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
