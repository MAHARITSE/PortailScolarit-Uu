import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import {
  createYearWithPointedStudents,
  enrichInscriptions,
  findNextNiveauId,
  formatDateFR,
  getLatestBaseAnneeId,
  sortAnneesDesc,
  suggestNextAnneeLabel,
} from '../services/database';
import { EnrichedInscription, ScolariteDatabase } from '../types/scolarite';

interface NewYearReinscriptionModalProps {
  db: ScolariteDatabase;
  mode?: 'create' | 'populate';
  initialTargetAnnee?: string;
  onClose: () => void;
  onConfirm: (
    nextDb: ScolariteDatabase,
    targetAnneeLabel: string,
    createdCount: number,
    skippedCount: number,
    isNewYear: boolean
  ) => void;
}

interface StudentOverride {
  idMention?: number;
  idNiveau?: number;
  idParcours?: number | null;
}

const PAGE_SIZE = 50;

export function NewYearReinscriptionModal({
  db,
  mode = 'create',
  initialTargetAnnee,
  onClose,
  onConfirm,
}: NewYearReinscriptionModalProps) {
  const sortedAnnees = useMemo(() => sortAnneesDesc(db.annees), [db.annees]);

  const [targetLabel, setTargetLabel] = useState<string>(() => {
    if (mode === 'populate' && initialTargetAnnee) return initialTargetAnnee;
    if (initialTargetAnnee && mode === 'create') return initialTargetAnnee;
    return suggestNextAnneeLabel(db.annees);
  });

  const existingTargetAnnee = useMemo(
    () =>
      db.annees.find(
        (a) => a.annee.trim().toLowerCase() === targetLabel.trim().toLowerCase()
      ) ?? null,
    [db.annees, targetLabel]
  );

  const [baseAnneeId, setBaseAnneeId] = useState<number>(() =>
    getLatestBaseAnneeId(
      db,
      mode === 'populate'
        ? db.annees.find((a) => a.annee === initialTargetAnnee)?.id
        : undefined
    )
  );

  const [levelRule, setLevelRule] = useState<'next' | 'keep' | `fixed:${number}`>(
    'next'
  );
  const [autoGenerateNumbers, setAutoGenerateNumbers] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMention, setFilterMention] = useState<string>('');
  const [filterNiveau, setFilterNiveau] = useState<string>('');
  const [onlyPointed, setOnlyPointed] = useState<boolean>(false);
  const [hideAlreadyEnrolled, setHideAlreadyEnrolled] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [pointedIds, setPointedIds] = useState<Set<number>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<number, StudentOverride>>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const anneeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const ins of db.inscriptions) {
      counts.set(ins.idAnnee, (counts.get(ins.idAnnee) ?? 0) + 1);
    }
    return counts;
  }, [db.inscriptions]);

  const allEnriched = useMemo(() => enrichInscriptions(db), [db]);

  // One representative row per student from the selected base year
  const baseRows = useMemo(() => {
    const seen = new Set<number>();
    const list: EnrichedInscription[] = [];
    for (const row of allEnriched) {
      if (row.idAnnee !== baseAnneeId) continue;
      if (seen.has(row.idEtudiant)) continue;
      seen.add(row.idEtudiant);
      list.push(row);
    }
    return list;
  }, [allEnriched, baseAnneeId]);

  // Students already enrolled in the target year (if it already exists)
  const enrolledInTargetIds = useMemo(() => {
    if (!existingTargetAnnee) return new Set<number>();
    return new Set(
      db.inscriptions
        .filter((i) => i.idAnnee === existingTargetAnnee.id)
        .map((i) => i.idEtudiant)
    );
  }, [db.inscriptions, existingTargetAnnee]);

  const baseMentionOptions = useMemo(() => {
    const set = new Set(baseRows.map((r) => r.mention).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [baseRows]);

  const baseNiveauOptions = useMemo(() => {
    const set = new Set(baseRows.map((r) => r.niveau).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [baseRows]);

  const resolveDefaultNiveauId = (baseNiveauId: number): number => {
    if (levelRule === 'keep') return baseNiveauId;
    if (levelRule === 'next') return findNextNiveauId(db.niveaux, baseNiveauId);
    const fixedId = Number(levelRule.replace('fixed:', ''));
    return fixedId || baseNiveauId;
  };

  const getEffectiveAssignment = (row: EnrichedInscription) => {
    const custom = overrides[row.idEtudiant];
    const idMention = custom?.idMention ?? row.idMention;
    const idNiveau = custom?.idNiveau ?? resolveDefaultNiveauId(row.idNiveau);
    const defaultParcours =
      idMention === row.idMention && idNiveau === row.idNiveau
        ? row.idParcours
        : null;
    const idParcours =
      custom && 'idParcours' in custom ? custom.idParcours ?? null : defaultParcours;
    return { idMention, idNiveau, idParcours };
  };

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseRows.filter((r) => {
      const already = enrolledInTargetIds.has(r.idEtudiant);
      if (hideAlreadyEnrolled && already) return false;
      if (onlyPointed && !pointedIds.has(r.idEtudiant)) return false;
      if (filterMention && r.mention !== filterMention) return false;
      if (filterNiveau && r.niveau !== filterNiveau) return false;
      if (!q) return true;
      return (
        r.nom.toLowerCase().includes(q) ||
        r.prenom.toLowerCase().includes(q) ||
        `${r.nom} ${r.prenom}`.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.numInscription.toLowerCase().includes(q) ||
        r.numeroCin.toLowerCase().includes(q)
      );
    });
  }, [
    baseRows,
    enrolledInTargetIds,
    hideAlreadyEnrolled,
    onlyPointed,
    pointedIds,
    filterMention,
    filterNiveau,
    searchQuery,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () =>
      filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage]
  );

  // Active pointed students (excluding those already in target year)
  const pointedRows = useMemo(
    () =>
      baseRows.filter(
        (r) => pointedIds.has(r.idEtudiant) && !enrolledInTargetIds.has(r.idEtudiant)
      ),
    [baseRows, pointedIds, enrolledInTargetIds]
  );

  const toggleStudent = (idEtudiant: number) => {
    if (enrolledInTargetIds.has(idEtudiant)) return;
    setPointedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idEtudiant)) next.delete(idEtudiant);
      else next.add(idEtudiant);
      return next;
    });
  };

  const checkAllFiltered = () => {
    setPointedIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredRows) {
        if (!enrolledInTargetIds.has(r.idEtudiant)) {
          next.add(r.idEtudiant);
        }
      }
      return next;
    });
  };

  const uncheckAllFiltered = () => {
    const filteredSet = new Set(filteredRows.map((r) => r.idEtudiant));
    setPointedIds((prev) => {
      const next = new Set(prev);
      for (const id of filteredSet) next.delete(id);
      return next;
    });
  };

  const handleBaseAnneeChange = (nextBaseId: number) => {
    setBaseAnneeId(nextBaseId);
    setPointedIds(new Set());
    setOverrides({});
    setFilterMention('');
    setFilterNiveau('');
    setPage(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = targetLabel.trim();
    if (!cleanTarget) {
      setErrorMsg("Veuillez saisir le nom de l'année universitaire cible (ex. 2025-2026).");
      return;
    }

    if (mode === 'populate' && pointedRows.length === 0) {
      setErrorMsg('Pointez au moins un étudiant à ajouter pour cette année.');
      return;
    }

    const entries = pointedRows.map((row) => {
      const assigned = getEffectiveAssignment(row);
      return {
        idEtudiant: row.idEtudiant,
        idMention: assigned.idMention,
        idNiveau: assigned.idNiveau,
        idParcours: assigned.idParcours,
      };
    });

    const result = createYearWithPointedStudents(db, {
      targetAnneeLabel: cleanTarget,
      targetAnneeId: existingTargetAnnee?.id,
      entries,
      autoGenerateNumbers,
    });

    onConfirm(
      result.nextDb,
      result.targetAnnee.annee,
      result.createdCount,
      result.skippedCount,
      result.isNewYear
    );
  };

  const baseAnneeObj = db.annees.find((a) => a.id === baseAnneeId);

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-50 text-blue-700 shrink-0">
              {mode === 'create' ? (
                <CalendarPlus className="w-5 h-5" />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 font-display">
                {mode === 'create'
                  ? 'Nouvelle année universitaire — Pointer les étudiants'
                  : `Pointer des étudiants vers ${targetLabel || 'l’année choisie'}`}
              </h3>
              <p className="text-xs text-slate-500">
                Prenez la dernière année comme base et cochez un à un les étudiants à reconduire sans ressaisir leurs informations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          {/* Top Configuration */}
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
            {errorMsg && (
              <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {mode === 'create'
                    ? 'Nouvelle année universitaire *'
                    : 'Année universitaire cible *'}
                </label>
                {mode === 'populate' && sortedAnnees.length > 0 ? (
                  <select
                    value={targetLabel}
                    onChange={(e) => {
                      setTargetLabel(e.target.value);
                      setErrorMsg('');
                    }}
                    className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-white text-slate-900"
                  >
                    {sortedAnnees.map((a) => (
                      <option key={a.id} value={a.annee}>
                        {a.annee} ({anneeCounts.get(a.id) ?? 0} inscr.)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={targetLabel}
                    onChange={(e) => {
                      setTargetLabel(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="ex. 2025-2026"
                    className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-white text-slate-900"
                  />
                )}
                <p className="mt-1 text-[10.5px] text-slate-500">
                  {existingTargetAnnee
                    ? `Année existante (${anneeCounts.get(existingTargetAnnee.id) ?? 0} inscrit(s) actuel(s))`
                    : 'Nouvelle année qui sera créée automatiquement'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Année de base (liste des étudiants)
                </label>
                <select
                  value={baseAnneeId}
                  onChange={(e) => handleBaseAnneeChange(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800"
                >
                  {sortedAnnees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.annee} ({anneeCounts.get(a.id) ?? 0} étudiants)
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10.5px] text-slate-500">
                  Par défaut : dernière année contenant des inscriptions
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Niveau appliqué par défaut
                </label>
                <select
                  value={levelRule}
                  onChange={(e) =>
                    setLevelRule(
                      e.target.value as 'next' | 'keep' | `fixed:${number}`
                    )
                  }
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800"
                >
                  <option value="next">
                    Passer au niveau supérieur (L1 → L2, L2 → L3…)
                  </option>
                  <option value="keep">
                    Conserver le même niveau ({baseAnneeObj?.annee || 'base'})
                  </option>
                  {db.niveaux.map((n) => (
                    <option key={n.id} value={`fixed:${n.id}`}>
                      Tous en : {n.niveau} ({n.grade})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10.5px] text-slate-500">
                  Modifiable individuellement sur chaque ligne pointée
                </p>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Chercher un étudiant (nom, prénom, réf., n° inscr., CIN)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                />
              </div>

              <select
                value={filterMention}
                onChange={(e) => {
                  setFilterMention(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrer par mention"
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
              >
                <option value="">Toutes mentions ({baseRows.length})</option>
                {baseMentionOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={filterNiveau}
                onChange={(e) => {
                  setFilterNiveau(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrer par niveau"
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
              >
                <option value="">Tous niveaux</option>
                {baseNiveauOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setOnlyPointed((v) => !v);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  onlyPointed
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Pointés ({pointedRows.length})
              </button>

              {existingTargetAnnee && (
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 px-2 py-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideAlreadyEnrolled}
                    onChange={(e) => {
                      setHideAlreadyEnrolled(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Masquer déjà inscrits
                </label>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={checkAllFiltered}
                  disabled={filteredRows.length === 0}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-40"
                >
                  Tout pointer ({filteredRows.length})
                </button>
                <button
                  type="button"
                  onClick={uncheckAllFiltered}
                  disabled={pointedRows.length === 0}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  Tout décocher
                </button>
              </div>
            </div>
          </div>

          {/* Student List (One-by-one pointing) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {baseRows.length === 0 ? (
              <div className="py-12 px-6 text-center text-slate-500 text-xs">
                <p className="font-semibold text-slate-700">
                  Aucun étudiant trouvé dans l&apos;année de base sélectionnée.
                </p>
                <p className="mt-1">
                  Choisissez une autre année de base ci-dessus ou créez l&apos;année vide pour importer/saisir plus tard.
                </p>
              </div>
            ) : pagedRows.length === 0 ? (
              <div className="py-12 px-6 text-center text-slate-500 text-xs">
                Aucun étudiant ne correspond aux filtres actuels.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">Ajouter</th>
                    <th className="px-3 py-2">Étudiant (fiche existante)</th>
                    <th className="px-3 py-2 whitespace-nowrap">
                      Base ({baseAnneeObj?.annee || '—'})
                    </th>
                    <th className="px-3 py-2">Mention pour {targetLabel || 'cible'}</th>
                    <th className="px-3 py-2">Niveau pour {targetLabel || 'cible'}</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {pagedRows.map((row) => {
                    const already = enrolledInTargetIds.has(row.idEtudiant);
                    const isPointed = !already && pointedIds.has(row.idEtudiant);
                    const assigned = getEffectiveAssignment(row);

                    return (
                      <tr
                        key={row.idEtudiant}
                        className={`transition-colors ${
                          already
                            ? 'bg-slate-50/70 opacity-65'
                            : isPointed
                              ? 'bg-emerald-50/60'
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={already || isPointed}
                            disabled={already}
                            onChange={() => toggleStudent(row.idEtudiant)}
                            aria-label={`Pointer ${row.nom} ${row.prenom}`}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td
                          onClick={() => !already && toggleStudent(row.idEtudiant)}
                          className={`px-3 py-2 ${already ? '' : 'cursor-pointer'}`}
                        >
                          <div className="font-semibold text-slate-900">
                            {row.nom} {row.prenom}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Réf. {row.reference || '—'} · N° {row.numInscription || '—'}
                            {row.dateNaissance
                              ? ` · Né(e) ${formatDateFR(row.dateNaissance)}`
                              : ''}
                          </div>
                        </td>
                        <td
                          onClick={() => !already && toggleStudent(row.idEtudiant)}
                          className={`px-3 py-2 whitespace-nowrap text-slate-600 ${
                            already ? '' : 'cursor-pointer'
                          }`}
                        >
                          <span className="font-medium text-slate-800">
                            {row.niveau}
                          </span>
                          <span className="text-slate-400"> · </span>
                          <span>{row.mention}</span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            disabled={already}
                            value={assigned.idMention}
                            onChange={(e) => {
                              const nextMention = Number(e.target.value);
                              setOverrides((prev) => ({
                                ...prev,
                                [row.idEtudiant]: {
                                  ...prev[row.idEtudiant],
                                  idMention: nextMention,
                                  idParcours: null,
                                },
                              }));
                              if (!pointedIds.has(row.idEtudiant) && !already) {
                                toggleStudent(row.idEtudiant);
                              }
                            }}
                            aria-label={`Mention pour ${row.nom} ${row.prenom}`}
                            className="w-full max-w-[190px] px-2 py-1 text-[11.5px] border border-slate-300 rounded bg-white disabled:bg-slate-100"
                          >
                            {db.mentions.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.mention}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            disabled={already}
                            value={assigned.idNiveau}
                            onChange={(e) => {
                              const nextNiveau = Number(e.target.value);
                              setOverrides((prev) => ({
                                ...prev,
                                [row.idEtudiant]: {
                                  ...prev[row.idEtudiant],
                                  idNiveau: nextNiveau,
                                  idParcours: null,
                                },
                              }));
                              if (!pointedIds.has(row.idEtudiant) && !already) {
                                toggleStudent(row.idEtudiant);
                              }
                            }}
                            aria-label={`Niveau pour ${row.nom} ${row.prenom}`}
                            className="w-full max-w-[160px] px-2 py-1 text-[11.5px] border border-slate-300 rounded bg-white disabled:bg-slate-100"
                          >
                            {db.niveaux.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.niveau} ({n.grade})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {already ? (
                            <span className="inline-flex px-2 py-0.5 text-[10.5px] font-medium rounded-full bg-slate-200 text-slate-700">
                              Déjà inscrit
                            </span>
                          ) : isPointed ? (
                            <span className="inline-flex px-2 py-0.5 text-[10.5px] font-semibold rounded-full bg-emerald-100 text-emerald-800">
                              À ajouter
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination bar when needed */}
          {filteredRows.length > PAGE_SIZE && (
            <div className="px-5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <span>
                Page {safePage} / {totalPages} · {filteredRows.length} étudiant(s) affichés
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateNumbers}
                onChange={(e) => setAutoGenerateNumbers(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>
                Générer automatiquement des numéros de référence et d&apos;inscription uniques
              </span>
            </label>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {existingTargetAnnee
                  ? `Ajouter ${pointedRows.length} étudiant(s) en ${existingTargetAnnee.annee}`
                  : pointedRows.length > 0
                    ? `Créer ${targetLabel.trim() || 'l’année'} + ${pointedRows.length} étudiant(s)`
                    : `Créer l’année ${targetLabel.trim() || ''}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
