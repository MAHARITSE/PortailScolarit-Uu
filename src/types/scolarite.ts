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
  adresse?: string;
  email?: string;
  numeroCin: string;
  dateCin: string; // YYYY-MM-DD or ''
  lieuDelivrance: string;
  nationalite: string;
  nomPere: string;
  nomMere: string;
  /** Photo d'identité (data URL) utilisée sur la carte étudiant */
  photo?: string;
}

export interface Inscription {
  id: number;
  idEtudiant: number;
  idNiveau: number;
  idAnnee: number;
  idMention: number;
  idParcours: number | null;
  /** N° d'inscription administrative (matricule) */
  numInscription: string;
  /** N° d'inscription pédagogique */
  numInscriptionPedagogique?: string;
  reference: string;
  /** Valeurs des champs personnalisés définis dans l'administration */
  customValues?: Record<string, string>;
  /** Numéro officiel du certificat de scolarité */
  numeroCertificat?: string;
  /** Date de délivrance du certificat (AAAA-MM-JJ) */
  dateDelivrance?: string;
  /** Jeton unique de vérification d'authenticité */
  certificateToken?: string;
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
  numInscriptionPedagogique: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  sexe: string;
  sexeNormalized: NormalizedSex;
  telephone: string;
  adresse: string;
  email: string;
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
  photo: string;
  customValues: Record<string, string>;
  numeroCertificat: string;
  dateDelivrance: string;
  certificateToken: string;
}

export interface StudentAssistedAssignment {
  idFaculte: number;
  idDomaine: number;
  idMention: number;
  /** Niveau proposé par défaut (niveau supérieur si l'année cible est postérieure) */
  recommendedNiveauId: number;
  /** Niveau supérieur calculé (ex. L1 -> Licence 2) */
  idNiveauNext: number;
  /** Niveau identique à la dernière inscription (cas de maintien / redoublement) */
  idNiveauSame: number;
  /** Parcours compatible pour le niveau recommandé (null si aucun) */
  idParcours: number | null;
  faculteLabel: string;
  domaineLabel: string;
  mentionLabel: string;
  recommendedNiveauLabel: string;
  nextNiveauLabel: string;
  sameNiveauLabel: string;
  /** Vrai si un niveau supérieur distinct existe dans le référentiel */
  hasProgression: boolean;
}

export interface StudentAssistedSuggestion {
  etudiant: Etudiant;
  /** Dernière inscription connue servant de base (hors année cible en priorité) */
  lastInscription: EnrichedInscription | null;
  /** Inscription déjà enregistrée dans l'année cible sélectionnée, le cas échéant */
  targetYearInscription: EnrichedInscription | null;
  /** Proposition d'affectation académique calculée sur la base de la dernière inscription */
  suggestedAssignment: StudentAssistedAssignment | null;
}

export type NavigationView =
  | 'accueil'
  | 'dashboard'
  | 'certificats'
  | 'administration'
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

/* ------------------------------------------------------------------ */
/* Modèles de documents (certificat de scolarité & carte étudiant)     */
/* ------------------------------------------------------------------ */

export type DocumentKind = 'certificat' | 'carte';

/* ----------------------------- Champs de saisie ------------------------------ */

export type FieldInputType = 'text' | 'textarea' | 'date' | 'number' | 'select';

/** Présentation du corps du certificat : phrase rédigée ou tableau. */
export type CertificateBodyMode = 'phrase' | 'table';

/** Impression de la carte étudiant : pliage recto/verso ou deux pages. */
export type CardPrintMode = 'fold' | 'side';

/* --------------------------- Typographie du corps --------------------------- */

export type BodyFontFamily = 'sans' | 'serif' | 'display' | 'mono';
export type BodyTextAlign = 'left' | 'center' | 'justify';
export type PageTextAlign = 'left' | 'center' | 'right' | 'justify';

export interface ElementTypography {
  fontFamily: string;
  /** Taille en px (0 = taille héritée) */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  align: PageTextAlign;
  color?: string;
  /** Décalage libre sur la page (en px) */
  offsetX?: number;
  offsetY?: number;
}

