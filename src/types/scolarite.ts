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
  | 'importation'
  | 'certificats'
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
