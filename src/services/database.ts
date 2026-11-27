import * as XLSX from 'xlsx';
import seedDataRaw from '../data/seedData.json';
import {
  BirthdateAnomaly,
  BreakdownItem,
  CertificateSettings,
  DashboardStats,
  DatabaseAuditReport,
  DuplicateCodeEntry,
  DuplicateStudentGroup,
  EnrichedInscription,
  Etudiant,
  ImportDuplicateMode,
  NormalizedSex,
  SaveResult,
  ScolariteDatabase,
  TableEntityKey,
} from '../types/scolarite';

const STORAGE_KEY = 'portail_scolarite_uu_db_v1';
const CERT_SETTINGS_KEY = 'portail_scolarite_uu_cert_settings_v1';

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  issueDate: '',
  signatoryTitle: 'Le Responsable de la Scolarité Centrale',
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

export function loadCertificateSettings(): CertificateSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_CERTIFICATE_SETTINGS };
    const raw = localStorage.getItem(CERT_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_CERTIFICATE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CertificateSettings>;
    return {
      issueDate: typeof parsed.issueDate === 'string' ? parsed.issueDate : '',
      signatoryTitle:
        typeof parsed.signatoryTitle === 'string' && parsed.signatoryTitle.trim()
          ? parsed.signatoryTitle
          : DEFAULT_CERTIFICATE_SETTINGS.signatoryTitle,
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

  // Check if user pasted a multi-line QR payload
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

