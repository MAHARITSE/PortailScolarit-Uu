import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  auditDatabase,
  batchReinscribe,
  buildNiveauFilterOptions,
  calculateAge,
  compareNiveauKeys,
  commitExcelImport,
  computeDashboardStats,
  enrichInscriptions,
  formatDateFR,
  getBirthdateAnomalyReason,
  getDependencyInfo,
  getSeedDatabase,
  getWorkbookSheetNames,
  importDatabaseJson,
  mergeDuplicateStudents,
  normalizeAllSexCodes,
  normalizeCin,
  normalizeNiveauKey,
  normalizePhone,
  normalizeSex,
  parseDateToISO,
  parseExcelWorkbook,
  verifyCertificateQuery,
} from '../src/services/database';

describe('Normalisation & Formatage', () => {
  it('normalise correctement les codes sexe (G/g/M -> M, f/F -> F, D -> Autre)', () => {
    assert.equal(normalizeSex('M'), 'M');
    assert.equal(normalizeSex('G'), 'M');
    assert.equal(normalizeSex('g'), 'M');
    assert.equal(normalizeSex('Garçon'), 'M');
    assert.equal(normalizeSex('F'), 'F');
    assert.equal(normalizeSex('f'), 'F');
    assert.equal(normalizeSex('Féminin'), 'F');
    assert.equal(normalizeSex('D'), 'Autre');
    assert.equal(normalizeSex(''), 'Autre');
  });

  it('restaure le zéro initial perdu par Excel sur les numéros malgaches à 9 chiffres', () => {
    assert.equal(normalizePhone('373024156'), '037 30 241 56');
    assert.equal(normalizePhone(341234567), '034 12 345 67');
    assert.equal(normalizePhone('0341234567'), '034 12 345 67');
    assert.equal(normalizePhone(''), '');
  });

  it('normalise CIN et convertit les dates FR/ISO/Excel', () => {
    assert.equal(normalizeCin('501 011 012 345'), '501011012345');
    assert.equal(formatDateFR('2004-05-14'), '14/05/2004');
    assert.equal(parseDateToISO('14/05/2004'), '2004-05-14');
    assert.equal(parseDateToISO('2004-05-14'), '2004-05-14');
  });

  it('détecte les dates de naissance aberrantes', () => {
    const ref = new Date('2026-11-27T00:00:00Z');
    assert.equal(getBirthdateAnomalyReason('2005-03-10', ref), null);
    assert.ok(getBirthdateAnomalyReason('5004-05-14', ref)?.includes('future'));
    assert.ok(getBirthdateAnomalyReason('2024-01-01', ref)?.includes('jeune'));
    assert.ok(getBirthdateAnomalyReason('2005-02-30', ref)?.includes('invalide'));
    assert.equal(calculateAge('2000-01-01', ref), 26);
  });
});

describe('Filtre niveau (Certificats de scolarité)', () => {
  it('fusionne les alias de niveau (L1, Licence 1, 1ère année Licence)', () => {
    assert.equal(normalizeNiveauKey('L1'), 'licence 1');
    assert.equal(normalizeNiveauKey('l1'), 'licence 1');
    assert.equal(normalizeNiveauKey('Licence 1'), 'licence 1');
    assert.equal(normalizeNiveauKey('LICENCE  1'), 'licence 1');
    assert.equal(normalizeNiveauKey('Licence1'), 'licence 1');
    assert.equal(normalizeNiveauKey('1ère année Licence'), 'licence 1');
    assert.equal(normalizeNiveauKey('M2'), 'master 2');
    assert.equal(normalizeNiveauKey('Master 2'), 'master 2');
    assert.equal(normalizeNiveauKey('D3'), 'doctorat 3');
    assert.equal(normalizeNiveauKey('Doctorat 3'), 'doctorat 3');
    assert.equal(normalizeNiveauKey(''), '');
  });

  it('trie les niveaux dans un ordre lisible (Licence -> Master -> Doctorat)', () => {
    const sorted = ['L1', 'Master 1', 'Licence 3', 'Doctorat 2']
      .map((label) => normalizeNiveauKey(label))
      .sort(compareNiveauKeys);
    assert.deepEqual(sorted, [
      'licence 1',
      'licence 3',
      'master 1',
      'doctorat 2',
    ]);
  });

  it('ne propose que les niveaux réellement présents, sans doublon d’alias', () => {
    const options = buildNiveauFilterOptions([
      'L1',
      'L1',
      'Licence 1',
      'Master 2',
    ]);
    assert.deepEqual(
      options.map((option) => [option.key, option.label, option.count]),
      [
        ['licence 1', 'Licence 1', 3],
        ['master 2', 'Master 2', 1],
      ]
    );
  });

  it('le filtre "Licence 1" retrouve les inscriptions saisies en "L1"', () => {
    const db = getSeedDatabase();
    const rows = enrichInscriptions(db);
    // Le jeu de données contient le niveau "L1" (id 92) et un niveau "Licence 1" (id 5)
    assert.ok(db.niveaux.some((n) => n.niveau === 'L1'));
    assert.ok(db.niveaux.some((n) => n.niveau === 'Licence 1'));

    const options = buildNiveauFilterOptions(rows.map((row) => row.niveau));
    const licence1 = options.find((option) => option.key === 'licence 1');
    assert.ok(licence1);
    assert.equal(licence1?.label, 'Licence 1');
    assert.equal(
      rows.filter((row) => normalizeNiveauKey(row.niveau) === 'licence 1').length,
      727
    );
    // Aucun niveau mort dans la liste des options
    for (const option of options) {
      assert.ok(
        rows.some((row) => normalizeNiveauKey(row.niveau) === option.key),
        `niveau sans inscription proposé : ${option.key}`
      );
    }
  });
});

