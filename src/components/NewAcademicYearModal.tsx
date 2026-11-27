import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Sparkles, X } from 'lucide-react';
import {
  createAcademicYear,
  sortAnneesDesc,
  suggestNextAnneeLabel,
} from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';

interface NewAcademicYearModalProps {
  db: ScolariteDatabase;
  onClose: () => void;
  onConfirm: (
    nextDb: ScolariteDatabase,
    anneeLabel: string,
    created: boolean
  ) => void;
}

export function NewAcademicYearModal({
  db,
  onClose,
  onConfirm,
}: NewAcademicYearModalProps) {
  const sortedAnnees = useMemo(() => sortAnneesDesc(db.annees), [db.annees]);
  const [anneeLabel, setAnneeLabel] = useState<string>(() =>
    suggestNextAnneeLabel(db.annees)
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

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

  const normalizedInput = anneeLabel
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-');

  const existingMatch = useMemo(
    () =>
      normalizedInput
        ? db.annees.find(
            (a) =>
              a.annee.trim().toLowerCase() === normalizedInput.toLowerCase()
          ) ?? null
        : null,
    [db.annees, normalizedInput]
  );

  const latestAnnee = sortedAnnees[0] ?? null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedInput) {
      setErrorMsg(
        "Veuillez saisir le libellé de l'année universitaire (ex. 2025-2026)."
      );
      return;
    }

    try {
      const result = createAcademicYear(db, normalizedInput);
      onConfirm(result.nextDb, result.annee.annee, result.created);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Impossible de créer l'année universitaire."
      );
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-50 text-blue-700 shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 font-display">
                Nouvelle année universitaire
              </h3>
              <p className="text-xs text-slate-500">
                Créer et activer une nouvelle session académique
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          <div>
            <label
              htmlFor="new-academic-year-label"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Année universitaire <span className="text-red-600">*</span>
            </label>
            <input
              id="new-academic-year-label"
              type="text"
              autoFocus
              required
              value={anneeLabel}
              onChange={(e) => {
                setAnneeLabel(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Ex. 2025-2026"
              className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
            {existingMatch ? (
              <p className="mt-1.5 text-[11px] text-amber-700 font-medium">
                L&apos;année {existingMatch.annee} existe déjà (
                {anneeCounts.get(existingMatch.id) ?? 0} inscription(s)) — la
                validation basculera directement dessus.
              </p>
            ) : latestAnnee ? (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Dernière année enregistrée :{' '}
                <span className="font-medium text-slate-700">
                  {latestAnnee.annee}
                </span>{' '}
                ({anneeCounts.get(latestAnnee.id) ?? 0} étudiant(s))
              </p>
            ) : null}
          </div>

          <div className="rounded-md bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              Fonctionnement des inscriptions
            </p>
            <p className="leading-relaxed text-[11.5px]">
              L&apos;année est créée vide et devient votre année de travail.
              Dans <strong>Nouvelle inscription</strong>, tapez simplement le
              nom de l&apos;étudiant : la saisie assistée retrouve sa dernière
              inscription et pré-remplit son état civil, sa mention et le
              passage au niveau supérieur.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {existingMatch
                ? `Basculer vers ${existingMatch.annee}`
                : `Créer ${normalizedInput || 'l’année'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
