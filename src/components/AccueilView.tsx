import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  enrichInscriptions,
  exportInscriptionsToXlsx,
  formatDateFR,
} from '../services/database';
import { EnrichedInscription, ScolariteDatabase } from '../types/scolarite';
import { CertificateDocument } from './CertificateDocument';
import { StudentInscriptionModal } from './StudentInscriptionModal';

interface AccueilViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase) => void;
}

type SortKey =
  | 'reference'
  | 'numInscription'
  | 'nom'
  | 'prenom'
  | 'dateNaissance'
  | 'faculte'
  | 'mention'
  | 'niveau';

export function AccueilView({ db, onUpdateDb }: AccueilViewProps) {
  const [selectedAnnee, setSelectedAnnee] = useState<string>(
    db.annees[0]?.annee ?? ''
  );
  const [selectedFaculte, setSelectedFaculte] = useState<string>('');
  const [selectedDomaine, setSelectedDomaine] = useState<string>('');
  const [selectedMention, setSelectedMention] = useState<string>('');
  const [selectedNiveau, setSelectedNiveau] = useState<string>('');
  const [selectedParcours, setSelectedParcours] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<EnrichedInscription | null>(null);
  const [certificateRow, setCertificateRow] = useState<EnrichedInscription | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedInscription | null>(null);

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

  const niveauOptions = useMemo(
    () => db.niveaux.map((n) => n.niveau),
    [db.niveaux]
  );

  const parcoursOptions = useMemo(() => {
    const menObj = db.mentions.find((m) => m.mention === selectedMention);
    const nivObj = db.niveaux.find((n) => n.niveau === selectedNiveau);
    return db.parcours
      .filter(
        (p) =>
          (!menObj || p.idMention === menObj.id) &&
          (!nivObj || p.idNiveau === nivObj.id)
      )
      .map((p) => p.parcours)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.mentions, db.niveaux, db.parcours, selectedMention, selectedNiveau]);

  const filteredRows = useMemo(() => {
    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const list = allEnriched.filter((row) => {
      if (effectiveAnnee !== 'ALL' && row.annee !== effectiveAnnee) return false;
      if (selectedFaculte && row.faculte !== selectedFaculte) return false;
      if (selectedDomaine && row.domaine !== selectedDomaine) return false;
      if (selectedMention && row.mention !== selectedMention) return false;
      if (selectedNiveau && row.niveau !== selectedNiveau) return false;
      if (selectedParcours && row.parcours !== selectedParcours) return false;

      if (tokens.length > 0) {
        const haystack =
          `${row.nom} ${row.prenom} ${row.reference} ${row.numInscription} ${row.numeroCin} ${row.mention}`.toLowerCase();
        if (!tokens.every((t) => haystack.includes(t))) return false;
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
  }, [
    allEnriched,
    effectiveAnnee,
    selectedFaculte,
    selectedDomaine,
    selectedMention,
    selectedNiveau,
    selectedParcours,
    searchQuery,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

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
    setSearchQuery('');
    setPage(1);
  };

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
    onUpdateDb(next);
    setDeleteTarget(null);
  };

  const defaultAnneeId = db.annees.find((a) => a.annee === effectiveAnnee)?.id ?? db.annees[0]?.id;

  return (
    <div className="space-y-5">
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
              placeholder="Rechercher par nom, prénom, référence, n° inscription ou CIN..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
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
              onClick={() => exportInscriptionsToXlsx(filteredRows, effectiveAnnee)}
              disabled={filteredRows.length === 0}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter Excel
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRow(null);
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
            {niveauOptions.map((n) => (
              <option key={n} value={n}>
                {n}
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
      </div>

      {/* Data Grid (TABLE_Etudiant) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
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
                <th className="px-3 py-2.5 whitespace-nowrap">Date naiss.</th>
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
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                    <p className="font-medium text-slate-700">Aucun étudiant trouvé</p>
                    <p className="text-xs mt-1">
                      Modifiez vos critères de recherche ou ajoutez une nouvelle inscription.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.idInscription} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {row.reference || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {row.numInscription || '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                      {row.nom}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.prenom}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateFR(row.dateNaissance) || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {row.telephone || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {row.numeroCin || '—'}
                    </td>
                    <td
                      className="px-3 py-2 text-xs text-slate-700 max-w-[180px] truncate"
                      title={row.faculte}
                    >
                      {row.faculte}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {row.mention}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {row.niveau}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCertificateRow(row)}
                          title="Imprimer le certificat de scolarité"
                          className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <FileCheck2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRow(row);
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
                ))
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

      {/* Add / Edit Modal */}
      {modalOpen && (
        <StudentInscriptionModal
          db={db}
          editing={editingRow}
          defaultAnneeId={defaultAnneeId}
          onClose={() => {
            setModalOpen(false);
            setEditingRow(null);
          }}
          onSave={(nextDb) => {
            onUpdateDb(nextDb);
            setModalOpen(false);
            setEditingRow(null);
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
                  onClick={() => window.print()}
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

            <CertificateDocument record={certificateRow} />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (FEN_ChoixAvantSuppression) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
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
    </div>
  );
}