export type StyledZoneKey =
  | 'reference'
  | 'title'
  | 'body'
  | 'signature'
  | 'qr'
  | 'footer'
  | 'legalMention';

export type PageElementSelection =
  | { kind: 'headerLine'; id: string }
  | { kind: 'reference' }
  | { kind: 'title' }
  | { kind: 'body' }
  | { kind: 'freeZone'; id: string }
  | { kind: 'signature' }
  | { kind: 'qr' }
  | { kind: 'footer' }
  | { kind: 'legalMention' };

export interface BodyTypography {
  fontFamily: BodyFontFamily;
  /** Taille en px (0 = taille héritée du document) */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: BodyTextAlign;
  /** Casse forcée en majuscules */
  uppercase: boolean;
  /** Interligne (1 = normal) */
  lineHeight: number;
}
export type FieldDateFormat = 'JJ/MM/AAAA' | 'AAAA-MM-JJ';

export interface FieldDefinition {
  /** Identifiant stable utilisé dans les variables {{id}} */
  id: string;
  label: string;
  type: FieldInputType;
  enabled: boolean;
  required: boolean;
  /** Champ d'origine (état civil / inscription) ou personnalisé */
  custom: boolean;
  /** Texte transformé en majuscules (noms, lieux…) */
  uppercase: boolean;
  /** Format d'affichage des dates */
  dateFormat: FieldDateFormat;
  /** Masque de saisie simple (ex. 999 999 999 999) */
  mask: string;
  /** Options pour les listes déroulantes */
  options: string[];
  /** Aide affichée sous le champ du formulaire */
  help: string;
  /** Colonne pleine largeur dans le formulaire */
  fullWidth: boolean;
}

/* --------------------------------- QR Code ---------------------------------- */

export type QrContentMode = 'structured' | 'url' | 'both';
export type QrPosition =
  | 'bottom-left'
  | 'bottom-right'
  | 'beside-signature'
  | 'header'
  | 'footer';
export type QrSize = 'small' | 'medium' | 'large';

/* -------------------------------- Impression -------------------------------- */

export type PrintOrientation = 'portrait' | 'landscape';
export type TwoUpLayout = 'side-by-side' | 'stacked';

export interface CertificatePrintSettings {
  perSheet: 1 | 2;
  orientation: PrintOrientation;
  twoUpLayout: TwoUpLayout;
  /** En mode 2/feuille : dupliquer le même certificat (souche / archive) */
  duplicateSame: boolean;
  cutLine: boolean;
  marginMm: number;
}

export interface CertificateTokenEntry {
  token: string;
  idInscription: number;
  idEtudiant: number;
  numeroCertificat: string;
  nom: string;
  prenom: string;
  mention: string;
  niveau: string;
  annee: string;
  issuedAt: string;
}

export type DocumentBorderStyle = 'none' | 'thin' | 'double';
export type DocumentFontFamily = 'sans' | 'display' | 'mono';

export type CertificateSectionKey =
  | 'reference'
  | 'title'
  | 'body'
  | 'signatureQr'
  | 'footer'
  | 'legalMention';

export type HeaderLayoutMode = 'classic' | 'left' | 'centered' | 'minimal';
export type HorizontalAlign = 'left' | 'center' | 'right';
export type CardPhotoPosition = 'left' | 'right';
export type CardPhotoShape = 'rect' | 'rounded' | 'circle';
export type CardQrPlacement = 'front' | 'back' | 'both' | 'none';
export type CardHeaderStyle = 'solid' | 'gradient' | 'minimal';

export interface DocumentFreeZone {
  id: string;
  label: string;
  text: string;
  position: 'top' | 'body' | 'bottom';
  align: HorizontalAlign;
  enabled: boolean;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  fontSize?: number;
  boxed?: boolean;
  color?: string;
  offsetX?: number;
  offsetY?: number;
}

