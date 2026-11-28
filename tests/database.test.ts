import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  DEFAULT_DOCUMENT_TEMPLATES,
  auditDatabase,
  batchReinscribe,
  buildAuditReportCsv,
  buildCertificateNumber,
  DEFAULT_CERTIFICATE_PHRASE,
  buildCertificateQrPayload,
  buildCertificateVariables,
  buildDocumentQrPayload,
  buildNiveauFilterOptions,
  buildStudentAssistedIndex,
  calculateAge,
  compareNiveauKeys,
  commitExcelImport,
  computeDashboardStats,
  createAcademicYear,
  enrichInscriptions,
  ensureCertificateIdentitiesBatch,
  findNextNiveauId,
  formatCertificateNumber,
  formatDateFR,
  formatFieldValue,
  generateNextInscriptionCodes,
  getBirthdateAnomalyReason,
  getDefaultInitialAcademicSelection,
  getDependencyInfo,
  getDocumentRowValue,
  getLatestAnneeLabel,
  getLatestBaseAnneeId,
  getResolvedHeaderLines,
  getSampleInscription,
  getSeedDatabase,
  getStudentLastInscription,
  getWorkbookSheetNames,
  importDatabaseJson,
  loadDocumentTemplates,
  mergeDocumentTemplate,
  mergeDuplicateStudents,
  loadActiveAnnee,
  renderCertificateBody,
  normalizeAllSexCodes,
  normalizeCin,
  normalizeNiveauKey,
  normalizePhone,
  normalizeSex,
  searchStudentsForAssistedEntry,
  parseDateToISO,
  parseExcelWorkbook,
  sortAnneesDesc,
  suggestNextAnneeLabel,
  syncHeaderLegacyFields,
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

