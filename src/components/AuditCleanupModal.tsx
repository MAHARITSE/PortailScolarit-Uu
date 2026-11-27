import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Download,
  Files,
  GitMerge,
  Link2Off,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  VenusAndMars,
  X,
} from 'lucide-react';
import {
  enrichInscriptions,
  exportAuditReportToCsv,
  formatDateFR,
  mergeDuplicateStudents,
  normalizeAllSexCodes,
  normalizeSex,
} from '../services/database';
import {
  DatabaseAuditReport,
  EnrichedInscription,
  Etudiant,
  ScolariteDatabase,
} from '../types/scolarite';
import { QuickFilterMode } from './AccueilView';
import { StudentInscriptionModal } from './StudentInscriptionModal';

export type AuditTab = 'synthese' | 'doublons' | 'dates' | 'champs' | 'codes' | 'references';

interface AuditCleanupModalProps {
  db: ScolariteDatabase;
  audit: DatabaseAuditReport;
  anneeActive: string;
  /** Onglet affiché à l'ouverture (synthèse par défaut) */
  initialTab?: AuditTab;
  onClose: () => void;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
  onJumpToStudents: (filter: QuickFilterMode) => void;
}

interface PendingMerge {
  keepId: number;
  removeId: number;
}

const TABS: { key: AuditTab; label: string; icon: typeof Files }[] = [
  { key: 'synthese', label: 'Synthèse', icon: Sparkles },
  { key: 'doublons', label: 'Doublons', icon: Users },
  { key: 'dates', label: 'Dates', icon: CalendarClock },
  { key: 'champs', label: 'Champs à compléter', icon: Files },
  { key: 'codes', label: 'Codes sexe', icon: VenusAndMars },
  { key: 'references', label: 'Références', icon: Link2Off },
];