export interface DocumentLayoutConfig {
  sectionOrder: CertificateSectionKey[];
  headerLayout: HeaderLayoutMode;
  logoSizePx: number;
  secondaryLogoSizePx: number;
  showHeaderDivider: boolean;
  headerDividerColor: string;
  titleAlign: HorizontalAlign;
  titleUnderline: boolean;
  titleUppercase: boolean;
  titleSizeEm: number;
  referenceTemplate: string;
  matriculeLabel: string;
  signatureAlign: HorizontalAlign;
  datePhraseTemplate: string;
  signatureImageHeightPx: number;
  pagePaddingPx: number;
  borderWidthPx: number;
  borderRadiusPx: number;
  backgroundColor: string;
  freeZones: DocumentFreeZone[];
  elementStyles?: Partial<Record<StyledZoneKey, Partial<ElementTypography>>>;
}

export interface DocumentTemplateRow {
  id: string;
  label: string;
  enabled: boolean;
}

export interface HeaderLineItem {
  id: string;
  label: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: HorizontalAlign;
  uppercase?: boolean;
  color?: string;
}

export interface DocumentTemplate {
  version: number;
  kind: DocumentKind;
  updatedAt: string;
  header: {
    showLogo: boolean;
    logoUrl: string;
    showSecondaryLogo: boolean;
    secondaryLogoUrl: string;
    line1: string;
    line2: string;
    line3: string;
    line4: string;
    line5: string;
    lines?: HeaderLineItem[];
  };
  texts: {
    title: string;
    intro: string;
    closing: string;
    legalMention: string;
  };
  signature: {
    title: string;
    name: string;
    place: string;
    showDate: boolean;
    /** Image de signature / cachet (data URL) */
    imageUrl: string;
    showImage: boolean;
  };
  /** Bloc de pied de page (adresse, contacts, note) */
  footer: {
    showFooter: boolean;
    address: string;
    contacts: string;
    note: string;
  };
  /** Corps du texte avec variables {{...}} */
  body: {
    template: string;
    /**
     * `phrase` : certificat rédigé sous forme de phrase à compléter (aucun
     * tableau de données) · `table` : champs présentés en tableau.
     */
    mode: CertificateBodyMode;
    /** Police et caractère du texte rédigé */
    style: BodyTypography;
  };
  /** Champs affichés sur le certificat / saisis dans le formulaire */
  fields: FieldDefinition[];
  blocks: {
    header: boolean;
    reference: boolean;
    title: boolean;
    identity: boolean;
    filiation: boolean;
    academicTable: boolean;
    qr: boolean;
    signature: boolean;
    watermark: boolean;
    legalMention: boolean;
  };
  rows: DocumentTemplateRow[];
  qr: {
    enabled: boolean;
    size: number;
    preset: QrSize;
    mode: QrContentMode;
    /** Gabarit d'URL de vérification, ex. https://…/verifier?code={{token}} */
    urlTemplate: string;
    position: QrPosition;
    label: string;
    showLabel: boolean;
    includeName: boolean;
    includeInstitution: boolean;
    includeMention: boolean;
    includeLevel: boolean;
    includeYear: boolean;
    includeReference: boolean;
    header: string;
  };
  print: CertificatePrintSettings;
  appearance: {
    accentColor: string;
    textColor: string;
    borderStyle: DocumentBorderStyle;
    watermarkText: string;
    watermarkOpacity: number;
    fontFamily: DocumentFontFamily;
    fontSize: number;
  };
  layout: DocumentLayoutConfig;
  card: {
    /** `fold` : recto et verso côte à côte sur une A4 à plier en 2 · `side` : 2 pages */
    printMode: CardPrintMode;
    showPhoto: boolean;
    photoHint: string;
    photoPosition: CardPhotoPosition;
    photoShape: CardPhotoShape;
    qrPlacement: CardQrPlacement;
    headerStyle: CardHeaderStyle;
    headerColor: string;
    showValidity: boolean;
    validityYears: number;
    backTitle: string;
    backNote: string;
    footerText: string;
    frontFields: string[];
    rounded: boolean;
  };
}

export type DocumentTemplates = Record<DocumentKind, DocumentTemplate>;

export interface SavedDocumentProfile {
  id: string;
  name: string;
  kind: DocumentKind;
  updatedAt: string;
  template: DocumentTemplate;
}
