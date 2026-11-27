export interface AnneeUniversitaire {
  id: number;
  annee: string;
}

export interface Faculte {
  id: number;
  faculte: string;
  logo?: string;
}

export interface Domaine {
  id: number;
  domaine: string;
  idFaculte: number;
}

export interface Mention {
  id: number;
  mention: string;
  idDomaine: number;
}

export interface Niveau {
  id: number;
  niveau: string;
  grade: string;
}

export interface Parcours {
  id: number;
  parcours: string;
  idMention: number;
  idNiveau: number;
}

export interface Etudiant {
  id: number;
  nom: string;
  prenom: string;
  dateNaissance: string; // YYYY-MM-DD or ''
  lieuNaissance: string;
  sexe: 'M' | 'F' | string;
  telephone: string;
  numeroCin: string;
  dateCin: string; // YYYY-MM-DD or ''
  lieuDelivrance: string;
  nationalite: string;
  nomPere: string;
  nomMere: string;
}

export interface Inscription {
  id: number;
  idEtudiant: number;
  idNiveau: number;
  idAnnee: number;
  idMention: number;
  idParcours: number | null;
  numInscription: string;
  reference: string;
}

export interface ScolariteDatabase {
  annees: AnneeUniversitaire[];
  facultes: Faculte[];
  domaines: Domaine[];
  mentions: Mention[];
  niveaux: Niveau[];
  parcours: Parcours[];
  etudiants: Etudiant[];
  inscriptions: Inscription[];
}

export type NormalizedSex = 'M' | 'F' | 'Autre';

export interface EnrichedInscription {
  idInscription: number;
  idEtudiant: number;
  idAnnee: number;
  idFaculte: number;
  idDomaine: number;
  idMention: number;
  idNiveau: number;
  idParcours: number | null;
  reference: string;
  numInscription: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  sexe: string;
  sexeNormalized: NormalizedSex;
  telephone: string;
  numeroCin: string;
  dateCin: string;
  lieuDelivrance: string;
  nationalite: string;
  nomPere: string;
  nomMere: string;
  faculte: string;
  faculteLogo: string;
  domaine: string;
  mention: string;
  grade: string;
  niveau: string;
  parcours: string;
  annee: string;
}

export type NavigationView =
  | 'accueil'
  | 'dashboard'
  | 'certificats'
  | 'importation'
  | 'tables'
  | 'sauvegarde';

export type TableEntityKey =
  | 'facultes'
  | 'domaines'
  | 'mentions'
  | 'niveaux'
  | 'parcours'
  | 'annees'
  | 'etudiants'
  | 'inscriptions';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface CertificateSettings {
  issueDate: string; // YYYY-MM-DD or '' (means today)
  signatoryTitle: string;
  signatoryName: string;
  showFiliation: boolean;
}

export type ImportDuplicateMode =
  | 'skip_existing_inscription'
  | 'update_student'
  | 'create_new';

export interface DuplicateStudentGroup {
  key: string;
  reason: string;
  etudiants: Etudiant[];
}

export interface BirthdateAnomaly {
  etudiant: Etudiant;
  reason: string;
}

export interface DuplicateCodeEntry {
  value: string;
  annee: string;
  inscriptionIds: number[];
}

export interface DatabaseAuditReport {
  duplicateStudents: DuplicateStudentGroup[];
  suspiciousBirthdates: BirthdateAnomaly[];
  nonStandardSex: Etudiant[];
  missingCin: Etudiant[];
  missingTelephone: Etudiant[];
  duplicateReferences: DuplicateCodeEntry[];
  duplicateNumInscriptions: DuplicateCodeEntry[];
  orphanInscriptions: Inscription[];
  totalAnomalies: number;
}

export interface BreakdownItem {
  label: string;
  total: number;
  male: number;
  female: number;
  other: number;
}

export interface DashboardStats {
  totalInscriptions: number;
  uniqueStudents: number;
  multiYearStudents: number;
  maleCount: number;
  femaleCount: number;
  otherSexCount: number;
  cinCompletionRate: number;
  withCinCount: number;
  byMention: BreakdownItem[];
  byFaculte: BreakdownItem[];
  byNiveau: BreakdownItem[];
  byGrade: BreakdownItem[];
  byAnnee: BreakdownItem[];
  topLieuxDelivrance: { label: string; count: number }[];
}