export function AuditCleanupModal({
  db,
  audit,
  anneeActive,
  initialTab = 'synthese',
  onClose,
  onUpdateDb,
  onJumpToStudents,
}: AuditCleanupModalProps) {
  const [tab, setTab] = useState<AuditTab>(initialTab);
  const [search, setSearch] = useState('');
  const [editingRow, setEditingRow] = useState<EnrichedInscription | null>(null);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);

  const enrichedByStudentId = useMemo(() => {
    const map = new Map<number, EnrichedInscription>();
    for (const row of enrichInscriptions(db)) {
      if (!map.has(row.idEtudiant)) map.set(row.idEtudiant, row);
    }
    return map;
  }, [db]);

  // Bloque le défilement de la page derrière la modale
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Laisse la modale d'édition gérer sa propre fermeture
      if (editingRow) return;
      if (pendingMerge) {
        setPendingMerge(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingRow, onClose, pendingMerge]);

  const missingFieldsCount =
    audit.missingCin.length + audit.missingTelephone.length;
  const referenceIssuesCount =
    audit.duplicateReferences.length +
    audit.duplicateNumInscriptions.length +
    audit.orphanInscriptions.length;

  const counts: Record<AuditTab, number> = {
    synthese: audit.totalAnomalies + missingFieldsCount,
    doublons: audit.duplicateStudents.length,
    dates: audit.suspiciousBirthdates.length,
    champs: missingFieldsCount,
    codes: audit.nonStandardSex.length,
    references: referenceIssuesCount,
  };

  const query = search.trim().toLowerCase();
  const matchesStudent = (e: Etudiant) =>
    !query ||
    `${e.nom} ${e.prenom} ${e.numeroCin} ${e.telephone} ${e.id}`
      .toLowerCase()
      .includes(query);

  const handleNormalizeSex = () => {
    const { nextDb, updatedCount } = normalizeAllSexCodes(db);
    onUpdateDb(
      nextDb,
      updatedCount > 0
        ? `${updatedCount} code(s) sexe normalisé(s) (G/g → M, f → F).`
        : 'Tous les codes sexe M/F sont déjà normalisés.'
    );
  };

  const handleConfirmMerge = () => {
    if (!pendingMerge) return;
    const nextDb = mergeDuplicateStudents(
      db,
      pendingMerge.keepId,
      pendingMerge.removeId
    );
    onUpdateDb(
      nextDb,
      `Fiches #${pendingMerge.keepId} et #${pendingMerge.removeId} fusionnées avec succès.`
    );
    setPendingMerge(null);
  };

  const handleJump = (filter: QuickFilterMode) => {
    onJumpToStudents(filter);
    onClose();
  };

  const renderStudentActions = (etudiant: Etudiant) => {
    const row = enrichedByStudentId.get(etudiant.id);
    return (
      <button
        type="button"
        disabled={!row}
        title={
          row
            ? 'Corriger cette fiche'
            : 'Aucune inscription : ouverture impossible depuis ce module'
        }
        onClick={() => row && setEditingRow(row)}
        className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded inline-flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Pencil className="w-3 h-3" />
        Corriger
      </button>
    );
  };

  const emptyState = (message: string) => (
    <div className="p-6 text-xs text-emerald-700 flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4" />
      {message}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                audit.totalAnomalies > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {audit.totalAnomalies > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="audit-modal-title"
                className="text-base font-semibold text-slate-900 font-display"
              >
                Audit &amp; Nettoyage des Données
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Détection automatique des doublons, dates aberrantes et champs à
                compléter · Année {anneeActive || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportAuditReportToCsv(audit, anneeActive)}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (CSV)
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'audit"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="px-3 sm:px-5 pt-3 border-b border-slate-200 flex gap-1 overflow-x-auto">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            const count = counts[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                {item.key !== 'synthese' && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-full tabular-nums ${
                      count > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'synthese' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    key: 'codes' as AuditTab,
                    icon: VenusAndMars,
                    label: 'Codes sexe non standard',
                    count: audit.nonStandardSex.length,
                    hint: 'G / g / f / D à convertir en M ou F',
                  },
                  {
                    key: 'dates' as AuditTab,
                    icon: CalendarClock,
                    label: 'Dates de naissance suspectes',
                    count: audit.suspiciousBirthdates.length,
                    hint: 'Dates futures, illisibles ou trop anciennes',
                  },
                  {
                    key: 'doublons' as AuditTab,
                    icon: Users,
                    label: 'Doublons étudiants',
                    count: audit.duplicateStudents.length,
                    hint: 'Même CIN ou même identité + date de naissance',
                  },
                  {
                    key: 'champs' as AuditTab,
                    icon: Files,
                    label: 'Champs à compléter',
                    count: missingFieldsCount,
                    hint: `${audit.missingCin.length} CIN · ${audit.missingTelephone.length} téléphone(s)`,
                  },
                  {
                    key: 'references' as AuditTab,
                    icon: Link2Off,
                    label: 'Références & liens',
                    count: referenceIssuesCount,
                    hint: `${audit.duplicateReferences.length} réf. · ${audit.duplicateNumInscriptions.length} n° inscr. · ${audit.orphanInscriptions.length} orpheline(s)`,
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  const ok = card.count === 0;
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() => setTab(card.key)}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        ok
                          ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                          : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={`w-4 h-4 ${
                            ok ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        />
                        <span
                          className={`font-mono text-lg font-bold tabular-nums ${
                            ok ? 'text-emerald-700' : 'text-amber-800'
                          }`}
                        >
                          {card.count}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-900">
                        {card.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {ok ? 'Aucune anomalie' : card.hint}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions rapides
                </h3>
                <div className="flex flex-wrap gap-2">
                  {audit.nonStandardSex.length > 0 && (
                    <button
                      type="button"
                      onClick={handleNormalizeSex}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Normaliser {audit.nonStandardSex.length} code(s) sexe
                    </button>
                  )}
                  {audit.duplicateStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('doublons')}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 inline-flex items-center gap-1.5"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Examiner les doublons
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTab('champs')}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
                  >
                    <Files className="w-3.5 h-3.5" />
                    Compléter les champs manquants
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJump('anomalies')}
                    className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 inline-flex items-center gap-1.5"
                  >
                    Filtrer anomalies dans la liste
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {tab !== 'synthese' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer par nom, prénom, CIN, téléphone ou identifiant…"
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          )}

          {tab === 'codes' && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Codes sexe à normaliser ({audit.nonStandardSex.length})
                </span>
                {audit.nonStandardSex.length > 0 && (
                  <button
                    type="button"
                    onClick={handleNormalizeSex}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Tout normaliser
                  </button>
                )}
              </div>
              {audit.nonStandardSex.length === 0
                ? emptyState('Tous les codes sexe sont conformes (M / F).')
                : (
                    <div className="divide-y divide-slate-100 max-h-[46vh] overflow-y-auto">
                      {audit.nonStandardSex
                        .filter(matchesStudent)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">
                                <span className="font-mono text-slate-400 mr-1.5">
                                  #{e.id}
                                </span>
                                {e.nom} {e.prenom}
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                Valeur actuelle :{' '}
                                <span className="font-mono font-semibold text-amber-700">
                                  {e.sexe || '∅'}
                                </span>{' '}
                                → <span className="font-semibold text-emerald-700">
                                  {normalizeSex(e.sexe)}
                                </span>
                              </p>
                            </div>
                            {renderStudentActions(e)}
                          </div>
                        ))}
                    </div>
                  )}
            </div>
          )}

          {tab === 'dates' && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                Dates de naissance à vérifier (
                {audit.suspiciousBirthdates.length})
              </div>
              {audit.suspiciousBirthdates.length === 0
                ? emptyState('Toutes les dates de naissance sont cohérentes.')
                : (
                    <div className="divide-y divide-slate-100 max-h-[46vh] overflow-y-auto">
                      {audit.suspiciousBirthdates
                        .filter((item) => matchesStudent(item.etudiant))
                        .map(({ etudiant, reason }) => (
                          <div
                            key={etudiant.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">
                                <span className="font-mono text-slate-400 mr-1.5">
                                  #{etudiant.id}
                                </span>
                                {etudiant.nom} {etudiant.prenom}
                              </p>
                              <p className="text-amber-700 mt-0.5">
                                <span className="font-mono tabular-nums">
                                  {formatDateFR(etudiant.dateNaissance) || '∅'}
                                </span>{' '}
                                — {reason}
                              </p>
                            </div>
                            {renderStudentActions(etudiant)}
                          </div>
                        ))}
                    </div>
                  )}
            </div>
          )}

          {tab === 'champs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    CIN manquant ({audit.missingCin.length})
                  </span>
                  {audit.missingCin.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleJump('no_cin')}
                      className="text-[11px] font-medium text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      Voir la liste
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {audit.missingCin.length === 0
                  ? emptyState('Tous les étudiants ont un CIN.')
                  : (
                      <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
                        {audit.missingCin
                          .filter(matchesStudent)
                          .map((e) => (
                            <div
                              key={e.id}
                              className="px-4 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                            >
                              <span className="font-medium text-slate-800 truncate">
                                <span className="font-mono text-slate-400 mr-1.5">
                                  #{e.id}
                                </span>
                                {e.nom} {e.prenom}
                              </span>
                              {renderStudentActions(e)}
                            </div>
                          ))}
                      </div>
                    )}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                  Téléphone manquant ({audit.missingTelephone.length})
                </div>
                {audit.missingTelephone.length === 0
                  ? emptyState('Tous les étudiants ont un téléphone.')
                  : (
                      <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
                        {audit.missingTelephone
                          .filter(matchesStudent)
                          .map((e) => (
                            <div
                              key={e.id}
                              className="px-4 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                            >
                              <span className="font-medium text-slate-800 truncate">
                                <span className="font-mono text-slate-400 mr-1.5">
                                  #{e.id}
                                </span>
                                {e.nom} {e.prenom}
                              </span>
                              {renderStudentActions(e)}
                            </div>
                          ))}
                      </div>
                    )}
              </div>
            </div>
          )}

          {tab === 'doublons' && (
            <div className="space-y-3">
              {audit.duplicateStudents.length === 0 &&
                emptyState('Aucun doublon détecté.')}
              {audit.duplicateStudents.map((grp) => {
                const keep = grp.etudiants[0];
                const others = grp.etudiants.slice(1);
                return (
                  <div
                    key={grp.key}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-amber-50/60 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-900 inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {grp.reason}
                      </span>
                      <span className="text-[11px] text-amber-800">
                        {grp.etudiants.length} fiche(s)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {grp.etudiants.map((e) => (
                        <div
                          key={e.id}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              <span className="font-mono text-slate-400 mr-1.5">
                                #{e.id}
                              </span>
                              {e.nom} {e.prenom}
                            </p>
                            <p className="text-slate-500 mt-0.5 font-mono text-[11px] tabular-nums">
                              {formatDateFR(e.dateNaissance) || '—'} ·{' '}
                              {e.telephone || 'Sans tél'} ·{' '}
                              {e.numeroCin || 'Sans CIN'}
                            </p>
                          </div>
                          {e.id === keep.id ? (
                            <span className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded shrink-0">
                              Fiche conservée
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingMerge({
                                  keepId: keep.id,
                                  removeId: e.id,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded inline-flex items-center gap-1 shrink-0"
                            >
                              <GitMerge className="w-3 h-3" />
                              Fusionner dans #{keep.id}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {pendingMerge &&
                      others.some((e) => e.id === pendingMerge.removeId) &&
                      pendingMerge.keepId === keep.id && (
                        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-red-800">
                            Fusionner la fiche{' '}
                            <strong>#{pendingMerge.removeId}</strong> dans{' '}
                            <strong>#{pendingMerge.keepId}</strong> ? Les
                            inscriptions seront rattachées et la fiche supprimée.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleConfirmMerge}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 rounded hover:bg-red-700"
                            >
                              Confirmer la fusion
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingMerge(null)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'references' && (
            <div className="space-y-3">
              {referenceIssuesCount === 0 &&
                emptyState(
                  'Aucune référence dupliquée, aucun numéro d’inscription dupliqué, aucune inscription orpheline.'
                )}

              {audit.orphanInscriptions.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-xs font-semibold text-red-800">
                    Inscriptions orphelines ({audit.orphanInscriptions.length})
                  </div>
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto text-xs">
                    {audit.orphanInscriptions.map((ins) => (
                      <div key={ins.id} className="px-4 py-2 font-mono text-slate-700">
                        #{ins.id} — étudiant #{ins.idEtudiant} · mention #
                        {ins.idMention} · niveau #{ins.idNiveau} · année #
                        {ins.idAnnee}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {[
                {
                  title: 'Références en double (même année)',
                  entries: audit.duplicateReferences,
                },
                {
                  title: 'Numéros d’inscription en double (même année)',
                  entries: audit.duplicateNumInscriptions,
                },
              ].map((block) => (
                <div
                  key={block.title}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                    {block.title} ({block.entries.length})
                  </div>
                  {block.entries.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500">
                      Aucun doublon.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto text-xs">
                      {block.entries.map((entry) => (
                        <div
                          key={`${entry.annee}-${entry.value}`}
                          className="px-4 py-2 flex items-center justify-between gap-3"
                        >
                          <span className="font-mono font-semibold text-slate-800">
                            {entry.value}
                          </span>
                          <span className="text-slate-500">
                            {entry.annee} · inscriptions{' '}
                            {entry.inscriptionIds.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pied de modale */}
        <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleJump('anomalies')}
              className="px-3 py-1.5 font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 inline-flex items-center gap-1.5"
            >
              Filtrer anomalies
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleJump('no_cin')}
              className="px-3 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              Sans CIN ({audit.missingCin.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200"
          >
            Fermer
          </button>
        </div>
      </div>

      {editingRow && (
        <StudentInscriptionModal
          db={db}
          editing={editingRow}
          onClose={() => setEditingRow(null)}
          onSave={(nextDb, msg) => {
            onUpdateDb(nextDb, msg);
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
}
