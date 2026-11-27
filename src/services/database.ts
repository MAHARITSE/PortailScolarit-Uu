import * as XLSX from 'xlsx';
import seedDataRaw from '../data/seedData.json';
import {
  AnneeUniversitaire,
  BirthdateAnomaly,
  BreakdownItem,
  CertificateSettings,
  CertificateSectionKey,
  DashboardStats,
  CertificateTokenEntry,
  DocumentKind,
  DocumentTemplate,
  DocumentTemplates,
  FieldDefinition,
  HeaderLineItem,
  QrSize,
  DatabaseAuditReport,
  DuplicateCodeEntry,
  DuplicateStudentGroup,
  EnrichedInscription,
  Etudiant,
  ImportDuplicateMode,
  Niveau,
  NormalizedSex,
  SaveResult,
  SavedDocumentProfile,
  ScolariteDatabase,
  StudentAssistedAssignment,
  StudentAssistedSuggestion,
  TableEntityKey,
} from '../types/scolarite';

const STORAGE_KEY = 'portail_scolarite_uu_db_v1';
const CERT_SETTINGS_KEY = 'portail_scolarite_uu_cert_settings_v1';
const ACTIVE_ANNEE_KEY = 'portail_scolarite_uu_active_annee_v1';
const DOC_TEMPLATES_KEY = 'portail_scolarite_uu_doc_templates_v1';
const DOC_PROFILES_KEY = 'portail_scolarite_uu_doc_profiles_v1';

export const DEFAULT_SECTION_ORDER: CertificateSectionKey[] = [
  'reference',
  'title',
  'body',
  'signatureQr',
  'footer',
  'legalMention',
];

export const DEFAULT_CARD_FRONT_FIELDS: string[] = [
  'numInscription',
  'niveau',
  'mention',
  'dateNaissance',
];

export const CARD_FRONT_FIELD_OPTIONS: { id: string; label: string }[] = [
  { id: 'numInscription', label: 'N° inscription' },
  { id: 'niveau', label: 'Niveau' },
  { id: 'mention', label: 'Mention' },
  { id: 'dateNaissance', label: 'Date de naissance' },
  { id: 'lieuNaissance', label: 'Lieu de naissance' },
  { id: 'parcours', label: 'Parcours' },
  { id: 'domaine', label: 'Domaine' },
  { id: 'grade', label: 'Grade' },
  { id: 'faculte', label: 'Faculté / Établissement' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'numeroCin', label: 'N° CIN' },
  { id: 'nationalite', label: 'Nationalité' },
  { id: 'reference', label: 'Référence' },
  { id: 'annee', label: 'Année universitaire' },
];

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  issueDate: '',
  signatoryTitle: '',
  signatoryName: '',
  showFiliation: true,
};

export function getSeedDatabase(): ScolariteDatabase {
  return structuredClone(seedDataRaw as ScolariteDatabase);
}

export function loadDatabase(): ScolariteDatabase {
  try {
    if (typeof localStorage === 'undefined') {
      return getSeedDatabase();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = getSeedDatabase();
      saveDatabase(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as ScolariteDatabase;
    if (
      !parsed ||
      !Array.isArray(parsed.etudiants) ||
      !Array.isArray(parsed.inscriptions) ||
      !Array.isArray(parsed.facultes) ||
      !Array.isArray(parsed.domaines) ||
      !Array.isArray(parsed.mentions) ||
      !Array.isArray(parsed.niveaux) ||
      !Array.isArray(parsed.parcours) ||
      !Array.isArray(parsed.annees)
    ) {
      const seed = getSeedDatabase();
      saveDatabase(seed);
      return seed;
    }
    return parsed;
  } catch {
    return getSeedDatabase();
  }
}

export function saveDatabase(db: ScolariteDatabase): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return { ok: true };
    }
    const serialized = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, serialized);
    return { ok: true };
  } catch (err) {
    console.error('Impossible de sauvegarder dans localStorage:', err);
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    return {
      ok: false,
      error: isQuota
        ? 'Espace de stockage local saturé (5 Mo). Exportez une sauvegarde JSON et réduisez la taille des logos ou données.'
        : 'Erreur lors de la sauvegarde locale des données.',
    };
  }
}

export function getDatabaseStorageSizeKB(db: ScolariteDatabase): number {
  try {
    const bytes = new Blob([JSON.stringify(db)]).size;
    return Math.round(bytes / 1024);
  } catch {
    return Math.round(JSON.stringify(db).length / 1024);
  }
}

/** Année de début d'un libellé "2024-2025" (0 si non reconnue). */
export function anneeStartYear(label: string | null | undefined): number {
  const match = String(label ?? '').match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

/** Trie les années universitaires de la plus récente à la plus ancienne. */
export function sortAnneesDesc<T extends { annee: string }>(annees: T[]): T[] {
  return [...annees].sort(
    (a, b) =>
      anneeStartYear(b.annee) - anneeStartYear(a.annee) ||
      b.annee.localeCompare(a.annee, 'fr')
  );
}

/** Année universitaire la plus récente du référentiel ("dernière année"). */
export function getLatestAnneeLabel(annees: { annee: string }[]): string {
  return sortAnneesDesc(annees)[0]?.annee ?? '';
}

/**
 * Année universitaire de travail : une seule année à la fois, par défaut la
 * plus récente. Le choix de l'utilisateur est mémorisé localement.
 */
export function loadActiveAnnee(annees: { annee: string }[]): string {
  const latest = getLatestAnneeLabel(annees);
  try {
    if (typeof localStorage === 'undefined') return latest;
    const stored = localStorage.getItem(ACTIVE_ANNEE_KEY);
    if (stored && annees.some((a) => a.annee === stored)) return stored;
  } catch {
    // ignore storage errors
  }
  return latest;
}

export function saveActiveAnnee(annee: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACTIVE_ANNEE_KEY, annee);
  } catch {
    // ignore preference persistence errors
  }
}

export function loadCertificateSettings(): CertificateSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_CERTIFICATE_SETTINGS };
    const raw = localStorage.getItem(CERT_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_CERTIFICATE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CertificateSettings>;
    return {
      issueDate: typeof parsed.issueDate === 'string' ? parsed.issueDate : '',
      signatoryTitle:
        typeof parsed.signatoryTitle === 'string' &&
        parsed.signatoryTitle !== 'Le Responsable de la Scolarité Centrale'
          ? parsed.signatoryTitle
          : '',
      signatoryName: typeof parsed.signatoryName === 'string' ? parsed.signatoryName : '',
      showFiliation:
        typeof parsed.showFiliation === 'boolean'
          ? parsed.showFiliation
          : DEFAULT_CERTIFICATE_SETTINGS.showFiliation,
    };
  } catch {
    return { ...DEFAULT_CERTIFICATE_SETTINGS };
  }
}

export function saveCertificateSettings(settings: CertificateSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CERT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore preference persistence errors
  }
}

export function resetToSeedDatabase(): ScolariteDatabase {
  const seed = getSeedDatabase();
  saveDatabase(seed);
  return seed;
}

export function createEmptyDatabase(): ScolariteDatabase {
  const empty: ScolariteDatabase = {
    annees: [],
    facultes: [],
    domaines: [],
    mentions: [],
    niveaux: [],
    parcours: [],
    etudiants: [],
    inscriptions: [],
  };
  saveDatabase(empty);
  return empty;
}

export function getNextId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  let max = 0;
  for (const item of items) {
    if (item.id > max) max = item.id;
  }
  return max + 1;
}

export function normalizeSex(raw: string | undefined | null): NormalizedSex {
  const s = (raw ?? '').trim().toUpperCase();
  if (s === 'M' || s === 'G' || s === 'H' || s === 'MASCULIN' || s === 'GARCON' || s === 'GARÇON') {
    return 'M';
  }
  if (s === 'F' || s === 'FEMININ' || s === 'FÉMININ') {
    return 'F';
  }
  return 'Autre';
}

export function normalizePhone(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/\D+/g, '');
  // Excel often strips leading zero from 10-digit Madagascar numbers (373024156 -> 0373024156)
  if (digits.length === 9 && digits.startsWith('3')) {
    const full = `0${digits}`;
    return `${full.slice(0, 3)} ${full.slice(3, 5)} ${full.slice(5, 8)} ${full.slice(8, 10)}`;
  }
  if (digits.length === 10 && digits.startsWith('03')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)}`;
  }
  return s;
}

export function normalizeCin(raw: string | undefined | null): string {
  return (raw ?? '').replace(/\s+/g, '').trim();
}

const NIVEAU_CYCLES = ['licence', 'master', 'doctorat'] as const;
type NiveauCycle = (typeof NIVEAU_CYCLES)[number];

const NIVEAU_CYCLE_RANK: Record<NiveauCycle, number> = {
  licence: 0,
  master: 1,
  doctorat: 2,
};

/**
 * Clé canonique d'un niveau : "L1", "licence1", "Licence 1" et "1ère année Licence"
 * donnent tous "licence 1". Les libellés non reconnus sont simplement normalisés.
 */
export function normalizeNiveauKey(raw: string | null | undefined): string {
  const cleaned = (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[._\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const compact = cleaned.replace(/\s+/g, '');
  const cycleFor = (prefix: string): NiveauCycle | null => {
    if (prefix.startsWith('lic') || prefix === 'l') return 'licence';
    if (prefix.startsWith('mas') || prefix === 'm') return 'master';
    if (prefix.startsWith('doc') || prefix === 'd') return 'doctorat';
    return null;
  };
  const prefixPattern = '(licence|lic|master|mast|doctorat|doct|doctorant|m|l|d)';

  // "l1", "m2", "d3", "licence1", "master2", ...
  const shortMatch = compact.match(new RegExp(`^${prefixPattern}(\\d{1,2})$`));
  if (shortMatch) {
    const cycle = cycleFor(shortMatch[1]);
    if (cycle) return `${cycle} ${Number(shortMatch[2])}`;
  }

  // "1ereanneelicence", "2eanneemaster", ...
  const yearFirstMatch = compact.match(
    new RegExp(`^(\\d{1,2})(?:ere|ieme|e|nd|re)?annee(licence|lic|master|mast|doctorat|doct|m|l|d)$`)
  );
  if (yearFirstMatch) {
    const cycle = cycleFor(yearFirstMatch[2]);
    if (cycle) return `${cycle} ${Number(yearFirstMatch[1])}`;
  }

  // "licence1ereannee", "master2emeannee", ...
  const cycleFirstMatch = compact.match(
    new RegExp(`^${prefixPattern}(\\d{1,2})(?:ere|ieme|e|nd|re)?annee$`)
  );
  if (cycleFirstMatch) {
    const cycle = cycleFor(cycleFirstMatch[1]);
    if (cycle) return `${cycle} ${Number(cycleFirstMatch[2])}`;
  }

  return cleaned;
}

/** Tri lisible des niveaux : Licence 1..3, Master 1..2, Doctorat 1..3, puis alphabétique. */
export function compareNiveauKeys(a: string, b: string): number {
  const parse = (key: string) => {
    const match = key.match(/^(licence|master|doctorat)\s+(\d{1,2})$/);
    if (!match) return null;
    return {
      rank: NIVEAU_CYCLE_RANK[match[1] as NiveauCycle],
      year: Number(match[2]),
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa && pb) return pa.rank - pb.rank || pa.year - pb.year;
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b, 'fr');
}

export interface NiveauFilterOption {
  /** Clé canonique utilisée pour le filtrage (ex. "licence 1") */
  key: string;
  /** Libellé le plus explicite rencontré (ex. "Licence 1", jamais "L1") */
  label: string;
  /** Nombre d'inscriptions concernées */
  count: number;
}

/**
 * Construit la liste des niveaux réellement présents dans un jeu de données,
 * en fusionnant les alias ("L1" + "Licence 1") et en triant les niveaux.
 */
export function buildNiveauFilterOptions(
  labels: Iterable<string>
): NiveauFilterOption[] {
  const groups = new Map<
    string,
    { count: number; labels: Map<string, number> }
  >();

  for (const raw of labels) {
    const key = normalizeNiveauKey(raw);
    if (!key) continue;
    const display = (raw ?? '').trim() || key;
    const group = groups.get(key) ?? { count: 0, labels: new Map() };
    group.count += 1;
    group.labels.set(display, (group.labels.get(display) ?? 0) + 1);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const canonical = key.match(/^(licence|master|doctorat) (\d{1,2})$/);
      if (canonical) {
        // Libellé officiel lisible, même si la base ne contient que l'alias "L1"
        const cycle =
          canonical[1].charAt(0).toUpperCase() + canonical[1].slice(1);
        return { key, label: `${cycle} ${canonical[2]}`, count: group.count };
      }
      const [label] = [...group.labels.entries()].sort(
        (a, b) => b[0].length - a[0].length || b[1] - a[1]
      )[0];
      return {
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        count: group.count,
      };
    })
    .sort((a, b) => compareNiveauKeys(a.key, b.key));
}

export function formatDateFR(isoOrRaw: string): string {
  if (!isoOrRaw) return '';
  const trimmed = isoOrRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(6, 8)}/${trimmed.slice(4, 6)}/${trimmed.slice(0, 4)}`;
  }
  return trimmed;
}

export function parseDateToISO(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = String(value.getFullYear()).padStart(4, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = String(parsed.y).padStart(4, '0');
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const frMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (frMatch) {
    const [, d, m, y] = frMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return '';
}

export function calculateAge(dateNaissance: string, refDate = new Date()): number | null {
  if (!dateNaissance || !/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) return null;
  const [y, m, d] = dateNaissance.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  let age = refDate.getFullYear() - y;
  const monthDiff = refDate.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < d)) {
    age--;
  }
  return age;
}

export function getBirthdateAnomalyReason(
  dateNaissance: string,
  refDate = new Date()
): string | null {
  if (!dateNaissance) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) {
    return `Format invalide (${dateNaissance})`;
  }
  const [y, m, d] = dateNaissance.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return `Date calendaire invalide (${formatDateFR(dateNaissance)})`;
  }
  const currentYear = refDate.getFullYear();
  if (y > currentYear) {
    return `Année future / erronée (${y})`;
  }
  if (y < 1940) {
    return `Année trop ancienne (${y})`;
  }
  const age = calculateAge(dateNaissance, refDate);
  if (age !== null && age < 13) {
    return `Âge trop jeune pour l'université (${age} ans)`;
  }
  return null;
}

