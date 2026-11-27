import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import {
  formatCertificateNumber,
  formatDateFR,
  generateCertificateToken,
  getBirthdateAnomalyReason,
  getNextId,
  loadDocumentTemplates,
  normalizeCin,
  normalizePhone,
  normalizeSex,
} from '../services/database';
import {
  EnrichedInscription,
  Etudiant,
  FieldDefinition,
  Inscription,
  ScolariteDatabase,
} from '../types/scolarite';

interface StudentInscriptionModalProps {
  db: ScolariteDatabase;
  editing?: EnrichedInscription | null;
  reinscribeStudentId?: number | null;
  defaultAnneeId?: number;
  onClose: () => void;
  onSave: (nextDb: ScolariteDatabase, summary?: string) => void;
}

export function StudentInscriptionModal({
  db,
  editing,
  reinscribeStudentId,
  defaultAnneeId,
  onClose,
  onSave,
}: StudentInscriptionModalProps) {
  const [localDb, setLocalDb] = useState<ScolariteDatabase>(() => structuredClone(db));

  const initialExistingId = reinscribeStudentId ?? null;
  const initialStudent = useMemo(
    () =>
      initialExistingId
        ? db.etudiants.find((e) => e.id === initialExistingId) ?? null
        : null,
    [db.etudiants, initialExistingId]
  );

  const [mode, setMode] = useState<'new' | 'reinscription'>(
    initialExistingId ? 'reinscription' : 'new'
  );
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(initialExistingId);
  const [studentSearch, setStudentSearch] = useState<string>('');

  const sourceSex = editing?.sexe ?? initialStudent?.sexe ?? 'M';
  const normalizedInitialSex = normalizeSex(sourceSex);

  const [nom, setNom] = useState(editing?.nom ?? initialStudent?.nom ?? '');
  const [prenom, setPrenom] = useState(editing?.prenom ?? initialStudent?.prenom ?? '');
  const [dateNaissance, setDateNaissance] = useState(
    editing?.dateNaissance ?? initialStudent?.dateNaissance ?? ''
  );
  const [lieuNaissance, setLieuNaissance] = useState(
    editing?.lieuNaissance ?? initialStudent?.lieuNaissance ?? ''
  );
  const [sexe, setSexe] = useState<'M' | 'F'>(
    normalizedInitialSex === 'F' ? 'F' : 'M'
  );
  const [telephone, setTelephone] = useState(
    editing?.telephone ?? initialStudent?.telephone ?? ''
  );
  const [numeroCin, setNumeroCin] = useState(
    editing?.numeroCin ?? initialStudent?.numeroCin ?? ''
  );
  const [dateCin, setDateCin] = useState(editing?.dateCin ?? initialStudent?.dateCin ?? '');
  const [lieuDelivrance, setLieuDelivrance] = useState(
    editing?.lieuDelivrance ?? initialStudent?.lieuDelivrance ?? ''
  );
  const [nationalite, setNationalite] = useState(
    editing?.nationalite || initialStudent?.nationalite || 'MALAGASY'
  );
  const [nomPere, setNomPere] = useState(editing?.nomPere ?? initialStudent?.nomPere ?? '');
  const [nomMere, setNomMere] = useState(editing?.nomMere ?? initialStudent?.nomMere ?? '');

  const [reference, setReference] = useState(editing?.reference ?? '');
  const [numeroCertificat, setNumeroCertificat] = useState(
    editing?.numeroCertificat ?? ''
  );
  const [dateDelivrance, setDateDelivrance] = useState(
    editing?.dateDelivrance ?? ''
  );
  const [certificateToken, setCertificateToken] = useState(
    editing?.certificateToken ?? ''
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => ({ ...(editing?.customValues ?? {}) })
  );
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

  // Modèle de certificat défini dans l'administration : pilote les champs du formulaire
  const certificateFields = useMemo<FieldDefinition[]>(
    () => loadDocumentTemplates().certificat.fields,
    []
  );
  const customFields = useMemo(
    () => certificateFields.filter((f) => f.custom && f.enabled),
    [certificateFields]
  );
  const isFieldEnabled = (id: string) => {
    const def = certificateFields.find((f) => f.id === id);
    return def ? def.enabled : true;
  };
  const requiredField = (id: string) => {
    const def = certificateFields.find((f) => f.id === id);
    return Boolean(def?.required);
  };
  const setCustomValue = (id: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const applyExistingStudent = (stu: Etudiant) => {
    setSelectedExistingId(stu.id);
    setNom(stu.nom);
    setPrenom(stu.prenom);
    setDateNaissance(stu.dateNaissance);
    setLieuNaissance(stu.lieuNaissance);
    setSexe(normalizeSex(stu.sexe) === 'F' ? 'F' : 'M');
    setTelephone(stu.telephone);
    setNumeroCin(stu.numeroCin);
    setDateCin(stu.dateCin);
    setLieuDelivrance(stu.lieuDelivrance);
    setNationalite(stu.nationalite || 'MALAGASY');
    setNomPere(stu.nomPere);
    setNomMere(stu.nomMere);

    const previous = localDb.inscriptions
      .filter((i) => i.idEtudiant === stu.id)
      .slice(-1)[0];
    if (previous?.customValues) setCustomValues({ ...previous.customValues });

    // Pre-fill academic branch from most recent inscription if available
    const lastIns = localDb.inscriptions
      .filter((i) => i.idEtudiant === stu.id)
      .slice(-1)[0];
    if (lastIns) {
      const men = localDb.mentions.find((m) => m.id === lastIns.idMention);
      const dom = men ? localDb.domaines.find((d) => d.id === men.idDomaine) : undefined;
      if (dom) {
        setIdFaculte(dom.idFaculte);
        setIdDomaine(dom.id);
      }
      if (men) setIdMention(men.id);
      setIdNiveau(lastIns.idNiveau);
    }
  };

  const filteredExistingStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = localDb.etudiants;
    if (!q) return list.slice(0, 40);
    return list
      .filter((e) =>
        `${e.nom} ${e.prenom} ${e.numeroCin} ${e.telephone}`.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [localDb.etudiants, studentSearch]);

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

  const effectiveParcoursId = useMemo(() => {
    if (idParcours === '') return '';
    return filteredParcours.some((p) => p.id === Number(idParcours)) ? idParcours : '';
  }, [filteredParcours, idParcours]);

  // Live validation & duplicate checks
  const currentEditingEtudiantId = editing?.idEtudiant ?? (mode === 'reinscription' ? selectedExistingId : null);

  const potentialDuplicateStudent = useMemo(() => {
    if (editing || mode === 'reinscription') return null;
    const cinNorm = normalizeCin(numeroCin);
    if (cinNorm.length >= 6) {
      const byCin = localDb.etudiants.find((e) => normalizeCin(e.numeroCin) === cinNorm);
      if (byCin) return { etudiant: byCin, reason: 'Numéro CIN identique déjà enregistré' };
    }
    if (nom.trim() && dateNaissance) {
      const byId = localDb.etudiants.find(
        (e) =>
          e.nom.trim().toLowerCase() === nom.trim().toLowerCase() &&
          e.prenom.trim().toLowerCase() === prenom.trim().toLowerCase() &&
          e.dateNaissance === dateNaissance
      );
      if (byId) {
        return {
          etudiant: byId,
          reason: 'Un étudiant avec le même nom, prénom et date de naissance existe déjà',
        };
      }
    }
    return null;
  }, [editing, mode, numeroCin, nom, prenom, dateNaissance, localDb.etudiants]);

  const duplicateCodeWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (reference.trim() && idAnnee) {
      const dupRef = localDb.inscriptions.find(
        (i) =>
          i.id !== editing?.idInscription &&
          i.idAnnee === idAnnee &&
          i.reference.trim().toLowerCase() === reference.trim().toLowerCase()
      );
      if (dupRef) warnings.push(`La référence « ${reference.trim()} » existe déjà pour cette année.`);
    }
    if (numInscription.trim() && idAnnee) {
      const dupNum = localDb.inscriptions.find(
        (i) =>
          i.id !== editing?.idInscription &&
          i.idAnnee === idAnnee &&
          i.numInscription.trim().toLowerCase() === numInscription.trim().toLowerCase()
      );
      if (dupNum)
        warnings.push(`Le N° d'inscription « ${numInscription.trim()} » existe déjà pour cette année.`);
    }
    if (currentEditingEtudiantId && idAnnee) {
      const alreadyYear = localDb.inscriptions.find(
        (i) =>
          i.id !== editing?.idInscription &&
          i.idEtudiant === currentEditingEtudiantId &&
          i.idAnnee === idAnnee
      );
      if (alreadyYear) {
        warnings.push("Cet étudiant possède déjà une inscription pour l'année sélectionnée.");
      }
    }
    const dobWarn = getBirthdateAnomalyReason(dateNaissance);
    if (dobWarn) warnings.push(`Date de naissance : ${dobWarn}.`);
    if (dateNaissance && dateCin && dateCin < dateNaissance) {
      warnings.push('La date de délivrance CIN est antérieure à la date de naissance.');
    }
    return warnings;
  }, [
    reference,
    numInscription,
    idAnnee,
    editing,
    localDb.inscriptions,
    currentEditingEtudiantId,
    dateNaissance,
    dateCin,
  ]);

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
    if (mode === 'reinscription' && !editing && !selectedExistingId) {
      setErrorMsg('Veuillez sélectionner un étudiant existant à réinscrire.');
      return;
    }
    if (!nom.trim()) {
      setErrorMsg("Le nom de l'étudiant est obligatoire.");
      return;
    }
    const missingCustom = customFields.find(
      (f) => f.required && !(customValues[f.id] ?? '').trim()
    );
    if (missingCustom) {
      setErrorMsg(`Le champ « ${missingCustom.label} » est obligatoire.`);
      return;
    }
    if (!idAnnee || !effectiveMentionId || !idNiveau) {
      setErrorMsg('Veuillez sélectionner une Année, une Mention et un Niveau.');
      return;
    }

    const next = structuredClone(localDb);
    const cleanedPhone = normalizePhone(telephone);
    const anneeLabel = next.annees.find((a) => a.id === idAnnee)?.annee ?? '';
    const issueIdentity = (idInscription: number) => {
      const numero =
        numeroCertificat.trim() ||
        formatCertificateNumber(anneeLabel, numInscription.trim(), idInscription);
      const delivrance = dateDelivrance || new Date().toISOString().slice(0, 10);
      const token = certificateToken.trim() || generateCertificateToken();
      return {
        numeroCertificat: numero,
        dateDelivrance: delivrance,
        certificateToken: token,
        customValues: { ...customValues },
      };
    };

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
          telephone: cleanedPhone,
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
        const currentInsId = next.inscriptions[insIdx].id;
        next.inscriptions[insIdx] = {
          ...next.inscriptions[insIdx],
          idAnnee,
          idMention: effectiveMentionId,
          idNiveau,
          idParcours: effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
          numInscription: numInscription.trim(),
          reference: reference.trim(),
          ...issueIdentity(currentInsId),
        };
      }
      onSave(next, `Fiche de ${nom.trim()} ${prenom.trim()} mise à jour.`);
      return;
    }

    if (mode === 'reinscription' && selectedExistingId) {
      const etIdx = next.etudiants.findIndex((x) => x.id === selectedExistingId);
      if (etIdx !== -1) {
        next.etudiants[etIdx] = {
          ...next.etudiants[etIdx],
          nom: nom.trim(),
          prenom: prenom.trim(),
          dateNaissance,
          lieuNaissance: lieuNaissance.trim(),
          sexe,
          telephone: cleanedPhone,
          numeroCin: numeroCin.trim(),
          dateCin,
          lieuDelivrance: lieuDelivrance.trim(),
          nationalite: nationalite.trim() || 'MALAGASY',
          nomPere: nomPere.trim(),
          nomMere: nomMere.trim(),
        };
      }
      const reinscriptionId = getNextId(next.inscriptions);
      next.inscriptions.push({
        id: reinscriptionId,
        idEtudiant: selectedExistingId,
        idAnnee,
        idMention: effectiveMentionId,
        idNiveau,
        idParcours: effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
        numInscription: numInscription.trim(),
        reference: reference.trim(),
        ...issueIdentity(reinscriptionId),
      });
      onSave(next, `Réinscription enregistrée pour ${nom.trim()} ${prenom.trim()}.`);
      return;
    }

    const newEtudiantId = getNextId(next.etudiants);
    const newEtudiant: Etudiant = {
      id: newEtudiantId,
      nom: nom.trim(),
      prenom: prenom.trim(),
      dateNaissance,
      lieuNaissance: lieuNaissance.trim(),
      sexe,
      telephone: cleanedPhone,
      numeroCin: numeroCin.trim(),
      dateCin,
      lieuDelivrance: lieuDelivrance.trim(),
      nationalite: nationalite.trim() || 'MALAGASY',
      nomPere: nomPere.trim(),
      nomMere: nomMere.trim(),
    };
    next.etudiants.push(newEtudiant);

    const newInscriptionId = getNextId(next.inscriptions);
    const newInscription: Inscription = {
      id: newInscriptionId,
      idEtudiant: newEtudiantId,
      idAnnee,
      idMention: effectiveMentionId,
      idNiveau,
      idParcours: effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
      numInscription: numInscription.trim(),
      reference: reference.trim(),
      ...issueIdentity(newInscriptionId),
    };
    next.inscriptions.push(newInscription);

    onSave(next, `Nouvel étudiant ${nom.trim()} ${prenom.trim()} inscrit avec succès.`);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editing
                ? "Modifier la fiche étudiant & inscription"
                : mode === 'reinscription'
                  ? "Réinscription d'un étudiant existant"
                  : "Nouvel étudiant & inscription"}
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

        {/* Mode Switcher when creating */}
        {!editing && (
          <div className="px-6 pt-4 flex items-center gap-2 border-b border-slate-100 pb-3 bg-slate-50/60">
            <button
              type="button"
              onClick={() => {
                setMode('new');
                setSelectedExistingId(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
                mode === 'new'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nouvel étudiant
            </button>
            <button
              type="button"
              onClick={() => setMode('reinscription')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
                mode === 'reinscription'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réinscrire un étudiant existant
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6">
          {errorMsg && (
            <div className="px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Existing Student Picker for Réinscription */}
          {!editing && mode === 'reinscription' && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-emerald-900">
                  Rechercher l&apos;étudiant à réinscrire ({localDb.etudiants.length} enregistrés)
                </label>
                {selectedExistingId && (
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                    Sélectionné : #{selectedExistingId}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Nom, prénom, CIN ou téléphone..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-emerald-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
              <div className="max-h-36 overflow-y-auto bg-white border border-emerald-200 rounded divide-y divide-slate-100">
                {filteredExistingStudents.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500 text-center">Aucun étudiant trouvé.</p>
                ) : (
                  filteredExistingStudents.map((stu) => {
                    const isSel = selectedExistingId === stu.id;
                    return (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => applyExistingStudent(stu)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                          isSel ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">
                          {stu.nom} {stu.prenom}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                          {stu.numeroCin || formatDateFR(stu.dateNaissance) || `#${stu.id}`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Duplicate Student Warning */}
          {potentialDuplicateStudent && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{potentialDuplicateStudent.reason}</p>
                  <p className="text-amber-800 mt-0.5">
                    Fiche existante :{' '}
                    <strong>
                      {potentialDuplicateStudent.etudiant.nom}{' '}
                      {potentialDuplicateStudent.etudiant.prenom}
                    </strong>{' '}
                    (#{potentialDuplicateStudent.etudiant.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('reinscription');
                  applyExistingStudent(potentialDuplicateStudent.etudiant);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md whitespace-nowrap"
              >
                Basculer en Réinscription
              </button>
            </div>
          )}

          {/* Validation Warnings */}
          {duplicateCodeWarnings.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-md px-3.5 py-2.5 text-xs text-amber-900 space-y-1">
              {duplicateCodeWarnings.map((w) => (
                <p key={w} className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{w}</span>
                </p>
              ))}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sexe
                  {(editing?.sexe || initialStudent?.sexe) &&
                    sourceSex !== 'M' &&
                    sourceSex !== 'F' && (
                      <span className="ml-1.5 text-[10px] text-amber-700 font-normal">
                        (source : « {sourceSex} » → normalisé en {sexe})
                      </span>
                    )}
                </label>
                <select
                  value={sexe}
                  onChange={(e) => setSexe(e.target.value === 'F' ? 'F' : 'M')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="M">M (Masculin)</option>
                  <option value="F">F (Féminin)</option>
                </select>
              </div>
              {isFieldEnabled('telephone') && (
                <>
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
                </>
              )}
              {isFieldEnabled('numeroCin') && (
                <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Numéro CIN</label>
                <input
                  type="text"
                  value={numeroCin}
                  onChange={(e) => setNumeroCin(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
                </>
              )}
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
              {isFieldEnabled('nationalite') && (
                <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nationalité</label>
                <input
                  type="text"
                  value={nationalite}
                  onChange={(e) => setNationalite(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
                </>
              )}
              {isFieldEnabled('filiation') && (
                <>
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
                </>
              )}
            </div>
          </div>

          {/* Section Inscription Académique */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Inscription académique
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isFieldEnabled('reference') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Référence
                    {requiredField('reference') && (
                      <span className="text-red-600"> *</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex : 969117"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              )}
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
                  <label className="text-xs font-medium text-slate-700">
                    Faculté / Établissement
                  </label>
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

          {/* Certificat de scolarité : identité + champs personnalisés du modèle */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Certificat de scolarité
            </h3>
            <p className="text-[11px] text-slate-500">
              Numéro, date de délivrance et jeton de vérification générés
              automatiquement — modifiables si nécessaire. Les champs
              personnalisés proviennent du modèle défini dans
              Administration&nbsp;·&nbsp;Modèles de documents.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Numéro de certificat
                </label>
                <input
                  type="text"
                  value={numeroCertificat}
                  onChange={(e) => setNumeroCertificat(e.target.value)}
                  placeholder="Généré à l’enregistrement"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Date de délivrance
                </label>
                <input
                  type="date"
                  value={dateDelivrance}
                  onChange={(e) => setDateDelivrance(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Jeton de vérification (QR Code)
                  </label>
                  <button
                    type="button"
                    onClick={() => setCertificateToken(generateCertificateToken())}
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Régénérer
                  </button>
                </div>
                <input
                  type="text"
                  value={certificateToken}
                  onChange={(e) => setCertificateToken(e.target.value.toUpperCase())}
                  placeholder="Généré à l’enregistrement (16 caractères)"
                  className="w-full px-3 py-2 text-sm font-mono tracking-wider border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            {customFields.length > 0 && (
              <>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 pt-1">
                  Champs personnalisés
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className={field.fullWidth ? 'sm:col-span-2' : undefined}
                    >
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-600"> *</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={customValues[field.id] ?? ''}
                          onChange={(e) => setCustomValue(field.id, e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={customValues[field.id] ?? ''}
                          onChange={(e) => setCustomValue(field.id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                        >
                          <option value="">— Sélectionner —</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            field.type === 'date'
                              ? 'date'
                              : field.type === 'number'
                                ? 'number'
                                : 'text'
                          }
                          value={customValues[field.id] ?? ''}
                          onChange={(e) => setCustomValue(field.id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      )}
                      {field.help && (
                        <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
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
