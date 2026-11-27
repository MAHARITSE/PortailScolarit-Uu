import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  GraduationCap,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react';
import {
  buildStudentAssistedIndex,
  enrichInscriptions,
  formatCertificateNumber,
  formatDateFR,
  generateCertificateToken,
  generateNextInscriptionCodes,
  getBirthdateAnomalyReason,
  getDefaultInitialAcademicSelection,
  getNextId,
  loadDocumentTemplates,
  normalizeCin,
  normalizePhone,
  normalizeSex,
  resolveCompatibleParcoursId,
   searchStudentsForAssistedEntry,
  sortAnneesDesc,
  syncCertificateRegistryForInscription,
} from '../services/database';
import {
  EnrichedInscription,
  Etudiant,
  FieldDefinition,
  Inscription,
  ScolariteDatabase,
  StudentAssistedSuggestion,
} from '../types/scolarite';

interface StudentInscriptionModalProps {
  db: ScolariteDatabase;
  editing?: EnrichedInscription | null;
  reinscribeStudentId?: number | null;
  defaultAnneeId?: number;
  onClose: () => void;
  onSave: (
    nextDb: ScolariteDatabase,
    summary?: string,
    options?: { keepOpen?: boolean }
  ) => void;
}

export function StudentInscriptionModal({
  db,
  editing,
  reinscribeStudentId,
  defaultAnneeId,
  onClose,
  onSave,
}: StudentInscriptionModalProps) {
  const [localDb, setLocalDb] = useState<ScolariteDatabase>(() =>
    structuredClone(db)
  );
  const [activeEditing, setActiveEditing] = useState<EnrichedInscription | null>(
    editing ?? null
  );

  const sortedAnnees = useMemo(
    () => sortAnneesDesc(localDb.annees),
    [localDb.annees]
  );

  const initialAnneeId =
    editing?.idAnnee ?? defaultAnneeId ?? sortedAnnees[0]?.id ?? 0;

  const initialAcademicDefaults = useMemo(
    () => getDefaultInitialAcademicSelection(localDb),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const initialReinscribeProfile = useMemo(() => {
    if (editing || !reinscribeStudentId) return null;
    const idx = buildStudentAssistedIndex(db, initialAnneeId);
    return idx.get(reinscribeStudentId) ?? null;
  }, [db, editing, reinscribeStudentId, initialAnneeId]);

  const initialStudent = initialReinscribeProfile?.etudiant ?? null;
  const initialSuggested = initialReinscribeProfile?.suggestedAssignment ?? null;

  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(
    reinscribeStudentId ?? null
  );

  const sourceSex = activeEditing?.sexe ?? initialStudent?.sexe ?? 'M';
  const normalizedInitialSex = normalizeSex(sourceSex);

  const [nom, setNom] = useState(
    activeEditing?.nom ?? initialStudent?.nom ?? ''
  );
  const [prenom, setPrenom] = useState(
    activeEditing?.prenom ?? initialStudent?.prenom ?? ''
  );
  const [dateNaissance, setDateNaissance] = useState(
    activeEditing?.dateNaissance ?? initialStudent?.dateNaissance ?? ''
  );
  const [lieuNaissance, setLieuNaissance] = useState(
    activeEditing?.lieuNaissance ?? initialStudent?.lieuNaissance ?? ''
  );
  const [sexe, setSexe] = useState<'M' | 'F'>(
    normalizedInitialSex === 'F' ? 'F' : 'M'
  );
  const [telephone, setTelephone] = useState(
    activeEditing?.telephone ?? initialStudent?.telephone ?? ''
  );
  const [numeroCin, setNumeroCin] = useState(
    activeEditing?.numeroCin ?? initialStudent?.numeroCin ?? ''
  );
  const [dateCin, setDateCin] = useState(
    activeEditing?.dateCin ?? initialStudent?.dateCin ?? ''
  );
  const [lieuDelivrance, setLieuDelivrance] = useState(
    activeEditing?.lieuDelivrance ?? initialStudent?.lieuDelivrance ?? ''
  );
  const [nationalite, setNationalite] = useState(
    activeEditing?.nationalite || initialStudent?.nationalite || 'MALAGASY'
  );
  const [nomPere, setNomPere] = useState(
    activeEditing?.nomPere ?? initialStudent?.nomPere ?? ''
  );
  const [nomMere, setNomMere] = useState(
    activeEditing?.nomMere ?? initialStudent?.nomMere ?? ''
  );

  const [reference, setReference] = useState(activeEditing?.reference ?? '');
  const [numInscription, setNumInscription] = useState(
    activeEditing?.numInscription ?? ''
  );
  const [numeroCertificat, setNumeroCertificat] = useState(
    activeEditing?.numeroCertificat ?? ''
  );
  const [dateDelivrance, setDateDelivrance] = useState(
    activeEditing?.dateDelivrance ?? ''
  );
  const [certificateToken, setCertificateToken] = useState(
    activeEditing?.certificateToken ?? ''
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => ({
      ...(activeEditing?.customValues ??
        initialReinscribeProfile?.lastInscription?.customValues ??
        {}),
    })
  );

  const [idAnnee, setIdAnnee] = useState<number>(initialAnneeId);
  const [idFaculte, setIdFaculte] = useState<number>(
    activeEditing?.idFaculte ??
      initialSuggested?.idFaculte ??
      initialAcademicDefaults.idFaculte
  );
  const [idDomaine, setIdDomaine] = useState<number>(
    activeEditing?.idDomaine ??
      initialSuggested?.idDomaine ??
      initialAcademicDefaults.idDomaine
  );
  const [idMention, setIdMention] = useState<number>(
    activeEditing?.idMention ??
      initialSuggested?.idMention ??
      initialAcademicDefaults.idMention
  );
  const [idNiveau, setIdNiveau] = useState<number>(
    activeEditing?.idNiveau ??
      initialSuggested?.recommendedNiveauId ??
      initialAcademicDefaults.idNiveau
  );
  const [idParcours, setIdParcours] = useState<number | ''>(
    activeEditing?.idParcours ?? initialSuggested?.idParcours ?? ''
  );

  // Saisie assistée sur le nom
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [homonymDetached, setHomonymDetached] = useState<boolean>(false);
  const nomInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const numInscriptionInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteBoxRef = useRef<HTMLDivElement | null>(null);

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

  // Index des étudiants basé sur leur dernière inscription pour l'année sélectionnée
  const assistedIndex = useMemo(
    () => buildStudentAssistedIndex(localDb, idAnnee),
    [localDb, idAnnee]
  );

  const linkedSuggestion = useMemo<StudentAssistedSuggestion | null>(() => {
    if (!selectedExistingId) return null;
    return assistedIndex.get(selectedExistingId) ?? null;
  }, [assistedIndex, selectedExistingId]);

  const assistedQuery = useMemo(() => {
    if (activeEditing || selectedExistingId !== null || homonymDetached) {
      return '';
    }
    const cleanNom = nom.trim();
    if (!cleanNom) return '';
    const cleanPrenom = prenom.trim();
    return cleanPrenom ? `${cleanNom} ${cleanPrenom}` : cleanNom;
  }, [activeEditing, selectedExistingId, homonymDetached, nom, prenom]);

  const nameSuggestions = useMemo<StudentAssistedSuggestion[]>(() => {
    if (!assistedQuery) return [];
    return searchStudentsForAssistedEntry(localDb, assistedQuery, {
      targetAnneeId: idAnnee,
      limit: 8,
      index: assistedIndex,
    });
  }, [localDb, assistedQuery, idAnnee, assistedIndex]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [assistedQuery]);

  // Ferme le menu d'autocomplétion au clic extérieur
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        autocompleteBoxRef.current &&
        !autocompleteBoxRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Touche Échap : ferme d'abord la liste de suggestions, sinon la modale
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dropdownOpen && nameSuggestions.length > 0) {
          e.stopPropagation();
          setDropdownOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropdownOpen, nameSuggestions.length, onClose]);

  const applyAssistedSuggestion = (
    suggestion: StudentAssistedSuggestion,
    focusAcademicAfter = true
  ) => {
    const stu = suggestion.etudiant;
    setSelectedExistingId(stu.id);
    setHomonymDetached(false);
    setDropdownOpen(false);
    setErrorMsg('');

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

    if (suggestion.lastInscription?.customValues) {
      setCustomValues({ ...suggestion.lastInscription.customValues });
    } else {
      setCustomValues({});
    }

    // Nouveaux numéros pour la nouvelle année (ne pas recopier l'ancien certificat)
    setReference('');
    setNumInscription('');
    setNumeroCertificat('');
    setDateDelivrance('');
    setCertificateToken('');

    if (suggestion.suggestedAssignment) {
      const assign = suggestion.suggestedAssignment;
      if (assign.idFaculte) setIdFaculte(assign.idFaculte);
      if (assign.idDomaine) setIdDomaine(assign.idDomaine);
      if (assign.idMention) setIdMention(assign.idMention);
      if (assign.recommendedNiveauId) setIdNiveau(assign.recommendedNiveauId);
      setIdParcours(assign.idParcours ?? '');
    }

    if (focusAcademicAfter) {
      requestAnimationFrame(() => {
        if (referenceInputRef.current) {
          referenceInputRef.current.focus();
        } else {
          numInscriptionInputRef.current?.focus();
        }
      });
    }
  };

  const resetFormForNextEntry = (nextDatabase: ScolariteDatabase) => {
    const defaults = getDefaultInitialAcademicSelection(nextDatabase);
    setActiveEditing(null);
    setSelectedExistingId(null);
    setHomonymDetached(false);
    setDropdownOpen(false);
    setErrorMsg('');

    setNom('');
    setPrenom('');
    setDateNaissance('');
    setLieuNaissance('');
    setSexe('M');
    setTelephone('');
    setNumeroCin('');
    setDateCin('');
    setLieuDelivrance('');
    setNationalite('MALAGASY');
    setNomPere('');
    setNomMere('');
    setCustomValues({});

    setReference('');
    setNumInscription('');
    setNumeroCertificat('');
    setDateDelivrance('');
    setCertificateToken('');

    setIdFaculte(defaults.idFaculte);
    setIdDomaine(defaults.idDomaine);
    setIdMention(defaults.idMention);
    setIdNiveau(defaults.idNiveau);
    setIdParcours('');

    requestAnimationFrame(() => {
      nomInputRef.current?.focus();
    });
  };

  const switchToExistingTargetInscription = (ins: EnrichedInscription) => {
    setActiveEditing(ins);
    setSelectedExistingId(null);
    setDropdownOpen(false);
    setErrorMsg('');

    setNom(ins.nom);
    setPrenom(ins.prenom);
    setDateNaissance(ins.dateNaissance);
    setLieuNaissance(ins.lieuNaissance);
    setSexe(normalizeSex(ins.sexe) === 'F' ? 'F' : 'M');
    setTelephone(ins.telephone);
    setNumeroCin(ins.numeroCin);
    setDateCin(ins.dateCin);
    setLieuDelivrance(ins.lieuDelivrance);
    setNationalite(ins.nationalite || 'MALAGASY');
    setNomPere(ins.nomPere);
    setNomMere(ins.nomMere);

    setReference(ins.reference);
    setNumInscription(ins.numInscription);
    setNumeroCertificat(ins.numeroCertificat);
    setDateDelivrance(ins.dateDelivrance);
    setCertificateToken(ins.certificateToken);
    setCustomValues({ ...ins.customValues });

    setIdAnnee(ins.idAnnee);
    setIdFaculte(ins.idFaculte);
    setIdDomaine(ins.idDomaine);
    setIdMention(ins.idMention);
    setIdNiveau(ins.idNiveau);
    setIdParcours(ins.idParcours ?? '');
  };

  const filteredDomaines = useMemo(
    () =>
      localDb.domaines.filter((d) => !idFaculte || d.idFaculte === idFaculte),
    [localDb.domaines, idFaculte]
  );

  const effectiveDomaineId = useMemo(() => {
    if (filteredDomaines.some((d) => d.id === idDomaine)) return idDomaine;
    return filteredDomaines[0]?.id ?? 0;
  }, [filteredDomaines, idDomaine]);

  const filteredMentions = useMemo(
    () =>
      localDb.mentions.filter(
        (m) => !effectiveDomaineId || m.idDomaine === effectiveDomaineId
      ),
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
    return filteredParcours.some((p) => p.id === Number(idParcours))
      ? idParcours
      : '';
  }, [filteredParcours, idParcours]);

  // Détection de doublon lorsque la fiche n'est pas liée à un étudiant existant
  const currentEditingEtudiantId =
    activeEditing?.idEtudiant ?? selectedExistingId;

  const potentialDuplicateStudent = useMemo(() => {
    if (activeEditing || selectedExistingId !== null || homonymDetached) {
      return null;
    }
    const cinNorm = normalizeCin(numeroCin);
    if (cinNorm.length >= 6) {
      const byCin = localDb.etudiants.find(
        (e) => normalizeCin(e.numeroCin) === cinNorm
      );
      if (byCin) {
        return {
          etudiant: byCin,
          reason: 'Numéro CIN identique déjà enregistré',
        };
      }
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
          reason:
            'Un étudiant avec le même nom, prénom et date de naissance existe déjà',
        };
      }
    }
    return null;
  }, [
    activeEditing,
    selectedExistingId,
    homonymDetached,
    numeroCin,
    nom,
    prenom,
    dateNaissance,
    localDb.etudiants,
  ]);

  const existingTargetYearIns = useMemo<EnrichedInscription | null>(() => {
    if (activeEditing || !currentEditingEtudiantId || !idAnnee) return null;
    return (
      assistedIndex.get(currentEditingEtudiantId)?.targetYearInscription ?? null
    );
  }, [activeEditing, currentEditingEtudiantId, idAnnee, assistedIndex]);

  const duplicateCodeWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (reference.trim() && idAnnee) {
      const dupRef = localDb.inscriptions.find(
        (i) =>
          i.id !== activeEditing?.idInscription &&
          i.idAnnee === idAnnee &&
          i.reference.trim().toLowerCase() === reference.trim().toLowerCase()
      );
      if (dupRef) {
        warnings.push(
          `La référence « ${reference.trim()} » existe déjà pour cette année.`
        );
      }
    }
    if (numInscription.trim() && idAnnee) {
      const dupNum = localDb.inscriptions.find(
        (i) =>
          i.id !== activeEditing?.idInscription &&
          i.idAnnee === idAnnee &&
          i.numInscription.trim().toLowerCase() ===
            numInscription.trim().toLowerCase()
      );
      if (dupNum) {
        warnings.push(
          `Le N° d'inscription « ${numInscription.trim()} » existe déjà pour cette année.`
        );
      }
    }
    const dobWarn = getBirthdateAnomalyReason(dateNaissance);
    if (dobWarn) warnings.push(`Date de naissance : ${dobWarn}.`);
    if (dateNaissance && dateCin && dateCin < dateNaissance) {
      warnings.push(
        'La date de délivrance CIN est antérieure à la date de naissance.'
      );
    }
    return warnings;
  }, [
    reference,
    numInscription,
    idAnnee,
    activeEditing,
    localDb.inscriptions,
    dateNaissance,
    dateCin,
  ]);

  const handleAutoGenerateCodes = () => {
    if (!idAnnee) return;
    const codes = generateNextInscriptionCodes(localDb, idAnnee);
    setReference(codes.reference);
    setNumInscription(codes.numInscription);
  };

  const handleAnneeSelectChange = (
    nextAnneeId: number,
    sourceDb: ScolariteDatabase = localDb
  ) => {
    setIdAnnee(nextAnneeId);
    if (!activeEditing && selectedExistingId !== null) {
      const updated = buildStudentAssistedIndex(sourceDb, nextAnneeId).get(
        selectedExistingId
      );
      if (updated?.suggestedAssignment) {
        const nextNiv = updated.suggestedAssignment.recommendedNiveauId;
        setIdNiveau(nextNiv);
        const nextParc = resolveCompatibleParcoursId(
          sourceDb,
          updated.lastInscription,
          effectiveMentionId,
          nextNiv
        );
        setIdParcours(nextParc ?? '');
      }
    }
  };

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
        setErrorMsg(
          'Veuillez sélectionner une Faculté avant d’ajouter un Domaine.'
        );
        return;
      }
      const id = getNextId(next.domaines);
      next.domaines.push({ id, domaine: val, idFaculte });
      setIdDomaine(id);
    } else if (quickAddType === 'mention') {
      if (!effectiveDomaineId) {
        setErrorMsg(
          'Veuillez sélectionner un Domaine avant d’ajouter une Mention.'
        );
        return;
      }
      const id = getNextId(next.mentions);
      next.mentions.push({ id, mention: val, idDomaine: effectiveDomaineId });
      setIdMention(id);
    } else if (quickAddType === 'niveau') {
      const id = getNextId(next.niveaux);
      next.niveaux.push({
        id,
        niveau: val,
        grade: quickAddGrade.trim() || 'Licence',
      });
      setIdNiveau(id);
    } else if (quickAddType === 'parcours') {
      if (!effectiveMentionId || !idNiveau) {
        setErrorMsg(
          'Sélectionnez une Mention et un Niveau pour ajouter un Parcours.'
        );
        return;
      }
      const id = getNextId(next.parcours);
      next.parcours.push({
        id,
        parcours: val,
        idMention: effectiveMentionId,
        idNiveau,
      });
      setIdParcours(id);
    } else if (quickAddType === 'annee') {
      const existing = next.annees.find(
        (a) => a.annee.trim().toLowerCase() === val.toLowerCase()
      );
      if (existing) {
        handleAnneeSelectChange(existing.id, next);
      } else {
        const id = getNextId(next.annees);
        next.annees.push({ id, annee: val });
        handleAnneeSelectChange(id, next);
      }
    }

    setLocalDb(next);
    setQuickAddType(null);
    setQuickAddValue('');
    setErrorMsg('');
  };

  const persistInscription = (keepOpen: boolean) => {
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
      setErrorMsg(
        'Veuillez sélectionner une Année, une Mention et un Niveau.'
      );
      return;
    }
    if (!activeEditing && existingTargetYearIns) {
      setErrorMsg(
        `Cet étudiant est déjà inscrit en ${existingTargetYearIns.annee} (${existingTargetYearIns.mention} · ${existingTargetYearIns.niveau}). Cliquez sur « Modifier l'inscription existante » pour mettre à jour son dossier.`
      );
      return;
    }

    const next = structuredClone(localDb);
    const cleanedNom = nom.trim().toUpperCase();
    const cleanedPrenom = prenom.trim();
    const cleanedPhone = normalizePhone(telephone);
    const anneeLabel = next.annees.find((a) => a.id === idAnnee)?.annee ?? '';
    const niveauLabel =
      next.niveaux.find((n) => n.id === idNiveau)?.niveau ?? '';
    const mentionLabel =
      next.mentions.find((m) => m.id === effectiveMentionId)?.mention ?? '';

    const issueIdentity = (
      idInscription: number,
      effectiveNumInscription: string
    ) => {
      const numero =
        numeroCertificat.trim() ||
        formatCertificateNumber(
          anneeLabel,
          effectiveNumInscription,
          idInscription
        );
      const delivrance =
        dateDelivrance || new Date().toISOString().slice(0, 10);
      const token = certificateToken.trim() || generateCertificateToken();
      return {
        numeroCertificat: numero,
        dateDelivrance: delivrance,
        certificateToken: token,
        customValues: { ...customValues },
      };
    };

    if (activeEditing) {
      const etIdx = next.etudiants.findIndex(
        (x) => x.id === activeEditing.idEtudiant
      );
      if (etIdx !== -1) {
        next.etudiants[etIdx] = {
          ...next.etudiants[etIdx],
          nom: cleanedNom,
          prenom: cleanedPrenom,
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
      const insIdx = next.inscriptions.findIndex(
        (x) => x.id === activeEditing.idInscription
      );
      if (insIdx !== -1) {
        const currentInsId = next.inscriptions[insIdx].id;
        const cleanNum = numInscription.trim();
        next.inscriptions[insIdx] = {
          ...next.inscriptions[insIdx],
          idAnnee,
          idMention: effectiveMentionId,
          idNiveau,
          idParcours:
            effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
          numInscription: cleanNum,
          reference: reference.trim(),
          ...issueIdentity(currentInsId, cleanNum),
        };
        const updatedRecord = enrichInscriptions(next).find(
          (r) => r.idInscription === currentInsId
        );
        if (updatedRecord) {
          syncCertificateRegistryForInscription(updatedRecord);
        }
      }
      onSave(
        next,
        `Fiche de ${cleanedNom} ${cleanedPrenom} mise à jour.`,
        { keepOpen: false }
      );
      return;
    }

    if (selectedExistingId) {
      const etIdx = next.etudiants.findIndex(
        (x) => x.id === selectedExistingId
      );
      if (etIdx !== -1) {
        next.etudiants[etIdx] = {
          ...next.etudiants[etIdx],
          nom: cleanedNom,
          prenom: cleanedPrenom,
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
      const cleanNum = numInscription.trim();
      next.inscriptions.push({
        id: reinscriptionId,
        idEtudiant: selectedExistingId,
        idAnnee,
        idMention: effectiveMentionId,
        idNiveau,
        idParcours:
          effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
        numInscription: cleanNum,
        reference: reference.trim(),
        ...issueIdentity(reinscriptionId, cleanNum),
      });

      const summary = `Réinscription enregistrée pour ${cleanedNom} ${cleanedPrenom} (${niveauLabel} · ${mentionLabel}, ${anneeLabel}).`;
      setLocalDb(next);
      onSave(next, summary, { keepOpen });
      if (keepOpen) {
        resetFormForNextEntry(next);
      }
      return;
    }

    const newEtudiantId = getNextId(next.etudiants);
    const newEtudiant: Etudiant = {
      id: newEtudiantId,
      nom: cleanedNom,
      prenom: cleanedPrenom,
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
    const cleanNum = numInscription.trim();
    const newInscription: Inscription = {
      id: newInscriptionId,
      idEtudiant: newEtudiantId,
      idAnnee,
      idMention: effectiveMentionId,
      idNiveau,
      idParcours:
        effectiveParcoursId === '' ? null : Number(effectiveParcoursId),
      numInscription: cleanNum,
      reference: reference.trim(),
      ...issueIdentity(newInscriptionId, cleanNum),
    };
    next.inscriptions.push(newInscription);

    const summary = `Nouvel étudiant ${cleanedNom} ${cleanedPrenom} inscrit en ${niveauLabel} · ${mentionLabel} (${anneeLabel}).`;
    setLocalDb(next);
    onSave(next, summary, { keepOpen });
    if (keepOpen) {
      resetFormForNextEntry(next);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    persistInscription(false);
  };

  const handleNomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || nameSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % nameSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(
        (prev) => (prev - 1 + nameSuggestions.length) % nameSuggestions.length
      );
    } else if (e.key === 'Enter') {
      const picked = nameSuggestions[highlightedIndex];
      if (picked) {
        e.preventDefault();
        applyAssistedSuggestion(picked, true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(false);
    }
  };

  const activeAnneeLabel =
    localDb.annees.find((a) => a.id === idAnnee)?.annee ?? '';
  const showAutocompletePopover =
    !activeEditing &&
    selectedExistingId === null &&
    !homonymDetached &&
    dropdownOpen &&
    nameSuggestions.length > 0;

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-md shrink-0 ${
                activeEditing
                  ? 'bg-slate-100 text-slate-700'
                  : selectedExistingId
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-blue-50 text-blue-700'
              }`}
            >
              {activeEditing ? (
                <GraduationCap className="w-5 h-5" />
              ) : selectedExistingId ? (
                <UserCheck className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 truncate font-display">
                  {activeEditing
                    ? 'Modifier la fiche étudiant & inscription'
                    : selectedExistingId
                      ? 'Réinscription assistée (ancien étudiant)'
                      : 'Nouvelle inscription'}
                </h2>
                {activeAnneeLabel && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {activeAnneeLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeEditing
                  ? "Mettez à jour l'état civil ou l'affectation académique"
                  : "Tapez le nom : la saisie assistée retrouve automatiquement la dernière inscription d'un ancien étudiant"}
              </p>
            </div>
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

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-6 py-5 space-y-6 flex-1 min-h-0"
        >
          {errorMsg && (
            <div className="px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Bandeau de fiche existante liée sur la base de la dernière inscription */}
          {!activeEditing && linkedSuggestion && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-950">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Fiche existante liée : {linkedSuggestion.etudiant.nom}{' '}
                      {linkedSuggestion.etudiant.prenom}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700">
                      #{linkedSuggestion.etudiant.id}
                    </span>
                  </div>
                  {linkedSuggestion.lastInscription ? (
                    <p className="text-[11.5px] text-emerald-800">
                      Dernière inscription :{' '}
                      <strong>
                        {linkedSuggestion.lastInscription.annee} ·{' '}
                        {linkedSuggestion.lastInscription.niveau} ·{' '}
                        {linkedSuggestion.lastInscription.mention}
                      </strong>
                      {linkedSuggestion.lastInscription.reference ||
                      linkedSuggestion.lastInscription.numInscription ? (
                        <span className="text-emerald-700/90">
                          {' '}
                          (Réf.{' '}
                          {linkedSuggestion.lastInscription.reference || '—'} ·
                          N°{' '}
                          {linkedSuggestion.lastInscription.numInscription ||
                            '—'}
                          )
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-emerald-800">
                      Fiche étudiant existante sans inscription antérieure.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExistingId(null);
                      setHomonymDetached(true);
                    }}
                    title="Conserver le texte saisi mais créer un nouvel étudiant distinct (homonyme)"
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Créer homonyme
                  </button>
                  <button
                    type="button"
                    onClick={() => resetFormForNextEntry(localDb)}
                    title="Effacer et rechercher un autre étudiant"
                    className="px-2.5 py-1 text-[11px] font-medium text-emerald-900 bg-emerald-100/80 border border-emerald-300 rounded hover:bg-emerald-200/70 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Changer
                  </button>
                </div>
              </div>

              {/* Choix rapide Passage vs Maintien / Redoublement */}
              {linkedSuggestion.suggestedAssignment &&
                linkedSuggestion.suggestedAssignment.hasProgression && (
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-emerald-200/70 text-[11.5px]">
                    <span className="text-emerald-900 font-medium">
                      Niveau pour {activeAnneeLabel || 'la nouvelle année'} :
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const assign = linkedSuggestion.suggestedAssignment!;
                        setIdNiveau(assign.idNiveauNext);
                        const nextParc = resolveCompatibleParcoursId(
                          localDb,
                          linkedSuggestion.lastInscription,
                          effectiveMentionId,
                          assign.idNiveauNext
                        );
                        setIdParcours(nextParc ?? '');
                      }}
                      className={`px-2.5 py-1 rounded font-semibold border transition-colors inline-flex items-center gap-1 ${
                        idNiveau ===
                        linkedSuggestion.suggestedAssignment.idNiveauNext
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100/60'
                      }`}
                    >
                      Passage :{' '}
                      {linkedSuggestion.suggestedAssignment.nextNiveauLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const assign = linkedSuggestion.suggestedAssignment!;
                        setIdNiveau(assign.idNiveauSame);
                        const sameParc = resolveCompatibleParcoursId(
                          localDb,
                          linkedSuggestion.lastInscription,
                          effectiveMentionId,
                          assign.idNiveauSame
                        );
                        setIdParcours(sameParc ?? '');
                      }}
                      className={`px-2.5 py-1 rounded font-medium border transition-colors ${
                        idNiveau ===
                        linkedSuggestion.suggestedAssignment.idNiveauSame
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100/60'
                      }`}
                    >
                      Maintien / Redoublement :{' '}
                      {linkedSuggestion.suggestedAssignment.sameNiveauLabel}
                    </button>
                  </div>
                )}
            </div>
          )}

          {/* Mode homonyme explicite */}
          {!activeEditing && selectedExistingId === null && homonymDetached && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-md px-3.5 py-2 text-xs text-blue-900 flex items-center justify-between gap-3">
              <span>
                Création d&apos;une <strong>nouvelle fiche étudiant</strong>{' '}
                (homonyme dissocié des fiches existantes).
              </span>
              <button
                type="button"
                onClick={() => {
                  setHomonymDetached(false);
                  setDropdownOpen(true);
                }}
                className="text-[11px] font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                Réactiver la saisie assistée
              </button>
            </div>
          )}

          {/* Alerte si l'étudiant lié est déjà inscrit dans l'année cible */}
          {existingTargetYearIns && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Cet étudiant possède déjà une inscription en{' '}
                    {existingTargetYearIns.annee}
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    {existingTargetYearIns.mention} ·{' '}
                    {existingTargetYearIns.niveau} (Réf.{' '}
                    {existingTargetYearIns.reference || '—'} · N°{' '}
                    {existingTargetYearIns.numInscription || '—'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  switchToExistingTargetInscription(existingTargetYearIns)
                }
                className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md whitespace-nowrap"
              >
                Modifier l&apos;inscription existante
              </button>
            </div>
          )}

          {/* Filet de sécurité doublon CIN / état civil si non lié */}
          {potentialDuplicateStudent && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {potentialDuplicateStudent.reason}
                  </p>
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
                  const found = assistedIndex.get(
                    potentialDuplicateStudent.etudiant.id
                  );
                  if (found) applyAssistedSuggestion(found, true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md whitespace-nowrap"
              >
                Lier cette fiche existante
              </button>
            </div>
          )}

          {/* Avertissements de validation (codes, dates) */}
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

          {/* Section État Civil avec Saisie Assistée sur le Nom */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Identité de l&apos;étudiant
              </h3>
              {!activeEditing && selectedExistingId === null && !homonymDetached && (
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                  <Sparkles className="w-3 h-3" />
                  Saisie assistée active sur le nom
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Champ NOM avec autocomplétion basée sur la dernière inscription */}
              <div ref={autocompleteBoxRef} className="relative">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom <span className="text-red-600">*</span>
                </label>
                <input
                  ref={nomInputRef}
                  type="text"
                  autoFocus={!activeEditing && !reinscribeStudentId}
                  autoComplete="off"
                  value={nom}
                  onFocus={() => {
                    if (
                      !activeEditing &&
                      selectedExistingId === null &&
                      !homonymDetached &&
                      nom.trim().length > 0
                    ) {
                      setDropdownOpen(true);
                    }
                  }}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setNom(nextVal);
                    setErrorMsg('');
                    if (
                      !activeEditing &&
                      selectedExistingId === null &&
                      !homonymDetached
                    ) {
                      setDropdownOpen(nextVal.trim().length > 0);
                    }
                  }}
                  onKeyDown={handleNomKeyDown}
                  placeholder="Tapez un nom (ex. AFITSARA, ELANIRIKO...)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />

                {showAutocompletePopover && (
                  <div
                    role="listbox"
                    aria-label="Suggestions d'anciens étudiants"
                    className="absolute left-0 right-0 sm:w-[540px] mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
                  >
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[10.5px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        Anciens étudiants — basé sur la dernière inscription
                      </span>
                      <span className="hidden sm:inline">
                        ↑↓ naviguer · Entrée choisir · Échap fermer
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {nameSuggestions.map((item, idx) => {
                        const isActive = idx === highlightedIndex;
                        const last = item.lastInscription;
                        const assign = item.suggestedAssignment;
                        const alreadyTarget = item.targetYearInscription;

                        return (
                          <button
                            key={item.etudiant.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onMouseDown={(ev) => {
                              // Évite la perte de focus avant la sélection
                              ev.preventDefault();
                              applyAssistedSuggestion(item, true);
                            }}
                            className={`w-full text-left px-3 py-2.5 flex items-start justify-between gap-3 transition-colors ${
                              isActive ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {item.etudiant.nom}{' '}
                                <span className="font-normal text-slate-700">
                                  {item.etudiant.prenom}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {item.etudiant.dateNaissance
                                  ? `Né(e) ${formatDateFR(item.etudiant.dateNaissance)}`
                                  : 'Date naiss. non renseignée'}
                                {item.etudiant.numeroCin
                                  ? ` · CIN ${item.etudiant.numeroCin}`
                                  : ''}
                                {last?.reference
                                  ? ` · Réf. ${last.reference}`
                                  : ''}
                              </div>
                            </div>

                            <div className="shrink-0 flex flex-col items-end gap-1 text-right">
                              {last ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium rounded bg-slate-100 text-slate-700">
                                  {last.annee} · {last.niveau} · {last.mention}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10.5px] rounded bg-slate-100 text-slate-500">
                                  Sans inscription
                                </span>
                              )}

                              {alreadyTarget ? (
                                <span className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-semibold rounded bg-amber-100 text-amber-800">
                                  Déjà inscrit en {alreadyTarget.annee} (
                                  {alreadyTarget.niveau})
                                </span>
                              ) : assign ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-semibold rounded bg-emerald-100 text-emerald-800">
                                  <ArrowRight className="w-3 h-3" />
                                  {assign.recommendedNiveauLabel} ·{' '}
                                  {assign.mentionLabel}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 truncate">
                        Nouvel étudiant ne figurant pas dans la liste ?
                      </span>
                      <button
                        type="button"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setDropdownOpen(false);
                        }}
                        className="font-semibold text-blue-700 hover:underline shrink-0"
                      >
                        Continuer nouvelle saisie
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Prénom(s)
                </label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => {
                    setPrenom(e.target.value);
                    if (
                      !activeEditing &&
                      selectedExistingId === null &&
                      !homonymDetached &&
                      nom.trim().length > 0
                    ) {
                      setDropdownOpen(true);
                    }
                  }}
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
                  {(activeEditing?.sexe || initialStudent?.sexe) &&
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Ex : 038 65 473 93"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              )}

              {isFieldEnabled('numeroCin') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Numéro CIN
                  </label>
                  <input
                    type="text"
                    value={numeroCin}
                    onChange={(e) => setNumeroCin(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Délivrance CIN
                </label>
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nationalité
                  </label>
                  <input
                    type="text"
                    value={nationalite}
                    onChange={(e) => setNationalite(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              )}

              {isFieldEnabled('filiation') && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom du père
                    </label>
                    <input
                      type="text"
                      value={nomPere}
                      onChange={(e) => setNomPere(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom de la mère
                    </label>
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
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-1.5 gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inscription académique
              </h3>
              <button
                type="button"
                onClick={handleAutoGenerateCodes}
                className="text-[11px] font-medium text-blue-700 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                <Wand2 className="w-3 h-3" />
                Générer Réf. &amp; N° uniques
              </button>
            </div>

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
                    ref={referenceInputRef}
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex : 250001"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Numéro d&apos;inscription
                </label>
                <input
                  ref={numInscriptionInputRef}
                  type="text"
                  value={numInscription}
                  onChange={(e) => setNumInscription(e.target.value)}
                  placeholder="Ex : 000728"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Année universitaire
                  </label>
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
                  onChange={(e) =>
                    handleAnneeSelectChange(Number(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {sortedAnnees.map((a) => (
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
                  <label className="text-xs font-medium text-slate-700">
                    Domaine
                  </label>
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
                  <label className="text-xs font-medium text-slate-700">
                    Mention
                  </label>
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
                  <label className="text-xs font-medium text-slate-700">
                    Niveau
                  </label>
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
                  <label className="text-xs font-medium text-slate-700">
                    Parcours
                  </label>
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
                    setIdParcours(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Grade
                    </label>
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
                    onClick={() =>
                      setCertificateToken(generateCertificateToken())
                    }
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Régénérer
                  </button>
                </div>
                <input
                  type="text"
                  value={certificateToken}
                  onChange={(e) =>
                    setCertificateToken(e.target.value.toUpperCase())
                  }
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
                        {field.required && (
                          <span className="text-red-600"> *</span>
                        )}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={customValues[field.id] ?? ''}
                          onChange={(e) =>
                            setCustomValue(field.id, e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={customValues[field.id] ?? ''}
                          onChange={(e) =>
                            setCustomValue(field.id, e.target.value)
                          }
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
                          onChange={(e) =>
                            setCustomValue(field.id, e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      )}
                      {field.help && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {field.help}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              Annuler
            </button>
            {!activeEditing && !reinscribeStudentId && (
              <button
                type="button"
                onClick={() => persistInscription(true)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Valider &amp; suivant
              </button>
            )}
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
