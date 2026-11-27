import { ChangeEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  createEmptyDatabase,
  exportDatabaseJson,
  getDatabaseStorageSizeKB,
  importDatabaseJson,
  resetToSeedDatabase,
} from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';

interface SauvegardeViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
}

const LOCAL_STORAGE_LIMIT_KB = 5120; // ~5 Mo browser standard

export function SauvegardeView({ db, onUpdateDb }: SauvegardeViewProps) {
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'purge' | null>(
    null
  );

  const storageKB = useMemo(() => getDatabaseStorageSizeKB(db), [db]);
  const storagePercent = Math.min(
    100,
    Math.round((storageKB / LOCAL_STORAGE_LIMIT_KB) * 100)
  );

  const handleRestoreJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const restored = importDatabaseJson(text);
      onUpdateDb(
        restored,
        `Base restaurée depuis ${file.name} (${restored.etudiants.length} étudiants, ${restored.inscriptions.length} inscriptions).`
      );
      setStatusMessage({
        type: 'success',
        text: `Restauration réussie depuis ${file.name}.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erreur de lecture JSON.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmAction = () => {
    if (confirmAction === 'reset') {
      const seeded = resetToSeedDatabase();
      onUpdateDb(
        seeded,
        `Base réinitialisée aux données d'origine (${seeded.etudiants.length} étudiants).`
      );
      setStatusMessage({
        type: 'success',
        text: 'Jeu de données initial restauré avec succès.',
      });
    } else if (confirmAction === 'purge') {
      const empty = createEmptyDatabase();
      onUpdateDb(empty, 'Base locale vidée.');
      setStatusMessage({
        type: 'success',
        text: 'Toutes les tables locales ont été vidées.',
      });
    }
    setConfirmAction(null);
  };

  const quotaColor =
    storagePercent >= 80
      ? 'bg-red-600'
      : storagePercent >= 55
        ? 'bg-amber-500'
        : 'bg-blue-600';

  return (
    <div className="space-y-6">
      {/* Storage Quota & Summary Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Sauvegarde, Restauration &amp; Stockage Local
              </h2>
              <p className="text-xs text-slate-500">
                Export JSON complet et suivi de la capacité du navigateur (localStorage)
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {storageKB.toLocaleString('fr-FR')} Ko
            </span>
            <span className="text-slate-500">
              {' '}
              / {(LOCAL_STORAGE_LIMIT_KB / 1024).toFixed(0)} Mo ({storagePercent}
              %)
            </span>
          </div>
        </div>

        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${quotaColor}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <p className="text-slate-500">Étudiants</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-display">
              {db.etudiants.length.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <p className="text-slate-500">Inscriptions</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-display">
              {db.inscriptions.length.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <p className="text-slate-500">Mentions / Parcours</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-display">
              {db.mentions.length} / {db.parcours.length}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <p className="text-slate-500">Années / Facultés</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-display">
              {db.annees.length} / {db.facultes.length}
            </p>
          </div>
        </div>

        {storagePercent >= 80 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Espace localStorage élevé ({storagePercent}%). Pensez à exporter
              une sauvegarde JSON externe et à éviter les logos trop volumineux.
            </span>
          </div>
        )}

        {statusMessage && (
          <div
            className={`p-3 rounded text-xs flex items-center gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Backup & Restore Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            1. Exporter une sauvegarde complète (.json)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Télécharge l&apos;intégralité des 8 tables relationnelles dans un
            fichier JSON horodaté, archivage recommandé avant toute opération
            massive.
          </p>
          <button
            type="button"
            onClick={() => exportDatabaseJson(db)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Télécharger la sauvegarde JSON
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            2. Restaurer depuis un fichier (.json)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Remplace l&apos;état local actuel par une archive JSON exportée
            précédemment depuis ce portail.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer">
            <Upload className="w-4 h-4" />
            Choisir un fichier JSON à restaurer
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white border border-red-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-700">
          <ShieldAlert className="w-5 h-5" />
          <h3 className="text-sm font-semibold">
            Zone de réinitialisation et de maintenance
          </h3>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setConfirmAction('reset')}
            className="px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser aux données initiales (727 étudiants)
          </button>

          <button
            type="button"
            onClick={() => setConfirmAction('purge')}
            className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 inline-flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Vider toutes les tables locales
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-50 text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h4 className="text-sm font-semibold text-slate-900">
                  {confirmAction === 'reset'
                    ? 'Réinitialiser la base ?'
                    : 'Vider toutes les tables ?'}
                </h4>
                <p className="text-slate-600">
                  {confirmAction === 'reset'
                    ? 'Toutes les modifications locales non sauvegardées seront remplacées par le jeu de données initial.'
                    : 'Cette action supprime tous les étudiants, inscriptions et référentiels stockés dans votre navigateur.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
