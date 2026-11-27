import { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileCheck2,
  GraduationCap,
  Pencil,
  Phone,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import {
  calculateAge,
  enrichInscriptions,
  formatDateFR,
  getBirthdateAnomalyReason,
  normalizeSex,
} from '../services/database';
import { EnrichedInscription, Etudiant, ScolariteDatabase } from '../types/scolarite';

interface StudentDetailModalProps {
  db: ScolariteDatabase;
  etudiantId: number;
  onClose: () => void;
  onEditInscription: (record: EnrichedInscription) => void;
  onPrintCertificate: (record: EnrichedInscription) => void;
  onReinscribe: (etudiantId: number) => void;
}

export function StudentDetailModal({
  db,
  etudiantId,
  onClose,
  onEditInscription,
  onPrintCertificate,
  onReinscribe,
}: StudentDetailModalProps) {
  const etudiant: Etudiant | undefined = useMemo(
    () => db.etudiants.find((e) => e.id === etudiantId),
    [db.etudiants, etudiantId]
  );

  const history = useMemo(() => {
    return enrichInscriptions(db)
      .filter((r) => r.idEtudiant === etudiantId)
      .sort((a, b) => b.annee.localeCompare(a.annee, 'fr'));
  }, [db, etudiantId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!etudiant) return null;

  const sexNorm = normalizeSex(etudiant.sexe);
  const age = calculateAge(etudiant.dateNaissance);
  const dobWarning = getBirthdateAnomalyReason(etudiant.dateNaissance);

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                sexNorm === 'F'
                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {etudiant.nom.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 truncate font-display">
                  {etudiant.nom} {etudiant.prenom}
                </h2>
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                    sexNorm === 'F'
                      ? 'bg-pink-50 text-pink-700 border border-pink-200'
                      : sexNorm === 'M'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {sexNorm === 'F'
                    ? 'Féminin'
                    : sexNorm === 'M'
                      ? 'Masculin'
                      : `Code: ${etudiant.sexe || '?'}`}
                </span>
                <span className="font-mono text-[11px] text-slate-400">#{etudiant.id}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {history.length} inscription(s) universitaire(s) enregistrée(s)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Anomalies alert if any */}
          {(dobWarning || !etudiant.numeroCin.trim() || (etudiant.sexe !== 'M' && etudiant.sexe !== 'F')) && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Points d&apos;attention sur ce dossier
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {dobWarning && <li>Date de naissance suspecte : {dobWarning}</li>}
                {!etudiant.numeroCin.trim() && <li>Numéro CIN non renseigné</li>}
                {etudiant.sexe !== 'M' && etudiant.sexe !== 'F' && (
                  <li>
                    Code sexe non standardisé (« {etudiant.sexe} » — normalisé en {sexNorm})
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Civil Identity Grid */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              État civil &amp; Coordonnées
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
              <div>
                <span className="text-slate-500">Date &amp; lieu de naissance :</span>
                <p className="font-medium text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="tabular-nums">
                    {etudiant.dateNaissance ? formatDateFR(etudiant.dateNaissance) : '—'}
                  </span>
                  {age !== null && age >= 0 && age <= 120 && (
                    <span className="text-slate-500">({age} ans)</span>
                  )}
                  {etudiant.lieuNaissance && <span>à {etudiant.lieuNaissance}</span>}
                </p>
              </div>

              <div>
                <span className="text-slate-500">Téléphone :</span>
                <p className="font-mono font-medium text-slate-900 mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {etudiant.telephone || 'Non renseigné'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">CIN :</span>
                <p className="font-mono font-medium text-slate-900 mt-0.5 tabular-nums">
                  {etudiant.numeroCin || 'Non renseigné'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">Délivré le / à :</span>
                <p className="font-medium text-slate-900 mt-0.5 tabular-nums">
                  {etudiant.dateCin ? formatDateFR(etudiant.dateCin) : '—'}
                  {etudiant.lieuDelivrance ? ` à ${etudiant.lieuDelivrance}` : ''}
                </p>
              </div>

              <div>
                <span className="text-slate-500">Nationalité :</span>
                <p className="font-medium text-slate-900 mt-0.5">
                  {etudiant.nationalite || 'MALAGASY'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">Filiation :</span>
                <p className="font-medium text-slate-900 mt-0.5">
                  {etudiant.nomPere || etudiant.nomMere
                    ? `${etudiant.nomPere ? `Père : ${etudiant.nomPere}` : ''}${
                        etudiant.nomPere && etudiant.nomMere ? ' · ' : ''
                      }${etudiant.nomMere ? `Mère : ${etudiant.nomMere}` : ''}`
                    : 'Non renseignée'}
                </p>
              </div>
            </div>
          </div>

          {/* Academic Enrollment History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4" />
                Parcours &amp; Inscriptions ({history.length})
              </h3>
              <button
                type="button"
                onClick={() => onReinscribe(etudiant.id)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réinscrire pour une nouvelle année
              </button>
            </div>

            {history.length === 0 ? (
              <div className="border border-slate-200 rounded-md p-6 text-center text-xs text-slate-500">
                Aucune inscription associée à cet étudiant.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {history.map((ins) => (
                  <div
                    key={ins.idInscription}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          {ins.annee}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {ins.mention} · {ins.niveau}
                        </span>
                        {ins.parcours !== '— Aucun —' && (
                          <span className="text-xs text-slate-600">({ins.parcours})</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        {ins.faculte} · {ins.domaine}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                        Réf : {ins.reference || '—'} · N° Inscr. : {ins.numInscription || '—'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPrintCertificate(ins)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md inline-flex items-center gap-1.5"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        Certificat
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditInscription(ins)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md inline-flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