export function enrichInscriptions(db: ScolariteDatabase): EnrichedInscription[] {
  const etuMap = new Map(db.etudiants.map((e) => [e.id, e]));
  const anneeMap = new Map(db.annees.map((a) => [a.id, a]));
  const facMap = new Map(db.facultes.map((f) => [f.id, f]));
  const domMap = new Map(db.domaines.map((d) => [d.id, d]));
  const menMap = new Map(db.mentions.map((m) => [m.id, m]));
  const nivMap = new Map(db.niveaux.map((n) => [n.id, n]));
  const parMap = new Map(db.parcours.map((p) => [p.id, p]));

  const result: EnrichedInscription[] = [];
  for (const ins of db.inscriptions) {
    const etu = etuMap.get(ins.idEtudiant);
    const annee = anneeMap.get(ins.idAnnee);
    const mention = menMap.get(ins.idMention);
    const niveau = nivMap.get(ins.idNiveau);
    if (!etu || !annee || !mention || !niveau) continue;

    const domaine = domMap.get(mention.idDomaine);
    const faculte = domaine ? facMap.get(domaine.idFaculte) : undefined;
    const parcours = ins.idParcours ? parMap.get(ins.idParcours) : undefined;

    result.push({
      idInscription: ins.id,
      idEtudiant: etu.id,
      idAnnee: annee.id,
      idFaculte: faculte?.id ?? 0,
      idDomaine: domaine?.id ?? 0,
      idMention: mention.id,
      idNiveau: niveau.id,
      idParcours: parcours?.id ?? null,
      reference: ins.reference,
      numInscription: ins.numInscription,
      nom: etu.nom,
      prenom: etu.prenom,
      dateNaissance: etu.dateNaissance,
      lieuNaissance: etu.lieuNaissance,
      sexe: etu.sexe,
      sexeNormalized: normalizeSex(etu.sexe),
      telephone: etu.telephone,
      numeroCin: etu.numeroCin,
      dateCin: etu.dateCin,
      lieuDelivrance: etu.lieuDelivrance,
      nationalite: etu.nationalite,
      nomPere: etu.nomPere,
      nomMere: etu.nomMere,
      faculte: faculte?.faculte ?? 'Non renseignée',
      faculteLogo: faculte?.logo ?? '/assets/logo-uu.jpg',
      domaine: domaine?.domaine ?? 'Non renseigné',
      mention: mention.mention,
      grade: niveau.grade,
      niveau: niveau.niveau,
      parcours: parcours ? parcours.parcours : '— Aucun —',
      annee: annee.annee,
      photo: etu.photo ?? '',
      customValues: ins.customValues ?? {},
      numeroCertificat: ins.numeroCertificat ?? '',
      dateDelivrance: ins.dateDelivrance ?? '',
      certificateToken: ins.certificateToken ?? '',
    });
  }

  result.sort((a, b) => {
    const c = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
    if (c !== 0) return c;
    return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' });
  });

  return result;
}

