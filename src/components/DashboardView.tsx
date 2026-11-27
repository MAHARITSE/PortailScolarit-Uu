import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  auditDatabase,
  computeDashboardStats,
  enrichInscriptions,
} from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';
import { QuickFilterMode } from './AccueilView';
import { AuditCleanupModal, AuditTab } from './AuditCleanupModal';

interface DashboardViewProps {
  db: ScolariteDatabase;
  /** Année universitaire de travail (une seule à la fois) */
  anneeActive: string;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
  onJumpToStudents: (filter: QuickFilterMode) => void;
}

export function DashboardView({
  db,
  anneeActive,
  onUpdateDb,
  onJumpToStudents,
}: DashboardViewProps) {
  const [auditTab, setAuditTab] = useState<AuditTab | null>(null);

  const stats = useMemo(
    () => computeDashboardStats(db, anneeActive),
    [db, anneeActive]
  );
  const audit = useMemo(() => auditDatabase(db), [db]);

  const malePct =
    stats.totalInscriptions > 0
      ? Math.round((stats.maleCount / stats.totalInscriptions) * 100)
      : 0;
  const femalePct =
    stats.totalInscriptions > 0
      ? Math.round((stats.femaleCount / stats.totalInscriptions) * 100)
      : 0;

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

        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
          <CalendarRange className="w-3.5 h-3.5 text-blue-700" />
          <span className="text-xs font-medium text-blue-900">
            Année universitaire {anneeActive || '—'}
          </span>
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
      {/* Audit & Nettoyage — synthèse compacte, le détail s'ouvre en modale */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
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
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Audit &amp; Nettoyage des Données
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Détection automatique des doublons, dates aberrantes et champs à compléter
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {[
                { label: 'doublon(s)', count: audit.duplicateStudents.length },
                { label: 'date(s)', count: audit.suspiciousBirthdates.length },
                {
                  label: 'champ(s) manquant(s)',
                  count: audit.missingCin.length + audit.missingTelephone.length,
                },
                { label: 'code(s) sexe', count: audit.nonStandardSex.length },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className={`px-2 py-0.5 text-[11px] rounded-full border tabular-nums ${
                    chip.count > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <strong className="font-semibold">{chip.count}</strong> {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {audit.nonStandardSex.length > 0 && (
            <button
              type="button"
              onClick={() => setAuditTab('codes')}
              className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Corriger {audit.nonStandardSex.length} code(s) sexe
            </button>
          )}
          <button
            type="button"
            onClick={() => setAuditTab('synthese')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Ouvrir l&apos;audit ({audit.totalAnomalies})
          </button>
        </div>
      </div>

      {auditTab && (
        <AuditCleanupModal
          db={db}
          audit={audit}
          anneeActive={anneeActive}
          initialTab={auditTab}
          onClose={() => setAuditTab(null)}
          onUpdateDb={onUpdateDb}
          onJumpToStudents={onJumpToStudents}
        />
      )}
    </div>
  );
}