describe('Modèles de documents (administration)', () => {
  it('fournit un modèle par défaut pour le certificat et la carte', () => {
    const certificat = DEFAULT_DOCUMENT_TEMPLATES.certificat;
    const carte = DEFAULT_DOCUMENT_TEMPLATES.carte;
    assert.equal(certificat.kind, 'certificat');
    assert.equal(carte.kind, 'carte');
    assert.equal(certificat.texts.title, 'Certificat de Scolarité');
    assert.equal(carte.texts.title, 'Carte d’Étudiant');
    assert.ok(certificat.blocks.academicTable);
    assert.equal(carte.blocks.academicTable, false);
    assert.ok(certificat.rows.length >= 6);
    assert.ok(certificat.qr.includeName);
  });

  it('fusionne un modèle enregistré avec les valeurs par défaut sans perdre la personnalisation', () => {
    const merged = mergeDocumentTemplate('certificat', {
      texts: { title: 'ATTESTATION DE SCOLARITÉ' },
      appearance: { accentColor: '#7c3aed' },
      blocks: { watermark: true },
    } as never);

    assert.equal(merged.texts.title, 'ATTESTATION DE SCOLARITÉ');
    assert.equal(merged.appearance.accentColor, '#7c3aed');
    assert.equal(merged.blocks.watermark, true);
    // Les clés non fournies gardent la valeur par défaut
    assert.equal(
      merged.texts.closing,
      DEFAULT_DOCUMENT_TEMPLATES.certificat.texts.closing
    );
    assert.equal(merged.blocks.header, true);
    assert.equal(merged.rows.length, DEFAULT_DOCUMENT_TEMPLATES.certificat.rows.length);
  });

  it('construit le contenu du QR code selon les champs activés', () => {
    const db = getSeedDatabase();
    const record = getSampleInscription(db);
    const tpl = mergeDocumentTemplate('certificat', null);

    const full = buildDocumentQrPayload(record, tpl);
    assert.ok(full.includes(record.nom));
    assert.ok(full.includes(record.mention));
    assert.ok(full.includes(record.annee));

    const light = mergeDocumentTemplate('certificat', {
      qr: {
        header: '=== TEST ===',
        includeName: true,
        includeInstitution: false,
        includeMention: false,
        includeLevel: false,
        includeYear: false,
        includeReference: true,
      },
    } as never);
    const minimal = buildDocumentQrPayload(record, light);
    assert.ok(minimal.startsWith('=== TEST ==='));
    assert.ok(minimal.includes(record.nom));
    assert.ok(!minimal.includes(record.mention));
    assert.ok(!minimal.includes(record.annee));
    assert.ok(minimal.includes(record.reference));
  });

  it('associe chaque ligne de modèle à la bonne donnée et récupère la photo de l’étudiant', () => {
    const db = getSeedDatabase();
    db.etudiants[0].photo = 'data:image/jpeg;base64,AAAA';
    const record = enrichInscriptions(db).find(
      (row) => row.idEtudiant === db.etudiants[0].id
    );
    assert.ok(record);
    if (!record) return;
    assert.equal(getDocumentRowValue(record, 'mention'), record.mention);
    assert.equal(getDocumentRowValue(record, 'niveau'), record.niveau);
    assert.equal(getDocumentRowValue(record, 'annee'), record.annee);
    assert.equal(
      getDocumentRowValue(record, 'inconnu'),
      ''
    );
    assert.equal(record.photo, 'data:image/jpeg;base64,AAAA');
  });

  it('fournit un étudiant d’aperçu même avec une base vide', () => {
    const empty = {
      annees: [],
      facultes: [],
      domaines: [],
      mentions: [],
      niveaux: [],
      parcours: [],
      etudiants: [],
      inscriptions: [],
    };
    const sample = getSampleInscription(empty);
    assert.equal(sample.nom, 'RAKOTO');
    assert.ok(sample.numInscription.length > 0);
    assert.equal(sample.photo, '');
  });

  it('gère un modèle malléable (ordre des zones, zones libres, champs carte et champs personnalisés)', () => {
    const partialOrder = mergeDocumentTemplate('certificat', {
      layout: {
        sectionOrder: ['title', 'body'],
        headerLayout: 'left',
        freeZones: [
          {
            id: 'z1',
            label: 'Visa',
            text: 'Vu par {{signataire_titre}}',
            position: 'bottom',
            align: 'right',
            enabled: true,
          },
        ],
      },
    } as never);

    // L'ordre personnalisé commence bien par title puis body, tout en conservant les autres zones
    assert.equal(partialOrder.layout.sectionOrder[0], 'title');
    assert.equal(partialOrder.layout.sectionOrder[1], 'body');
    assert.equal(partialOrder.layout.sectionOrder.length, 6);
    assert.equal(partialOrder.layout.headerLayout, 'left');
    assert.equal(partialOrder.layout.freeZones.length, 1);

    const carte = mergeDocumentTemplate('carte', {
      card: {
        photoPosition: 'right',
        photoShape: 'circle',
        qrPlacement: 'back',
        frontFields: ['numInscription', 'mention'],
      },
    } as never);
    assert.equal(carte.card.photoPosition, 'right');
    assert.equal(carte.card.photoShape, 'circle');
    assert.equal(carte.card.qrPlacement, 'back');
    assert.deepEqual(carte.card.frontFields, ['numInscription', 'mention']);

    const db = getSeedDatabase();
    const rec = { ...getSampleInscription(db), customValues: { bourse: 'OUI' } };
    assert.equal(getDocumentRowValue(rec, 'bourse'), 'OUI');
  });

  it('gère les lignes d’en-tête dynamiques et la compatibilité avec line1..line5', () => {
    const defaultLines = getResolvedHeaderLines(
      DEFAULT_DOCUMENT_TEMPLATES.certificat.header
    );
    assert.equal(defaultLines.length, 5);
    assert.equal(defaultLines[3].text, 'Université de Toliara');

    // Migration d'un ancien modèle ne contenant que line1..line5
    const legacyMerged = mergeDocumentTemplate('certificat', {
      header: { line4: 'Institut Supérieur Test' },
    } as never);
    assert.equal(legacyMerged.header.lines?.length, 5);
    assert.equal(legacyMerged.header.lines?.[3].text, 'Institut Supérieur Test');

    // Ajout / personnalisation de lignes typographiques
    const customLines = [
      ...defaultLines,
      {
        id: 'h6',
        label: 'Contact',
        text: 'BP 185 · Toliara',
        fontFamily: 'Georgia',
        fontSize: 12,
        bold: true,
        italic: true,
        underline: false,
        align: 'right' as const,
      },
    ];
    const syncedHeader = syncHeaderLegacyFields(
      DEFAULT_DOCUMENT_TEMPLATES.certificat.header,
      customLines
    );
    const mergedCustom = mergeDocumentTemplate('certificat', {
      header: syncedHeader,
    } as never);
    assert.equal(mergedCustom.header.lines?.length, 6);
    assert.equal(mergedCustom.header.lines?.[5].fontFamily, 'Georgia');
    assert.equal(mergedCustom.header.lines?.[5].align, 'right');
    assert.equal(mergedCustom.header.lines?.[5].bold, true);
  });

  it('conserve les styles typographiques par zone (elementStyles), les décalages X/Y et les polices des blocs libres', () => {
    const merged = mergeDocumentTemplate('certificat', {
      layout: {
        elementStyles: {
          title: { fontFamily: 'Georgia', fontSize: 22, italic: true, align: 'left' },
          reference: { fontFamily: 'JetBrains Mono', fontSize: 10, uppercase: true },
          signature: { align: 'left', offsetX: 48, offsetY: -24 },
          qr: { offsetX: -16, offsetY: 12 },
          footer: { fontFamily: 'Arial', fontSize: 9, align: 'center' },
        },
        freeZones: [
          {
            id: 'fz1',
            label: 'Visa',
            text: 'Visé par le secrétariat',
            position: 'bottom',
            align: 'right',
            enabled: true,
            fontFamily: 'Times New Roman',
            fontSize: 11,
            bold: true,
            italic: true,
            underline: true,
            color: '#1e293b',
            offsetX: 20,
            offsetY: -10,
          },
        ],
      },
    } as never);

    assert.equal(merged.layout.elementStyles?.title?.fontFamily, 'Georgia');
    assert.equal(merged.layout.elementStyles?.title?.fontSize, 22);
    assert.equal(merged.layout.elementStyles?.title?.italic, true);
    assert.equal(merged.layout.elementStyles?.title?.align, 'left');
    assert.equal(merged.layout.elementStyles?.reference?.uppercase, true);
    assert.equal(merged.layout.elementStyles?.signature?.offsetX, 48);
    assert.equal(merged.layout.elementStyles?.signature?.offsetY, -24);
    assert.equal(merged.layout.elementStyles?.qr?.offsetX, -16);
    assert.equal(merged.layout.elementStyles?.qr?.offsetY, 12);
    assert.equal(merged.layout.elementStyles?.footer?.align, 'center');
    assert.equal(merged.layout.freeZones[0].fontFamily, 'Times New Roman');
    assert.equal(merged.layout.freeZones[0].underline, true);
    assert.equal(merged.layout.freeZones[0].color, '#1e293b');
    assert.equal(merged.layout.freeZones[0].offsetX, 20);
    assert.equal(merged.layout.freeZones[0].offsetY, -10);
  });
});