function buildBreakdown(
  rows: EnrichedInscription[],
  selector: (r: EnrichedInscription) => string
): BreakdownItem[] {
  const map = new Map<string, BreakdownItem>();
  for (const r of rows) {
    const label = selector(r) || 'Non renseigné';
    let item = map.get(label);
    if (!item) {
      item = { label, total: 0, male: 0, female: 0, other: 0 };
      map.set(label, item);
    }
    item.total++;
    if (r.sexeNormalized === 'M') item.male++;
    else if (r.sexeNormalized === 'F') item.female++;
    else item.other++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function computeDashboardStats(
  db: ScolariteDatabase,
  filterAnnee = 'ALL'
): DashboardStats {
  const allRows = enrichInscriptions(db);
  const rows =
    filterAnnee === 'ALL' || !filterAnnee
      ? allRows
      : allRows.filter((r) => r.annee === filterAnnee);

  const uniqueStudentIds = new Set(rows.map((r) => r.idEtudiant));
  const studentYearsMap = new Map<number, Set<number>>();
  for (const ins of db.inscriptions) {
    if (!studentYearsMap.has(ins.idEtudiant)) {
      studentYearsMap.set(ins.idEtudiant, new Set());
    }
    studentYearsMap.get(ins.idEtudiant)!.add(ins.idAnnee);
  }
  let multiYearStudents = 0;
  for (const id of uniqueStudentIds) {
    if ((studentYearsMap.get(id)?.size ?? 0) > 1) multiYearStudents++;
  }

  let maleCount = 0;
  let femaleCount = 0;
  let otherSexCount = 0;
  let withCinCount = 0;
  const lieuxMap = new Map<string, number>();

  for (const r of rows) {
    if (r.sexeNormalized === 'M') maleCount++;
    else if (r.sexeNormalized === 'F') femaleCount++;
    else otherSexCount++;

    if (normalizeCin(r.numeroCin).length > 0) withCinCount++;

    const lieu = r.lieuDelivrance.trim().toUpperCase();
    if (lieu) {
      lieuxMap.set(lieu, (lieuxMap.get(lieu) ?? 0) + 1);
    }
  }

  const cinCompletionRate =
    rows.length > 0 ? Math.round((withCinCount / rows.length) * 100) : 0;

  const topLieuxDelivrance = Array.from(lieuxMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalInscriptions: rows.length,
    uniqueStudents: uniqueStudentIds.size,
    multiYearStudents,
    maleCount,
    femaleCount,
    otherSexCount,
    cinCompletionRate,
    withCinCount,
    byMention: buildBreakdown(rows, (r) => r.mention),
    byFaculte: buildBreakdown(rows, (r) => r.faculte),
    byNiveau: buildBreakdown(rows, (r) => r.niveau),
    byGrade: buildBreakdown(rows, (r) => r.grade),
    byAnnee: buildBreakdown(allRows, (r) => r.annee),
    topLieuxDelivrance,
  };
}

export function auditDatabase(
  db: ScolariteDatabase,
  refDate = new Date()
): DatabaseAuditReport {
  const suspiciousBirthdates: BirthdateAnomaly[] = [];
  const nonStandardSex: Etudiant[] = [];
  const missingCin: Etudiant[] = [];
  const missingTelephone: Etudiant[] = [];

  const cinGroups = new Map<string, Etudiant[]>();
  const identityGroups = new Map<string, Etudiant[]>();

  for (const e of db.etudiants) {
    const dobReason = getBirthdateAnomalyReason(e.dateNaissance, refDate);
    if (dobReason) {
      suspiciousBirthdates.push({ etudiant: e, reason: dobReason });
    }

    if (e.sexe !== 'M' && e.sexe !== 'F') {
      nonStandardSex.push(e);
    }

    const cinNorm = normalizeCin(e.numeroCin);
    if (!cinNorm) {
      missingCin.push(e);
    } else {
      if (!cinGroups.has(cinNorm)) cinGroups.set(cinNorm, []);
      cinGroups.get(cinNorm)!.push(e);
    }

    if (!e.telephone || !e.telephone.trim()) {
      missingTelephone.push(e);
    }

    const idKey = `${e.nom.trim().toLowerCase()}|${e.prenom.trim().toLowerCase()}|${e.dateNaissance.trim()}`;
    if (e.nom.trim()) {
      if (!identityGroups.has(idKey)) identityGroups.set(idKey, []);
      identityGroups.get(idKey)!.push(e);
    }
  }

  const duplicateStudents: DuplicateStudentGroup[] = [];
  const seenGroupIds = new Set<string>();

  for (const [cin, list] of cinGroups.entries()) {
    if (list.length > 1) {
      const sig = list.map((x) => x.id).sort((a, b) => a - b).join(',');
      seenGroupIds.add(sig);
      duplicateStudents.push({
        key: `cin:${cin}`,
        reason: `Même numéro CIN (${cin})`,
        etudiants: list,
      });
    }
  }

  for (const [key, list] of identityGroups.entries()) {
    if (list.length > 1) {
      const sig = list.map((x) => x.id).sort((a, b) => a - b).join(',');
      if (!seenGroupIds.has(sig)) {
        seenGroupIds.add(sig);
        duplicateStudents.push({
          key: `id:${key}`,
          reason: 'Même Nom, Prénom(s) et Date de naissance',
          etudiants: list,
        });
      }
    }
  }

  // Check duplicate references / numInscription within same academic year
  const anneeMap = new Map(db.annees.map((a) => [a.id, a.annee]));
  const refGroups = new Map<string, number[]>();
  const numGroups = new Map<string, number[]>();

  const etuIds = new Set(db.etudiants.map((e) => e.id));
  const menIds = new Set(db.mentions.map((m) => m.id));
  const nivIds = new Set(db.niveaux.map((n) => n.id));
  const annIds = new Set(db.annees.map((a) => a.id));
  const orphanInscriptions = [];

  for (const ins of db.inscriptions) {
    if (
      !etuIds.has(ins.idEtudiant) ||
      !menIds.has(ins.idMention) ||
      !nivIds.has(ins.idNiveau) ||
      !annIds.has(ins.idAnnee)
    ) {
      orphanInscriptions.push(ins);
    }
    if (ins.reference.trim()) {
      const k = `${ins.idAnnee}::${ins.reference.trim().toLowerCase()}`;
      if (!refGroups.has(k)) refGroups.set(k, []);
      refGroups.get(k)!.push(ins.id);
    }
    if (ins.numInscription.trim()) {
      const k = `${ins.idAnnee}::${ins.numInscription.trim().toLowerCase()}`;
      if (!numGroups.has(k)) numGroups.set(k, []);
      numGroups.get(k)!.push(ins.id);
    }
  }

  const duplicateReferences: DuplicateCodeEntry[] = [];
  for (const [k, ids] of refGroups.entries()) {
    if (ids.length > 1) {
      const [idAnneeStr, value] = k.split('::');
      duplicateReferences.push({
        value,
        annee: anneeMap.get(Number(idAnneeStr)) ?? idAnneeStr,
        inscriptionIds: ids,
      });
    }
  }

  const duplicateNumInscriptions: DuplicateCodeEntry[] = [];
  for (const [k, ids] of numGroups.entries()) {
    if (ids.length > 1) {
      const [idAnneeStr, value] = k.split('::');
      duplicateNumInscriptions.push({
        value,
        annee: anneeMap.get(Number(idAnneeStr)) ?? idAnneeStr,
        inscriptionIds: ids,
      });
    }
  }

  const totalAnomalies =
    duplicateStudents.length +
    suspiciousBirthdates.length +
    nonStandardSex.length +
    duplicateReferences.length +
    duplicateNumInscriptions.length +
    orphanInscriptions.length;

  return {
    duplicateStudents,
    suspiciousBirthdates,
    nonStandardSex,
    missingCin,
    missingTelephone,
    duplicateReferences,
    duplicateNumInscriptions,
    orphanInscriptions,
    totalAnomalies,
  };
}

/** Construit le rapport d'audit au format CSV (séparateur « ; », BOM UTF-8). */
export function buildAuditReportCsv(audit: DatabaseAuditReport): string {
  const headers = [
    'Catégorie',
    'Détail',
    'ID étudiant',
    'NOM',
    'PRÉNOMS',
    'Date de naissance',
    'Téléphone',
    'CIN',
  ];
  const rows: string[][] = [];

  const studentRow = (category: string, detail: string, e: Etudiant) => [
    category,
    detail,
    String(e.id),
    e.nom,
    e.prenom,
    formatDateFR(e.dateNaissance),
    e.telephone,
    e.numeroCin,
  ];

  for (const group of audit.duplicateStudents) {
    for (const e of group.etudiants) {
      rows.push(studentRow('Doublon étudiant', group.reason, e));
    }
  }
  for (const { etudiant, reason } of audit.suspiciousBirthdates) {
    rows.push(studentRow('Date de naissance', reason, etudiant));
  }
  for (const e of audit.nonStandardSex) {
    rows.push(
      studentRow(
        'Code sexe non standard',
        `« ${e.sexe} » → ${normalizeSex(e.sexe)}`,
        e
      )
    );
  }
  for (const e of audit.missingCin) {
    rows.push(studentRow('CIN manquant', '', e));
  }
  for (const e of audit.missingTelephone) {
    rows.push(studentRow('Téléphone manquant', '', e));
  }
  for (const dup of audit.duplicateReferences) {
    rows.push([
      'Référence dupliquée',
      `${dup.value} (${dup.annee}) — inscriptions ${dup.inscriptionIds.join(', ')}`,
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  }
  for (const dup of audit.duplicateNumInscriptions) {
    rows.push([
      'N° inscription dupliqué',
      `${dup.value} (${dup.annee}) — inscriptions ${dup.inscriptionIds.join(', ')}`,
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  }
  for (const ins of audit.orphanInscriptions) {
    rows.push([
      'Inscription orpheline',
      `#${ins.id} (étudiant #${ins.idEtudiant})`,
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  }

  const escape = (value: string) => `"${(value ?? '').replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
  );
}

export function exportAuditReportToCsv(
  audit: DatabaseAuditReport,
  anneeLabel?: string
): void {
  const blob = new Blob([buildAuditReportCsv(audit)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const suffix = (anneeLabel || 'Toutes').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `Audit qualite donnees ${suffix} du ${dd}-${mm}-${yy}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Modèles de documents (administration)                              */
/* ------------------------------------------------------------------ */

const DOC_TEMPLATE_ROWS: { id: string; label: string }[] = [
  { id: 'institution', label: 'Institution' },
  { id: 'domaine', label: 'Domaine' },
  { id: 'mention', label: 'Mention' },
  { id: 'parcours', label: 'Parcours' },
  { id: 'grade', label: 'Grade' },
  { id: 'niveau', label: 'Niveau' },
  { id: 'annee', label: 'Année universitaire' },
  { id: 'numInscription', label: 'N° inscription' },
  { id: 'reference', label: 'Référence' },
];

/** Champs standard proposés dans l'administration (ordre par défaut). */
export const STANDARD_FIELD_DEFINITIONS: FieldDefinition[] = [
  { id: 'nom', label: 'Nom', type: 'text', enabled: true, required: true, custom: false, uppercase: true, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'prenom', label: 'Prénom(s)', type: 'text', enabled: true, required: true, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'dateNaissance', label: 'Date de naissance', type: 'date', enabled: true, required: true, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'lieuNaissance', label: 'Lieu de naissance', type: 'text', enabled: true, required: false, custom: false, uppercase: true, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'niveau', label: 'Classe / Niveau', type: 'text', enabled: true, required: true, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'mention', label: 'Mention', type: 'text', enabled: true, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'annee', label: 'Année scolaire', type: 'text', enabled: true, required: true, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'matricule', label: 'Matricule', type: 'text', enabled: true, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'numeroCertificat', label: 'Numéro de certificat', type: 'text', enabled: true, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'dateDelivrance', label: 'Date de délivrance', type: 'date', enabled: true, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'faculte', label: 'Établissement / Faculté', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'domaine', label: 'Domaine', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'parcours', label: 'Parcours', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'numeroCin', label: 'CIN', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '999 999 999 999', options: [], help: '', fullWidth: false },
  { id: 'telephone', label: 'Téléphone', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'nationalite', label: 'Nationalité', type: 'text', enabled: false, required: false, custom: false, uppercase: true, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
  { id: 'filiation', label: 'Filiation (père / mère)', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: true },
  { id: 'reference', label: 'Référence', type: 'text', enabled: false, required: false, custom: false, uppercase: false, dateFormat: 'JJ/MM/AAAA', mask: '', options: [], help: '', fullWidth: false },
];

/** Variables insérables dans le corps du certificat. */
export const CERTIFICATE_VARIABLES: { key: string; label: string }[] = [
  { key: 'civilite', label: 'Civilité' },
  { key: 'accord_e', label: 'Accord féminin (« e »)' },
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom(s)' },
  { key: 'nom_complet', label: 'Nom complet' },
  { key: 'date_naissance', label: 'Date de naissance' },
  { key: 'lieu_naissance', label: 'Lieu de naissance' },
  { key: 'classe', label: 'Classe / Niveau' },
  { key: 'mention', label: 'Mention' },
  { key: 'annee_scolaire', label: 'Année scolaire' },
  { key: 'matricule', label: 'Matricule' },
  { key: 'numero_certificat', label: 'N° de certificat' },
  { key: 'date_delivrance', label: 'Date de délivrance' },
  { key: 'faculte', label: 'Établissement' },
  { key: 'signataire_titre', label: 'Titre du signataire' },
  { key: 'signataire_nom', label: 'Nom du signataire' },
  { key: 'lieu_signature', label: 'Lieu de signature' },
  { key: 'token', label: 'Jeton de vérification' },
];

/**
 * Phrase type du certificat : le texte est complété automatiquement avec les
 * données de l'étudiant (aucun tableau).
 */
export const DEFAULT_CERTIFICATE_PHRASE =
  'Je soussigné(e), {{signataire_titre}}, certifie que {{civilite}} {{nom_complet}}, ' +
  'né{{accord_e}} le {{date_naissance}} à {{lieu_naissance}}, est régulièrement ' +
  'inscrit{{accord_e}} en {{classe}} — mention {{mention}} — au titre de l’année ' +
  'universitaire {{annee_scolaire}}, sous le matricule {{matricule}}.\n\n' +
  'Le présent certificat est délivré à l’intéressé{{accord_e}} pour servir et valoir ' +
  'ce que de droit.\n\n' +
  'Certificat n° {{numero_certificat}}, délivré le {{date_delivrance}}.';

export const QR_PIXEL_SIZES: Record<QrSize, number> = {
  small: 72,
  medium: 96,
  large: 128,
};

const CERT_REGISTRY_KEY = 'portail_scolarite_uu_cert_registry_v1';

/** Valeur affichée pour un champ du certificat. */
export function getCertificateFieldValue(
  record: EnrichedInscription,
  field: FieldDefinition,
  options: { numeroCertificat?: string; dateDelivrance?: string } = {}
): string {
  const formatDate = (iso: string) => {
    if (!iso) return '';
    return field.dateFormat === 'AAAA-MM-JJ' ? iso : formatDateFR(iso);
  };
  switch (field.id) {
    case 'nom':
      return record.nom;
    case 'prenom':
      return record.prenom;
    case 'dateNaissance':
      return formatDate(record.dateNaissance);
    case 'lieuNaissance':
      return record.lieuNaissance;
    case 'niveau':
      return record.niveau;
    case 'mention':
      return record.mention;
    case 'annee':
      return record.annee;
    case 'matricule':
      return record.numInscription;
    case 'numeroCertificat':
      return options.numeroCertificat || record.numeroCertificat;
    case 'dateDelivrance':
      return formatDate(options.dateDelivrance || record.dateDelivrance);
    case 'faculte':
      return record.faculte;
    case 'domaine':
      return record.domaine;
    case 'parcours':
      return record.parcours === '— Aucun —' ? '' : record.parcours;
    case 'numeroCin':
      return record.numeroCin;
    case 'telephone':
      return record.telephone;
    case 'nationalite':
      return record.nationalite;
    case 'filiation':
      return [record.nomPere, record.nomMere].filter(Boolean).join(' · ');
    case 'reference':
      return record.reference;
    default:
      return record.customValues?.[field.id] ?? '';
  }
}

/** Applique le formatage configuré (majuscules, masque) à une valeur. */
export function formatFieldValue(field: FieldDefinition, raw: string): string {
  let value = (raw ?? '').trim();
  if (!value) return '';
  if (field.type === 'date') {
    value = parseDateToISO(value) || value;
    return field.dateFormat === 'AAAA-MM-JJ' ? value : formatDateFR(value);
  }
  if (field.uppercase) value = value.toLocaleUpperCase('fr-FR');
  if (field.mask) {
    const digits = value.replace(/\D+/g, '');
    let index = 0;
    let masked = '';
    for (const char of field.mask) {
      if (index >= digits.length) break;
      masked += char === '9' ? digits[index++] : char;
    }
    if (digits.length > index) masked += digits.slice(index);
    return masked;
  }
  return value;
}

/** Variables disponibles dans le corps du certificat. */
export function buildCertificateVariables(
  record: EnrichedInscription,
  template: DocumentTemplate,
  extra: {
    token?: string;
    numeroCertificat?: string;
    dateDelivrance?: string;
    signataireTitre?: string;
    signataireNom?: string;
  } = {}
): Record<string, string> {
  const numero = extra.numeroCertificat || record.numeroCertificat;
  const delivrance = extra.dateDelivrance || record.dateDelivrance;
  const isFemale = (record.sexeNormalized ?? normalizeSex(record.sexe)) === 'F';
  const fieldById = new Map(template.fields.map((f) => [f.id, f]));
  const formatStd = (id: string, raw: string) => {
    const def =
      fieldById.get(id) ?? STANDARD_FIELD_DEFINITIONS.find((f) => f.id === id);
    return def ? formatFieldValue(def, raw) : raw;
  };

  const vars: Record<string, string> = {
    civilite: isFemale ? 'Mme/Mlle' : 'M.',
    nom: formatStd('nom', record.nom),
    prenom: formatStd('prenom', record.prenom),
    nom_complet: `${formatStd('nom', record.nom)} ${formatStd('prenom', record.prenom)}`.trim(),
    date_naissance: formatStd('dateNaissance', record.dateNaissance),
    lieu_naissance: formatStd('lieuNaissance', record.lieuNaissance),
    classe: formatStd('niveau', record.niveau),
    niveau: formatStd('niveau', record.niveau),
    mention: formatStd('mention', record.mention),
    annee_scolaire: formatStd('annee', record.annee),
    annee: formatStd('annee', record.annee),
    matricule: formatStd('matricule', record.numInscription),
    numero_certificat: numero,
    date_delivrance: formatStd('dateDelivrance', delivrance),
    faculte: formatStd('faculte', record.faculte),
    accord_e: isFemale ? 'e' : '',
    signataire_titre: extra.signataireTitre ?? template.signature.title,
    signataire_nom: extra.signataireNom ?? template.signature.name,
    lieu_signature: template.signature.place,
    domaine: formatStd('domaine', record.domaine),
    filiere: formatStd('mention', record.mention),
    token: extra.token ?? record.certificateToken,
    reference: formatStd('reference', record.reference),
  };

  for (const field of template.fields) {
    if (!field.custom) continue;
    vars[field.id] = formatFieldValue(field, record.customValues?.[field.id] ?? '');
  }
  return vars;
}

/** Remplace les {{variables}} du corps du certificat. */
export function renderCertificateBody(
  bodyTemplate: string,
  variables: Record<string, string>
): string {
  return (bodyTemplate ?? '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    // Une variable connue mais vide est remplacée par une chaîne vide
    // (ex. {{accord_e}} = '' au masculin) ; une variable inconnue est conservée.
    return key in variables ? variables[key] : match;
  });
}

/** Taille en pixels du QR code selon le préréglage choisi. */
export function getQrPixelSize(template: DocumentTemplate, scale = 1): number {
  const base = QR_PIXEL_SIZES[template.qr.preset] ?? template.qr.size ?? 96;
  return Math.round(base * scale);
}

/** Contenu encodé dans le QR code du certificat (URL, résumé ou les deux). */
export function buildCertificateQrPayload(
  record: EnrichedInscription,
  template: DocumentTemplate,
  extra: { token?: string } = {}
): string {
  const token = extra.token || record.certificateToken;
  const numero = record.numeroCertificat;
  const fill = (value: string) =>
    value
      .replace(/\{\{\s*token\s*\}\}/g, token)
      .replace(/\{\{\s*numero_certificat\s*\}\}/g, numero)
      .replace(/\{\{\s*matricule\s*\}\}/g, record.numInscription)
      .replace(/\{\{\s*annee\s*\}\}/g, record.annee);

  const url = fill(template.qr.urlTemplate || '');
  const summary = [
    template.qr.header,
    `N° certificat : ${numero || '—'}`,
    `Matricule     : ${record.numInscription || '—'}`,
    `Étudiant      : ${record.nom} ${record.prenom}`.trim(),
    `Classe        : ${record.niveau} · ${record.mention}`,
    `Année         : ${record.annee}`,
    `Émis le       : ${formatDateFR(record.dateDelivrance) || formatDateFR(new Date().toISOString().slice(0, 10))}`,
    `Jeton         : ${token || '—'}`,
    '=========================',
  ].join('\n');

  if (template.qr.mode === 'url') return url || summary;
  if (template.qr.mode === 'both') return `${url}\n${summary}`;
  return summary;
}

/** Jeton unique (16 caractères hexadécimaux) anti-falsification. */
export function generateCertificateToken(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
  }
  let token = '';
  for (let i = 0; i < 16; i += 1) {
    token += Math.floor(Math.random() * 16).toString(16).toUpperCase();
  }
  return token;
}

/** Numéro de certificat lisible : CERT/2024-2025/000123 (ou n° d'inscription). */
export function formatCertificateNumber(
  annee: string,
  numInscription: string,
  sequence: number
): string {
  const base = (numInscription || '').trim() || String(sequence);
  return `CERT/${annee || '----'}/${String(sequence).padStart(6, '0')}-${base}`;
}

export function buildCertificateNumber(
  record: EnrichedInscription,
  sequence?: number
): string {
  return formatCertificateNumber(
    record.annee,
    record.numInscription,
    sequence ?? record.idInscription
  );
}

/**
 * Garantit qu'une inscription possède un numéro de certificat, une date de
 * délivrance et un jeton unique. Les valeurs existantes sont conservées.
 */
export function ensureCertificateIdentity(
  db: ScolariteDatabase,
  idInscription: number
): {
  nextDb: ScolariteDatabase;
  record: EnrichedInscription | null;
  token: string;
  numeroCertificat: string;
  dateDelivrance: string;
  created: boolean;
} {
  const before = enrichInscriptions(db).find(
    (row) => row.idInscription === idInscription
  ) ?? null;
  if (!before) {
    return {
      nextDb: db,
      record: null,
      token: '',
      numeroCertificat: '',
      dateDelivrance: '',
      created: false,
    };
  }
  if (before.certificateToken && before.numeroCertificat && before.dateDelivrance) {
    return {
      nextDb: db,
      record: before,
      token: before.certificateToken,
      numeroCertificat: before.numeroCertificat,
      dateDelivrance: before.dateDelivrance,
      created: false,
    };
  }

  const nextDb = structuredClone(db);
  const index = nextDb.inscriptions.findIndex((row) => row.id === idInscription);
  if (index === -1) {
    return {
      nextDb: db,
      record: before,
      token: '',
      numeroCertificat: '',
      dateDelivrance: '',
      created: false,
    };
  }
  const target = nextDb.inscriptions[index];
  target.certificateToken = target.certificateToken || generateCertificateToken();
  target.numeroCertificat =
    target.numeroCertificat || buildCertificateNumber(before);
  target.dateDelivrance =
    target.dateDelivrance || new Date().toISOString().slice(0, 10);

  const record = enrichInscriptions(nextDb).find(
    (row) => row.idInscription === idInscription
  ) ?? before;

  return {
    nextDb,
    record,
    token: target.certificateToken,
    numeroCertificat: target.numeroCertificat,
    dateDelivrance: target.dateDelivrance,
    created: true,
  };
}

export function loadCertificateRegistry(): CertificateTokenEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CERT_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CertificateTokenEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Vide l'historique local des certificats émis. */
export function clearCertificateRegistry(): void {
  try {
    localStorage.removeItem(CERT_REGISTRY_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function registerCertificate(entry: CertificateTokenEntry): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const registry = loadCertificateRegistry().filter(
      (item) =>
        item.token !== entry.token &&
        item.idInscription !== entry.idInscription
    );
    registry.unshift(entry);
    localStorage.setItem(
      CERT_REGISTRY_KEY,
      JSON.stringify(registry.slice(0, 500))
    );
  } catch {
    // ignore registry errors
  }
}

/** Met à jour l'entrée du registre local si un certificat déjà émis est modifié. */
export function syncCertificateRegistryForInscription(
  record: EnrichedInscription
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const registry = loadCertificateRegistry();
    const index = registry.findIndex(
      (item) => item.idInscription === record.idInscription
    );
    if (index === -1) return;
    registry[index] = {
      ...registry[index],
      token: record.certificateToken || registry[index].token,
      idEtudiant: record.idEtudiant,
      numeroCertificat:
        record.numeroCertificat || registry[index].numeroCertificat,
      nom: record.nom,
      prenom: record.prenom,
      mention: record.mention,
      niveau: record.niveau,
      annee: record.annee,
    };
    localStorage.setItem(CERT_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // ignore registry errors
  }
}

export function findCertificateByToken(
  token: string
): CertificateTokenEntry | null {
  const normalized = token.trim().toUpperCase();
  if (!normalized) return null;
  return (
    loadCertificateRegistry().find(
      (entry) => entry.token.toUpperCase() === normalized
    ) ?? null
  );
}

export function buildDefaultHeaderLines(
  header?: Partial<DocumentTemplate['header']>
): HeaderLineItem[] {
  return [
    {
      id: 'h1',
      label: 'République / Entité principale',
      text: header?.line1 ?? "Repoblikan'i Madagasikara",
      fontFamily: 'Arial',
      fontSize: 11,
      bold: true,
      italic: false,
      underline: false,
      align: 'center',
      uppercase: true,
      color: '#334155',
    },
    {
      id: 'h2',
      label: 'Devise',
      text: header?.line2 ?? 'Fitiavana - Tanindrazana - Fandrosoana',
      fontFamily: 'Arial',
      fontSize: 10,
      bold: false,
      italic: true,
      underline: false,
      align: 'center',
      uppercase: false,
      color: '#64748b',
    },
    {
      id: 'h3',
      label: 'Ministère / Tutelle',
      text:
        header?.line3 ??
        "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
      fontFamily: 'Arial',
      fontSize: 11,
      bold: true,
      italic: false,
      underline: false,
      align: 'center',
      uppercase: true,
      color: '#1e293b',
    },
    {
      id: 'h4',
      label: "Nom principal de l'établissement",
      text: header?.line4 ?? 'Université de Toliara',
      fontFamily: 'Arial',
      fontSize: 18,
      bold: true,
      italic: false,
      underline: false,
      align: 'center',
      uppercase: true,
      color: '',
    },
    {
      id: 'h5',
      label: 'Direction / Service',
      text:
        header?.line5 ??
        "Direction des Systèmes d'Information et du Numérique · Scolarité Centrale",
      fontFamily: 'Arial',
      fontSize: 11,
      bold: false,
      italic: false,
      underline: false,
      align: 'center',
      uppercase: false,
      color: '#334155',
    },
  ];
}

export function getResolvedHeaderLines(
  header: DocumentTemplate['header']
): HeaderLineItem[] {
  if (Array.isArray(header.lines) && header.lines.length > 0) {
    return header.lines;
  }
  return buildDefaultHeaderLines(header);
}

export function syncHeaderLegacyFields(
  header: DocumentTemplate['header'],
  lines: HeaderLineItem[]
): DocumentTemplate['header'] {
  const mainLine = lines.find((l) => l.id === 'h4') ?? lines[3] ?? lines[0];
  return {
    ...header,
    lines,
    line1: lines[0]?.text ?? '',
    line2: lines[1]?.text ?? '',
    line3: lines[2]?.text ?? '',
    line4: mainLine?.text ?? '',
    line5: lines[4]?.text ?? '',
  };
}

function baseDocumentTemplate(kind: DocumentKind): DocumentTemplate {
  return {
    version: 1,
    kind,
    updatedAt: '',
    header: {
      showLogo: true,
      logoUrl: '/assets/logo-uu.jpg',
      showSecondaryLogo: true,
      secondaryLogoUrl: '/assets/phoenix-logo.png',
      line1: "Repoblikan'i Madagasikara",
      line2: 'Fitiavana - Tanindrazana - Fandrosoana',
      line3:
        "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
      line4: 'Université de Toliara',
      line5: "Direction des Systèmes d'Information et du Numérique · Scolarité Centrale",
      lines: buildDefaultHeaderLines(),
    },
    texts: {
      title: 'Certificat de Scolarité',
      intro:
        "Le Responsable de la Scolarité Centrale de l'Université de Toliara certifie par la présente que :",
      closing:
        "En foi de quoi, le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.",
      legalMention:
        "Document officiel de l'Université de Toliara — toute falsification est passible de poursuites.",
    },
    signature: {
      title: 'Le Responsable de la Scolarité Centrale',
      name: '',
      place: 'Toliara',
      showDate: true,
      imageUrl: '',
      showImage: false,
    },
    footer: {
      showFooter: false,
      address: 'BP 185 — Toliara 601, Madagascar',
      contacts: 'scolarite@univ-toliara.mg · +261 34 00 000 00',
      note: 'Document généré par le Portail Scolarité Uu',
    },
    body: {
      template: '',
      mode: 'phrase',
      style: {
        fontFamily: 'sans',
        fontSize: 0,
        bold: false,
        italic: false,
        underline: false,
        align: 'justify',
        uppercase: false,
        lineHeight: 1.5,
      },
    },
    fields: STANDARD_FIELD_DEFINITIONS.map((field) => ({ ...field })),
    blocks: {
      header: true,
      reference: true,
      title: true,
      identity: true,
      filiation: true,
      academicTable: true,
      qr: true,
      signature: true,
      watermark: false,
      legalMention: true,
    },
    rows: DOC_TEMPLATE_ROWS.map((row) => ({ ...row, enabled: true })),
    qr: {
      enabled: true,
      preset: 'medium',
      mode: 'structured',
      urlTemplate: 'https://scolarite.univ-toliara.mg/verifier?code={{token}}',
      position: 'bottom-left',
      label: "Scanner pour vérifier l'authenticité",
      showLabel: true,
      size: 96,
      includeName: true,
      includeInstitution: true,
      includeMention: true,
      includeLevel: true,
      includeYear: true,
      includeReference: true,
      header: '===== SCOLARITE LOG =====',
    },
    appearance: {
      accentColor: '#0f172a',
      textColor: '#0f172a',
      borderStyle: 'thin',
      watermarkText: 'UNIVERSITÉ DE TOLIARA',
      watermarkOpacity: 0.08,
      fontFamily: 'display',
      fontSize: 14,
    },
    layout: {
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      headerLayout: 'classic',
      logoSizePx: 80,
      secondaryLogoSizePx: 40,
      showHeaderDivider: true,
      headerDividerColor: '',
      titleAlign: 'center',
      titleUnderline: true,
      titleUppercase: true,
      titleSizeEm: 1.65,
      referenceTemplate: 'Réf : {{reference}}/MEsupRes/U. U/DSIN/Sco.Cent',
      matriculeLabel: 'Matricule :',
      signatureAlign: 'right',
      datePhraseTemplate: 'Fait à {{lieu}}, le {{date}}',
      signatureImageHeightPx: 64,
      pagePaddingPx: 36,
      borderWidthPx: 1,
      borderRadiusPx: 2,
      backgroundColor: '#ffffff',
      freeZones: [],
      elementStyles: {},
    },
    print: {
      perSheet: 1,
      orientation: 'portrait',
      twoUpLayout: 'side-by-side',
      duplicateSame: true,
      cutLine: true,
      marginMm: 12,
    },
    card: {
      printMode: 'fold',
      showPhoto: true,
      photoHint: 'Photo non fournie',
      photoPosition: 'left',
      photoShape: 'rounded',
      qrPlacement: 'both',
      headerStyle: 'solid',
      headerColor: '#1d4ed8',
      showValidity: true,
      validityYears: 1,
      backTitle: 'Carte d’étudiant',
      backNote:
        "Cette carte est strictement personnelle. Elle doit être présentée à toute demande des autorités universitaires.",
      footerText: '',
      frontFields: [...DEFAULT_CARD_FRONT_FIELDS],
      rounded: true,
    },
  };
}

export const DEFAULT_DOCUMENT_TEMPLATES: DocumentTemplates = {
  certificat: {
    ...baseDocumentTemplate('certificat'),
    body: {
      template: DEFAULT_CERTIFICATE_PHRASE,
      mode: 'phrase',
      style: {
        ...baseDocumentTemplate('certificat').body.style,
      },
    },
    qr: {
      ...baseDocumentTemplate('certificat').qr,
      enabled: true,
    },
  },
  carte: {
    ...baseDocumentTemplate('carte'),
    texts: {
      title: 'Carte d’Étudiant',
      intro: '',
      closing: '',
      legalMention:
        "Carte officielle de l'Université de Toliara — non transférable.",
    },
    signature: {
      title: 'Le Responsable de la Scolarité Centrale',
      name: '',
      place: 'Toliara',
      showDate: false,
      imageUrl: '',
      showImage: false,
    },
    blocks: {
      ...baseDocumentTemplate('carte').blocks,
      reference: false,
      filiation: false,
      academicTable: false,
      legalMention: true,
    },
    qr: {
      ...baseDocumentTemplate('carte').qr,
      size: 64,
      header: '===== CARTE ETUDIANT =====',
    },
    appearance: {
      ...baseDocumentTemplate('carte').appearance,
      accentColor: '#1d4ed8',
      fontFamily: 'sans',
      fontSize: 12,
    },
  },
};

/**
 * Fusionne un modèle enregistré avec les valeurs par défaut (tolère les
 * évolutions de schéma sans perdre les personnalisations).
 */
export function mergeDocumentTemplate(
  kind: DocumentKind,
  stored: Partial<DocumentTemplate> | null | undefined
): DocumentTemplate {
  const base = structuredClone(DEFAULT_DOCUMENT_TEMPLATES[kind]);
  if (!stored) return base;
  const mergeObject = (
    target: Record<string, unknown>,
    patch: unknown
  ): Record<string, unknown> => {
    if (!patch || typeof patch !== 'object') return target;
    const next: Record<string, unknown> = { ...target };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      const current = target[key];
      if (value === null || value === undefined) continue;
      if (
        current &&
        typeof current === 'object' &&
        !Array.isArray(current) &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        next[key] = mergeObject(current as Record<string, unknown>, value);
      } else {
        next[key] = value;
      }
    }
    return next;
  };
  const merged = mergeObject(
    base as unknown as Record<string, unknown>,
    stored
  ) as unknown as DocumentTemplate;

  // Les champs standard sont fusionnés par identifiant : un nouveau champ
  // standard apparaît même si le modèle enregistré ne le connaissait pas.
  if (Array.isArray(stored.fields)) {
    const storedById = new Map(stored.fields.map((field) => [field.id, field]));
    const baseIds = new Set(base.fields.map((field) => field.id));
    const standard = base.fields.map((field) => ({
      ...field,
      ...(storedById.get(field.id) ?? {}),
    }));
    const customs = stored.fields.filter(
      (field) => field.custom && !baseIds.has(field.id)
    );
    merged.fields = [...standard, ...customs];
  }
  if (Array.isArray(stored.layout?.sectionOrder)) {
    const valid = new Set<CertificateSectionKey>(DEFAULT_SECTION_ORDER);
    const ordered = stored.layout.sectionOrder.filter((k): k is CertificateSectionKey =>
      valid.has(k)
    );
    for (const defKey of DEFAULT_SECTION_ORDER) {
      if (!ordered.includes(defKey)) ordered.push(defKey);
    }
    merged.layout.sectionOrder = ordered;
  }
  if (Array.isArray(stored.header?.lines) && stored.header.lines.length > 0) {
    const normalizedLines: HeaderLineItem[] = stored.header.lines.map(
      (line, idx) => ({
        id: line.id || `hl_${idx + 1}`,
        label: line.label || `Ligne ${idx + 1}`,
        text: typeof line.text === 'string' ? line.text : '',
        fontFamily: line.fontFamily || 'Arial',
        fontSize:
          typeof line.fontSize === 'number' && line.fontSize > 0
            ? line.fontSize
            : 11,
        bold: Boolean(line.bold),
        italic: Boolean(line.italic),
        underline: Boolean(line.underline),
        align:
          line.align === 'left' || line.align === 'right' ? line.align : 'center',
        uppercase: Boolean(line.uppercase),
        color: typeof line.color === 'string' ? line.color : '',
      })
    );
    merged.header = syncHeaderLegacyFields(merged.header, normalizedLines);
  } else {
    merged.header.lines = buildDefaultHeaderLines(merged.header);
  }
  return merged;
}

export function loadDocumentTemplates(): DocumentTemplates {
  try {
    if (typeof localStorage === 'undefined') return structuredClone(DEFAULT_DOCUMENT_TEMPLATES);
    const raw = localStorage.getItem(DOC_TEMPLATES_KEY);
    if (!raw) return structuredClone(DEFAULT_DOCUMENT_TEMPLATES);
    const parsed = JSON.parse(raw) as Partial<DocumentTemplates>;
    return {
      certificat: mergeDocumentTemplate('certificat', parsed.certificat),
      carte: mergeDocumentTemplate('carte', parsed.carte),
    };
  } catch {
    return structuredClone(DEFAULT_DOCUMENT_TEMPLATES);
  }
}

export function saveDocumentTemplates(templates: DocumentTemplates): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DOC_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // ignore preference persistence errors
  }
}

export function resetDocumentTemplate(kind: DocumentKind): DocumentTemplate {
  return structuredClone(DEFAULT_DOCUMENT_TEMPLATES[kind]);
}

export interface DocumentThemePreset {
  id: string;
  kind: DocumentKind;
  name: string;
  description: string;
  patch: Partial<DocumentTemplate>;
}

export const DOCUMENT_THEME_PRESETS: DocumentThemePreset[] = [
  {
    id: 'cert-classique',
    kind: 'certificat',
    name: 'Classique officiel',
    description: 'En-tête symétrique, cadre fin ardoise, phrase rédigée justifiée',
    patch: {
      texts: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.texts,
        title: 'Certificat de Scolarité',
      },
      appearance: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.appearance,
        accentColor: '#0f172a',
        textColor: '#0f172a',
        borderStyle: 'thin',
      },
      body: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body,
        mode: 'phrase',
        style: {
          ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style,
          fontFamily: 'sans',
          align: 'justify',
        },
      },
      layout: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.layout,
        headerLayout: 'classic',
        titleAlign: 'center',
        titleUnderline: true,
        backgroundColor: '#ffffff',
        borderWidthPx: 1,
      },
    },
  },
  {
    id: 'cert-solemn-serif',
    kind: 'certificat',
    name: 'Solennel double cadre',
    description: 'Double bordure bordeaux, police Serif académique, filigrane discret',
    patch: {
      appearance: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.appearance,
        accentColor: '#7f1d1d',
        textColor: '#1e293b',
        borderStyle: 'double',
      },
      blocks: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.blocks,
        watermark: true,
      },
      body: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body,
        mode: 'phrase',
        style: {
          ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style,
          fontFamily: 'serif',
          align: 'justify',
          lineHeight: 1.65,
        },
      },
      layout: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.layout,
        headerLayout: 'centered',
        titleAlign: 'center',
        titleUnderline: true,
        backgroundColor: '#fffdf9',
        borderWidthPx: 4,
      },
    },
  },
  {
    id: 'cert-moderne-bleu',
    kind: 'certificat',
    name: 'Moderne institutionnel',
    description: 'En-tête aligné à gauche, bleu universitaire, sans bordure extérieure',
    patch: {
      appearance: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.appearance,
        accentColor: '#1d4ed8',
        textColor: '#0f172a',
        borderStyle: 'none',
      },
      body: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body,
        mode: 'phrase',
        style: {
          ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style,
          fontFamily: 'display',
          align: 'left',
          lineHeight: 1.6,
        },
      },
      layout: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.layout,
        headerLayout: 'left',
        titleAlign: 'left',
        titleUnderline: false,
        backgroundColor: '#ffffff',
      },
    },
  },
  {
    id: 'cert-tableau-compact',
    kind: 'certificat',
    name: 'Fiche structurée (Tableau)',
    description: 'Données présentées en tableau clair · idéal pour impression A5',
    patch: {
      body: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.body,
        mode: 'table',
      },
      print: {
        ...DEFAULT_DOCUMENT_TEMPLATES.certificat.print,
        perSheet: 2,
        twoUpLayout: 'side-by-side',
      },
    },
  },
  {
    id: 'carte-bleue',
    kind: 'carte',
    name: 'Bleu universitaire',
    description: 'Bandeau bleu vif, photo à gauche, QR recto & verso',
    patch: {
      appearance: {
        ...DEFAULT_DOCUMENT_TEMPLATES.carte.appearance,
        accentColor: '#1d4ed8',
        textColor: '#0f172a',
      },
      card: {
        ...DEFAULT_DOCUMENT_TEMPLATES.carte.card,
        headerColor: '#1d4ed8',
        headerStyle: 'solid',
        photoPosition: 'left',
        photoShape: 'rounded',
        qrPlacement: 'both',
        rounded: true,
      },
    },
  },
  {
    id: 'carte-ardoise-degrade',
    kind: 'carte',
    name: 'Ardoise & Or',
    description: 'Bandeau dégradé sombre, photo circulaire à droite',
    patch: {
      appearance: {
        ...DEFAULT_DOCUMENT_TEMPLATES.carte.appearance,
        accentColor: '#0f172a',
        textColor: '#0f172a',
      },
      card: {
        ...DEFAULT_DOCUMENT_TEMPLATES.carte.card,
        headerColor: '#0f172a',
        headerStyle: 'gradient',
        photoPosition: 'right',
        photoShape: 'circle',
        qrPlacement: 'both',
        rounded: true,
      },
    },
  },
  {
    id: 'carte-emeraude',
    kind: 'carte',
    name: 'Émeraude épuré',
    description: 'Bandeau minimaliste vert foncé, coins nets',
    patch: {
      appearance: {
        ...DEFAULT_DOCUMENT_TEMPLATES.carte.appearance,
        accentColor: '#047857',
        textColor: '#0f172a',
      },
      card: {
        ...DEFAULT_DOCUMENT_TEMPLATES.carte.card,
        headerColor: '#047857',
        headerStyle: 'minimal',
        photoPosition: 'left',
        photoShape: 'rect',
        qrPlacement: 'back',
        rounded: false,
      },
    },
  },
];