describe('Audit, Nettoyage & Statistiques sur seedData.json', () => {
  it('audite fidèlement le jeu de données initial (727 étudiants / 727 inscriptions)', () => {
    const db = getSeedDatabase();
    assert.equal(db.etudiants.length, 727);
    assert.equal(db.inscriptions.length, 727);

    const audit = auditDatabase(db, new Date('2026-11-27T00:00:00Z'));
    assert.equal(audit.orphanInscriptions.length, 0);
    assert.equal(audit.duplicateStudents.length, 3);
    assert.equal(audit.suspiciousBirthdates.length, 7);
    assert.equal(audit.missingCin.length, 159);
    assert.equal(audit.missingTelephone.length, 9);
    // Non-standard sex: 348 'G' + 8 'g' + 4 'f' + 1 'D' = 361
    assert.equal(audit.nonStandardSex.length, 361);
  });

  it('normalise les codes sexe en masse et fusionne les doublons sans créer d’orphelins', () => {
    const db = getSeedDatabase();
    const { nextDb, updatedCount } = normalizeAllSexCodes(db);
    // 348 G + 8 g + 4 f = 360 normalized; 1 'D' remains non-standard
    assert.equal(updatedCount, 360);

    const afterNormAudit = auditDatabase(nextDb, new Date('2026-11-27T00:00:00Z'));
    assert.equal(afterNormAudit.nonStandardSex.length, 1);

    const merged = mergeDuplicateStudents(nextDb, 66334, 66466);
    assert.equal(merged.etudiants.length, 726);
    assert.equal(merged.inscriptions.length, 727);
    assert.equal(
      merged.inscriptions.filter((i) => i.idEtudiant === 66334).length,
      2
    );
    assert.equal(
      auditDatabase(merged, new Date('2026-11-27T00:00:00Z')).orphanInscriptions
        .length,
      0
    );
  });

  it('calcule correctement les statistiques du tableau de bord', () => {
    const db = getSeedDatabase();
    const stats = computeDashboardStats(db, '2024-2025');
    assert.equal(stats.totalInscriptions, 727);
    assert.equal(stats.uniqueStudents, 727);
    assert.equal(stats.maleCount + stats.femaleCount + stats.otherSexCount, 727);
    assert.equal(stats.maleCount, 394); // 38 M + 348 G + 8 g
    assert.equal(stats.femaleCount, 332); // 328 F + 4 f
    assert.equal(stats.otherSexCount, 1); // 1 D
    assert.equal(stats.withCinCount, 568); // 727 - 159
    assert.equal(stats.byMention.length, 4);
  });
});

describe('Intégrité référentielle & Réinscription par lot', () => {
  it('bloque la suppression d’entités référencées et autorise les entités libres', () => {
    const db = getSeedDatabase();
    const yearDep = getDependencyInfo(db, 'annees', 20);
    assert.equal(yearDep.blocked, true);
    assert.equal(yearDep.count, 727);

    const freeYearDep = getDependencyInfo(db, 'annees', 19);
    assert.equal(freeYearDep.blocked, false);
    assert.equal(freeYearDep.count, 0);
  });

  it('réinscrit un lot d’étudiants sur une nouvelle année sans doublonner', () => {
    const db = getSeedDatabase();
    const sampleIds = db.etudiants.slice(0, 5).map((e) => e.id);
    const res1 = batchReinscribe(db, {
      studentIds: sampleIds,
      idAnnee: 19, // 2023-2024
      idMention: db.mentions[0].id,
      idNiveau: db.niveaux[0].id,
      idParcours: null,
      autoGenerateNumbers: true,
    });
    assert.equal(res1.createdCount, 5);
    assert.equal(res1.skippedCount, 0);
    assert.equal(res1.nextDb.inscriptions.length, 732);

    // Re-running same batch must skip all 5
    const res2 = batchReinscribe(res1.nextDb, {
      studentIds: sampleIds,
      idAnnee: 19,
      idMention: db.mentions[0].id,
      idNiveau: db.niveaux[0].id,
      idParcours: null,
      autoGenerateNumbers: true,
    });
    assert.equal(res2.createdCount, 0);
    assert.equal(res2.skippedCount, 5);
  });
});

