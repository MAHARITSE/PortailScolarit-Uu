import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileBadge,
  Pencil,
  Printer,
  QrCode,
  Search,
  LayoutTemplate,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import {
  buildNiveauFilterOptions,
  enrichInscriptions,
  ensureCertificateIdentitiesBatch,
  ensureCertificateIdentity,
  formatDateFR,
  loadCertificateSettings,
  loadDocumentTemplates,
  normalizeNiveauKey,
  registerCertificate,
  registerCertificatesBatch,
  saveCertificateSettings,
  verifyCertificateQuery,
} from '../services/database';
import {
  CertificateSettings,
  EnrichedInscription,
  ScolariteDatabase,
} from '../types/scolarite';
import { CertificateDocument } from './CertificateDocument';
import { CertificatePrintSheets } from './CertificatePrintSheets';
import { LoadingWaitModal, nextAnimationFrame } from './LoadingWaitModal';
import { StudentInscriptionModal } from './StudentInscriptionModal';

interface CertificatsViewProps {
  db: ScolariteDatabase;
  /** Année universitaire de travail (une seule à la fois) */
  anneeActive: string;
  /** Ouvre la page Administration · Modèles de documents */
  onOpenTemplates?: () => void;
  /** Persiste les jetons / numéros de certificat générés */
  onUpdateDb?: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
}

const PAGE_SIZE = 50;
const CHUNK_SIZE = 150;