export function loadSavedProfiles(): SavedDocumentProfile[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(DOC_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDocumentProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      template: mergeDocumentTemplate(item.kind, item.template),
    }));
  } catch {
    return [];
  }
}

export function saveSavedProfiles(profiles: SavedDocumentProfile[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DOC_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // ignore storage errors
  }
}

export function upsertSavedProfile(
  profile: SavedDocumentProfile
): SavedDocumentProfile[] {
  const existing = loadSavedProfiles().filter((p) => p.id !== profile.id);
  const next = [profile, ...existing];
  saveSavedProfiles(next);
  return next;
}

export function deleteSavedProfile(id: string): SavedDocumentProfile[] {
  const next = loadSavedProfiles().filter((p) => p.id !== id);
  saveSavedProfiles(next);
  return next;
}

/** Texte encodé dans le QR Code du document, selon les champs activés. */
export function buildDocumentQrPayload(
  record: EnrichedInscription,
  template: DocumentTemplate
): string {
  const refCode =
    record.reference || record.numInscription || String(record.idInscription);
  const lines = [template.qr.header];
  if (template.qr.includeName) lines.push(`NOM        : ${record.nom} ${record.prenom}`);
  if (template.qr.includeInstitution) lines.push(`Institution : ${record.faculte}`);
  if (template.qr.includeMention) lines.push(`Mention     : ${record.mention}`);
  if (template.qr.includeLevel) lines.push(`Niveau      : ${record.niveau}`);
  if (template.qr.includeYear) lines.push(`Année       : ${record.annee}`);
  if (template.qr.includeReference) lines.push(`Référence   : ${refCode}`);
  lines.push('=========================');
  return lines.join('\n');
}