describe('Personnalisation du certificat (champs, corps, QR, impression)', () => {
  const db = getSeedDatabase();
  const record = getSampleInscription(db);
  const tpl = mergeDocumentTemplate('certificat', null);

  it('active dix-huit champs standards dont huit activés par défaut', () => {
    assert.equal(tpl.fields.length, 18);
    const enabled = tpl.fields.filter((f) => f.enabled).map((f) => f.id);
    for (const id of [
      'nom',
      'prenom',
      'dateNaissance',
      'lieuNaissance',
      'niveau',
      'annee',
      'matricule',
      'numeroCertificat',
      'dateDelivrance',
    ]) {
      assert.ok(enabled.includes(id), `champ ${id} attendu actif`);
    }
    assert.equal(tpl.fields.filter((f) => f.id === 'reference')[0].enabled, false);
  });

  it('fusionne les champs standards et personnalisés par identifiant', () => {
    const custom = {
      ...tpl.fields[0],
      id: 'numero_table',
      label: 'Numéro de table',
      custom: true,
    };
    const merged = mergeDocumentTemplate('certificat', {
      fields: [{ ...tpl.fields[0], label: 'NOM DE FAMILLE', required: true }, custom],
    } as never);
    assert.equal(merged.fields.find((f) => f.id === 'nom')?.label, 'NOM DE FAMILLE');
    assert.equal(merged.fields.find((f) => f.id === 'numero_table')?.custom, true);
    assert.equal(merged.fields.length, 19);
  });

  it('formate les valeurs : majuscules, masque et dates', () => {
    const nom = tpl.fields.find((f) => f.id === 'nom')!;
    assert.equal(formatFieldValue(nom, 'rakoto jean'), 'RAKOTO JEAN');
    const cin = { ...nom, uppercase: false, mask: '999 999 999 999', type: 'text' as const };
    assert.equal(formatFieldValue(cin, '501011012345'), '501 011 012 345');
    const date = { ...nom, type: 'date' as const, dateFormat: 'JJ/MM/AAAA' as const };
    assert.equal(formatFieldValue(date, '2003-04-12'), '12/04/2003');
  });

  it('résout les variables du corps, y compris les champs personnalisés', () => {
    const withCustom = mergeDocumentTemplate('certificat', {
      fields: [
        {
          ...tpl.fields[0],
          id: 'numero_table',
          label: 'Numéro de table',
          custom: true,
          uppercase: false,
        },
      ],
    } as never);
    const sampleCustom: typeof record = {
      ...record,
      customValues: { numero_table: 'T-42' },
    };
    const vars = buildCertificateVariables(sampleCustom, withCustom);
    assert.equal(vars.nom, record.nom.toLocaleUpperCase('fr-FR'));
    assert.equal(vars.numero_table, 'T-42');
    const body = renderCertificateBody(
      'Certificat {{numero_certificat}} pour {{nom_complet}} (table {{numero_table}})',
      vars
    );
    assert.ok(body.includes(record.numeroCertificat));
    assert.ok(body.includes('T-42'));
    // Une variable inconnue est conservée telle quelle
    assert.equal(renderCertificateBody('{{inconnue}}', vars), '{{inconnue}}');
  });

  it('numérote les certificats de façon stable', () => {
    assert.equal(formatCertificateNumber('2024-2025', '649399', 7), 'CERT/2024-2025/000007-649399');
    assert.equal(buildCertificateNumber(record), `CERT/${record.annee}/${String(record.idInscription).padStart(6, '0')}-${record.numInscription}`);
  });

  it('génère un QR URL ou structuré avec jeton', () => {
    const urlTpl = mergeDocumentTemplate('certificat', {
      qr: { mode: 'url', urlTemplate: 'https://exemple.mg/verifier?code={{token}}' },
    } as never);
    const url = buildCertificateQrPayload(record, urlTpl, { token: 'ABC123' });
    assert.equal(url, 'https://exemple.mg/verifier?code=ABC123');

    const structured = mergeDocumentTemplate('certificat', { qr: { mode: 'structured' } } as never);
    const payload = buildCertificateQrPayload(record, structured, { token: 'ABC123' });
    assert.ok(payload.includes(record.nom));
    assert.ok(payload.includes('ABC123'));

    const both = mergeDocumentTemplate('certificat', { qr: { mode: 'both' } } as never);
    const mixed = buildCertificateQrPayload(record, both, { token: 'ABC123' });
    assert.ok(mixed.includes('https://'));
    assert.ok(mixed.includes(record.nom));
  });

  it('imprime par défaut 2 certificats par page (économie de papier)', () => {
    assert.equal(tpl.print.perSheet, 2);
    assert.equal(tpl.print.orientation, 'portrait');
    assert.equal(tpl.print.twoUpLayout, 'stacked');
    assert.equal(tpl.print.duplicateSame, false);
    assert.equal(tpl.print.cutLine, true);
  });

  it('migre les réglages d’impression jamais modifiés vers 2 par page', () => {
    const store = new Map<string, string>();
    store.set(
      'portail_scolarite_uu_doc_templates_v1',
      JSON.stringify({
        certificat: {
          print: {
            perSheet: 1,
            orientation: 'portrait',
            twoUpLayout: 'side-by-side',
            duplicateSame: true,
            cutLine: true,
            marginMm: 12,
          },
        },
      })
    );
    const original = (globalThis as Record<string, unknown>).localStorage;
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const loaded = loadDocumentTemplates();
      assert.equal(loaded.certificat.print.perSheet, 2);
      assert.equal(loaded.certificat.print.twoUpLayout, 'stacked');
      assert.equal(loaded.certificat.print.duplicateSame, false);
      // la migration est persistée
      const persisted = JSON.parse(
        store.get('portail_scolarite_uu_doc_templates_v1')!
      );
      assert.equal(persisted.certificat.print.perSheet, 2);
    } finally {
      if (original === undefined) {
        delete (globalThis as Record<string, unknown>).localStorage;
      } else {
        (globalThis as Record<string, unknown>).localStorage = original;
      }
    }
  });

  it('respecte des réglages d’impression personnalisés (pas de migration)', () => {
    const store = new Map<string, string>();
    store.set(
      'portail_scolarite_uu_doc_templates_v1',
      JSON.stringify({
        certificat: {
          print: {
            perSheet: 1,
            orientation: 'portrait',
            twoUpLayout: 'stacked',
            duplicateSame: false,
            cutLine: false,
            marginMm: 8,
          },
        },
      })
    );
    const original = (globalThis as Record<string, unknown>).localStorage;
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const loaded = loadDocumentTemplates();
      assert.equal(loaded.certificat.print.perSheet, 1);
      assert.equal(loaded.certificat.print.marginMm, 8);
      assert.equal(loaded.certificat.print.cutLine, false);
    } finally {
      if (original === undefined) {
        delete (globalThis as Record<string, unknown>).localStorage;
      } else {
        (globalThis as Record<string, unknown>).localStorage = original;
      }
    }
  });

  it('retrouve un certificat par son numéro (y compris personnalisé) ou jeton QR', () => {
    const found = verifyCertificateQuery(db, record.numeroCertificat);
    assert.ok(found);

    const customDb = structuredClone(db);
    customDb.inscriptions[0].numeroCertificat = 'ATT-2025-0042';
    customDb.inscriptions[0].certificateToken = 'JETONPERSO99';
    const byCustomNum = verifyCertificateQuery(customDb, 'ATT-2025-0042');
    assert.equal(byCustomNum.length, 1);
    assert.equal(byCustomNum[0].idInscription, customDb.inscriptions[0].id);

    const byQrLines = verifyCertificateQuery(
      customDb,
      'N° certificat : ATT-2025-0042\nJeton : JETONPERSO99'
    );
    assert.equal(byQrLines.length, 1);
  });

  it('applique les surcharges de signataire dans les variables du corps', () => {
    const vars = buildCertificateVariables(record, tpl, {
      signataireTitre: 'Le Doyen de la Faculté',
      signataireNom: 'Prof. TEST',
    });
    assert.equal(vars.signataire_titre, 'Le Doyen de la Faculté');
    assert.equal(vars.signataire_nom, 'Prof. TEST');
  });
});


