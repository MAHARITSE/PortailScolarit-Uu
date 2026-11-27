import * as XLSX from 'xlsx';
import seedDataRaw from '../data/seedData.json';
import {
  EnrichedInscription,
  ScolariteDatabase,
} from '../types/scolarite';

const STORAGE_KEY = 'portail_scolarite_uu_db_v1';

export function getSeedDatabase(): ScolariteDatabase {
  return structuredClone(seedDataRaw as ScolariteDatabase);
}

export function loadDatabase(): ScolariteDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = getSeedDatabase();
      saveDatabase(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as ScolariteDatabase;
    if (!parsed || !Array.isArray(parsed.etudiants) || !Array.isArray(parsed.inscriptions)) {
      const seed = getSeedDatabase();
      saveDatabase(seed);
      return seed;
    }
    return parsed;
  } catch {
    return getSeedDatabase();
  }
}

export function saveDatabase(db: ScolariteDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Impossible de sauvegarder dans localStorage:', err);
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
  return Math.max(...items.map((i) => i.id)) + 1;
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
  faculte: string;
  domaine: string;
  mention: string;
  grade: string;
  niveau: string;
  parcours: string;
  annee: string;
  valid: boolean;
  error?: string;
}

export function parseExcelWorkbook(buffer: ArrayBuffer): ParsedExcelRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (rawRows.length <= 1) return [];

  const parsed: ParsedExcelRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => String(c ?? '').trim() === '')) continue;

    const cell = (idx: number) => String(row[idx] ?? '').trim();
    const nom = cell(2);
    const faculte = cell(12);
    const domaine = cell(13);
    const mention = cell(14);
    const niveau = cell(16);
    const annee = cell(18);

    const missing: string[] = [];
    if (!nom) missing.push('Nom');
    if (!faculte) missing.push('Faculté');
    if (!domaine) missing.push('Domaine');
    if (!mention) missing.push('Mention');
    if (!niveau) missing.push('Niveau');
    if (!annee) missing.push('Année');

    const rawSexe = cell(6).toUpperCase();
    const sexe = rawSexe === 'F' ? 'F' : rawSexe === 'M' ? 'M' : rawSexe || 'M';

    parsed.push({
      rowIndex: i + 1,
      reference: cell(0),
      numInscription: cell(1),
      nom,
      prenom: cell(3),
      dateNaissance: parseDateToISO(row[4]),
      lieuNaissance: cell(5),
      sexe,
      telephone: cell(7),
      numeroCin: cell(8),
      dateCin: parseDateToISO(row[9]),
      lieuDelivrance: cell(10),
      nationalite: cell(11) || 'MALAGASY',
      faculte,
      domaine,
      mention,
      grade: cell(15) || 'Licence',
      niveau,
      parcours: cell(17),
      annee,
      valid: missing.length === 0,
      error: missing.length > 0 ? `Manquant : ${missing.join(', ')}` : undefined,
    });
  }
  return parsed;
}

export function commitExcelImport(
  db: ScolariteDatabase,
  rows: ParsedExcelRow[]
): { nextDb: ScolariteDatabase; importedCount: number } {
  const next: ScolariteDatabase = structuredClone(db);
  let importedCount = 0;

  for (const r of rows) {
    if (!r.valid) continue;

    // 1. Faculte
    let fac = next.facultes.find(
      (f) => f.faculte.trim().toLowerCase() === r.faculte.trim().toLowerCase()
    );
    if (!fac) {
      fac = {
        id: getNextId(next.facultes),
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
        id: getNextId(next.domaines),
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
        id: getNextId(next.mentions),
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
        id: getNextId(next.niveaux),
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
        id: getNextId(next.annees),
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
          id: getNextId(next.parcours),
          parcours: r.parcours.trim(),
          idMention: men.id,
          idNiveau: niv.id,
        };
        next.parcours.push(par);
      }
      idParcours = par.id;
    }

    // 7. Etudiant
    const newEtudiant = {
      id: getNextId(next.etudiants),
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
      nomPere: '',
      nomMere: '',
    };
    next.etudiants.push(newEtudiant);

    // 8. Inscription
    next.inscriptions.push({
      id: getNextId(next.inscriptions),
      idEtudiant: newEtudiant.id,
      idNiveau: niv.id,
      idAnnee: ann.id,
      idMention: men.id,
      idParcours,
      numInscription: r.numInscription,
      reference: r.reference,
    });
    importedCount++;
  }

  return { nextDb: next, importedCount };
}