export function CertificatsView({
  db,
  anneeActive,
  onOpenTemplates,
  onUpdateDb,
}: CertificatsViewProps) {
  const [search, setSearch] = useState('');
  const annee = anneeActive;
  const [mention, setMention] = useState('ALL');
  const [niveau, setNiveau] = useState('ALL');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewItem, setPreviewItem] = useState<EnrichedInscription | null>(
    null
  );
  const [editingItem, setEditingItem] = useState<EnrichedInscription | null>(
    null
  );
  const [printTargets, setPrintTargets] = useState<EnrichedInscription[]>([]);
  const [printLoading, setPrintLoading] = useState<{
    message: string;
    processed?: number;
    total?: number;
  } | null>(null);
  const printJobIdRef = useRef(0);

  // Certificate settings persisted locally
  const [settings, setSettings] = useState<CertificateSettings>(() =>
    loadCertificateSettings()
  );
  // Modèle de document défini dans la page Administration
  const [docTemplates] = useState(() => loadDocumentTemplates());
  const template = docTemplates.certificat;

  const [showSettings, setShowSettings] = useState(false);

  // Verifier modal
  const [showVerifier, setShowVerifier] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');

  const allEnriched = useMemo(() => enrichInscriptions(db), [db]);

  // Niveaux réellement proposés : issus des inscriptions de l'année / mention
  // sélectionnées, alias fusionnés ("L1" ≡ "Licence 1") et triés.
  const niveauScope = useMemo(
    () =>
      allEnriched.filter((item) => {
        if (item.annee !== annee) return false;
        if (mention !== 'ALL' && item.mention !== mention) return false;
        return true;
      }),
    [allEnriched, annee, mention]
  );

  const niveauOptions = useMemo(
    () => buildNiveauFilterOptions(niveauScope.map((item) => item.niveau)),
    [niveauScope]
  );

  // Mentions réellement présentes pour l'année de travail et le niveau choisi
  const mentionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allEnriched) {
      if (item.annee !== annee) continue;
      if (niveau !== 'ALL' && normalizeNiveauKey(item.niveau) !== niveau) continue;
      counts.set(item.mention, (counts.get(item.mention) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
      .map(([label, count]) => ({ label, count }));
  }, [allEnriched, annee, niveau]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEnriched.filter((item) => {
      if (item.annee !== annee) return false;
      if (mention !== 'ALL' && item.mention !== mention) return false;
      if (niveau !== 'ALL' && normalizeNiveauKey(item.niveau) !== niveau) return false;
      if (!q) return true;
      return (
        item.nom.toLowerCase().includes(q) ||
        item.prenom.toLowerCase().includes(q) ||
        item.numInscription.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q)
      );
    });
  }, [allEnriched, annee, mention, niveau, search]);

  useEffect(() => {
    setPage(1);
  }, [search, annee, mention, niveau]);

  // La mention choisie n'existe plus dans le périmètre année / niveau courant
  useEffect(() => {
    if (mention === 'ALL') return;
    if (!mentionOptions.some((option) => option.label === mention)) {
      setMention('ALL');
    }
  }, [mention, mentionOptions]);

  // Le niveau choisi n'existe plus dans le périmètre année / mention courant
  useEffect(() => {
    if (niveau === 'ALL') return;
    if (!niveauOptions.some((option) => option.key === niveau)) {
      setNiveau('ALL');
    }
  }, [niveau, niveauOptions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const selectedRows = useMemo(
    () => filtered.filter((r) => selectedIds.has(r.idInscription)),
    [filtered, selectedIds]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingItem) {
        setPreviewItem(null);
        setShowVerifier(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editingItem]);

  const updateSettings = (patch: Partial<CertificateSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveCertificateSettings(next);
      return next;
    });
  };

  const toggleRow = (idInscription: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idInscription)) next.delete(idInscription);
      else next.add(idInscription);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const allOnPage =
      pagedItems.length > 0 &&
      pagedItems.every((r) => selectedIds.has(r.idInscription));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of pagedItems) {
        if (allOnPage) next.delete(r.idInscription);
        else next.add(r.idInscription);
      }
      return next;
    });
  };

  const openPreview = (item: EnrichedInscription) => {
    const result = ensureCertificateIdentity(db, item.idInscription);
    if (result.created && onUpdateDb && result.record) {
      onUpdateDb(
        result.nextDb,
        `Certificat n° ${result.numeroCertificat} réservé pour ${item.nom} ${item.prenom}.`
      );
    }
    setPreviewItem(result.record ?? item);
  };

  const cancelPrintPreparation = () => {
    printJobIdRef.current++;
    setPrintLoading(null);
    setPrintTargets([]);
  };

  const triggerPrint = async (targets: EnrichedInscription[]) => {
    if (targets.length === 0) return;
    const jobId = ++printJobIdRef.current;
    const total = targets.length;

    setPrintLoading({
      message:
        total > 1
          ? `Chargement de l'état pour ${total.toLocaleString('fr-FR')} certificats...`
          : "Chargement de l'état d'impression...",
      processed: total > 1 ? 0 : undefined,
      total: total > 1 ? total : undefined,
    });
    setPrintTargets([]);

    // Laisse le navigateur afficher « Veuillez patienter... » avant tout traitement lourd
    await nextAnimationFrame();
    if (printJobIdRef.current !== jobId) return;

    const batch = ensureCertificateIdentitiesBatch(
      db,
      targets.map((t) => t.idInscription)
    );
    const prepared = batch.records.length > 0 ? batch.records : targets;
    const issuedAt = new Date().toISOString();

    registerCertificatesBatch(
      prepared.map((record) => ({
        token: record.certificateToken,
        idInscription: record.idInscription,
        idEtudiant: record.idEtudiant,
        numeroCertificat: record.numeroCertificat,
        nom: record.nom,
        prenom: record.prenom,
        mention: record.mention,
        niveau: record.niveau,
        annee: record.annee,
        issuedAt,
      }))
    );

    if (onUpdateDb && batch.nextDb !== db) {
      onUpdateDb(
        batch.nextDb,
        prepared.length > 1
          ? `${prepared.length} certificats numérotés et horodatés.`
          : 'Certificat numéroté et horodaté.'
      );
    }

    // Montage progressif par tranches pour ne jamais figer le navigateur
    const RENDER_BATCH = 20;
    if (prepared.length <= RENDER_BATCH) {
      setPrintTargets(prepared);
      if (total > 1) {
        setPrintLoading({
          message: `Finalisation de la mise en page (${total} certificats)...`,
          processed: total,
          total,
        });
      }
      await nextAnimationFrame();
      await nextAnimationFrame();
    } else {
      for (let end = RENDER_BATCH; end < prepared.length + RENDER_BATCH; end += RENDER_BATCH) {
        if (printJobIdRef.current !== jobId) return;
        const clampedEnd = Math.min(end, prepared.length);
        setPrintTargets(prepared.slice(0, clampedEnd));
        setPrintLoading({
          message: "Préparation des certificats pour l'impression...",
          processed: clampedEnd,
          total: prepared.length,
        });
        await nextAnimationFrame();
      }
      await nextAnimationFrame();
    }

    if (printJobIdRef.current !== jobId) return;
    setPrintLoading(null);
    await nextAnimationFrame();
    if (printJobIdRef.current !== jobId) return;
    window.print();
  };

  const verifyResults = useMemo(() => {
    if (!verifyInput.trim()) return null;
    return verifyCertificateQuery(db, verifyInput);
  }, [db, verifyInput]);

  const chunkCount = Math.ceil(filtered.length / CHUNK_SIZE);

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Controls Header */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                <FileBadge className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 font-display">
                  Édition de Certificats de Scolarité
                </h2>
                <p className="text-xs text-slate-500">
                  Impression unitaire ou par lot avec QR Code de vérification intégré
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowVerifier(true)}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                Vérifier un certificat
              </button>

              {onOpenTemplates && (
                <button
                  type="button"
                  onClick={onOpenTemplates}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <LayoutTemplate className="w-4 h-4 text-blue-600" />
                  Modèles de documents
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                className={`px-3 py-2 text-xs font-medium rounded-md border inline-flex items-center gap-1.5 ${
                  showSettings
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Options d&apos;édition
              </button>

              {selectedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => triggerPrint(selectedRows)}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer sélection ({selectedRows.length})
                </button>
              )}

              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => triggerPrint(filtered)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Tout imprimer ({filtered.length})
              </button>
            </div>
          </div>

          {/* Impression : automatique — 1 destinataire = 1 par A4 · plusieurs = 2 par A4 */}

          {/* Certificate Settings Panel */}
          {showSettings && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md grid grid-cols-1 md:grid-cols-4 gap-3">
              <p className="md:col-span-4 text-[11px] text-slate-500 -mb-1">
                Mise en page (en-tête, blocs, tableau, QR code, signature) :
                page <span className="font-medium text-slate-700">Administration · Modèles</span>.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Date d&apos;édition affichée (vide = aujourd&apos;hui)
                </label>
                <input
                  type="date"
                  value={settings.issueDate}
                  onChange={(e) =>
                    updateSettings({ issueDate: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Fonction du signataire (vide = modèle)
                </label>
                <input
                  placeholder={template.signature.title || 'Modèle actif'}
                  value={settings.signatoryTitle}
                  onChange={(e) =>
                    updateSettings({ signatoryTitle: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Nom du signataire (vide = modèle)
                </label>
                <input
                  placeholder={template.signature.name || 'Ex. Dr. RAKOTO Jean'}
                  value={settings.signatoryName}
                  onChange={(e) =>
                    updateSettings({ signatoryName: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showFiliation}
                    onChange={(e) =>
                      updateSettings({ showFiliation: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Afficher la filiation (Père / Mère)
                </label>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher nom, prénom, N° inscription, réf..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <select
              value={mention}
              onChange={(e) => setMention(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="ALL">Toutes les mentions</option>
              {mentionOptions.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>

            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="ALL">Tous les niveaux</option>
              {niveauOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>

          {/* Slice Printing Helpers when lot > 150 */}
          {filtered.length > CHUNK_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-600">
                Lot volumineux ({filtered.length} certificats) — impression par
                tranches recommandée ({CHUNK_SIZE}/tranche) :
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: chunkCount }, (_, i) => {
                  const start = i * CHUNK_SIZE;
                  const end = Math.min(filtered.length, start + CHUNK_SIZE);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => triggerPrint(filtered.slice(start, end))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded border border-slate-200 font-mono text-[11px]"
                    >
                      Tranche {i + 1} ({start + 1}–{end})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>
                <strong className="text-slate-900">{filtered.length}</strong>{' '}
                certificat(s) disponible(s)
              </span>
              {selectedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-blue-700 hover:underline font-medium"
                >
                  Effacer sélection ({selectedRows.length})
                </button>
              )}
            </div>
            <span>
              Page {safePage} / {totalPages}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectPage}
                      title="Sélectionner cette page"
                      className="text-slate-500 hover:text-blue-600"
                    >
                      {pagedItems.length > 0 &&
                      pagedItems.every((r) =>
                        selectedIds.has(r.idInscription)
                      ) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">N° Inscription</th>
                  <th className="py-3 px-4">Étudiant</th>
                  <th className="py-3 px-4">Formation</th>
                  <th className="py-3 px-4">Année</th>
                  <th className="py-3 px-4">Réf.</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-slate-400"
                    >
                      Aucun étudiant trouvé avec ces critères.
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((item) => {
                    const isChecked = selectedIds.has(item.idInscription);
                    return (
                      <tr
                        key={item.idInscription}
                        className={`hover:bg-slate-50/80 ${
                          isChecked ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => toggleRow(item.idInscription)}
                            className="text-slate-400 hover:text-blue-600"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">
                          {item.numInscription || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {item.nom} {item.prenom}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          <span className="font-medium text-blue-700">
                            {item.niveau}
                          </span>{' '}
                          · {item.mention}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                          {item.annee}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {item.reference || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              title="Modifier les informations de l'étudiant et du certificat"
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => openPreview(item)}
                              className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                            >
                              Aperçu
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerPrint([item])}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Imprimer
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
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/50">
              <span className="text-slate-500">
                Affichage {(safePage - 1) * PAGE_SIZE + 1} –{' '}
                {Math.min(safePage * PAGE_SIZE, filtered.length)} sur{' '}
                {filtered.length}
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
      </div>

      {/* Single Certificate Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-4 print:static print:bg-transparent print:p-0">
          <div className="max-w-4xl mx-auto my-4 space-y-3">
            <div className="no-print bg-white border border-slate-200 rounded-lg px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                Certificat — {previewItem.nom} {previewItem.prenom}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(previewItem)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier les infos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    registerCertificate({
                      token: previewItem.certificateToken,
                      idInscription: previewItem.idInscription,
                      idEtudiant: previewItem.idEtudiant,
                      numeroCertificat: previewItem.numeroCertificat,
                      nom: previewItem.nom,
                      prenom: previewItem.prenom,
                      mention: previewItem.mention,
                      niveau: previewItem.niveau,
                      annee: previewItem.annee,
                      issuedAt: new Date().toISOString(),
                    });
                    // Imprime via la feuille A4 dimensionnée, pas via l'article de prévisualisation
                    setPrintTargets([previewItem]);
                    setPreviewItem(null);
                    setTimeout(() => window.print(), 80);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <CertificateDocument
              record={previewItem}
              settings={settings}
              template={template}
              token={previewItem.certificateToken}
            />
          </div>
        </div>
      )}

      {/* Certificate Verifier Modal */}
      {showVerifier && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Vérifier l&apos;authenticité d&apos;un certificat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifier(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Contenu du QR Code, Référence, N° Inscription, CIN ou Nom
                </label>
                <textarea
                  rows={2}
                  autoFocus
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  placeholder="Ex: 240001 ou 501011012345 ou texte complet du QR Code..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {verifyResults === null ? (
                <p className="text-slate-500">
                  Collez le contenu d&apos;un QR Code ou saisissez une référence
                  pour vérifier sa présence dans le registre officiel.
                </p>
              ) : verifyResults.length === 0 ? (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Aucune correspondance trouvée
                    </p>
                    <p className="mt-0.5 text-red-700">
                      Ce numéro ou code QR ne correspond à aucune inscription
                      enregistrée dans la base locale.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto">
                  {verifyResults.map((match) => (
                    <div
                      key={match.idInscription}
                      className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-900 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold inline-flex items-center gap-1.5 text-emerald-800">
                          <ShieldCheck className="w-4 h-4" />
                          Certificat authentique vérifié
                        </span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {match.numInscription || `#${match.idInscription}`}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900">
                        {match.nom} {match.prenom}
                      </p>
                      <p className="text-slate-700">
                        {match.niveau} · {match.mention} ({match.faculte}) —
                        Année <strong>{match.annee}</strong>
                      </p>
                      <p className="text-[11px] text-slate-600 font-mono">
                        Réf : {match.reference || '—'} · Né(e) le{' '}
                        {formatDateFR(match.dateNaissance) || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Print Container — 1 ou 2 certificats par feuille A4 */}
      {!previewItem && printTargets.length > 0 && (
        <div className="hidden print:block">
          <CertificatePrintSheets
            records={printTargets}
            template={template}
            settings={settings}
          />
        </div>
      )}

      {/* Edit Student & Certificate Info Modal */}
      {editingItem && (
        <StudentInscriptionModal
          db={db}
          editing={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(nextDb, msg) => {
            onUpdateDb?.(nextDb, msg);
            if (
              previewItem &&
              previewItem.idInscription === editingItem.idInscription
            ) {
              const refreshed = enrichInscriptions(nextDb).find(
                (r) => r.idInscription === editingItem.idInscription
              );
              if (refreshed) setPreviewItem(refreshed);
            }
            setEditingItem(null);
          }}
        />
      )}

      <LoadingWaitModal
        open={Boolean(printLoading)}
        title="Veuillez patienter..."
        message={printLoading?.message}
        processed={printLoading?.processed}
        total={printLoading?.total}
        onCancel={cancelPrintPreparation}
      />
    </div>
  );
}
