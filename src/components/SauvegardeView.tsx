import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { createEmptyDatabase, resetToSeedDatabase } from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';

interface SauvegardeViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase) => void;
}

export function SauvegardeView({ db, onUpdateDb }: SauvegardeViewProps) {
  const [purgeStep, setPurgeStep] = useState<0 | 1 | 2>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleDownloadBackup = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sauvegardes_SICU_${dd}-${mm}-${yyyy}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      text: `Sauvegarde générée : Sauvegardes_SICU_${dd}-${mm}-${yyyy}.json`,
    });
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ScolariteDatabase;
      if (!parsed || !Array.isArray(parsed.etudiants) || !Array.isArray(parsed.inscriptions)) {
        throw new Error('Format invalide');
      }
      onUpdateDb(parsed);
      setFeedback({
        type: 'success',
        text: `Sauvegarde restaurée avec succès (${parsed.etudiants.length} étudiants, ${parsed.inscriptions.length} inscriptions).`,
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Erreur sauvegarde : le fichier JSON sélectionné est invalide.',
      });
    }
    e.target.value = '';
  };

  const handleResetSeed = () => {
    const seed = resetToSeedDatabase();
    onUpdateDb(seed);
    setFeedback({
      type: 'success',
      text: `Données initiales de l'Université de Toliara restaurées (${seed.etudiants.length} étudiants).`,
    });
  };

  const handlePurgeConfirm = () => {
    const empty = createEmptyDatabase();
    onUpdateDb(empty);
    setPurgeStep(0);
    setFeedback({
      type: 'success',
      text: 'Purge terminée avec succès ! Toutes les données ont été supprimées.',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {feedback && (
        <div
          className={`px-4 py-3 rounded-md border text-sm flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Sauvegarde & Restauration */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Sauvegarde &amp; Restauration (SICU)
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Exportez une copie complète de la base (étudiants, inscriptions, facultés, domaines, mentions, niveaux, parcours, années) ou restaurez une archive existante.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-4">
          <div>
            <span className="text-slate-500">Étudiants</span>
            <p className="font-mono font-bold text-slate-900 text-base tabular-nums">
              {db.etudiants.length}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Inscriptions</span>
            <p className="font-mono font-bold text-slate-900 text-base tabular-nums">
              {db.inscriptions.length}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Facultés</span>
            <p className="font-mono font-bold text-slate-900 text-base tabular-nums">
              {db.facultes.length}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Mentions</span>
            <p className="font-mono font-bold text-slate-900 text-base tabular-nums">
              {db.mentions.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Créer une sauvegarde (.json)
          </button>

          <label className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer inline-flex items-center gap-2 whitespace-nowrap">
            <Upload className="w-4 h-4" />
            Restaurer une sauvegarde
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreBackup}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleResetSeed}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser données d&apos;origine (727)
          </button>
        </div>
      </div>

      {/* Purger la base (OPT_Purger_la_base) */}
      <div className="bg-white border border-red-200 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-red-900">Purger la base de données</h3>
            <p className="text-sm text-slate-600 mt-1">
              Supprime l&apos;intégralité des tables (Inscriptions, Étudiants, Parcours, Domaines, Mentions, Facultés, Niveaux, Années Universitaires). Cette action est irréversible.
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setPurgeStep(1)}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 inline-flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Purger toutes les données
          </button>
        </div>
      </div>

      {/* 2-Step Purge Confirmation Modal matching FEN_Acceuil1 */}
      {purgeStep > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-red-700">
              {purgeStep === 1 ? 'CONFIRMATION AVANT PURGE' : 'DERNIÈRE CONFIRMATION !'}
            </h3>
            <p className="text-sm text-slate-700">
              {purgeStep === 1
                ? 'ATTENTION ! Vous êtes sur le point de supprimer TOUTES les données. Cette action est IRRÉVERSIBLE ! Êtes-vous sûr de vouloir continuer ?'
                : 'Toutes les données seront définitivement perdues. Confirmez-vous la purge totale ?'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPurgeStep(0)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              {purgeStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setPurgeStep(2)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-md hover:bg-amber-700"
                >
                  Continuer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePurgeConfirm}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Confirmer la purge totale
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