describe('Certificat rédigé en phrase (sans tableau)', () => {
  const db = getSeedDatabase();
  const record = getSampleInscription(db);
  const tpl = mergeDocumentTemplate('certificat', null);

  it('utilise le mode « phrase » par défaut', () => {
    assert.equal(tpl.body.mode, 'phrase');
    assert.ok(tpl.body.template.includes('{{nom_complet}}'));
    assert.ok(tpl.body.template.includes('{{numero_certificat}}'));
  });

  it('remplit la phrase type avec les données de l’étudiant', () => {
    const vars = buildCertificateVariables(record, tpl);
    const phrase = renderCertificateBody(DEFAULT_CERTIFICATE_PHRASE, vars);
    assert.ok(phrase.includes(record.nom));
    assert.ok(phrase.includes(record.prenom));
    assert.ok(phrase.includes(formatDateFR(record.dateNaissance)) || phrase.includes(record.dateNaissance));
    assert.ok(phrase.includes(record.annee));
    assert.ok(phrase.includes(record.numeroCertificat));
    assert.equal(phrase.includes('{{'), false, 'aucune variable ne doit rester visible');
  });

  it('accorde le texte au féminin via {{accord_e}}', () => {
    const female = { ...record, sexe: 'F', sexeNormalized: 'F' } as typeof record;
    const vars = buildCertificateVariables(female, tpl);
    assert.equal(vars.accord_e, 'e');
    const phrase = renderCertificateBody(DEFAULT_CERTIFICATE_PHRASE, vars);
    assert.ok(phrase.includes('née le'));
    assert.ok(phrase.includes('inscrite'));
    assert.equal(phrase.includes('{{'), false);
  });

  it('conserve le mode tableau si le modèle le précise', () => {
    const table = mergeDocumentTemplate('certificat', { body: { mode: 'table' } } as never);
    assert.equal(table.body.mode, 'table');
    assert.equal(table.body.template, DEFAULT_CERTIFICATE_PHRASE);
  });

  it('accepte un texte rédigé libre avec les variables de saisie', () => {
    const custom = mergeDocumentTemplate('certificat', {
      body: { template: 'Nous certifions que {{nom_complet}} suit les cours en {{classe}}.' },
      fields: [
        {
          ...tpl.fields[0],
          id: 'numero_table',
          label: 'Numéro de table',
          custom: true,
          uppercase: false,
        },
      ],
    } as never);
    const phrase = renderCertificateBody(
      custom.body.template,
      buildCertificateVariables({ ...record, customValues: { numero_table: 'T-7' } }, custom)
    );
    assert.equal(phrase, `Nous certifions que ${record.nom} ${record.prenom} suit les cours en ${record.niveau}.`);
  });

  it('préserve l’indentation, les tabulations, les espaces multiples et les sauts de ligne', () => {
    const vars = buildCertificateVariables(record, tpl);
    const formatted =
      '\tJe soussigné(e)  certifie que {{nom_complet}}.\n\n\n      Le présent certificat est délivré.';
    const rendered = renderCertificateBody(formatted, vars);
    assert.equal(
      rendered,
      `\tJe soussigné(e)  certifie que ${record.nom} ${record.prenom}.\n\n\n      Le présent certificat est délivré.`
    );
  });
});