describe('Importation Excel multi-feuilles & Vérification QR', () => {
  it('lit les feuilles et colonnes réelles de IMPORTATION_Format.xlsx (y compris colonne H téléphone)', () => {
    const xlsxPath = path.resolve(
      process.cwd(),
      'public/assets/IMPORTATION_Format.xlsx'
    );
    const buf = fs.readFileSync(xlsxPath);
    const arrayBuffer = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength
    );

    const sheets = getWorkbookSheetNames(arrayBuffer);
    assert.deepEqual(sheets, ['L1', 'Feuil1']);

    const db = getSeedDatabase();
    const parsed = parseExcelWorkbook(arrayBuffer, 'L1', db);
    assert.ok(parsed.length >= 720);
    // Check that phone numbers from unnamed column H were captured and zero-padded
    const withPhone = parsed.filter((r) => r.telephone.startsWith('03'));
    assert.ok(withPhone.length >= 700);
  });

  it('importe de nouvelles lignes Excel et réinscrit automatiquement un étudiant existant', () => {
    const db = getSeedDatabase();
    const existing = db.etudiants[0];

    const ws = XLSX.utils.json_to_sheet([
      {
        Ref: '259001',
        'Num Inscr': '990001',
        NOM: existing.nom,
        PRÉNOMS: existing.prenom,
        'DATE DE NAISSANCE': formatDateFR(existing.dateNaissance),
        SEXE: 'M',
        Téléphone: '341122334',
        CIN: existing.numeroCin,
        Faculte: 'DEGS',
        Domaine: 'Sciences de la Société',
        Mention: 'DROIT',
        Grade: 'Licence',
        Niveau: 'L2',
        Annee: '2025-2026',
      },
      {
        Ref: '259002',
        'Num Inscr': '990002',
        NOM: 'TESTNEW',
        PRÉNOMS: 'Student',
        'DATE DE NAISSANCE': '10/10/2004',
        SEXE: 'f',
        Téléphone: '321234567',
        CIN: '501999888777',
        Faculte: 'DEGS',
        Domaine: 'Sciences de la Société',
        Mention: 'GESTION',
        Grade: 'Licence',
        Niveau: 'L1',
        Annee: '2025-2026',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import');
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const rows = parseExcelWorkbook(u8, 'Import', db);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].status, 'reinscription');
    assert.equal(rows[0].matchedEtudiantId, existing.id);
    assert.equal(rows[1].status, 'new');
    assert.equal(rows[1].sexe, 'F');
    assert.equal(rows[1].telephone, '032 12 345 67');

    const commitRes = commitExcelImport(db, rows, 'skip_existing_inscription');
    assert.equal(commitRes.importedCount, 2);
    assert.equal(commitRes.nextDb.etudiants.length, 728); // only 1 new student created
    assert.equal(commitRes.nextDb.inscriptions.length, 729); // 2 new inscriptions
  });

  it('vérifie un certificat par référence, numéro inscription ou payload QR complet', () => {
    const db = getSeedDatabase();
    const enriched = enrichInscriptions(db);
    const sample = enriched[0];
    const qrPayload = [
      '===== SCOLARITE LOG =====',
      `NOM        : ${sample.nom} ${sample.prenom}`.trim(),
      `Institution : ${sample.faculte}`,
      `Mention     : ${sample.mention}`,
      `Année       : ${sample.annee}`,
      `Référence   : ${sample.reference || sample.numInscription}`,
      '====================',
    ].join('\n');

    const byQr = verifyCertificateQuery(db, qrPayload);
    assert.ok(byQr.some((r) => r.idInscription === sample.idInscription));

    if (sample.reference) {
      const byRef = verifyCertificateQuery(db, sample.reference);
      assert.ok(byRef.some((r) => r.idInscription === sample.idInscription));
    }

    assert.equal(verifyCertificateQuery(db, 'REF_INEXISTANTE_999999').length, 0);
  });

  it('valide la structure lors de la restauration JSON', () => {
    const db = getSeedDatabase();
    const okDb = importDatabaseJson(JSON.stringify(db));
    assert.equal(okDb.etudiants.length, 727);
    assert.throws(() => importDatabaseJson('{"etudiants":[]}'), /manquante/);
  });
});
