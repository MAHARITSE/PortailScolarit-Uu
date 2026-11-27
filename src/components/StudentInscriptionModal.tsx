import React, { useMemo, useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { getNextId } from '../services/database';
import {
  EnrichedInscription,
  Etudiant,
  Inscription,
  ScolariteDatabase,
} from '../types/scolarite';

interface StudentInscriptionModalProps {
  db: ScolariteDatabase;
  editing?: EnrichedInscription | null;
  defaultAnneeId?: number;
  onClose: () => void;
  onSave: (nextDb: ScolariteDatabase) => void;
}

export function StudentInscriptionModal({
  db,
  editing,
  defaultAnneeId,
  onClose,
  onSave,
}: StudentInscriptionModalProps) {
  const [localDb, setLocalDb] = useState<ScolariteDatabase>(() => structuredClone(db));

  const [nom, setNom] = useState(editing?.nom ?? '');
  const [prenom, setPrenom] = useState(editing?.prenom ?? '');
  const [dateNaissance, setDateNaissance] = useState(editing?.dateNaissance ?? '');
  const [lieuNaissance, setLieuNaissance] = useState(editing?.lieuNaissance ?? '');
  const [sexe, setSexe] = useState(editing?.sexe || 'M');
  const [telephone, setTelephone] = useState(editing?.telephone ?? '');
  const [numeroCin, setNumeroCin] = useState(editing?.numeroCin ?? '');
  const [dateCin, setDateCin] = useState(editing?.dateCin ?? '');
  const [lieuDelivrance, setLieuDelivrance] = useState(editing?.lieuDelivrance ?? '');
  const [nationalite, setNationalite] = useState(editing?.nationalite || 'MALAGASY');
  const [nomPere, setNomPere] = useState(editing?.nomPere ?? '');
  const [nomMere, setNomMere] = useState(editing?.nomMere ?? '');

  const [reference, setReference] = useState(editing?.reference ?? '');
  const [numInscription, setNumInscription] = useState(editing?.numInscription ?? '');
  const [idAnnee, setIdAnnee] = useState<number>(
    editing?.idAnnee ?? defaultAnneeId ?? localDb.annees[0]?.id ?? 0
  );
  const [idFaculte, setIdFaculte] = useState<number>(
    editing?.idFaculte ?? localDb.facultes[0]?.id ?? 0
  );
  const [idDomaine, setIdDomaine] = useState<number>(editing?.idDomaine ?? 0);
  const [idMention, setIdMention] = useState<number>(editing?.idMention ?? 0);
  const [idNiveau, setIdNiveau] = useState<number>(
    editing?.idNiveau ?? localDb.niveaux[0]?.id ?? 0
  );
  const [idParcours, setIdParcours] = useState<number | ''>(editing?.idParcours ?? '');

  const [quickAddType, setQuickAddType] = useState<
    null | 'faculte' | 'domaine' | 'mention' | 'niveau' | 'parcours' | 'annee'
  >(null);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddGrade, setQuickAddGrade] = useState('Licence');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredDomaines = useMemo(
    () => localDb.domaines.filter((d) => !idFaculte || d.idFaculte === idFaculte),
    [localDb.domaines, idFaculte]
  );

  const effectiveDomaineId = useMemo(() => {
    if (filteredDomaines.some((d) => d.id === idDomaine)) return idDomaine;
    return filteredDomaines[0]?.id ?? 0;
  }, [filteredDomaines, idDomaine]);

  const filteredMentions = useMemo(
    () => localDb.mentions.filter((m) => !effectiveDomaineId || m.idDomaine === effectiveDomaineId),
    [localDb.mentions, effectiveDomaineId]
  );

  const effectiveMentionId = useMemo(() => {
    if (filteredMentions.some((m) => m.id === idMention)) return idMention;
    return filteredMentions[0]?.id ?? 0;
  }, [filteredMentions, idMention]);

  const filteredParcours = useMemo(
    () =>
      localDb.parcours.filter(
        (p) =>
          (!effectiveMentionId || p.idMention === effectiveMentionId) &&
          (!idNiveau || p.idNiveau === idNiveau)
      ),
    [localDb.parcours, effectiveMentionId, idNiveau]
  );

  const handleQuickAdd = () => {
    const val = quickAddValue.trim();
    if (!val) return;
    const next = structuredClone(localDb);

    if (quickAddType === 'faculte') {
      const id = getNextId(next.facultes);
      next.facultes.push({ id, faculte: val, logo: '/assets/logo-uu.jpg' });
      setIdFaculte(id);
    } else if (quickAddType === 'domaine') {
      if (!idFaculte) {
        setErrorMsg('Veuillez sélectionner une Faculté avant d’ajouter un Domaine.');
        return;
      }
      const id = getNextId(next.domaines);
      next.domaines.push({ id, domaine: val, idFaculte });
      setIdDomaine(id);
    } else if (quickAddType === 'mention') {
      if (!effectiveDomaineId) {
        setErrorMsg('Veuillez sélectionner un Domaine avant d’ajouter une Mention.');
        return;
      }
      const id = getNextId(next.mentions);
      next.mentions.push({ id, mention: val, idDomaine: effectiveDomaineId });
      setIdMention(id);
    } else if (quickAddType === 'niveau') {
      const id = getNextId(next.niveaux);
      next.niveaux.push({ id, niveau: val, grade: quickAddGrade.trim() || 'Licence' });
      setIdNiveau(id);
    } else if (quickAddType === 'parcours') {
      if (!effectiveMentionId || !idNiveau) {
        setErrorMsg('Sélectionnez une Mention et un Niveau pour ajouter un Parcours.');
        return;
      }
      const id = getNextId(next.parcours);
      next.parcours.push({ id, parcours: val, idMention: effectiveMentionId, idNiveau });
      setIdParcours(id);
    } else if (quickAddType === 'annee') {
      const id = getNextId(next.annees);
      next.annees.push({ id, annee: val });
      setIdAnnee(id);
    }

    setLocalDb(next);
    setQuickAddType(null);
    setQuickAddValue('');
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      setErrorMsg("Le nom de l'étudiant est obligatoire.");
      return;
    }
    if (!idAnnee || !effectiveMentionId || !idNiveau) {
      setErrorMsg('Veuillez sélectionner une Année, une Mention et un Niveau.');
      return;
    }

    const next = structuredClone(localDb);

    if (editing) {
      const etIdx = next.etudiants.findIndex((x) => x.id === editing.idEtudiant);
      if (etIdx !== -1) {
        next.etudiants[etIdx] = {
          ...next.etudiants[etIdx],
          nom: nom.trim(),
          prenom: prenom.trim(),
          dateNaissance,
          lieuNaissance: lieuNaissance.trim(),
          sexe,
          telephone: telephone.trim(),
          numeroCin: numeroCin.trim(),
          dateCin,
          lieuDelivrance: lieuDelivrance.trim(),
          nationalite: nationalite.trim() || 'MALAGASY',
          nomPere: nomPere.trim(),
          nomMere: nomMere.trim(),
        };
      }
      const insIdx = next.inscriptions.findIndex((x) => x.id === editing.idInscription);
      if (insIdx !== -1) {
        next.inscriptions[insIdx] = {
          ...next.inscriptions[insIdx],
          idAnnee,
          idMention: effectiveMentionId,
          idNiveau,
          idParcours: idParcours === '' ? null : Number(idParcours),
          numInscription: numInscription.trim(),
          reference: reference.trim(),
        };
      }
    } else {
      const newEtudiantId = getNextId(next.etudiants);
      const newEtudiant: Etudiant = {
        id: newEtudiantId,
        nom: nom.trim(),
        prenom: prenom.trim(),
        dateNaissance,
        lieuNaissance: lieuNaissance.trim(),
        sexe,
        telephone: telephone.trim(),
        numeroCin: numeroCin.trim(),
        dateCin,
        lieuDelivrance: lieuDelivrance.trim(),
        nationalite: nationalite.trim() || 'MALAGASY',
        nomPere: nomPere.trim(),
        nomMere: nomMere.trim(),
      };
      next.etudiants.push(newEtudiant);

      const newInscription: Inscription = {
        id: getNextId(next.inscriptions),
        idEtudiant: newEtudiantId,
        idAnnee,
        idMention: effectiveMentionId,
        idNiveau,
        idParcours: idParcours === '' ? null : Number(idParcours),
        numInscription: numInscription.trim(),
        reference: reference.trim(),
      };
      next.inscriptions.push(newInscription);
    }

    onSave(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editing ? "Modifier la fiche étudiant & inscription" : "Nouvel étudiant & inscription"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Renseignez l&apos;état civil et l&apos;affectation universitaire
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6">
          {errorMsg && (
            <div className="px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Section État Civil */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Identité de l&apos;étudiant
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex : ELANIRIKO"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Prénom(s)</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Ex : Alexandre brillant"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Date de naissance
                </label>
                <input
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Lieu de naissance
                </label>
                <input
                  type="text"
                  value={lieuNaissance}
                  onChange={(e) => setLieuNaissance(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sexe</label>
                <select
                  value={sexe}
                  onChange={(e) => setSexe(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="M">M (Masculin)</option>
                  <option value="F">F (Féminin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex : 038 65 473 93"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Numéro CIN</label>
                <input
                  type="text"
                  value={numeroCin}
                  onChange={(e) => setNumeroCin(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Délivrance CIN</label>
                <input
                  type="date"
                  value={dateCin}
                  onChange={(e) => setDateCin(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Lieu de délivrance CIN
                </label>
                <input
                  type="text"
                  value={lieuDelivrance}
                  onChange={(e) => setLieuDelivrance(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nationalité</label>
                <input
                  type="text"
                  value={nationalite}
                  onChange={(e) => setNationalite(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom du père</label>
                <input
                  type="text"
                  value={nomPere}
                  onChange={(e) => setNomPere(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom de la mère</label>
                <input
                  type="text"
                  value={nomMere}
                  onChange={(e) => setNomMere(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section Inscription Académique */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Inscription académique
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Référence</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex : 969117"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Numéro d&apos;inscription
                </label>
                <input
                  type="text"
                  value={numInscription}
                  onChange={(e) => setNumInscription(e.target.value)}
                  placeholder="Ex : 649399"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Année universitaire</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('annee')}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <select
                  value={idAnnee}
                  onChange={(e) => setIdAnnee(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {localDb.annees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.annee}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Faculté / Établissement</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('faculte')}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <select
                  value={idFaculte}
                  onChange={(e) => setIdFaculte(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {localDb.facultes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.faculte}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Domaine</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('domaine')}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Mention</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('mention')}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Niveau</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('niveau')}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <select
                  value={idNiveau}
                  onChange={(e) => setIdNiveau(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {localDb.niveaux.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.niveau} ({n.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Parcours</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('parcours')}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <select
                  value={idParcours}
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

            {/* Inline Quick-Add Box */}
            {quickAddType && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nouveau ({quickAddType})
                  </label>
                  <input
                    type="text"
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    placeholder={`Nom du ${quickAddType}...`}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                  />
                </div>
                {quickAddType === 'niveau' && (
                  <div className="w-40">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Grade</label>
                    <input
                      type="text"
                      value={quickAddGrade}
                      onChange={(e) => setQuickAddGrade(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddType(null);
                      setQuickAddValue('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              Valider
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