describe('Impression des cartes & choix de la fiche à conserver', () => {
  it('imprime recto/verso côte à côte par défaut (feuille pliée en 2)', () => {
    assert.equal(DEFAULT_DOCUMENT_TEMPLATES.carte.card.printMode, 'fold');
    const side = mergeDocumentTemplate('carte', { card: { printMode: 'side' } } as never);
    assert.equal(side.card.printMode, 'side');
    // Les autres réglages de la carte sont conservés
    const fold = mergeDocumentTemplate('carte', { card: { printMode: 'fold' } } as never);
    assert.equal(fold.card.showPhoto, DEFAULT_DOCUMENT_TEMPLATES.carte.card.showPhoto);
  });

  it('fusionne dans la fiche choisie, même s’il ne s’agit pas de la première', () => {
    const db = getSeedDatabase();
    const group = auditDatabase(db).duplicateStudents[0];
    const [first, second] = group.etudiants;
    const inscriptionsBefore = db.inscriptions.filter(
      (i) => i.idEtudiant === first.id || i.idEtudiant === second.id
    ).length;

    // On conserve la SECONDE fiche et on supprime la première
    const next = mergeDuplicateStudents(db, second.id, first.id);
    assert.equal(next.etudiants.some((e) => e.id === first.id), false);
    assert.equal(next.etudiants.some((e) => e.id === second.id), true);
    const relinked = next.inscriptions.filter((i) => i.idEtudiant === second.id).length;
    assert.equal(relinked, inscriptionsBefore);
  });

  it('remplit les champs vides de la fiche conservée', () => {
    const db = getSeedDatabase();
    const base = db.etudiants[0];
    const next = mergeDuplicateStudents(
      {
        ...db,
        etudiants: [
          { ...base, id: 9001, telephone: '', numeroCin: '' },
          { ...base, id: 9002, telephone: '034 00 000 00', numeroCin: '123456789012' },
        ],
        inscriptions: [],
      },
      9001,
      9002
    );
    assert.equal(next.etudiants[0].telephone, '034 00 000 00');
    assert.equal(next.etudiants[0].numeroCin, '123456789012');
  });
});