/** Valeur affichée pour une ligne du tableau académique ou d'une carte. */
export function getDocumentRowValue(
  record: EnrichedInscription,
  rowId: string
): string {
  switch (rowId) {
    case 'institution':
    case 'faculte':
      return record.faculte;
    case 'domaine':
      return record.domaine;
    case 'mention':
      return record.mention;
    case 'parcours':
      return record.parcours;
    case 'grade':
      return record.grade;
    case 'niveau':
      return record.niveau;
    case 'annee':
      return record.annee;
    case 'numInscription':
      return record.numInscription || '—';
    case 'reference':
      return record.reference || '—';
    case 'dateNaissance':
      return formatDateFR(record.dateNaissance) || '—';
    case 'lieuNaissance':
      return record.lieuNaissance || '—';
    case 'telephone':
      return record.telephone || '—';
    case 'numeroCin':
      return record.numeroCin || '—';
    case 'nationalite':
      return record.nationalite || '—';
    default:
      return record.customValues?.[rowId] ?? '';
  }
}

/** Étudiant fictif utilisé pour l'aperçu des modèles dans l'administration. */
/**
 * Complète un enregistrement d'exemple avec l'identité du certificat
 * (numéro, date, jeton) afin que l'aperçu de l'administration soit réaliste.
 */
function withDisplayIdentity(record: EnrichedInscription): EnrichedInscription {
  const numero =
    record.numeroCertificat ||
    formatCertificateNumber(record.annee, record.numInscription, record.idInscription);
  return {
    ...record,
    numeroCertificat: numero,
    dateDelivrance: record.dateDelivrance || new Date().toISOString().slice(0, 10),
    certificateToken:
      record.certificateToken || `APERCU${String(record.idInscription).padStart(6, '0')}`,
  };
}

export function getSampleInscription(db: ScolariteDatabase): EnrichedInscription {
  const rows = enrichInscriptions(db);
  const sample = rows[0];
  if (sample) return withDisplayIdentity({ ...sample, photo: sample.photo || '' });
  return withDisplayIdentity({
    idInscription: 0,
    idEtudiant: 0,
    idAnnee: 0,
    idFaculte: 0,
    idDomaine: 0,
    idMention: 0,
    idNiveau: 0,
    idParcours: null,
    reference: '000000',
    numInscription: '000000',
    nom: 'RAKOTO',
    prenom: 'Naivo',
    dateNaissance: '2003-04-12',
    lieuNaissance: 'TOLIARA',
    sexe: 'M',
    sexeNormalized: 'M',
    telephone: '034 12 345 67',
    numeroCin: '501011012345',
    dateCin: '2021-06-01',
    lieuDelivrance: 'TOLIARA',
    nationalite: 'MALAGASY',
    nomPere: 'RAKOTO Jean',
    nomMere: 'RASOA Marie',
    faculte: 'Faculté des Lettres et Sciences Humaines',
    faculteLogo: '/assets/logo-uu.jpg',
    domaine: 'Sciences de la Société',
    mention: 'SOCIOLOGIE',
    grade: 'Licence',
    niveau: 'L1',
    parcours: '— Aucun —',
    annee: '2024-2025',
    photo: '',
    customValues: {},
    numeroCertificat: 'CERT/2024-2025/000000-000000',
    dateDelivrance: '2026-11-27',
    certificateToken: 'EXEMPLE000000000',
  });
}

export function normalizeAllSexCodes(db: ScolariteDatabase): {
  nextDb: ScolariteDatabase;
  updatedCount: number;
} {
  const nextDb = structuredClone(db);
  let updatedCount = 0;
  for (const e of nextDb.etudiants) {
    const norm = normalizeSex(e.sexe);
    if ((norm === 'M' || norm === 'F') && e.sexe !== norm) {
      e.sexe = norm;
      updatedCount++;
    }
  }
  return { nextDb, updatedCount };
}

export function mergeDuplicateStudents(
  db: ScolariteDatabase,
  keepId: number,
  removeId: number
): ScolariteDatabase {
  if (keepId === removeId) return db;
  const nextDb = structuredClone(db);
  const keepIdx = nextDb.etudiants.findIndex((e) => e.id === keepId);
  const removeIdx = nextDb.etudiants.findIndex((e) => e.id === removeId);
  if (keepIdx === -1 || removeIdx === -1) return db;

  const keep = nextDb.etudiants[keepIdx];
  const rem = nextDb.etudiants[removeIdx];

  // Fill blank fields on keep from rem
  if (!keep.prenom.trim() && rem.prenom.trim()) keep.prenom = rem.prenom;
  if (!keep.dateNaissance && rem.dateNaissance) keep.dateNaissance = rem.dateNaissance;
  if (!keep.lieuNaissance.trim() && rem.lieuNaissance.trim()) keep.lieuNaissance = rem.lieuNaissance;
  if (!keep.telephone.trim() && rem.telephone.trim()) keep.telephone = rem.telephone;
  if (!keep.numeroCin.trim() && rem.numeroCin.trim()) keep.numeroCin = rem.numeroCin;
  if (!keep.dateCin && rem.dateCin) keep.dateCin = rem.dateCin;
  if (!keep.lieuDelivrance.trim() && rem.lieuDelivrance.trim()) keep.lieuDelivrance = rem.lieuDelivrance;
  if (!keep.nomPere.trim() && rem.nomPere.trim()) keep.nomPere = rem.nomPere;
  if (!keep.nomMere.trim() && rem.nomMere.trim()) keep.nomMere = rem.nomMere;

  // Re-link inscriptions from removeId to keepId
  for (const ins of nextDb.inscriptions) {
    if (ins.idEtudiant === removeId) {
      ins.idEtudiant = keepId;
    }
  }

  nextDb.etudiants = nextDb.etudiants.filter((e) => e.id !== removeId);
  return nextDb;
}

export function getDependencyInfo(
  db: ScolariteDatabase,
  entity: TableEntityKey,
  id: number
): { blocked: boolean; count: number; message: string } {
  if (entity === 'facultes') {
    const count = db.domaines.filter((d) => d.idFaculte === id).length;
    return {
      blocked: count > 0,
      count,
      message:
        count > 0
          ? `Suppression impossible : ${count} domaine(s) sont rattaché(s) à cette faculté.`
          : '',
    };
  }
  if (entity === 'domaines') {
    const count = db.mentions.filter((m) => m.idDomaine === id).length;
    return {
      blocked: count > 0,
      count,
      message:
        count > 0
          ? `Suppression impossible : ${count} mention(s) sont rattachée(s) à ce domaine.`
          : '',
    };
  }
  if (entity === 'mentions') {
    const insCount = db.inscriptions.filter((i) => i.idMention === id).length;
    const parCount = db.parcours.filter((p) => p.idMention === id).length;
    const count = insCount + parCount;
    return {
      blocked: count > 0,
      count,
      message:
        count > 0
          ? `Suppression impossible : ${insCount} inscription(s) et ${parCount} parcours utilisent cette mention.`
          : '',
    };
  }
  if (entity === 'niveaux') {
    const insCount = db.inscriptions.filter((i) => i.idNiveau === id).length;
    const parCount = db.parcours.filter((p) => p.idNiveau === id).length;
    const count = insCount + parCount;
    return {
      blocked: count > 0,
      count,
      message:
        count > 0
          ? `Suppression impossible : ${insCount} inscription(s) et ${parCount} parcours utilisent ce niveau.`
          : '',
    };
  }
  if (entity === 'parcours') {
    const count = db.inscriptions.filter((i) => i.idParcours === id).length;
    return {
      blocked: count > 0,
      count,
      message:
        count > 0
          ? `Suppression impossible : ${count} inscription(s) utilisent ce parcours.`
          : '',
    };
  }
  if (entity === 'annees') {
    const count = db.inscriptions.filter((i) => i.idAnnee === id).length;
    return {
      blocked: count > 0,
      count,
      message:
        count > 0
          ? `Suppression impossible : ${count} inscription(s) appartiennent à cette année universitaire.`
          : '',
    };
  }
  if (entity === 'etudiants') {
    const count = db.inscriptions.filter((i) => i.idEtudiant === id).length;
    return {
      blocked: false,
      count,
      message:
        count > 0
          ? `Attention : supprimer cet étudiant supprimera également ses ${count} inscription(s).`
          : '',
    };
  }
  return { blocked: false, count: 0, message: '' };
}

