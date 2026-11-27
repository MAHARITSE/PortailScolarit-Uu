import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildNiveauFilterOptions,
  enrichInscriptions,
  exportInscriptionsToCsv,
  exportInscriptionsToXlsx,
  formatDateFR,
  getBirthdateAnomalyReason,
  loadCertificateSettings,
  normalizeNiveauKey,
} from '../services/database';
import { EnrichedInscription, ScolariteDatabase } from '../types/scolarite';
import { BatchReinscriptionModal } from './BatchReinscriptionModal';
import { CertificateDocument } from './CertificateDocument';
import { StudentDetailModal } from './StudentDetailModal';
import { StudentInscriptionModal } from './StudentInscriptionModal';

interface AccueilViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
  initialQuickFilter?: QuickFilterMode;
  onClearInitialFilter?: () => void;
}

export type QuickFilterMode = 'all' | 'male' | 'female' | 'no_cin' | 'anomalies';

type SortKey =
  | 'reference'
  | 'numInscription'
  | 'nom'
  | 'prenom'
  | 'dateNaissance'
  | 'faculte'
  | 'mention'
  | 'niveau'
  | 'annee';

export function AccueilView({
  db,
  onUpdateDb,
  initialQuickFilter = 'all',
  onClearInitialFilter,
}: AccueilViewProps) {
  const [selectedAnnee, setSelectedAnnee] = useState<string>(
    db.annees[0]?.annee ?? 'ALL'
  );
  const [selectedFaculte, setSelectedFaculte] = useState<string>('');
  const [selectedDomaine, setSelectedDomaine] = useState<string>('');
  const [selectedMention, setSelectedMention] = useState<string>('');
  const [selectedNiveau, setSelectedNiveau] = useState<string>('');
  const [selectedParcours, setSelectedParcours] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilterMode>(initialQuickFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<EnrichedInscription | null>(null);
  const [reinscribeId, setReinscribeId] = useState<number | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);
  const [batchReinscribeOpen, setBatchReinscribeOpen] = useState<boolean>(false);

  const [certificateRow, setCertificateRow] = useState<EnrichedInscription | null>(null);
  const [batchPrintActive, setBatchPrintActive] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedInscription | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialQuickFilter && initialQuickFilter !== 'all') {
      setQuickFilter(initialQuickFilter);
      setPage(1);
      onClearInitialFilter?.();
    }
  }, [initialQuickFilter, onClearInitialFilter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (certificateRow) setCertificateRow(null);
        else if (deleteTarget) setDeleteTarget(null);
        else if (bulkDeleteOpen) setBulkDeleteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [certificateRow, deleteTarget, bulkDeleteOpen]);

  const certSettings = useMemo(() => loadCertificateSettings(), []);
  const allEnriched = useMemo(() => enrichInscriptions(db), [db]);

  // Cascading filter options
  const anneeOptions = useMemo(() => db.annees.map((a) => a.annee), [db.annees]);

  const effectiveAnnee = useMemo(() => {
    if (selectedAnnee === 'ALL') return 'ALL';
    if (anneeOptions.includes(selectedAnnee)) return selectedAnnee;
    return anneeOptions[0] ?? 'ALL';
  }, [anneeOptions, selectedAnnee]);

  const faculteOptions = useMemo(
    () => db.facultes.map((f) => f.faculte).sort((a, b) => a.localeCompare(b, 'fr')),
    [db.facultes]
  );

  const domaineOptions = useMemo(() => {
    const facObj = db.facultes.find((f) => f.faculte === selectedFaculte);
    return db.domaines
      .filter((d) => !facObj || d.idFaculte === facObj.id)
      .map((d) => d.domaine)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.facultes, db.domaines, selectedFaculte]);

  const mentionOptions = useMemo(() => {
    const facObj = db.facultes.find((f) => f.faculte === selectedFaculte);
    const domObj = db.domaines.find(
      (d) => d.domaine === selectedDomaine && (!facObj || d.idFaculte === facObj.id)
    );
    const validDomIds = domObj
      ? [domObj.id]
      : facObj
        ? db.domaines.filter((d) => d.idFaculte === facObj.id).map((d) => d.id)
        : null;
    return db.mentions
      .filter((m) => !validDomIds || validDomIds.includes(m.idDomaine))
      .map((m) => m.mention)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.facultes, db.domaines, db.mentions, selectedFaculte, selectedDomaine]);

  // Niveaux présents dans les inscriptions, alias fusionnés ("L1" ≡ "Licence 1")
  const niveauOptions = useMemo(
    () => buildNiveauFilterOptions(allEnriched.map((row) => row.niveau)),
    [allEnriched]
  );

  const selectedNiveauIds = useMemo(
    () =>
      new Set(
        db.niveaux
          .filter((n) => normalizeNiveauKey(n.niveau) === selectedNiveau)
          .map((n) => n.id)
      ),
    [db.niveaux, selectedNiveau]
  );

  const selectedNiveauLabel = useMemo(
    () =>
      niveauOptions.find((option) => option.key === selectedNiveau)?.label ?? '',
    [niveauOptions, selectedNiveau]
  );

  const parcoursOptions = useMemo(() => {
    const menObj = db.mentions.find((m) => m.mention === selectedMention);
    return db.parcours
      .filter(
        (p) =>
          (!menObj || p.idMention === menObj.id) &&
          (!selectedNiveau || selectedNiveauIds.has(p.idNiveau))
      )
      .map((p) => p.parcours)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.mentions, db.parcours, selectedMention, selectedNiveau, selectedNiveauIds]);

  // Base filtered rows before quick filter (used to compute chip counts)
  const baseFilteredRows = useMemo(() => {
    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return allEnriched.filter((row) => {
      if (effectiveAnnee !== 'ALL' && row.annee !== effectiveAnnee) return false;
      if (selectedFaculte && row.faculte !== selectedFaculte) return false;
      if (selectedDomaine && row.domaine !== selectedDomaine) return false;
      if (selectedMention && row.mention !== selectedMention) return false;
      if (selectedNiveau && normalizeNiveauKey(row.niveau) !== selectedNiveau) return false;
      if (selectedParcours && row.parcours !== selectedParcours) return false;

      if (tokens.length > 0) {
        const haystack =
          `${row.nom} ${row.prenom} ${row.reference} ${row.numInscription} ${row.numeroCin} ${row.mention} ${row.telephone}`.toLowerCase();
        if (!tokens.every((t) => haystack.includes(t))) return false;
      }
      return true;
    });
  }, [
    allEnriched,
    effectiveAnnee,
    selectedFaculte,
    selectedDomaine,
    selectedMention,
    selectedNiveau,
    selectedParcours,
    searchQuery,
  ]);

  const quickCounts = useMemo(() => {
    let male = 0;
    let female = 0;
    let noCin = 0;
    let anomalies = 0;
    for (const r of baseFilteredRows) {
      if (r.sexeNormalized === 'M') male++;
      else if (r.sexeNormalized === 'F') female++;
      if (!r.numeroCin.trim()) noCin++;
      if (getBirthdateAnomalyReason(r.dateNaissance) || (r.sexe !== 'M' && r.sexe !== 'F')) {
        anomalies++;
      }
    }
    return {
      all: baseFilteredRows.length,
      male,
      female,
      no_cin: noCin,
      anomalies,
    };
  }, [baseFilteredRows]);

  const filteredRows = useMemo(() => {
    const list = baseFilteredRows.filter((row) => {
      if (quickFilter === 'male') return row.sexeNormalized === 'M';
      if (quickFilter === 'female') return row.sexeNormalized === 'F';
      if (quickFilter === 'no_cin') return !row.numeroCin.trim();
      if (quickFilter === 'anomalies') {
        return (
          Boolean(getBirthdateAnomalyReason(row.dateNaissance)) ||
          (row.sexe !== 'M' && row.sexe !== 'F')
        );
      }
      return true;
    });

    list.sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      const cmp = av.localeCompare(bv, 'fr', { sensitivity: 'base', numeric: true });
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [baseFilteredRows, quickFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selectedIds.has(r.idInscription)),
    [filteredRows, selectedIds]
  );

  const allPageSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((r) => selectedIds.has(r.idInscription));

  const activeMentionsCount = useMemo(
    () => new Set(filteredRows.map((r) => r.mention)).size,
    [filteredRows]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSelectedAnnee(db.annees[0]?.annee ?? 'ALL');
    setSelectedFaculte('');
    setSelectedDomaine('');
    setSelectedMention('');
    setSelectedNiveau('');
    setSelectedParcours('');
    setQuickFilter('all');
    setSearchQuery('');
    setSelectedIds(new Set());
    setPage(1);
  };

  const toggleSelectRow = (idInscription: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idInscription)) next.delete(idInscription);
      else next.add(idInscription);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedRows.forEach((r) => next.delete(r.idInscription));
      } else {
        paginatedRows.forEach((r) => next.add(r.idInscription));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredRows.map((r) => r.idInscription)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const next = structuredClone(db);
    next.inscriptions = next.inscriptions.filter((i) => i.id !== deleteTarget.idInscription);
    const stillHasInscription = next.inscriptions.some(
      (i) => i.idEtudiant === deleteTarget.idEtudiant
    );
    if (!stillHasInscription) {
      next.etudiants = next.etudiants.filter((e) => e.id !== deleteTarget.idEtudiant);
    }
    onUpdateDb(
      next,
      `Inscription de ${deleteTarget.nom} ${deleteTarget.prenom} supprimée.`
    );
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.delete(deleteTarget.idInscription);
      return s;
    });
    setDeleteTarget(null);
  };

  const confirmBulkDelete = () => {
    if (selectedRows.length === 0) return;
    const toRemoveIds = new Set(selectedRows.map((r) => r.idInscription));
    const affectedStudentIds = new Set(selectedRows.map((r) => r.idEtudiant));
    const next = structuredClone(db);
    next.inscriptions = next.inscriptions.filter((i) => !toRemoveIds.has(i.id));
    next.etudiants = next.etudiants.filter(
      (e) =>
        !affectedStudentIds.has(e.id) ||
        next.inscriptions.some((i) => i.idEtudiant === e.id)
    );
    onUpdateDb(next, `${selectedRows.length} inscription(s) supprimée(s).`);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const handlePrintSelectedCertificates = () => {
    if (selectedRows.length === 0) return;
    setBatchPrintActive(true);
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handlePrintRoster = () => {
    setBatchPrintActive(false);
    setCertificateRow(null);
    setTimeout(() => window.print(), 40);
  };

  const defaultAnneeId =
    db.annees.find((a) => a.annee === effectiveAnnee)?.id ?? db.annees[0]?.id;

  const isCertificatePrinting = Boolean(certificateRow) || batchPrintActive;

  return (
    <div className="space-y-5">
      {/* Main interactive workspace: ALWAYS hidden in print when a certificate print is active, and hidden in print because we have a dedicated clean print roster */}
      <div className="no-print space-y-5">
        {/* KPI Summary Strip */}
        <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Inscriptions affichées</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-display">
              {filteredRows.length.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Total étudiants enregistrés</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-display">
              {db.etudiants.length.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Mentions représentées</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-display">
              {activeMentionsCount}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Année universitaire</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums font-display">
              {effectiveAnnee === 'ALL' ? 'Toutes' : effectiveAnnee || '—'}
            </p>
          </div>
        </div>

        {/* Toolbar & Cascading Filters (FEN_Acceuil1) */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher par nom, prénom, référence, n° inscription, CIN ou téléphone..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={handlePrintRoster}
                disabled={filteredRows.length === 0}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimer liste
              </button>
              <button
                type="button"
                onClick={() => exportInscriptionsToCsv(filteredRows, effectiveAnnee)}
                disabled={filteredRows.length === 0}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportInscriptionsToXlsx(filteredRows, effectiveAnnee)}
                disabled={filteredRows.length === 0}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Exporter Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRow(null);
                  setReinscribeId(null);
                  setModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Nouvel étudiant
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            <select
              value={effectiveAnnee}
              onChange={(e) => {
                setSelectedAnnee(e.target.value);
                setPage(1);
              }}
              aria-label="Année universitaire"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="ALL">Toutes les années</option>
              {anneeOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              value={selectedFaculte}
              onChange={(e) => {
                setSelectedFaculte(e.target.value);
                setSelectedDomaine('');
                setSelectedMention('');
                setSelectedParcours('');
                setPage(1);
              }}
              aria-label="Faculté"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="">Toutes les facultés</option>
              {faculteOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={selectedDomaine}
              onChange={(e) => {
                setSelectedDomaine(e.target.value);
                setSelectedMention('');
                setSelectedParcours('');
                setPage(1);
              }}
              aria-label="Domaine"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="">Tous les domaines</option>
              {domaineOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={selectedMention}
              onChange={(e) => {
                setSelectedMention(e.target.value);
                setSelectedParcours('');
                setPage(1);
              }}
              aria-label="Mention"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="">Toutes les mentions</option>
              {mentionOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedNiveau}
              onChange={(e) => {
                setSelectedNiveau(e.target.value);
                setSelectedParcours('');
                setPage(1);
              }}
              aria-label="Niveau"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="">Tous les niveaux</option>
              {niveauOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>

            <select
              value={selectedParcours}
              onChange={(e) => {
                setSelectedParcours(e.target.value);
                setPage(1);
              }}
              aria-label="Parcours"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="">Tous les parcours</option>
              {parcoursOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            {(
              [
                { key: 'all', label: 'Tous', count: quickCounts.all },
                { key: 'male', label: 'Hommes', count: quickCounts.male },
                { key: 'female', label: 'Femmes', count: quickCounts.female },
                { key: 'no_cin', label: 'Sans CIN', count: quickCounts.no_cin },
                { key: 'anomalies', label: 'À vérifier', count: quickCounts.anomalies },
              ] as const
            ).map((chip) => {
              const active = quickFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setQuickFilter(chip.key);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? chip.key === 'anomalies'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {chip.key === 'anomalies' && chip.count > 0 && !active && (
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                  )}
                  <span>{chip.label}</span>
                  <span
                    className={`font-mono tabular-nums text-[10px] ${
                      active ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {selectedRows.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-blue-900">
              <span className="font-semibold tabular-nums">
                {selectedRows.length} inscription(s) sélectionnée(s)
              </span>
              {selectedRows.length < filteredRows.length && (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-blue-700 font-medium hover:underline"
                >
                  Tout sélectionner ({filteredRows.length})
                </button>
              )}
              <button
                type="button"
                onClick={clearSelection}
                className="text-slate-600 hover:text-slate-900 hover:underline"
              >
                Désélectionner
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintSelectedCertificates}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimer certificats ({Math.min(selectedRows.length, 200)})
              </button>
              <button
                type="button"
                onClick={() => setBatchReinscribeOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-md hover:bg-emerald-200 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réinscrire en lot
              </button>
              <button
                type="button"
                onClick={() => exportInscriptionsToXlsx(selectedRows, effectiveAnnee)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter sélection
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </div>
        )}

        {/* Data Grid (TABLE_Etudiant) */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2.5 w-9">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                      aria-label="Tout sélectionner sur cette page"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('reference')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Référence <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('numInscription')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      N° Inscr. <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('nom')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Nom <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('prenom')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Prénom(s) <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Sexe</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('dateNaissance')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Date naiss. <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Téléphone</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">CIN</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('faculte')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Faculté <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('mention')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Mention <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('niveau')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Niveau <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  {effectiveAnnee === 'ALL' && (
                    <th className="px-3 py-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort('annee')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Année <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  <th className="px-3 py-2.5 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={effectiveAnnee === 'ALL' ? 14 : 13}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      <p className="font-medium text-slate-700">Aucun étudiant trouvé</p>
                      <p className="text-xs mt-1">
                        Modifiez vos critères de recherche ou ajoutez une nouvelle inscription.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const isChecked = selectedIds.has(row.idInscription);
                    const dobAlert = getBirthdateAnomalyReason(row.dateNaissance);
                    return (
                      <tr
                        key={row.idInscription}
                        className={`transition-colors ${
                          isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(row.idInscription)}
                            aria-label={`Sélectionner ${row.nom} ${row.prenom}`}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {row.reference || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {row.numInscription || '—'}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDetailStudentId(row.idEtudiant)}
                            className="text-left hover:text-blue-700 hover:underline"
                          >
                            {row.nom}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDetailStudentId(row.idEtudiant)}
                            className="text-left hover:text-blue-700"
                          >
                            {row.prenom || '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            title={`Valeur source : ${row.sexe || 'vide'}`}
                            className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                              row.sexeNormalized === 'F'
                                ? 'bg-pink-50 text-pink-700'
                                : row.sexeNormalized === 'M'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.sexeNormalized === 'Autre' ? row.sexe || '?' : row.sexeNormalized}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs tabular-nums whitespace-nowrap">
                          <span
                            className={
                              dobAlert ? 'text-amber-700 font-semibold inline-flex items-center gap-1' : 'text-slate-600'
                            }
                            title={dobAlert ?? undefined}
                          >
                            {formatDateFR(row.dateNaissance) || '—'}
                            {dobAlert && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {row.telephone || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {row.numeroCin || '—'}
                        </td>
                        <td
                          className="px-3 py-2 text-xs text-slate-700 max-w-[160px] truncate"
                          title={row.faculte}
                        >
                          {row.faculte}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-800 whitespace-nowrap">
                          {row.mention}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                          {row.niveau}
                          {row.parcours !== '— Aucun —' && (
                            <span className="ml-1 text-[11px] text-slate-400">
                              · {row.parcours}
                            </span>
                          )}
                        </td>
                        {effectiveAnnee === 'ALL' && (
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {row.annee}
                          </td>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setDetailStudentId(row.idEtudiant)}
                              title="Voir le dossier étudiant"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchPrintActive(false);
                                setCertificateRow(row);
                              }}
                              title="Imprimer le certificat de scolarité"
                              className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <FileCheck2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow(row);
                                setReinscribeId(null);
                                setModalOpen(true);
                              }}
                              title="Modifier"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              title="Supprimer"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
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

          {/* Pagination Footer */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                Affichage{' '}
                <strong className="text-slate-900">
                  {filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                </strong>
                –
                <strong className="text-slate-900">
                  {Math.min(safePage * pageSize, filteredRows.length)}
                </strong>{' '}
                sur <strong className="text-slate-900">{filteredRows.length}</strong>
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Lignes par page"
                className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
                aria-label="Page précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono tabular-nums">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
                aria-label="Page suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only Official Roster (only rendered in print when NOT printing certificates) */}
      {!isCertificatePrinting && (
        <div className="hidden print:block">
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-4">
            <img src="/assets/logo-uu.jpg" alt="Logo" className="w-12 h-12 object-contain" />
            <div className="text-center">
              <p className="text-[11px] uppercase font-semibold text-slate-700">
                Université de Toliara · Scolarité Centrale
              </p>
              <h2 className="text-base font-bold uppercase">
                Liste officielle des étudiants inscrits
              </h2>
              <p className="text-xs text-slate-600">
                Année : {effectiveAnnee === 'ALL' ? 'Toutes' : effectiveAnnee}
                {selectedFaculte ? ` · ${selectedFaculte}` : ''}
                {selectedMention ? ` · ${selectedMention}` : ''}
                {selectedNiveau ? ` · ${selectedNiveauLabel}` : ''} — {filteredRows.length} étudiant(s)
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums">
              {new Date().toLocaleDateString('fr-FR')}
            </span>
          </div>

          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-100">
                <th className="py-1.5 px-2">N°</th>
                <th className="py-1.5 px-2">Réf.</th>
                <th className="py-1.5 px-2">N° Inscr.</th>
                <th className="py-1.5 px-2">Nom &amp; Prénom(s)</th>
                <th className="py-1.5 px-2">Sexe</th>
                <th className="py-1.5 px-2">Né(e) le</th>
                <th className="py-1.5 px-2">CIN</th>
                <th className="py-1.5 px-2">Mention / Niveau</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.map((r, idx) => (
                <tr key={r.idInscription}>
                  <td className="py-1 px-2 font-mono">{idx + 1}</td>
                  <td className="py-1 px-2 font-mono">{r.reference || '—'}</td>
                  <td className="py-1 px-2 font-mono">{r.numInscription || '—'}</td>
                  <td className="py-1 px-2 font-semibold">
                    {r.nom} {r.prenom}
                  </td>
                  <td className="py-1 px-2">{r.sexeNormalized}</td>
                  <td className="py-1 px-2 font-mono">{formatDateFR(r.dateNaissance) || '—'}</td>
                  <td className="py-1 px-2 font-mono">{r.numeroCin || '—'}</td>
                  <td className="py-1 px-2">
                    {r.mention} · {r.niveau}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Certificate Print Area for Selected Rows */}
      {batchPrintActive && selectedRows.length > 0 && (
        <div className="hidden print:block">
          {selectedRows.map((rec) => (
            <div key={rec.idInscription} className="print-page-break">
              <CertificateDocument record={rec} settings={certSettings} />
            </div>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      {detailStudentId !== null && (
        <StudentDetailModal
          db={db}
          etudiantId={detailStudentId}
          onClose={() => setDetailStudentId(null)}
          onEditInscription={(rec) => {
            setDetailStudentId(null);
            setEditingRow(rec);
            setReinscribeId(null);
            setModalOpen(true);
          }}
          onPrintCertificate={(rec) => {
            setDetailStudentId(null);
            setBatchPrintActive(false);
            setCertificateRow(rec);
          }}
          onReinscribe={(stuId) => {
            setDetailStudentId(null);
            setEditingRow(null);
            setReinscribeId(stuId);
            setModalOpen(true);
          }}
        />
      )}

      {/* Add / Edit / Reinscribe Modal */}
      {modalOpen && (
        <StudentInscriptionModal
          db={db}
          editing={editingRow}
          reinscribeStudentId={reinscribeId}
          defaultAnneeId={defaultAnneeId}
          onClose={() => {
            setModalOpen(false);
            setEditingRow(null);
            setReinscribeId(null);
          }}
          onSave={(nextDb, msg) => {
            onUpdateDb(nextDb, msg);
            setModalOpen(false);
            setEditingRow(null);
            setReinscribeId(null);
          }}
        />
      )}

      {/* Batch Reinscription Modal */}
      {batchReinscribeOpen && selectedRows.length > 0 && (
        <BatchReinscriptionModal
          db={db}
          selectedStudentIds={selectedRows.map((r) => r.idEtudiant)}
          onClose={() => setBatchReinscribeOpen(false)}
          onConfirm={(nextDb, created, skipped) => {
            onUpdateDb(
              nextDb,
              `${created} réinscription(s) créée(s)${
                skipped > 0 ? `, ${skipped} déjà inscrit(s) ignoré(s)` : ''
              }.`
            );
            setBatchReinscribeOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* Single Certificate Preview & Print Modal */}
      {certificateRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-4 print:static print:bg-white print:p-0">
          <div className="max-w-[840px] mx-auto space-y-4">
            <div className="no-print bg-white border border-slate-200 rounded-lg px-5 py-3 flex items-center justify-between gap-4 sticky top-4 z-10 shadow-md">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Certificat de Scolarité — {certificateRow.nom} {certificateRow.prenom}
                </p>
                <p className="text-xs text-slate-500">
                  {certificateRow.faculte} · {certificateRow.mention} · {certificateRow.niveau}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBatchPrintActive(false);
                    window.print();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setCertificateRow(null)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <CertificateDocument record={certificateRow} settings={certSettings} />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (FEN_ChoixAvantSuppression) */}
      {deleteTarget && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">
              Confirmation de suppression
            </h3>
            <p className="text-sm text-slate-600">
              Voulez-vous vraiment supprimer l&apos;inscription de{' '}
              <strong className="text-slate-900">
                {deleteTarget.nom} {deleteTarget.prenom}
              </strong>{' '}
              ({deleteTarget.mention} · {deleteTarget.niveau}) ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setBulkDeleteOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-red-700">
              Suppression groupée ({selectedRows.length})
            </h3>
            <p className="text-sm text-slate-600">
              Voulez-vous supprimer les <strong>{selectedRows.length}</strong> inscription(s)
              sélectionnée(s) ? Les fiches étudiants n&apos;ayant plus d&apos;autres inscriptions
              seront également supprimées.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Supprimer {selectedRows.length} inscription(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