describe('Typographie du corps du certificat', () => {
  it('fournit un style par défaut', () => {
    const style = DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;
    assert.equal(style.fontFamily, 'sans');
    assert.equal(style.fontSize, 0);
    assert.equal(style.align, 'justify');
    assert.equal(style.bold, false);
    assert.equal(style.lineHeight, 1.5);
  });

  it('fusionne partiellement le style enregistré', () => {
    const merged = mergeDocumentTemplate('certificat', {
      body: { style: { fontFamily: 'serif', bold: true, align: 'center' } },
    } as never);
    assert.equal(merged.body.style.fontFamily, 'serif');
    assert.equal(merged.body.style.bold, true);
    assert.equal(merged.body.style.align, 'center');
    // Les clés non fournies gardent la valeur par défaut
    assert.equal(merged.body.style.lineHeight, 1.5);
    assert.equal(merged.body.template, DEFAULT_CERTIFICATE_PHRASE);
  });
});

describe('Rapport d’audit exportable', () => {
  it('produit un CSV complet (BOM UTF-8, séparateur « ; », une ligne par anomalie)', () => {
    const db = getSeedDatabase();
    const audit = auditDatabase(db, new Date('2026-11-27T00:00:00Z'));
    const csv = buildAuditReportCsv(audit);

    assert.ok(csv.startsWith('\uFEFF'));
    const lines = csv.split('\r\n');
    // Le BOM précède la première cellule
    assert.ok(
      lines[0].includes('"Catégorie";"Détail";"ID étudiant";"NOM";"PRÉNOMS"')
    );

    const expectedRows =
      1 +
      audit.duplicateStudents.reduce((n, g) => n + g.etudiants.length, 0) +
      audit.suspiciousBirthdates.length +
      audit.nonStandardSex.length +
      audit.missingCin.length +
      audit.missingTelephone.length +
      audit.duplicateReferences.length +
      audit.duplicateNumInscriptions.length +
      audit.orphanInscriptions.length;
    assert.equal(lines.length, expectedRows);

    assert.ok(csv.includes('"Doublon étudiant"'));
    assert.ok(csv.includes('"Date de naissance"'));
    assert.ok(csv.includes('"Code sexe non standard"'));
    assert.ok(csv.includes('"CIN manquant"'));
    assert.ok(csv.includes('"Téléphone manquant"'));
  });
});