export function batchReinscribe(
  db: ScolariteDatabase,
  params: {
    studentIds: number[];
    idAnnee: number;
    idMention: number;
    idNiveau: number;
    idParcours: number | null;
    autoGenerateNumbers: boolean;
  }
): { nextDb: ScolariteDatabase; createdCount: number; skippedCount: number } {
  const nextDb = structuredClone(db);
  const uniqueIds = Array.from(new Set(params.studentIds));
  let createdCount = 0;
  let skippedCount = 0;

  let nextInsId = getNextId(nextDb.inscriptions);
  const anneeLabel = nextDb.annees.find((a) => a.id === params.idAnnee)?.annee ?? '2025';
  const yearShort = anneeLabel.slice(0, 4).replace(/\D/g, '') || '2025';

  const existingRefs = new Set(nextDb.inscriptions.map((i) => i.reference));
  const existingNums = new Set(nextDb.inscriptions.map((i) => i.numInscription));

  for (const idEtudiant of uniqueIds) {
    const alreadyEnrolled = nextDb.inscriptions.some(
      (i) =>
        i.idEtudiant === idEtudiant &&
        i.idAnnee === params.idAnnee &&
        i.idMention === params.idMention &&
        i.idNiveau === params.idNiveau
    );
    if (alreadyEnrolled) {
      skippedCount++;
      continue;
    }

    let reference = '';
    let numInscription = '';
    if (params.autoGenerateNumbers) {
      let seq = nextInsId;
      do {
        reference = `${yearShort.slice(-2)}${String(seq).padStart(4, '0')}`;
        numInscription = String(seq).padStart(6, '0');
        seq++;
      } while (existingRefs.has(reference) || existingNums.has(numInscription));
      existingRefs.add(reference);
      existingNums.add(numInscription);
    }

    nextDb.inscriptions.push({
      id: nextInsId++,
      idEtudiant,
      idAnnee: params.idAnnee,
      idMention: params.idMention,
      idNiveau: params.idNiveau,
      idParcours: params.idParcours,
      reference,
      numInscription,
    });
    createdCount++;
  }

  return { nextDb, createdCount, skippedCount };
}

export function suggestNextAnneeLabel(annees: { annee: string }[]): string {
  const existing = new Set(
    annees.map((a) => a.annee.trim().toLowerCase()).filter(Boolean)
  );
  const latest = getLatestAnneeLabel(annees);
  const rangeMatch = latest.match(/(\d{4})\s*[-–/]\s*(\d{4})/);
  let startYear = new Date().getFullYear();
  let endYear = startYear + 1;

  if (rangeMatch) {
    startYear = Number(rangeMatch[1]) + 1;
    endYear = Number(rangeMatch[2]) + 1;
  } else {
    const singleMatch = latest.match(/(\d{4})/);
    if (singleMatch) {
      startYear = Number(singleMatch[1]) + 1;
      endYear = startYear + 1;
    }
  }

  let candidate = `${startYear}-${endYear}`;
  let guard = 0;
  while (existing.has(candidate.toLowerCase()) && guard < 20) {
    startYear += 1;
    endYear += 1;
    candidate = `${startYear}-${endYear}`;
    guard += 1;
  }
  return candidate;
}

export function getLatestBaseAnneeId(
  db: ScolariteDatabase,
  excludeAnneeId?: number
): number {
  const sorted = sortAnneesDesc(db.annees).filter((a) => a.id !== excludeAnneeId);
  if (sorted.length === 0) return db.annees[0]?.id ?? 0;
  const counts = new Map<number, number>();
  for (const ins of db.inscriptions) {
    counts.set(ins.idAnnee, (counts.get(ins.idAnnee) ?? 0) + 1);
  }
  const withInscriptions = sorted.find((a) => (counts.get(a.id) ?? 0) > 0);
  return withInscriptions?.id ?? sorted[0].id;
}

export function findNextNiveauId(
  niveaux: Niveau[],
  currentNiveauId: number
): number {
  const current = niveaux.find((n) => n.id === currentNiveauId);
  if (!current) return currentNiveauId;

  const key = normalizeNiveauKey(current.niveau);
  let nextKey = '';
  const match = key.match(/^(licence|master|doctorat)\s+(\d+)$/);
  if (match) {
    const cycle = match[1];
    const num = Number(match[2]);
    if (cycle === 'licence') {
      nextKey = num < 3 ? `licence ${num + 1}` : 'master 1';
    } else if (cycle === 'master') {
      nextKey = num < 2 ? `master ${num + 1}` : 'doctorat 1';
    } else if (cycle === 'doctorat') {
      nextKey = num < 3 ? `doctorat ${num + 1}` : '';
    }
  }

  if (!nextKey) return currentNiveauId;

  const candidates = niveaux.filter(
    (n) => normalizeNiveauKey(n.niveau) === nextKey
  );
  if (candidates.length === 0) return currentNiveauId;
  if (candidates.length === 1) return candidates[0].id;

  const currentIsShort = /^[lmd]\s*\d+/i.test(current.niveau.trim());
  const styled = candidates.find(
    (c) => /^[lmd]\s*\d+/i.test(c.niveau.trim()) === currentIsShort
  );
  return (styled ?? candidates[0]).id;
}

/**
 * Crée une nouvelle année universitaire vide (ou retrouve l'année existante
 * si le même libellé est déjà présent dans le référentiel).
 */
export function createAcademicYear(
  db: ScolariteDatabase,
  anneeLabel: string
): {
  nextDb: ScolariteDatabase;
  annee: AnneeUniversitaire;
  created: boolean;
} {
  const cleanLabel = anneeLabel
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-');

  if (!cleanLabel) {
    throw new Error("Veuillez indiquer un libellé d'année universitaire.");
  }

  const existing = db.annees.find(
    (a) => a.annee.trim().toLowerCase() === cleanLabel.toLowerCase()
  );
  if (existing) {
    return { nextDb: db, annee: existing, created: false };
  }

  const nextDb = structuredClone(db);
  const annee: AnneeUniversitaire = {
    id: getNextId(nextDb.annees),
    annee: cleanLabel,
  };
  nextDb.annees.push(annee);
  return { nextDb, annee, created: true };
}

/**
 * Génère un couple (référence, numéro d'inscription) unique pour l'année cible.
 */
export function generateNextInscriptionCodes(
  db: ScolariteDatabase,
  idAnnee: number
): { reference: string; numInscription: string } {
  const targetAnnee = db.annees.find((a) => a.id === idAnnee);
  const yearDigits = (targetAnnee?.annee ?? '').slice(0, 4).replace(/\D/g, '');
  const yearPrefix = (yearDigits || String(new Date().getFullYear())).slice(-2);

  const existingRefs = new Set(
    db.inscriptions.map((i) => i.reference.trim().toLowerCase()).filter(Boolean)
  );
  const existingNums = new Set(
    db.inscriptions
      .map((i) => i.numInscription.trim().toLowerCase())
      .filter(Boolean)
  );

  let seq = getNextId(db.inscriptions);
  let reference = '';
  let numInscription = '';
  do {
    reference = `${yearPrefix}${String(seq).padStart(4, '0')}`;
    numInscription = String(seq).padStart(6, '0');
    seq++;
  } while (
    existingRefs.has(reference.toLowerCase()) ||
    existingNums.has(numInscription.toLowerCase())
  );

  return { reference, numInscription };
}

