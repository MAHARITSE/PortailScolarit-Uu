import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  GitMerge,
  Pencil,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  auditDatabase,
  computeDashboardStats,
  enrichInscriptions,
  formatDateFR,
  mergeDuplicateStudents,
  normalizeAllSexCodes,
} from '../services/database';
import {
  EnrichedInscription,
  ScolariteDatabase,
} from '../types/scolarite';
import { QuickFilterMode } from './AccueilView';
import { StudentInscriptionModal } from './StudentInscriptionModal';

interface DashboardViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
  onJumpToStudents: (filter: QuickFilterMode) => void;
}

export function DashboardView({
  db,
  onUpdateDb,
  onJumpToStudents,
}: DashboardViewProps) {
  const [selectedAnnee, setSelectedAnnee] = useState<string>(
    db.annees[0]?.annee ?? 'ALL'
  );
  const [editingAnomalyRow, setEditingAnomalyRow] =
    useState<EnrichedInscription | null>(null);

  const stats = useMemo(
    () => computeDashboardStats(db, selectedAnnee),
    [db, selectedAnnee]
  );
  const audit = useMemo(() => auditDatabase(db), [db]);
  const allEnriched = useMemo(() => enrichInscriptions(db), [db]);

  const enrichedByStudentId = useMemo(() => {
    const map = new Map<number, EnrichedInscription>();
    for (const r of allEnriched) {
      if (!map.has(r.idEtudiant)) map.set(r.idEtudiant, r);
    }
    return map;
  }, [allEnriched]);

  const malePct =
    stats.totalInscriptions > 0
      ? Math.round((stats.maleCount / stats.totalInscriptions) * 100)
      : 0;
  const femalePct =
    stats.totalInscriptions > 0
      ? Math.round((stats.femaleCount / stats.totalInscriptions) * 100)
      : 0;

  const handleNormalizeSex = () => {
    const { nextDb, updatedCount } = normalizeAllSexCodes(db);
    if (updatedCount > 0) {
      onUpdateDb(
        nextDb,
        `${updatedCount} code(s) sexe normalisé(s) (G/g → M, f → F).`
      );
    } else {
      onUpdateDb(nextDb, 'Tous les codes sexe M/F sont déjà normalisés.');
    }
  };

  const handleMergePair = (keepId: number, removeId: number) => {
    const nextDb = mergeDuplicateStudents(db, keepId, removeId);
    onUpdateDb(
      nextDb,
      `Fiches #${keepId} et #${removeId} fusionnées avec succès.`
    );
  };

  const maxMentionTotal = Math.max(1, ...stats.byMention.map((m) => m.total));
  const maxFaculteTotal = Math.max(1, ...stats.byFaculte.map((f) => f.total));

  return (
    <div className="space-y-6">
      {/* Header & Year Selector */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-display">
              Tableau de Bord &amp; Contrôle Qualité
            </h2>
            <p className="text-xs text-slate-500">
              Indicateurs d&apos;effectifs, répartition académique et audit d&apos;intégrité
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-xs font-medium text-slate-600">
            Périmètre :
          </label>
          <select
            value={selectedAnnee}
            onChange={(e) => setSelectedAnnee(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 font-medium"
          >
            <option value="ALL">Toutes les années</option>
            {db.annees.map((a) => (
              <option key={a.id} value={a.annee}>
                Année {a.annee}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Inscriptions actives</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums font-display">
            {stats.totalInscriptions.toLocaleString('fr-FR')}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {stats.uniqueStudents.toLocaleString('fr-FR')} étudiant(s) unique(s) ·{' '}
            {stats.multiYearStudents} réinscrit(s)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Parité Hommes / Femmes</span>
            <span className="font-mono text-[11px] text-slate-600">
              {malePct}% H / {femalePct}% F
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold text-blue-700 tabular-nums font-display">
              {stats.maleCount} H
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xl font-bold text-pink-700 tabular-nums font-display">
              {stats.femaleCount} F
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-600 h-full"
              style={{ width: `${malePct}%` }}
            />
            <div
              className="bg-pink-500 h-full"
              style={{ width: `${femalePct}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Complétude CIN</span>
            <span className="font-mono text-[11px] text-emerald-700 font-semibold">
              {stats.cinCompletionRate}%
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums font-display">
            {stats.withCinCount.toLocaleString('fr-FR')}
            <span className="text-sm font-normal text-slate-400">
              {' '}
              / {stats.totalInscriptions}
            </span>
          </p>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full"
              style={{ width: `${stats.cinCompletionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Qualité des données</span>
            {audit.totalAnomalies === 0 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <p
            className={`text-2xl font-bold tabular-nums font-display ${
              audit.totalAnomalies === 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {audit.totalAnomalies.toLocaleString('fr-FR')}
          </p>
          <p className="text-xs text-slate-500">
            {audit.totalAnomalies === 0
              ? 'Aucune anomalie critique détectée'
              : `${audit.duplicateStudents.length} doublon(s), ${audit.suspiciousBirthdates.length} date(s), ${audit.nonStandardSex.length} code(s) sexe`}
          </p>
        </div>
      </div>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mentions Breakdown */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Effectifs par Mention
            </h3>
            <span className="text-[11px] text-slate-500">
              Bleu : Hommes · Rose : Femmes
            </span>
          </div>

          {stats.byMention.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Aucune donnée pour ce périmètre.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.byMention.map((item) => {
                const share =
                  stats.totalInscriptions > 0
                    ? Math.round((item.total / stats.totalInscriptions) * 100)
                    : 0;
                const maleWidth = (item.male / maxMentionTotal) * 100;
                const femaleWidth = (item.female / maxMentionTotal) * 100;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate pr-2">
                        {item.label}
                      </span>
                      <span className="font-mono text-slate-600 tabular-nums shrink-0">
                        <strong className="text-slate-900">{item.total}</strong> ({share}%) ·{' '}
                        <span className="text-blue-700">{item.male}H</span> /{' '}
                        <span className="text-pink-700">{item.female}F</span>
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded overflow-hidden flex">
                      <div
                        className="bg-blue-600 h-full transition-all"
                        style={{ width: `${maleWidth}%` }}
                        title={`${item.male} Hommes`}
                      />
                      <div
                        className="bg-pink-500 h-full transition-all"
                        style={{ width: `${femaleWidth}%` }}
                        title={`${item.female} Femmes`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Faculté & Niveau Breakdown */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Effectifs par Faculté &amp; Niveau
            </h3>
            {stats.byFaculte.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Aucune donnée.
              </p>
            ) : (
              <div className="space-y-2.5">
                {stats.byFaculte.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate pr-2">
                        {item.label}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {item.total}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded"
                        style={{
                          width: `${(item.total / maxFaculteTotal) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stats.byNiveau.length > 0 && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                {stats.byNiveau.map((niv) => (
                  <div
                    key={niv.label}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs flex items-center gap-2"
                  >
                    <span className="font-medium text-slate-700">{niv.label}</span>
                    <span className="font-mono font-bold text-blue-700 tabular-nums">
                      {niv.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Lieux de délivrance */}
          {stats.topLieuxDelivrance.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Principaux lieux de délivrance CIN
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.topLieuxDelivrance.map((lieu) => (
                  <span
                    key={lieu.label}
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-700 inline-flex items-center gap-1.5"
                  >
                    <span>{lieu.label}</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {lieu.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Quality & Cleanup Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Audit &amp; Nettoyage des Données
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Détection automatique des doublons, dates aberrantes et champs à compléter
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {audit.nonStandardSex.length > 0 && (
              <button
                type="button"
                onClick={handleNormalizeSex}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Normaliser {audit.nonStandardSex.length} code(s) sexe (G/g → M, f → F)
              </button>
            )}
            <button
              type="button"
              onClick={() => onJumpToStudents('no_cin')}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              Sans CIN ({audit.missingCin.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onJumpToStudents('anomalies')}
              className="px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 inline-flex items-center gap-1.5"
            >
              Filtrer anomalies
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Suspicious Birthdates */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Dates de naissance à vérifier ({audit.suspiciousBirthdates.length})
              </span>
            </div>
            {audit.suspiciousBirthdates.length === 0 ? (
              <div className="p-5 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Toutes les dates de naissance sont cohérentes.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {audit.suspiciousBirthdates.map(({ etudiant, reason }) => {
                  const enriched = enrichedByStudentId.get(etudiant.id);
                  return (
                    <div
                      key={etudiant.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {etudiant.nom} {etudiant.prenom}
                        </p>
                        <p className="text-amber-700 mt-0.5">
                          <span className="font-mono tabular-nums">
                            {formatDateFR(etudiant.dateNaissance)}
                          </span>{' '}
                          — {reason}
                        </p>
                      </div>
                      {enriched && (
                        <button
                          type="button"
                          onClick={() => setEditingAnomalyRow(enriched)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded inline-flex items-center gap-1 shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                          Corriger
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Duplicate Students */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Doublons potentiels d&apos;étudiants ({audit.duplicateStudents.length})
              </span>
            </div>
            {audit.duplicateStudents.length === 0 ? (
              <div className="p-5 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Aucun doublon détecté.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {audit.duplicateStudents.map((grp) => {
                  const primary = grp.etudiants[0];
                  const secondary = grp.etudiants[1];
                  return (
                    <div key={grp.key} className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-amber-800">
                          {grp.reason}
                        </span>
                        {primary && secondary && (
                          <button
                            type="button"
                            onClick={() =>
                              handleMergePair(primary.id, secondary.id)
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded inline-flex items-center gap-1"
                          >
                            <GitMerge className="w-3 h-3" />
                            Fusionner vers #{primary.id}
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {grp.etudiants.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200/80"
                          >
                            <span className="font-medium text-slate-800">
                              <span className="font-mono text-slate-400 mr-1.5">
                                #{e.id}
                              </span>
                              {e.nom} {e.prenom}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                              {formatDateFR(e.dateNaissance) || '—'} ·{' '}
                              {e.telephone || 'Sans tél'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal for fixing anomalous records directly from Dashboard */}
      {editingAnomalyRow && (
        <StudentInscriptionModal
          db={db}
          editing={editingAnomalyRow}
          onClose={() => setEditingAnomalyRow(null)}
          onSave={(nextDb, msg) => {
            onUpdateDb(nextDb, msg);
            setEditingAnomalyRow(null);
          }}
        />
      )}
    </div>
  );
}