describe('Année universitaire de travail', () => {
  it('choisit par défaut l’année la plus récente, quel que soit l’ordre du référentiel', () => {
    const db = getSeedDatabase();
    assert.equal(getLatestAnneeLabel(db.annees), '2024-2025');
    assert.equal(
      getLatestAnneeLabel([
        { annee: '2019-2020' },
        { annee: '2025-2026' },
        { annee: '2021-2022' },
      ]),
      '2025-2026'
    );
    assert.equal(getLatestAnneeLabel([]), '');
  });

  it('trie les années de la plus récente à la plus ancienne', () => {
    const sorted = sortAnneesDesc([
      { id: 1, annee: '2021-2022' },
      { id: 2, annee: '2024-2025' },
      { id: 3, annee: '2019-2020' },
    ]).map((a) => a.annee);
    assert.deepEqual(sorted, ['2024-2025', '2021-2022', '2019-2020']);
  });

  it('démarre sur la dernière année et ignore une préférence obsolète', () => {
    const db = getSeedDatabase();
    assert.equal(loadActiveAnnee(db.annees), '2024-2025');
  });

  it('les inscriptions d’une année sont bien cloisonnées', () => {
    const db = getSeedDatabase();
    const rows = enrichInscriptions(db);
    assert.equal(rows.filter((r) => r.annee === '2024-2025').length, 727);
    assert.equal(rows.filter((r) => r.annee === '2023-2024').length, 0);
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

  it('crée une nouvelle année universitaire vide sans dupliquer une année existante', () => {
    const db = getSeedDatabase();
    assert.equal(suggestNextAnneeLabel(db.annees), '2025-2026');
    const baseId = getLatestBaseAnneeId(db);
    const baseAnnee = db.annees.find((a) => a.id === baseId);
    assert.equal(baseAnnee?.annee, '2024-2025');

    const created = createAcademicYear(db, ' 2025 - 2026 ');
    assert.equal(created.created, true);
    assert.equal(created.annee.annee, '2025-2026');
    assert.equal(created.nextDb.annees.length, db.annees.length + 1);
    // L'année est créée vide : aucune copie aveugle d'inscriptions
    assert.equal(created.nextDb.inscriptions.length, db.inscriptions.length);
    assert.equal(suggestNextAnneeLabel(created.nextDb.annees), '2026-2027');

    // Re-créer la même année retourne l'existante sans doublon
    const existing = createAcademicYear(created.nextDb, '2025-2026');
    assert.equal(existing.created, false);
    assert.equal(existing.annee.id, created.annee.id);
    assert.equal(existing.nextDb.annees.length, created.nextDb.annees.length);
  });

  it('propose la saisie assistée sur le nom à partir de la dernière inscription chronologique et avance le niveau', () => {
    const seed = getSeedDatabase();
    const { nextDb: dbWithNewYear, annee: annee2025 } = createAcademicYear(
      seed,
      '2025-2026'
    );

    // Recherche par préfixe du nom (insensible à la casse)
    const results = searchStudentsForAssistedEntry(dbWithNewYear, 'elanir', {
      targetAnneeId: annee2025.id,
    });
    assert.ok(results.length >= 1);
    const match = results[0];
    assert.equal(match.etudiant.nom, 'ELANIRIKO');
    assert.ok(match.lastInscription);
    assert.equal(match.lastInscription.annee, '2024-2025');
    assert.equal(match.lastInscription.niveau, 'L1');
    assert.equal(match.targetYearInscription, null);

    // Le niveau proposé passe automatiquement de L1 à Licence 2
    assert.ok(match.suggestedAssignment);
    assert.equal(match.suggestedAssignment.hasProgression, true);
    assert.equal(match.suggestedAssignment.sameNiveauLabel, 'L1');
    assert.equal(match.suggestedAssignment.nextNiveauLabel, 'Licence 2');
    assert.equal(
      match.suggestedAssignment.recommendedNiveauLabel,
      'Licence 2'
    );
    assert.equal(
      match.suggestedAssignment.mentionLabel,
      match.lastInscription.mention
    );

    // Vérifie le tri chronologique même si une inscription plus ancienne est ajoutée après dans le tableau
    const annee2023 = dbWithNewYear.annees.find(
      (a) => a.annee === '2023-2024'
    )!;
    const dbOutOfOrder = structuredClone(dbWithNewYear);
    dbOutOfOrder.inscriptions.push({
      id: 999999,
      idEtudiant: match.etudiant.id,
      idAnnee: annee2023.id,
      idMention: match.lastInscription.idMention,
      idNiveau: match.lastInscription.idNiveau,
      idParcours: null,
      reference: 'OLD23',
      numInscription: 'OLD23',
    });
    const lastIns = getStudentLastInscription(
      dbOutOfOrder,
      match.etudiant.id,
      annee2025.id
    );
    assert.equal(lastIns?.annee, '2024-2025');

    // Une fois l'étudiant inscrit en 2025-2026, targetYearInscription est détectée
    const codes = generateNextInscriptionCodes(dbWithNewYear, annee2025.id);
    assert.ok(codes.reference.startsWith('25'));
    dbOutOfOrder.inscriptions.push({
      id: 1000000,
      idEtudiant: match.etudiant.id,
      idAnnee: annee2025.id,
      idMention: match.suggestedAssignment.idMention,
      idNiveau: match.suggestedAssignment.recommendedNiveauId,
      idParcours: null,
      reference: codes.reference,
      numInscription: codes.numInscription,
    });
    const refreshedIndex = buildStudentAssistedIndex(
      dbOutOfOrder,
      annee2025.id
    );
    const updatedProfile = refreshedIndex.get(match.etudiant.id)!;
    assert.equal(updatedProfile.lastInscription?.annee, '2024-2025');
    assert.equal(updatedProfile.targetYearInscription?.annee, '2025-2026');
    assert.equal(updatedProfile.targetYearInscription?.niveau, 'Licence 2');

    // Vérifie les valeurs par défaut pour un tout nouvel étudiant
    const defaults = getDefaultInitialAcademicSelection(dbWithNewYear);
    assert.ok(defaults.idFaculte > 0);
    assert.ok(defaults.idDomaine > 0);
    assert.ok(defaults.idMention > 0);
    const niv = dbWithNewYear.niveaux.find((n) => n.id === defaults.idNiveau);
    assert.equal(normalizeNiveauKey(niv?.niveau ?? ''), 'licence 1');
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

  it('génère les identités de certificat en lot (O(N)) sans bloquer et de façon idempotente', () => {
    const db = getSeedDatabase();
    const allIds = db.inscriptions.map((i) => i.id);
    const first = ensureCertificateIdentitiesBatch(db, allIds);
    assert.equal(first.records.length, allIds.length);
    assert.equal(first.createdCount, allIds.length);
    assert.ok(first.records.every((r) => Boolean(r.certificateToken && r.numeroCertificat && r.dateDelivrance)));

    // Deuxième appel : aucune nouvelle création, même référence retournée
    const second = ensureCertificateIdentitiesBatch(first.nextDb, allIds);
    assert.equal(second.createdCount, 0);
    assert.equal(second.nextDb, first.nextDb);
    assert.equal(second.records.length, allIds.length);
  });
});