function normalizeAssistedSearchText(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compareInscriptionsMostRecentFirst(
  a: EnrichedInscription,
  b: EnrichedInscription
): number {
  const yearDiff = anneeStartYear(b.annee) - anneeStartYear(a.annee);
  if (yearDiff !== 0) return yearDiff;
  const nivDiff = compareNiveauKeys(
    normalizeNiveauKey(b.niveau),
    normalizeNiveauKey(a.niveau)
  );
  if (nivDiff !== 0) return nivDiff;
  return b.idInscription - a.idInscription;
}

/**
 * Résout un parcours compatible pour le couple (mention, niveau) cible à partir
 * de la dernière inscription (conserve le parcours si identique ou de même nom).
 */
export function resolveCompatibleParcoursId(
  db: ScolariteDatabase,
  lastInscription: EnrichedInscription | null,
  targetMentionId: number,
  targetNiveauId: number
): number | null {
  if (!lastInscription || !lastInscription.idParcours) return null;
  if (
    lastInscription.idMention === targetMentionId &&
    lastInscription.idNiveau === targetNiveauId
  ) {
    return db.parcours.some((p) => p.id === lastInscription.idParcours)
      ? lastInscription.idParcours
      : null;
  }
  const prevParcours = db.parcours.find(
    (p) => p.id === lastInscription.idParcours
  );
  if (!prevParcours) return null;
  const prevName = prevParcours.parcours.trim().toLowerCase();
  const match = db.parcours.find(
    (p) =>
      p.idMention === targetMentionId &&
      p.idNiveau === targetNiveauId &&
      p.parcours.trim().toLowerCase() === prevName
  );
  return match?.id ?? null;
}

/**
 * Construit un index des étudiants avec leur dernière inscription connue et
 * la proposition d'affectation pour l'année cible (passage au niveau supérieur).
 */
export function buildStudentAssistedIndex(
  db: ScolariteDatabase,
  targetAnneeId?: number
): Map<number, StudentAssistedSuggestion> {
  const allEnriched = enrichInscriptions(db);
  const byStudent = new Map<number, EnrichedInscription[]>();
  for (const ins of allEnriched) {
    const list = byStudent.get(ins.idEtudiant);
    if (list) list.push(ins);
    else byStudent.set(ins.idEtudiant, [ins]);
  }
  for (const list of byStudent.values()) {
    list.sort(compareInscriptionsMostRecentFirst);
  }

  const targetAnneeObj = targetAnneeId
    ? db.annees.find((a) => a.id === targetAnneeId)
    : undefined;
  const niveauById = new Map(db.niveaux.map((n) => [n.id, n]));

  const index = new Map<number, StudentAssistedSuggestion>();

  for (const etudiant of db.etudiants) {
    const inscriptions = byStudent.get(etudiant.id) ?? [];
    const targetYearInscription = targetAnneeId
      ? inscriptions.find((i) => i.idAnnee === targetAnneeId) ?? null
      : null;
    const lastInscription =
      (targetAnneeId
        ? inscriptions.find((i) => i.idAnnee !== targetAnneeId)
        : inscriptions[0]) ??
      inscriptions[0] ??
      null;

    let suggestedAssignment: StudentAssistedAssignment | null = null;
    if (lastInscription) {
      const idNiveauSame = lastInscription.idNiveau;
      const idNiveauNext = findNextNiveauId(db.niveaux, idNiveauSame);
      const hasProgression = idNiveauNext !== idNiveauSame;

      let isNewerYear = true;
      if (targetAnneeObj) {
        const targetStart = anneeStartYear(targetAnneeObj.annee);
        const baseStart = anneeStartYear(lastInscription.annee);
        isNewerYear =
          targetStart > 0 && baseStart > 0
            ? targetStart > baseStart
            : targetAnneeObj.id !== lastInscription.idAnnee;
      }

      const recommendedNiveauId = isNewerYear ? idNiveauNext : idNiveauSame;
      const sameNiveauLabel =
        niveauById.get(idNiveauSame)?.niveau ?? lastInscription.niveau;
      const nextNiveauLabel =
        niveauById.get(idNiveauNext)?.niveau ?? sameNiveauLabel;
      const recommendedNiveauLabel =
        niveauById.get(recommendedNiveauId)?.niveau ?? sameNiveauLabel;
      const idParcours = resolveCompatibleParcoursId(
        db,
        lastInscription,
        lastInscription.idMention,
        recommendedNiveauId
      );

      suggestedAssignment = {
        idFaculte: lastInscription.idFaculte,
        idDomaine: lastInscription.idDomaine,
        idMention: lastInscription.idMention,
        recommendedNiveauId,
        idNiveauNext,
        idNiveauSame,
        idParcours,
        faculteLabel: lastInscription.faculte,
        domaineLabel: lastInscription.domaine,
        mentionLabel: lastInscription.mention,
        recommendedNiveauLabel,
        nextNiveauLabel,
        sameNiveauLabel,
        hasProgression,
      };
    }

    index.set(etudiant.id, {
      etudiant,
      lastInscription,
      targetYearInscription,
      suggestedAssignment,
    });
  }

  return index;
}

/**
 * Retourne la dernière inscription chronologique d'un étudiant (hors `excludeAnneeId`
 * en priorité lorsqu'une année cible est fournie).
 */
export function getStudentLastInscription(
  db: ScolariteDatabase,
  idEtudiant: number,
  excludeAnneeId?: number
): EnrichedInscription | null {
  const index = buildStudentAssistedIndex(db, excludeAnneeId);
  return index.get(idEtudiant)?.lastInscription ?? null;
}

/**
 * Recherche assistée sur le nom (et prénom / CIN / matricule) pour l'autocomplétion
 * du formulaire d'inscription sur la base de la dernière inscription.
 */
export function searchStudentsForAssistedEntry(
  db: ScolariteDatabase,
  query: string,
  options?: {
    targetAnneeId?: number;
    limit?: number;
    index?: Map<number, StudentAssistedSuggestion>;
  }
): StudentAssistedSuggestion[] {
  const qNorm = normalizeAssistedSearchText(query);
  if (!qNorm) return [];

  const limit = options?.limit ?? 8;
  const tokens = qNorm.split(' ').filter(Boolean);
  const qCompact = qNorm.replace(/\s+/g, '');
  const index =
    options?.index ?? buildStudentAssistedIndex(db, options?.targetAnneeId);

  const scored: Array<{ item: StudentAssistedSuggestion; score: number }> = [];

  for (const item of index.values()) {
    const { etudiant, lastInscription } = item;
    const nomNorm = normalizeAssistedSearchText(etudiant.nom);
    const prenomNorm = normalizeAssistedSearchText(etudiant.prenom);
    const fullNorm = `${nomNorm} ${prenomNorm}`.trim();
    const cinSpaced = normalizeAssistedSearchText(etudiant.numeroCin);
    const cinCompact = normalizeCin(etudiant.numeroCin).toLowerCase();
    const refNorm = normalizeAssistedSearchText(lastInscription?.reference);
    const numInsNorm = normalizeAssistedSearchText(
      lastInscription?.numInscription
    );

    const haystack = `${fullNorm} ${cinSpaced} ${cinCompact} ${refNorm} ${numInsNorm}`;
    const matchesAllTokens = tokens.every((tok) => haystack.includes(tok));
    const matchesCompactCin =
      qCompact.length >= 4 && cinCompact.includes(qCompact);

    if (!matchesAllTokens && !matchesCompactCin) continue;

    let score = 5;
    if (nomNorm === qNorm || fullNorm === qNorm) {
      score = 0;
    } else if (nomNorm.startsWith(qNorm)) {
      score = 1;
    } else if (fullNorm.startsWith(qNorm)) {
      score = 2;
    } else if (
      nomNorm.split(' ').some((w) => w.startsWith(tokens[0])) ||
      prenomNorm.split(' ').some((w) => w.startsWith(tokens[0]))
    ) {
      score = 3;
    } else if (
      (qCompact.length >= 4 && cinCompact.startsWith(qCompact)) ||
      refNorm === qNorm ||
      numInsNorm === qNorm
    ) {
      score = 4;
    }

    scored.push({ item, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const aEnrolled = a.item.targetYearInscription ? 1 : 0;
    const bEnrolled = b.item.targetYearInscription ? 1 : 0;
    if (aEnrolled !== bEnrolled) return aEnrolled - bEnrolled;
    const aHasLast = a.item.lastInscription ? 1 : 0;
    const bHasLast = b.item.lastInscription ? 1 : 0;
    if (aHasLast !== bHasLast) return bHasLast - aHasLast;
    const aYear = anneeStartYear(a.item.lastInscription?.annee);
    const bYear = anneeStartYear(b.item.lastInscription?.annee);
    if (aYear !== bYear) return bYear - aYear;
    const aName = `${a.item.etudiant.nom} ${a.item.etudiant.prenom}`;
    const bName = `${b.item.etudiant.nom} ${b.item.etudiant.prenom}`;
    return aName.localeCompare(bName, 'fr', { sensitivity: 'base' });
  });

  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Valeurs académiques par défaut pertinentes pour une première inscription
 * (faculté possédant réellement des domaines/mentions et niveau initial L1).
 */
export function getDefaultInitialAcademicSelection(db: ScolariteDatabase): {
  idFaculte: number;
  idDomaine: number;
  idMention: number;
  idNiveau: number;
} {
  const domaineIdsWithMentions = new Set(db.mentions.map((m) => m.idDomaine));
  const faculteIdsWithBranches = new Set(
    db.domaines
      .filter((d) => domaineIdsWithMentions.has(d.id))
      .map((d) => d.idFaculte)
  );

  // Préfère la faculté la plus représentée parmi celles ayant des mentions
  const mentionToFaculte = new Map<number, number>();
  const domaineById = new Map(db.domaines.map((d) => [d.id, d]));
  for (const m of db.mentions) {
    const dom = domaineById.get(m.idDomaine);
    if (dom) mentionToFaculte.set(m.id, dom.idFaculte);
  }
  const facCounts = new Map<number, number>();
  for (const ins of db.inscriptions) {
    const facId = mentionToFaculte.get(ins.idMention);
    if (facId) facCounts.set(facId, (facCounts.get(facId) ?? 0) + 1);
  }

  const validFacultes = db.facultes.filter((f) =>
    faculteIdsWithBranches.has(f.id)
  );
  validFacultes.sort(
    (a, b) => (facCounts.get(b.id) ?? 0) - (facCounts.get(a.id) ?? 0)
  );

  const chosenFaculte = validFacultes[0] ?? db.facultes[0];
  const idFaculte = chosenFaculte?.id ?? 0;

  const chosenDomaine =
    db.domaines.find(
      (d) => d.idFaculte === idFaculte && domaineIdsWithMentions.has(d.id)
    ) ??
    db.domaines.find((d) => d.idFaculte === idFaculte) ??
    db.domaines[0];
  const idDomaine = chosenDomaine?.id ?? 0;

  const chosenMention =
    db.mentions.find((m) => m.idDomaine === idDomaine) ?? db.mentions[0];
  const idMention = chosenMention?.id ?? 0;

  const l1Candidate =
    db.niveaux.find((n) => normalizeNiveauKey(n.niveau) === 'licence 1') ??
    db.niveaux[0];
  const idNiveau = l1Candidate?.id ?? 0;

  return { idFaculte, idDomaine, idMention, idNiveau };
}

export function exportInscriptionsToXlsx(
  rows: EnrichedInscription[],
  anneeLabel: string
): void {
  const exportRows = rows.map((r) => ({
    Ref: r.reference,
    'Num Inscr': r.numInscription,
    NOM: r.nom,
    PRÉNOMS: r.prenom,
    'DATE DE NAISSANCE': formatDateFR(r.dateNaissance),
    Lieu_De_Naissance: r.lieuNaissance,
    SEXE: r.sexe,
    Téléphone: r.telephone,
    CIN: r.numeroCin,
    'Date delivrance': formatDateFR(r.dateCin),
    Lieu_Delivrance: r.lieuDelivrance,
    NATIONALITÉ: r.nationalite,
    Faculte: r.faculte,
    Domaine: r.domaine,
    Mention: r.mention,
    Grade: r.grade,
    Niveau: r.niveau,
    Parcours: r.parcours === '— Aucun —' ? '' : r.parcours,
    Annee: r.annee,
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Etudiants');
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const safeAnnee = (anneeLabel || 'Tous').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Export Etudiant Année ${safeAnnee} du ${dd}-${mm}-${yy}.xlsx`);
}

export function exportInscriptionsToCsv(
  rows: EnrichedInscription[],
  anneeLabel: string
): void {
  const headers = [
    'Ref',
    'Num Inscr',
    'NOM',
    'PRÉNOMS',
    'DATE DE NAISSANCE',
    'Lieu_De_Naissance',
    'SEXE',
    'Téléphone',
    'CIN',
    'Date delivrance',
    'Lieu_Delivrance',
    'NATIONALITÉ',
    'Faculte',
    'Domaine',
    'Mention',
    'Grade',
    'Niveau',
    'Parcours',
    'Annee',
  ];

  const escapeCsv = (val: string) => {
    const clean = (val ?? '').replace(/"/g, '""');
    return `"${clean}"`;
  };

  const lines = [
    headers.map(escapeCsv).join(';'),
    ...rows.map((r) =>
      [
        r.reference,
        r.numInscription,
        r.nom,
        r.prenom,
        formatDateFR(r.dateNaissance),
        r.lieuNaissance,
        r.sexe,
        r.telephone,
        r.numeroCin,
        formatDateFR(r.dateCin),
        r.lieuDelivrance,
        r.nationalite,
        r.faculte,
        r.domaine,
        r.mention,
        r.grade,
        r.niveau,
        r.parcours === '— Aucun —' ? '' : r.parcours,
        r.annee,
      ]
        .map(escapeCsv)
        .join(';')
    ),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const safeAnnee = (anneeLabel || 'Tous').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `Export Etudiant Année ${safeAnnee} du ${dd}-${mm}-${yy}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ExcelRowStatus = 'new' | 'reinscription' | 'duplicate_inscription' | 'error';

export interface ParsedExcelRow {
  rowIndex: number;
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
  domaine: string;
  mention: string;
  grade: string;
  niveau: string;
  parcours: string;
  annee: string;
  valid: boolean;
  status: ExcelRowStatus;
  matchedEtudiantId?: number;
  error?: string;
  warning?: string;
}

export function getWorkbookSheetNames(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  return wb.SheetNames;
}

function normalizeHeaderKey(header: unknown): string {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const HEADER_ALIASES: Record<string, string> = {
  ref: 'reference',
  reference: 'reference',
  num_inscr: 'numInscription',
  num_inscription: 'numInscription',
  numero_inscription: 'numInscription',
  numero_d_inscription: 'numInscription',
  nom: 'nom',
  prenoms: 'prenom',
  prenom: 'prenom',
  date_de_naissance: 'dateNaissance',
  date_naissance: 'dateNaissance',
  lieu_de_naissance: 'lieuNaissance',
  lieu_naissance: 'lieuNaissance',
  sexe: 'sexe',
  genre: 'sexe',
  telephone: 'telephone',
  tel: 'telephone',
  contact: 'telephone',
  cin: 'numeroCin',
  numero_cin: 'numeroCin',
  date_delivrance: 'dateCin',
  date_cin: 'dateCin',
  lieu_delivrance: 'lieuDelivrance',
  delivrance_cin: 'lieuDelivrance',
  nationalite: 'nationalite',
  pere: 'nomPere',
  nom_pere: 'nomPere',
  nom_du_pere: 'nomPere',
  mere: 'nomMere',
  nom_mere: 'nomMere',
  nom_de_la_mere: 'nomMere',
  faculte: 'faculte',
  etablissement: 'faculte',
  institution: 'faculte',
  domaine: 'domaine',
  mention: 'mention',
  grade: 'grade',
  niveau: 'niveau',
  parcours: 'parcours',
  annee: 'annee',
  annee_universitaire: 'annee',
};

export function parseExcelWorkbook(
  buffer: ArrayBuffer,
  sheetName?: string,
  existingDb?: ScolariteDatabase
): ParsedExcelRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const targetSheet =
    sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  if (!targetSheet) return [];
  const sheet = wb.Sheets[targetSheet];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (rawRows.length <= 1) return [];

  // Default A..S column positions matching IMPORTATION_Format.xlsx
  const colIndex: Record<string, number> = {
    reference: 0,
    numInscription: 1,
    nom: 2,
    prenom: 3,
    dateNaissance: 4,
    lieuNaissance: 5,
    sexe: 6,
    telephone: 7,
    numeroCin: 8,
    dateCin: 9,
    lieuDelivrance: 10,
    nationalite: 11,
    faculte: 12,
    domaine: 13,
    mention: 14,
    grade: 15,
    niveau: 16,
    parcours: 17,
    annee: 18,
    nomPere: -1,
    nomMere: -1,
  };

  const headerRow = (rawRows[0] as unknown[]) ?? [];
  const headerKeys = headerRow.map(normalizeHeaderKey);
  const looksLikeHeader =
    headerKeys.includes('nom') &&
    (headerKeys.includes('mention') || headerKeys.includes('faculte') || headerKeys.includes('annee'));

  if (looksLikeHeader) {
    const claimedIndexes = new Set<number>();
    const detected: Record<string, number> = {};
    headerKeys.forEach((hk, idx) => {
      const mapped = HEADER_ALIASES[hk];
      if (mapped && detected[mapped] === undefined) {
        detected[mapped] = idx;
        claimedIndexes.add(idx);
      }
    });
    for (const [k, idx] of Object.entries(detected)) {
      colIndex[k] = idx;
    }
    // Keep column 7 as telephone if not claimed by anything else (IMPORTATION_Format.xlsx has blank H header)
    if (detected.telephone === undefined && claimedIndexes.has(7)) {
      colIndex.telephone = -1;
    }
  }

  // Build quick lookup indexes from existingDb for duplicate detection
  const cinToEtudiant = new Map<string, number>();
  const identityToEtudiant = new Map<string, number>();
  const anneeByLabel = new Map<string, number>();
  const existingEtudiantAnnees = new Set<string>();

  if (existingDb) {
    for (const e of existingDb.etudiants) {
      const c = normalizeCin(e.numeroCin);
      if (c && !cinToEtudiant.has(c)) cinToEtudiant.set(c, e.id);
      const idKey = `${e.nom.trim().toLowerCase()}|${e.prenom.trim().toLowerCase()}|${e.dateNaissance}`;
      if (e.nom.trim() && !identityToEtudiant.has(idKey)) {
        identityToEtudiant.set(idKey, e.id);
      }
    }
    for (const a of existingDb.annees) {
      anneeByLabel.set(a.annee.trim().toLowerCase(), a.id);
    }
    for (const ins of existingDb.inscriptions) {
      existingEtudiantAnnees.add(`${ins.idEtudiant}:${ins.idAnnee}`);
    }
  }

  const parsed: ParsedExcelRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => String(c ?? '').trim() === '')) continue;

    const cell = (field: string) => {
      const idx = colIndex[field];
      if (idx === undefined || idx < 0) return '';
      return String(row[idx] ?? '').trim();
    };
    const rawVal = (field: string) => {
      const idx = colIndex[field];
      if (idx === undefined || idx < 0) return '';
      return row[idx];
    };

    const nom = cell('nom');
    const prenom = cell('prenom');
    const dateNaissance = parseDateToISO(rawVal('dateNaissance'));
    const faculte = cell('faculte');
    const domaine = cell('domaine');
    const mention = cell('mention');
    const niveau = cell('niveau');
    const annee = cell('annee');

    const missing: string[] = [];
    if (!nom) missing.push('Nom');
    if (!faculte) missing.push('Faculté');
    if (!domaine) missing.push('Domaine');
    if (!mention) missing.push('Mention');
    if (!niveau) missing.push('Niveau');
    if (!annee) missing.push('Année');

    const normSex = normalizeSex(cell('sexe'));
    const sexe = normSex === 'Autre' ? 'M' : normSex;
    const numeroCin = cell('numeroCin');
    const cinNorm = normalizeCin(numeroCin);
    const idKey = `${nom.toLowerCase()}|${prenom.toLowerCase()}|${dateNaissance}`;

    const matchedEtudiantId =
      (cinNorm ? cinToEtudiant.get(cinNorm) : undefined) ??
      identityToEtudiant.get(idKey);

    const matchedAnneeId = anneeByLabel.get(annee.toLowerCase());
    const hasExistingInscription =
      matchedEtudiantId !== undefined &&
      matchedAnneeId !== undefined &&
      existingEtudiantAnnees.has(`${matchedEtudiantId}:${matchedAnneeId}`);

    const dobAnomaly = getBirthdateAnomalyReason(dateNaissance);

    let status: ExcelRowStatus = 'new';
    if (missing.length > 0) {
      status = 'error';
    } else if (hasExistingInscription) {
      status = 'duplicate_inscription';
    } else if (matchedEtudiantId !== undefined) {
      status = 'reinscription';
    }

    parsed.push({
      rowIndex: i + 1,
      reference: cell('reference'),
      numInscription: cell('numInscription'),
      nom,
      prenom,
      dateNaissance,
      lieuNaissance: cell('lieuNaissance'),
      sexe,
      telephone: normalizePhone(rawVal('telephone')),
      numeroCin,
      dateCin: parseDateToISO(rawVal('dateCin')),
      lieuDelivrance: cell('lieuDelivrance'),
      nationalite: cell('nationalite') || 'MALAGASY',
      nomPere: cell('nomPere'),
      nomMere: cell('nomMere'),
      faculte,
      domaine,
      mention,
      grade: cell('grade') || 'Licence',
      niveau,
      parcours: cell('parcours'),
      annee,
      valid: missing.length === 0,
      status,
      matchedEtudiantId,
      error: missing.length > 0 ? `Manquant : ${missing.join(', ')}` : undefined,
      warning: dobAnomaly ?? undefined,
    });
  }
  return parsed;
}

export function commitExcelImport(
  db: ScolariteDatabase,
  rows: ParsedExcelRow[],
  mode: ImportDuplicateMode = 'skip_existing_inscription'
): {
  nextDb: ScolariteDatabase;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
} {
  const next: ScolariteDatabase = structuredClone(db);
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  let nextFacId = getNextId(next.facultes);
  let nextDomId = getNextId(next.domaines);
  let nextMenId = getNextId(next.mentions);
  let nextNivId = getNextId(next.niveaux);
  let nextAnnId = getNextId(next.annees);
  let nextParId = getNextId(next.parcours);
  let nextEtuId = getNextId(next.etudiants);
  let nextInsId = getNextId(next.inscriptions);

  const findExistingStudent = (r: ParsedExcelRow): Etudiant | undefined => {
    const cinNorm = normalizeCin(r.numeroCin);
    if (cinNorm) {
      const byCin = next.etudiants.find((e) => normalizeCin(e.numeroCin) === cinNorm);
      if (byCin) return byCin;
    }
    return next.etudiants.find(
      (e) =>
        e.nom.trim().toLowerCase() === r.nom.trim().toLowerCase() &&
        e.prenom.trim().toLowerCase() === r.prenom.trim().toLowerCase() &&
        e.dateNaissance === r.dateNaissance
    );
  };

  for (const r of rows) {
    if (!r.valid) {
      skippedCount++;
      continue;
    }

    // 1. Faculte
    let fac = next.facultes.find(
      (f) => f.faculte.trim().toLowerCase() === r.faculte.trim().toLowerCase()
    );
    if (!fac) {
      fac = {
        id: nextFacId++,
        faculte: r.faculte.trim(),
        logo: '/assets/logo-uu.jpg',
      };
      next.facultes.push(fac);
    }

    // 2. Domaine
    let dom = next.domaines.find(
      (d) =>
        d.domaine.trim().toLowerCase() === r.domaine.trim().toLowerCase() &&
        d.idFaculte === fac!.id
    );
    if (!dom) {
      dom = {
        id: nextDomId++,
        domaine: r.domaine.trim(),
        idFaculte: fac.id,
      };
      next.domaines.push(dom);
    }

    // 3. Mention
    let men = next.mentions.find(
      (m) =>
        m.mention.trim().toLowerCase() === r.mention.trim().toLowerCase() &&
        m.idDomaine === dom!.id
    );
    if (!men) {
      men = {
        id: nextMenId++,
        mention: r.mention.trim(),
        idDomaine: dom.id,
      };
      next.mentions.push(men);
    }

    // 4. Niveau
    let niv = next.niveaux.find(
      (n) => n.niveau.trim().toLowerCase() === r.niveau.trim().toLowerCase()
    );
    if (!niv) {
      niv = {
        id: nextNivId++,
        niveau: r.niveau.trim(),
        grade: r.grade.trim() || 'Licence',
      };
      next.niveaux.push(niv);
    }

    // 5. Annee universitaire
    let ann = next.annees.find(
      (a) => a.annee.trim().toLowerCase() === r.annee.trim().toLowerCase()
    );
    if (!ann) {
      ann = {
        id: nextAnnId++,
        annee: r.annee.trim(),
      };
      next.annees.push(ann);
    }

    // 6. Parcours (optional)
    let idParcours: number | null = null;
    if (r.parcours && r.parcours !== '— Aucun —') {
      let par = next.parcours.find(
        (p) =>
          p.parcours.trim().toLowerCase() === r.parcours.trim().toLowerCase() &&
          p.idMention === men!.id &&
          p.idNiveau === niv!.id
      );
      if (!par) {
        par = {
          id: nextParId++,
          parcours: r.parcours.trim(),
          idMention: men.id,
          idNiveau: niv.id,
        };
        next.parcours.push(par);
      }
      idParcours = par.id;
    }

    // 7. Etudiant & Inscription according to duplicate mode
    const existingStudent = mode !== 'create_new' ? findExistingStudent(r) : undefined;
    let studentId: number;

    if (existingStudent) {
      studentId = existingStudent.id;
      const existingIns = next.inscriptions.find(
        (i) => i.idEtudiant === studentId && i.idAnnee === ann!.id
      );

      if (mode === 'update_student') {
        if (!existingStudent.dateNaissance && r.dateNaissance)
          existingStudent.dateNaissance = r.dateNaissance;
        if (!existingStudent.lieuNaissance && r.lieuNaissance)
          existingStudent.lieuNaissance = r.lieuNaissance;
        if (!existingStudent.telephone && r.telephone) existingStudent.telephone = r.telephone;
        if (!existingStudent.numeroCin && r.numeroCin) existingStudent.numeroCin = r.numeroCin;
        if (!existingStudent.dateCin && r.dateCin) existingStudent.dateCin = r.dateCin;
        if (!existingStudent.lieuDelivrance && r.lieuDelivrance)
          existingStudent.lieuDelivrance = r.lieuDelivrance;
        if (!existingStudent.nomPere && r.nomPere) existingStudent.nomPere = r.nomPere;
        if (!existingStudent.nomMere && r.nomMere) existingStudent.nomMere = r.nomMere;

        if (existingIns) {
          existingIns.idMention = men.id;
          existingIns.idNiveau = niv.id;
          existingIns.idParcours = idParcours;
          if (r.numInscription) existingIns.numInscription = r.numInscription;
          if (r.reference) existingIns.reference = r.reference;
          updatedCount++;
          continue;
        }
      } else if (existingIns) {
        skippedCount++;
        continue;
      }
    } else {
      const newEtudiant: Etudiant = {
        id: nextEtuId++,
        nom: r.nom,
        prenom: r.prenom,
        dateNaissance: r.dateNaissance,
        lieuNaissance: r.lieuNaissance,
        sexe: r.sexe,
        telephone: r.telephone,
        numeroCin: r.numeroCin,
        dateCin: r.dateCin,
        lieuDelivrance: r.lieuDelivrance,
        nationalite: r.nationalite,
        nomPere: r.nomPere,
        nomMere: r.nomMere,
      };
      next.etudiants.push(newEtudiant);
      studentId = newEtudiant.id;
    }

    // 8. Inscription
    next.inscriptions.push({
      id: nextInsId++,
      idEtudiant: studentId,
      idNiveau: niv.id,
      idAnnee: ann.id,
      idMention: men.id,
      idParcours,
      numInscription: r.numInscription,
      reference: r.reference,
    });
    importedCount++;
  }

  return { nextDb: next, importedCount, updatedCount, skippedCount };
}

export function verifyCertificateQuery(
  db: ScolariteDatabase,
  queryText: string
): EnrichedInscription[] {
  const trimmed = queryText.trim();
  if (!trimmed) return [];

  const all = enrichInscriptions(db);

  // Jeton unique de vérification (QR Code) ou numéro de certificat
  const tokenCandidate = trimmed
    .replace(/\s+/g, '')
    .replace(/^.*[?&]code=/i, '')
    .toUpperCase();
  if (/^[A-Z0-9]{8,20}$/.test(tokenCandidate)) {
    const byToken = all.filter(
      (r) => r.certificateToken && r.certificateToken.toUpperCase() === tokenCandidate
    );
    if (byToken.length > 0) return byToken;
    const registryEntry = findCertificateByToken(tokenCandidate);
    if (registryEntry) {
      const byRegistry = all.filter(
        (r) => r.idInscription === registryEntry.idInscription
      );
      if (byRegistry.length > 0) return byRegistry;
    }
  }
  if (/^CERT\//i.test(trimmed)) {
    const byNumber = all.filter(
      (r) => r.numeroCertificat.toUpperCase() === trimmed.toUpperCase()
    );
    if (byNumber.length > 0) return byNumber;
  }

  // Check if user pasted a multi-line QR payload
  const tokenLineMatch = trimmed.match(/Jeton\s*:\s*([A-Z0-9-]+)/i);
  if (tokenLineMatch) {
    const tokenVal = tokenLineMatch[1].trim().toUpperCase();
    const byLineToken = all.filter(
      (r) => r.certificateToken && r.certificateToken.toUpperCase() === tokenVal
    );
    if (byLineToken.length > 0) return byLineToken;
  }

  const certNumLineMatch = trimmed.match(/N°\s*certificat\s*:\s*([^\n\r]+)/i);
  if (certNumLineMatch) {
    const numVal = certNumLineMatch[1].trim().toLowerCase();
    if (numVal && numVal !== '—') {
      const byLineNum = all.filter(
        (r) => r.numeroCertificat.toLowerCase() === numVal
      );
      if (byLineNum.length > 0) return byLineNum;
    }
  }

  const refMatch = trimmed.match(/R[ée]f[ée]rence\s*:\s*([^\n\r]+)/i);
  const nomMatch = trimmed.match(/NOM\s*:\s*([^\n\r]+)/i);
  const anneeMatch = trimmed.match(/Ann[ée]e\s*:\s*([^\n\r]+)/i);

  if (refMatch) {
    const refVal = refMatch[1].trim().toLowerCase();
    const byRef = all.filter(
      (r) =>
        r.reference.toLowerCase() === refVal ||
        r.numInscription.toLowerCase() === refVal ||
        String(r.idInscription) === refVal
    );
    if (byRef.length > 0) {
      if (anneeMatch) {
        const ann = anneeMatch[1].trim().toLowerCase();
        const exact = byRef.filter((r) => r.annee.toLowerCase() === ann);
        if (exact.length > 0) return exact;
      }
      return byRef;
    }
  }

  if (nomMatch) {
    const targetNom = nomMatch[1].trim().toLowerCase();
    const byName = all.filter(
      (r) => `${r.nom} ${r.prenom}`.trim().toLowerCase() === targetNom
    );
    if (byName.length > 0) return byName;
  }

  // Handle #idEtudiant / #idInscription format
  const idMatch = trimmed.match(/^#?(\d+)\s*\/\s*#?(\d+)$/);
  if (idMatch) {
    const etuId = Number(idMatch[1]);
    const insId = Number(idMatch[2]);
    return all.filter((r) => r.idEtudiant === etuId && r.idInscription === insId);
  }

  const q = trimmed.toLowerCase();
  const qNoSpaces = q.replace(/\s+/g, '');
  return all.filter((r) => {
    if (r.numeroCertificat && r.numeroCertificat.toLowerCase() === q) return true;
    if (r.reference.toLowerCase() === q) return true;
    if (r.numInscription.toLowerCase() === q) return true;
    if (normalizeCin(r.numeroCin).toLowerCase() === qNoSpaces && qNoSpaces.length >= 6) return true;
    if (String(r.idInscription) === q) return true;
    const fullName = `${r.nom} ${r.prenom}`.toLowerCase();
    return fullName.includes(q);
  });
}

export function downloadExcelTemplate(): void {
  const sampleRows = [
    {
      Ref: '250001',
      'Num Inscr': '000001',
      NOM: 'RAKOTO',
      'PRÉNOMS': 'Jean',
      'DATE DE NAISSANCE': '15/03/2004',
      Lieu_De_Naissance: 'Toliara',
      SEXE: 'M',
      Téléphone: '034 12 345 67',
      CIN: '501011012345',
      'Date delivrance': '20/05/2022',
      Lieu_Delivrance: 'Toliara I',
      'NATIONALITÉ': 'MALAGASY',
      Faculte: 'DEGS',
      Domaine: 'Sciences de la Société',
      Mention: 'DROIT',
      Grade: 'Licence',
      Niveau: 'L1',
      Parcours: '',
      Annee: '2025-2026',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modele_Import');
  XLSX.writeFile(wb, 'Modele_Importation_Scolarite_Uu.xlsx');
}

export function exportDatabaseJson(db: ScolariteDatabase): void {
  const payload = JSON.stringify(db, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Sauvegarde_Scolarite_Uu_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDatabaseJson(rawText: string): ScolariteDatabase {
  const parsed = JSON.parse(rawText) as Partial<ScolariteDatabase>;
  const requiredKeys: (keyof ScolariteDatabase)[] = [
    'annees',
    'facultes',
    'domaines',
    'mentions',
    'niveaux',
    'parcours',
    'etudiants',
    'inscriptions',
  ];
  for (const key of requiredKeys) {
    if (!parsed || !Array.isArray(parsed[key])) {
      throw new Error(`Structure JSON invalide : table "${key}" manquante.`);
    }
  }
  return parsed as ScolariteDatabase;
}

