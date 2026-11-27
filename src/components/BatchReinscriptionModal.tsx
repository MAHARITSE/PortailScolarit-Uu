import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { batchReinscribe } from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';

interface BatchReinscriptionModalProps {
  db: ScolariteDatabase;
  selectedStudentIds: number[];
  onClose: () => void;
  onConfirm: (nextDb: ScolariteDatabase, createdCount: number, skippedCount: number) => void;
}

export function BatchReinscriptionModal({
  db,
  selectedStudentIds,
  onClose,
  onConfirm,
}: BatchReinscriptionModalProps) {
  const uniqueIds = useMemo(() => Array.from(new Set(selectedStudentIds)), [selectedStudentIds]);

  const [idAnnee, setIdAnnee] = useState<number>(db.annees[0]?.id ?? 0);
  const [idFaculte, setIdFaculte] = useState<number>(db.facultes[0]?.id ?? 0);
  const [idDomaine, setIdDomaine] = useState<number>(0);
  const [idMention, setIdMention] = useState<number>(0);
  const [idNiveau, setIdNiveau] = useState<number>(db.niveaux[0]?.id ?? 0);
  const [idParcours, setIdParcours] = useState<number | ''>('');
  const [autoGenerateNumbers, setAutoGenerateNumbers] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filteredDomaines = useMemo(
    () => db.domaines.filter((d) => !idFaculte || d.idFaculte === idFaculte),
    [db.domaines, idFaculte]
  );

  const effectiveDomaineId = useMemo(() => {
    if (filteredDomaines.some((d) => d.id === idDomaine)) return idDomaine;
    return filteredDomaines[0]?.id ?? 0;
  }, [filteredDomaines, idDomaine]);

  const filteredMentions = useMemo(
    () => db.mentions.filter((m) => !effectiveDomaineId || m.idDomaine === effectiveDomaineId),
    [db.mentions, effectiveDomaineId]
  );

  const effectiveMentionId = useMemo(() => {
    if (filteredMentions.some((m) => m.id === idMention)) return idMention;
    return filteredMentions[0]?.id ?? 0;
  }, [filteredMentions, idMention]);

  const filteredParcours = useMemo(
    () =>
      db.parcours.filter(
        (p) =>
          (!effectiveMentionId || p.idMention === effectiveMentionId) &&
          (!idNiveau || p.idNiveau === idNiveau)
      ),
    [db.parcours, effectiveMentionId, idNiveau]
  );

  const effectiveParcoursId = useMemo(() => {
    if (idParcours === '') return '';
    return filteredParcours.some((p) => p.id === Number(idParcours)) ? idParcours : '';
  }, [filteredParcours, idParcours]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idAnnee || !effectiveMentionId || !idNiveau) {
      setErrorMsg('Veuillez sélectionner une Année, une Mention et un Niveau valides.');
      return;
    }

    const { nextDb, createdCount, skippedCount } = batchReinscribe(db, {
      studentIds: uniqueIds,
      idAnnee,
      idMention: effectiveMentionId,
      idNiveau,
      idParcours: effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
      autoGenerateNumbers,
    });
    onConfirm(nextDb, createdCount, skippedCount);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-xl w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-700">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Réinscription groupée ({uniqueIds.length} étudiant{uniqueIds.length > 1 ? 's' : ''})
              </h3>
              <p className="text-xs text-slate-500">
                Affecter les étudiants sélectionnés vers une nouvelle année ou un niveau supérieur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Année universitaire cible
              </label>
              <select
                value={idAnnee}
                onChange={(e) => setIdAnnee(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {db.annees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.annee}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Faculté / Établissement
              </label>
              <select
                value={idFaculte}
                onChange={(e) => setIdFaculte(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {db.facultes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.faculte}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Domaine</label>
              <select
                value={effectiveDomaineId}
                onChange={(e) => setIdDomaine(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {filteredDomaines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.domaine}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mention</label>
              <select
                value={effectiveMentionId}
                onChange={(e) => setIdMention(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {filteredMentions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.mention}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Niveau cible</label>
              <select
                value={idNiveau}
                onChange={(e) => setIdNiveau(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {db.niveaux.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.niveau} ({n.grade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Parcours</label>
              <select
                value={effectiveParcoursId}
                onChange={(e) =>
                  setIdParcours(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="">— Aucun —</option>
                {filteredParcours.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.parcours}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3 cursor-pointer">
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

          <p className="text-[11px] text-slate-500">
            Les étudiants déjà inscrits dans la même année, mention et niveau seront automatiquement ignorés afin d&apos;éviter les doublons.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
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
              Valider la réinscription
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
