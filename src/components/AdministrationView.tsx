import { ChangeEvent, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  CreditCard,
  Download,
  Eye,
  FileBadge,
  LayoutTemplate,
  MousePointerClick,
  Printer,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  DEFAULT_DOCUMENT_TEMPLATES,
  DEFAULT_SECTION_ORDER,
  QR_PIXEL_SIZES,
  deleteSavedProfile,
  enrichInscriptions,
  getResolvedHeaderLines,
  getSampleInscription,
  loadDocumentTemplates,
  loadSavedProfiles,
  mergeDocumentTemplate,
  normalizeSex,
  resetDocumentTemplate,
  saveDocumentTemplates,
  syncHeaderLegacyFields,
  upsertSavedProfile,
} from '../services/database';
import {
  BodyFontFamily,
  CertificateSectionKey,
  DocumentFreeZone,
  DocumentKind,
  DocumentTemplate,
  DocumentTemplates,
  ElementTypography,
  HeaderLineItem,
  HorizontalAlign,
  PageElementSelection,
  QrPosition,
  QrSize,
  SavedDocumentProfile,
  ScolariteDatabase,
  StyledZoneKey,
} from '../types/scolarite';
import {
  CertificateDocument,
  DocumentZoneTarget,
} from './CertificateDocument';
import { CertificatePrintSheets } from './CertificatePrintSheets';
import {
  CertificateTemplateEditor,
  InspectorTab,
} from './CertificateTemplateEditor';
import { PageElementToolbar } from './PageElementToolbar';
import { StudentCardDocument } from './StudentCardDocument';
import { StudentCardPrintSheets } from './StudentCardPrintSheets';

const BODY_TO_TOOLBAR_FONT: Record<BodyFontFamily, string> = {
  sans: 'Public Sans',
  serif: 'Georgia',
  display: 'Plus Jakarta Sans',
  mono: 'JetBrains Mono',
};

function toolbarFontToBody(fontFamily: string): BodyFontFamily {
  if (fontFamily === 'Georgia' || fontFamily === 'Times New Roman') return 'serif';
  if (fontFamily === 'JetBrains Mono') return 'mono';
  if (fontFamily === 'Plus Jakarta Sans') return 'display';
  return 'sans';
}

const ZONE_LABELS: Record<StyledZoneKey, { kicker: string; title: string; sectionKey: CertificateSectionKey }> = {
  reference: { kicker: 'ZONE DE PAGE', title: 'Référence & Matricule', sectionKey: 'reference' },
  title: { kicker: 'ZONE DE PAGE', title: 'Titre du document', sectionKey: 'title' },
  body: { kicker: 'ZONE DE PAGE', title: 'Corps du certificat', sectionKey: 'body' },
  signature: { kicker: 'ZONE DE PAGE', title: 'Signature & Cachet', sectionKey: 'signatureQr' },
  qr: { kicker: 'ZONE DE PAGE', title: 'QR Code de vérification', sectionKey: 'signatureQr' },
  footer: { kicker: 'ZONE DE PAGE', title: 'Pied de page', sectionKey: 'footer' },
  legalMention: { kicker: 'ZONE DE PAGE', title: 'Mention légale', sectionKey: 'legalMention' },
};

interface AdministrationViewProps {
  db: ScolariteDatabase;
  anneeActive: string;
}

const ZONE_TO_TAB: Record<DocumentZoneTarget, InspectorTab> = {
  header: 'structure',
  footer: 'structure',
  reference: 'contenu',
  title: 'contenu',
  body: 'contenu',
  legalMention: 'contenu',
  signature: 'signature',
  qr: 'signature',
  cardFront: 'champs',
  cardBack: 'champs',
  cardPhoto: 'structure',
};

export function AdministrationView({ db, anneeActive }: AdministrationViewProps) {
  const [templates, setTemplates] = useState<DocumentTemplates>(() =>
    loadDocumentTemplates()
  );
  const [profiles, setProfiles] = useState<SavedDocumentProfile[]>(() =>
    loadSavedProfiles()
  );
  const [kind, setKind] = useState<DocumentKind>('certificat');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('structure');
  const [zoom, setZoom] = useState(0.85);
  const [savedAt, setSavedAt] = useState<string>('');
  const [showBack, setShowBack] = useState(true);
  const [showPrintSheets, setShowPrintSheets] = useState(false);
  const [interactivePreview, setInteractivePreview] = useState(true);
  const [activeZone, setActiveZone] = useState<DocumentZoneTarget | null>('header');
  const [pageSelection, setPageSelection] = useState<PageElementSelection | null>(
    () => {
      const firstId = getResolvedHeaderLines(templates.certificat.header)[0]?.id;
      return firstId ? { kind: 'headerLine', id: firstId } : null;
    }
  );
  const [importMessage, setImportMessage] = useState<string>('');
  const [printTargets, setPrintTargets] = useState<DocumentKind | null>(null);
  const [sampleId, setSampleId] = useState<number | 'auto'>('auto');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  // Pile Annuler / Rétablir par type de document
  const [undoStack, setUndoStack] = useState<
    Record<DocumentKind, DocumentTemplate[]>
  >({ certificat: [], carte: [] });
  const [redoStack, setRedoStack] = useState<
    Record<DocumentKind, DocumentTemplate[]>
  >({ certificat: [], carte: [] });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const template = templates[kind];

  const allEnriched = useMemo(() => enrichInscriptions(db), [db]);
  const defaultSample = useMemo(() => getSampleInscription(db), [db]);

  const sample = useMemo(() => {
    if (sampleId === 'auto') return defaultSample;
    const found = allEnriched.find((r) => r.idInscription === sampleId);
    if (!found) return defaultSample;
    return {
      ...found,
      numeroCertificat:
        found.numeroCertificat || defaultSample.numeroCertificat,
      dateDelivrance: found.dateDelivrance || defaultSample.dateDelivrance,
      certificateToken:
        found.certificateToken || defaultSample.certificateToken,
    };
  }, [allEnriched, defaultSample, sampleId]);

  const femaleSample = useMemo(
    () =>
      allEnriched.find(
        (r) => (r.sexeNormalized ?? normalizeSex(r.sexe)) === 'F'
      ),
    [allEnriched]
  );
  const maleSample = useMemo(
    () =>
      allEnriched.find(
        (r) => (r.sexeNormalized ?? normalizeSex(r.sexe)) === 'M'
      ),
    [allEnriched]
  );
  const photoSample = useMemo(
    () => allEnriched.find((r) => Boolean(r.photo)),
    [allEnriched]
  );

  const stamp = () =>
    new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const updateTemplate = (
    mutate: (current: DocumentTemplate) => DocumentTemplate,
    recordHistory = true
  ) => {
    setTemplates((prev) => {
      const current = prev[kind];
      if (recordHistory) {
        setUndoStack((u) => ({
          ...u,
          [kind]: [...u[kind].slice(-29), current],
        }));
        setRedoStack((r) => ({ ...r, [kind]: [] }));
      }
      const next: DocumentTemplates = {
        ...prev,
        [kind]: { ...mutate(current), updatedAt: new Date().toISOString() },
      };
      saveDocumentTemplates(next);
      return next;
    });
    setSavedAt(stamp());
  };

  const handleUndo = () => {
    const stack = undoStack[kind];
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    setUndoStack((u) => ({ ...u, [kind]: u[kind].slice(0, -1) }));
    setRedoStack((r) => ({
      ...r,
      [kind]: [...r[kind].slice(-29), templates[kind]],
    }));
    updateTemplate(() => previous, false);
  };

  const handleRedo = () => {
    const stack = redoStack[kind];
    if (stack.length === 0) return;
    const nextTpl = stack[stack.length - 1];
    setRedoStack((r) => ({ ...r, [kind]: r[kind].slice(0, -1) }));
    setUndoStack((u) => ({
      ...u,
      [kind]: [...u[kind].slice(-29), templates[kind]],
    }));
    updateTemplate(() => nextTpl, false);
  };

  const replaceTemplate = (nextTemplate: DocumentTemplate) =>
    updateTemplate(() => nextTemplate);

  const patch = (partial: Partial<DocumentTemplate>) =>
    updateTemplate((current) => ({ ...current, ...partial }));

  const patchSection = <K extends keyof DocumentTemplate>(
    key: K,
    value: Partial<DocumentTemplate[K]>
  ) =>
    updateTemplate((current) => ({
      ...current,
      [key]: {
        ...(current[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      },
    }));

  const handleReset = () => {
    const fresh = resetDocumentTemplate(kind);
    replaceTemplate(fresh);
    setActiveProfileId('');
    const firstId =
      kind === 'certificat' ? getResolvedHeaderLines(fresh.header)[0]?.id : undefined;
    setPageSelection(firstId ? { kind: 'headerLine', id: firstId } : null);
  };

  const handleSaveProfile = () => {
    const clean = profileName.trim();
    if (!clean) return;
    const id = `prof_${Date.now().toString(36)}`;
    const next = upsertSavedProfile({
      id,
      name: clean,
      kind,
      updatedAt: new Date().toISOString(),
      template: structuredClone(template),
    });
    setProfiles(next);
    setActiveProfileId(id);
    setProfileName('');
    setSavingProfile(false);
    setImportMessage(`Variante « ${clean} » enregistrée.`);
  };

  const handleLoadProfile = (id: string) => {
    setActiveProfileId(id);
    const found = profiles.find((p) => p.id === id && p.kind === kind);
    if (!found) return;
    const merged = mergeDocumentTemplate(kind, found.template);
    replaceTemplate(merged);
    const firstId =
      kind === 'certificat' ? getResolvedHeaderLines(merged.header)[0]?.id : undefined;
    setPageSelection(firstId ? { kind: 'headerLine', id: firstId } : null);
    setImportMessage(`Variante « ${found.name} » chargée.`);
  };

  const handleDeleteProfile = (id: string) => {
    const next = deleteSavedProfile(id);
    setProfiles(next);
    if (activeProfileId === id) setActiveProfileId('');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modeles-documents-uu.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DocumentTemplates>;
      const next: DocumentTemplates = {
        certificat: mergeDocumentTemplate('certificat', parsed.certificat),
        carte: mergeDocumentTemplate('carte', parsed.carte),
      };
      setTemplates(next);
      saveDocumentTemplates(next);
      setImportMessage('Modèles importés et enregistrés.');
      setSavedAt(stamp());
    } catch {
      setImportMessage('Fichier invalide : JSON attendu.');
    } finally {
      e.target.value = '';
    }
  };

  const triggerPrint = (target: DocumentKind) => {
    setPrintTargets(target);
    setTimeout(() => {
      window.print();
      setPrintTargets(null);
    }, 120);
  };

  const handleZoneSelect = (zone: DocumentZoneTarget) => {
    setActiveZone(zone);
    setInspectorTab(ZONE_TO_TAB[zone] ?? 'structure');
    if (kind !== 'certificat') {
      setPageSelection(null);
      return;
    }
    if (zone === 'header') {
      const lines = getResolvedHeaderLines(template.header);
      setPageSelection((prev) =>
        prev?.kind === 'headerLine' && lines.some((l) => l.id === prev.id)
          ? prev
          : lines[0]
            ? { kind: 'headerLine', id: lines[0].id }
            : null
      );
    } else if (
      zone === 'reference' ||
      zone === 'title' ||
      zone === 'body' ||
      zone === 'signature' ||
      zone === 'qr' ||
      zone === 'footer' ||
      zone === 'legalMention'
    ) {
      setPageSelection({ kind: zone });
    } else {
      setPageSelection(null);
    }
  };

  const resolvedHeaderLines = useMemo(
    () => getResolvedHeaderLines(template.header),
    [template.header]
  );

  const selectedHeaderLineId =
    pageSelection?.kind === 'headerLine' ? pageSelection.id : null;

  const selectedHeaderLineIndex = useMemo(
    () =>
      selectedHeaderLineId
        ? resolvedHeaderLines.findIndex((l) => l.id === selectedHeaderLineId)
        : -1,
    [resolvedHeaderLines, selectedHeaderLineId]
  );

  const selectedHeaderLine =
    selectedHeaderLineIndex >= 0
      ? resolvedHeaderLines[selectedHeaderLineIndex]
      : null;

  const updateHeaderLines = (nextLines: HeaderLineItem[]) => {
    patchSection('header', syncHeaderLegacyFields(template.header, nextLines));
  };

  const handleUpdateHeaderLine = (
    lineId: string,
    linePatch: Partial<HeaderLineItem>
  ) => {
    updateHeaderLines(
      resolvedHeaderLines.map((l) =>
        l.id === lineId ? { ...l, ...linePatch } : l
      )
    );
  };

  const handleMoveHeaderLine = (lineId: string, delta: -1 | 1) => {
    const idx = resolvedHeaderLines.findIndex((l) => l.id === lineId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= resolvedHeaderLines.length) return;
    const copy = [...resolvedHeaderLines];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    updateHeaderLines(copy);
  };

  const handleDeleteHeaderLine = (lineId: string) => {
    if (resolvedHeaderLines.length <= 1) return;
    const idx = resolvedHeaderLines.findIndex((l) => l.id === lineId);
    const next = resolvedHeaderLines.filter((l) => l.id !== lineId);
    updateHeaderLines(next);
    const fallbackId = next[Math.max(0, idx - 1)]?.id;
    setPageSelection(fallbackId ? { kind: 'headerLine', id: fallbackId } : null);
  };

  const handleAddHeaderLine = () => {
    const id = `hl_${Date.now().toString(36)}`;
    const align =
      (template.layout?.headerLayout ?? 'classic') === 'left'
        ? ('left' as const)
        : ('center' as const);
    const nextLines: HeaderLineItem[] = [
      ...resolvedHeaderLines,
      {
        id,
        label: `Ligne ${resolvedHeaderLines.length + 1}`,
        text: 'Nouvelle ligne d’en-tête',
        fontFamily: 'Arial',
        fontSize: 11,
        bold: false,
        italic: false,
        underline: false,
        align,
        uppercase: false,
        color: '#334155',
      },
    ];
    updateHeaderLines(nextLines);
    setPageSelection({ kind: 'headerLine', id });
    setActiveZone('header');
    setInspectorTab('structure');
  };

  const freeZones = template.layout?.freeZones ?? [];
  const sectionOrder =
    template.layout?.sectionOrder && template.layout.sectionOrder.length > 0
      ? template.layout.sectionOrder
      : DEFAULT_SECTION_ORDER;

  const handleAddFreeZone = () => {
    const id = `zone_${Date.now().toString(36)}`;
    const nextZones: DocumentFreeZone[] = [
      ...freeZones,
      {
        id,
        label: `Bloc libre ${freeZones.length + 1}`,
        text: 'Observation : {{annee_scolaire}}',
        position: 'bottom',
        align: 'left',
        enabled: true,
        fontFamily: 'Arial',
        fontSize: 11,
        bold: false,
        italic: false,
        underline: false,
        uppercase: false,
        boxed: false,
      },
    ];
    patchSection('layout', { freeZones: nextZones });
    setPageSelection({ kind: 'freeZone', id });
    setActiveZone('body');
    setInspectorTab('structure');
  };

  const handleUpdateFreeZone = (
    zoneId: string,
    zonePatch: Partial<DocumentFreeZone>
  ) => {
    patchSection('layout', {
      freeZones: freeZones.map((z) =>
        z.id === zoneId ? { ...z, ...zonePatch } : z
      ),
    });
  };

  const handleMoveFreeZone = (zoneId: string, delta: -1 | 1) => {
    const idx = freeZones.findIndex((z) => z.id === zoneId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= freeZones.length) return;
    const copy = [...freeZones];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    patchSection('layout', { freeZones: copy });
  };

  const handleDeleteFreeZone = (zoneId: string) => {
    const idx = freeZones.findIndex((z) => z.id === zoneId);
    const next = freeZones.filter((z) => z.id !== zoneId);
    patchSection('layout', { freeZones: next });
    const fallback = next[Math.max(0, idx - 1)];
    setPageSelection(fallback ? { kind: 'freeZone', id: fallback.id } : null);
  };

  const handleMoveSection = (secKey: CertificateSectionKey, delta: -1 | 1) => {
    const idx = sectionOrder.indexOf(secKey);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= sectionOrder.length) return;
    const copy = [...sectionOrder];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    patchSection('layout', { sectionOrder: copy });
  };

  const handleHideSection = (secKey: CertificateSectionKey) => {
    if (secKey === 'body') return;
    if (secKey === 'footer') {
      patchSection('footer', { showFooter: false });
    } else if (secKey === 'signatureQr') {
      patchSection('blocks', { signature: false });
    } else {
      patchSection('blocks', { [secKey]: false });
    }
    setPageSelection(null);
    setActiveZone(null);
  };

  const handleRestoreSection = (secKey: CertificateSectionKey | 'qr') => {
    if (secKey === 'qr') {
      updateTemplate((current) => ({
        ...current,
        blocks: { ...current.blocks, qr: true },
        qr: { ...current.qr, enabled: true },
      }));
      setPageSelection({ kind: 'qr' });
      setActiveZone('qr');
      return;
    }
    if (secKey === 'footer') {
      patchSection('footer', { showFooter: true });
      setPageSelection({ kind: 'footer' });
      setActiveZone('footer');
      return;
    }
    if (secKey === 'signatureQr') {
      patchSection('blocks', { signature: true });
      setPageSelection({ kind: 'signature' });
      setActiveZone('signature');
      return;
    }
    patchSection('blocks', { [secKey]: true });
    if (
      secKey === 'reference' ||
      secKey === 'title' ||
      secKey === 'body' ||
      secKey === 'legalMention'
    ) {
      setPageSelection({ kind: secKey });
      setActiveZone(secKey);
    }
  };

  const handleUpdateZonePosition = (
    zoneKey: StyledZoneKey,
    offsetX: number,
    offsetY: number
  ) => {
    updateTemplate((current) => {
      const curLayout =
        current.layout ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.layout;
      const curElementStyles = curLayout.elementStyles ?? {};
      return {
        ...current,
        layout: {
          ...curLayout,
          elementStyles: {
            ...curElementStyles,
            [zoneKey]: {
              ...(curElementStyles[zoneKey] ?? {}),
              offsetX: Math.round(offsetX),
              offsetY: Math.round(offsetY),
            },
          },
        },
      };
    });
  };

  const handleUpdateFreeZonePosition = (
    zoneId: string,
    offsetX: number,
    offsetY: number
  ) => {
    handleUpdateFreeZone(zoneId, {
      offsetX: Math.round(offsetX),
      offsetY: Math.round(offsetY),
    });
  };

  const getZoneTypography = (zoneKey: StyledZoneKey): ElementTypography => {
    const layout = template.layout ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.layout;
    const custom = layout.elementStyles?.[zoneKey];
    const baseFontSize = template.appearance.fontSize || 13;

    switch (zoneKey) {
      case 'reference':
        return {
          fontFamily: custom?.fontFamily || 'JetBrains Mono',
          fontSize:
            custom?.fontSize && custom.fontSize > 0
              ? custom.fontSize
              : Math.max(8, Math.round(baseFontSize * 0.78)),
          bold: custom?.bold ?? false,
          italic: custom?.italic ?? false,
          underline: custom?.underline ?? false,
          uppercase: custom?.uppercase ?? false,
          align: custom?.align ?? 'left',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
      case 'title':
        return {
          fontFamily: custom?.fontFamily || 'Plus Jakarta Sans',
          fontSize:
            custom?.fontSize && custom.fontSize > 0
              ? custom.fontSize
              : Math.round(baseFontSize * (layout.titleSizeEm || 1.65)),
          bold: custom?.bold ?? true,
          italic: custom?.italic ?? false,
          underline: custom?.underline ?? layout.titleUnderline ?? true,
          uppercase: custom?.uppercase ?? layout.titleUppercase ?? true,
          align: custom?.align ?? layout.titleAlign ?? 'center',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
      case 'body': {
        const bodyStyle =
          template.body.style ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;
        return {
          fontFamily:
            custom?.fontFamily ||
            BODY_TO_TOOLBAR_FONT[bodyStyle.fontFamily] ||
            'Public Sans',
          fontSize:
            custom?.fontSize && custom.fontSize > 0
              ? custom.fontSize
              : bodyStyle.fontSize > 0
                ? bodyStyle.fontSize
                : Math.round(baseFontSize * 0.98),
          bold: custom?.bold ?? bodyStyle.bold ?? false,
          italic: custom?.italic ?? bodyStyle.italic ?? false,
          underline: custom?.underline ?? bodyStyle.underline ?? false,
          uppercase: custom?.uppercase ?? bodyStyle.uppercase ?? false,
          align: custom?.align ?? bodyStyle.align ?? 'justify',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
      }
      case 'signature':
        return {
          fontFamily: custom?.fontFamily || 'Public Sans',
          fontSize:
            custom?.fontSize && custom.fontSize > 0
              ? custom.fontSize
              : baseFontSize,
          bold: custom?.bold ?? false,
          italic: custom?.italic ?? false,
          underline: custom?.underline ?? false,
          uppercase: custom?.uppercase ?? false,
          align: custom?.align ?? layout.signatureAlign ?? 'center',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
      case 'qr':
        return {
          fontFamily: 'Public Sans',
          fontSize: 11,
          bold: false,
          italic: false,
          underline: false,
          uppercase: false,
          align: 'center',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
      case 'footer':
        return {
          fontFamily: custom?.fontFamily || 'Public Sans',
          fontSize:
            custom?.fontSize && custom.fontSize > 0
              ? custom.fontSize
              : Math.max(8, Math.round(baseFontSize * 0.65)),
          bold: custom?.bold ?? false,
          italic: custom?.italic ?? false,
          underline: custom?.underline ?? false,
          uppercase: custom?.uppercase ?? false,
          align: custom?.align ?? 'left',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
      case 'legalMention':
        return {
          fontFamily: custom?.fontFamily || 'Public Sans',
          fontSize:
            custom?.fontSize && custom.fontSize > 0
              ? custom.fontSize
              : Math.max(8, Math.round(baseFontSize * 0.68)),
          bold: custom?.bold ?? false,
          italic: custom?.italic ?? false,
          underline: custom?.underline ?? false,
          uppercase: custom?.uppercase ?? false,
          align: custom?.align ?? 'center',
          offsetX: custom?.offsetX ?? 0,
          offsetY: custom?.offsetY ?? 0,
        };
    }
  };

  const handleUpdateZoneTypography = (
    zoneKey: StyledZoneKey,
    typoPatch: Partial<ElementTypography>
  ) => {
    updateTemplate((current) => {
      const curLayout =
        current.layout ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.layout;
      const curElementStyles = curLayout.elementStyles ?? {};
      const nextZoneStyle: Partial<ElementTypography> = {
        ...(curElementStyles[zoneKey] ?? {}),
        ...typoPatch,
      };
      if (
        zoneKey === 'signature' &&
        (typoPatch.align === 'left' ||
          typoPatch.align === 'center' ||
          typoPatch.align === 'right')
      ) {
        nextZoneStyle.offsetX = 0;
      }
      const nextLayout = {
        ...curLayout,
        elementStyles: {
          ...curElementStyles,
          [zoneKey]: nextZoneStyle,
        },
      };

      if (zoneKey === 'title') {
        if (
          typoPatch.align === 'left' ||
          typoPatch.align === 'center' ||
          typoPatch.align === 'right'
        ) {
          nextLayout.titleAlign = typoPatch.align;
        }
        if (typoPatch.underline !== undefined) {
          nextLayout.titleUnderline = typoPatch.underline;
        }
        if (typoPatch.uppercase !== undefined) {
          nextLayout.titleUppercase = typoPatch.uppercase;
        }
      }

      if (zoneKey === 'signature') {
        if (
          typoPatch.align === 'left' ||
          typoPatch.align === 'center' ||
          typoPatch.align === 'right'
        ) {
          nextLayout.signatureAlign = typoPatch.align;
        }
      }

      if (zoneKey === 'body') {
        const curBodyStyle =
          current.body.style ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;
        const nextBodyStyle = { ...curBodyStyle };
        if (typoPatch.fontFamily !== undefined) {
          nextBodyStyle.fontFamily = toolbarFontToBody(typoPatch.fontFamily);
        }
        if (typoPatch.fontSize !== undefined) {
          nextBodyStyle.fontSize = typoPatch.fontSize;
        }
        if (typoPatch.bold !== undefined) nextBodyStyle.bold = typoPatch.bold;
        if (typoPatch.italic !== undefined)
          nextBodyStyle.italic = typoPatch.italic;
        if (typoPatch.underline !== undefined)
          nextBodyStyle.underline = typoPatch.underline;
        if (typoPatch.uppercase !== undefined)
          nextBodyStyle.uppercase = typoPatch.uppercase;
        if (
          typoPatch.align === 'left' ||
          typoPatch.align === 'center' ||
          typoPatch.align === 'justify'
        ) {
          nextBodyStyle.align = typoPatch.align;
        }
        return {
          ...current,
          layout: nextLayout,
          body: {
            ...current.body,
            style: nextBodyStyle,
          },
        };
      }

      return {
        ...current,
        layout: nextLayout,
      };
    });
  };

  const pageToolbarProps = (() => {
    if (kind !== 'certificat' || !pageSelection) return null;

    if (pageSelection.kind === 'headerLine' && selectedHeaderLine) {
      return {
        kicker: 'LIGNE D’EN-TÊTE',
        title: `${selectedHeaderLineIndex + 1} sur ${resolvedHeaderLines.length} — ${selectedHeaderLine.label || `Ligne ${selectedHeaderLineIndex + 1}`}`,
        value: {
          fontFamily: selectedHeaderLine.fontFamily,
          fontSize: selectedHeaderLine.fontSize,
          bold: selectedHeaderLine.bold,
          italic: selectedHeaderLine.italic,
          underline: selectedHeaderLine.underline,
          uppercase: Boolean(selectedHeaderLine.uppercase),
          align: selectedHeaderLine.align,
        } as ElementTypography,
        allowJustify: false,
        canMoveUp: selectedHeaderLineIndex > 0,
        canMoveDown: selectedHeaderLineIndex < resolvedHeaderLines.length - 1,
        canDelete: resolvedHeaderLines.length > 1,
        deleteTitle: 'Supprimer cette ligne d’en-tête',
        onUpdate: (typoPatch: Partial<ElementTypography>) => {
          const { align: nextAlign, ...rest } = typoPatch;
          const linePatch: Partial<HeaderLineItem> = { ...rest };
          if (nextAlign) {
            linePatch.align = nextAlign === 'justify' ? 'left' : nextAlign;
          }
          handleUpdateHeaderLine(selectedHeaderLine.id, linePatch);
        },
        onMove: (delta: -1 | 1) =>
          handleMoveHeaderLine(selectedHeaderLine.id, delta),
        onDelete: () => handleDeleteHeaderLine(selectedHeaderLine.id),
      };
    }

    if (pageSelection.kind === 'freeZone') {
      const idx = freeZones.findIndex((z) => z.id === pageSelection.id);
      const zone = idx >= 0 ? freeZones[idx] : null;
      if (!zone) return null;
      return {
        kicker: 'BLOC LIBRE',
        title: `${idx + 1} sur ${freeZones.length} — ${zone.label || 'Texte libre'}`,
        value: {
          fontFamily: zone.fontFamily || 'Arial',
          fontSize: zone.fontSize && zone.fontSize > 0 ? zone.fontSize : 11,
          bold: Boolean(zone.bold),
          italic: Boolean(zone.italic),
          underline: Boolean(zone.underline),
          uppercase: Boolean(zone.uppercase),
          align: zone.align,
        } as ElementTypography,
        allowJustify: false,
        canMoveUp: idx > 0,
        canMoveDown: idx < freeZones.length - 1,
        canDelete: true,
        deleteTitle: 'Supprimer ce bloc libre',
        positionControls: {
          x: zone.offsetX ?? 0,
          y: zone.offsetY ?? 0,
          onChange: (x: number, y: number) =>
            handleUpdateFreeZonePosition(zone.id, x, y),
          onReset: () => handleUpdateFreeZonePosition(zone.id, 0, 0),
        },
        onUpdate: (typoPatch: Partial<ElementTypography>) => {
          const nextPatch: Partial<DocumentFreeZone> = {
            ...typoPatch,
            align:
              typoPatch.align && typoPatch.align !== 'justify'
                ? (typoPatch.align as HorizontalAlign)
                : undefined,
          };
          if (!typoPatch.align) delete nextPatch.align;
          handleUpdateFreeZone(zone.id, nextPatch);
        },
        onMove: (delta: -1 | 1) => handleMoveFreeZone(zone.id, delta),
        onDelete: () => handleDeleteFreeZone(zone.id),
      };
    }

    if (pageSelection.kind === 'qr') {
      const qrMeta = ZONE_LABELS.qr;
      const qrTypo = getZoneTypography('qr');
      const secIdx = sectionOrder.indexOf('signatureQr');
      return {
        kicker: qrMeta.kicker,
        title: qrMeta.title,
        canMoveUp: secIdx > 0,
        canMoveDown: secIdx >= 0 && secIdx < sectionOrder.length - 1,
        canDelete: true,
        deleteTitle: 'Masquer le QR code',
        qrControls: {
          position: template.qr.position,
          preset: template.qr.preset,
          onChangePosition: (position: QrPosition) => {
            updateTemplate((current) => {
              const curLayout =
                current.layout ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.layout;
              const curElementStyles = curLayout.elementStyles ?? {};
              return {
                ...current,
                qr: { ...current.qr, position },
                layout: {
                  ...curLayout,
                  elementStyles: {
                    ...curElementStyles,
                    qr: {
                      ...(curElementStyles.qr ?? {}),
                      offsetX: 0,
                      offsetY: 0,
                    },
                  },
                },
              };
            });
          },
          onChangeSize: (preset: QrSize) =>
            patchSection('qr', { preset, size: QR_PIXEL_SIZES[preset] }),
        },
        positionControls: {
          x: qrTypo.offsetX ?? 0,
          y: qrTypo.offsetY ?? 0,
          onChange: (x: number, y: number) =>
            handleUpdateZonePosition('qr', x, y),
          onReset: () => handleUpdateZonePosition('qr', 0, 0),
        },
        onMove: (delta: -1 | 1) => handleMoveSection('signatureQr', delta),
        onDelete: () => {
          patchSection('blocks', { qr: false });
          setPageSelection(null);
          setActiveZone(null);
        },
      };
    }

    if (pageSelection.kind !== 'headerLine') {
      const zoneKey = pageSelection.kind;
      const meta = ZONE_LABELS[zoneKey];
      const secIdx = sectionOrder.indexOf(meta.sectionKey);
      const zoneTypo = getZoneTypography(zoneKey);
      return {
        kicker: meta.kicker,
        title: meta.title,
        value: zoneTypo,
        allowJustify: zoneKey === 'body',
        canMoveUp: secIdx > 0,
        canMoveDown: secIdx >= 0 && secIdx < sectionOrder.length - 1,
        canDelete: zoneKey !== 'body',
        deleteTitle:
          zoneKey === 'body'
            ? 'Le corps principal ne peut pas être supprimé'
            : `Masquer : ${meta.title}`,
        positionControls: {
          x: zoneTypo.offsetX ?? 0,
          y: zoneTypo.offsetY ?? 0,
          onChange: (x: number, y: number) =>
            handleUpdateZonePosition(zoneKey, x, y),
          onReset: () => handleUpdateZonePosition(zoneKey, 0, 0),
        },
        onUpdate: (typoPatch: Partial<ElementTypography>) =>
          handleUpdateZoneTypography(zoneKey, typoPatch),
        onMove: (delta: -1 | 1) => handleMoveSection(meta.sectionKey, delta),
        onDelete: () => handleHideSection(meta.sectionKey),
      };
    }

    return null;
  })();

  const kindProfiles = profiles.filter((p) => p.kind === kind);

  return (
    <div className="space-y-4">
      <div className="no-print space-y-4">
        {/* Barre supérieure du Studio */}
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 shrink-0">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 font-display truncate">
                Studio de Modèles
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Structure, variables, styles et mise en page ·{' '}
                {savedAt ? `Enregistré à ${savedAt}` : 'Enregistrement automatique'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Annuler / Rétablir */}
            <div className="inline-flex items-center border border-slate-300 rounded-md overflow-hidden bg-white">
              <button
                type="button"
                disabled={undoStack[kind].length === 0}
                onClick={handleUndo}
                title="Annuler la dernière modification"
                className="px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-35 inline-flex items-center gap-1 border-r border-slate-200 whitespace-nowrap shrink-0"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Annuler
              </button>
              <button
                type="button"
                disabled={redoStack[kind].length === 0}
                onClick={handleRedo}
                title="Rétablir"
                className="px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-35 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Importer
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Sélecteur de document + bibliothèque de variantes */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                {
                  key: 'certificat' as DocumentKind,
                  label: 'Certificat de scolarité',
                  icon: FileBadge,
                },
                {
                  key: 'carte' as DocumentKind,
                  label: 'Carte étudiant',
                  icon: CreditCard,
                },
              ]
            ).map((tab) => {
              const Icon = tab.icon;
              const active = kind === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setKind(tab.key);
                    setActiveZone(tab.key === 'certificat' ? 'header' : null);
                    const firstId =
                      tab.key === 'certificat'
                        ? getResolvedHeaderLines(templates.certificat.header)[0]?.id
                        : undefined;
                    setPageSelection(
                      firstId ? { kind: 'headerLine', id: firstId } : null
                    );
                    setActiveProfileId('');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Variantes enregistrées :
            </span>
            <select
              value={activeProfileId}
              onChange={(e) => handleLoadProfile(e.target.value)}
              aria-label="Charger une variante enregistrée"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white min-w-[180px]"
            >
              <option value="">
                Modèle actif ({kindProfiles.length} variante{kindProfiles.length > 1 ? 's' : ''})
              </option>
              {kindProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {activeProfileId && (
              <button
                type="button"
                onClick={() => handleDeleteProfile(activeProfileId)}
                title="Supprimer cette variante"
                className="p-1.5 text-red-600 border border-red-200 rounded-md hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {savingProfile ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProfile();
                    if (e.key === 'Escape') setSavingProfile(false);
                  }}
                  placeholder="Nom de la variante..."
                  autoFocus
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white w-44"
                />
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={!profileName.trim()}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setSavingProfile(false)}
                  className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSavingProfile(true)}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Enregistrer sous…
              </button>
            )}
          </div>
        </div>

        {importMessage && (
          <div className="px-4 py-2 text-xs bg-blue-50 border border-blue-200 rounded-md text-blue-900 flex items-center justify-between">
            <span>{importMessage}</span>
            <button
              type="button"
              onClick={() => setImportMessage('')}
              className="text-blue-700 hover:underline text-[11px]"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Espace principal : Inspecteur 440px + Aperçu interactif */}
        <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-5 items-start">
          {/* Panneau de réglages */}
          <div>
            <CertificateTemplateEditor
              kind={kind}
              tab={inspectorTab}
              onChangeTab={setInspectorTab}
              template={template}
              sample={sample}
              patch={patch}
              patchSection={patchSection}
              replaceTemplate={replaceTemplate}
              selectedHeaderLineId={selectedHeaderLineId}
              onSelectHeaderLine={(lineId) => {
                setPageSelection(lineId ? { kind: 'headerLine', id: lineId } : null);
                if (lineId) setActiveZone('header');
              }}
            />
          </div>

          {/* Aperçu interactif en direct */}
          <div className="xl:sticky xl:top-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {/* Barre d'outils aperçu */}
              <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Aperçu en direct</span>
                  <span className="font-normal text-slate-500">
                    · {anneeActive || sample.annee}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInteractivePreview((v) => !v)}
                    title="Cliquer sur une zone du document pour ouvrir son réglage"
                    className={`px-2.5 py-1.5 text-[11px] font-medium rounded border inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      interactivePreview
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MousePointerClick className="w-3 h-3" />
                    Sélection directe
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrintSheets((v) => !v)}
                    className={`px-2.5 py-1.5 text-[11px] font-medium rounded border inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      showPrintSheets
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Printer className="w-3 h-3" />
                    {showPrintSheets
                      ? kind === 'carte'
                        ? 'Voir la carte'
                        : 'Voir le certificat'
                      : 'Feuille A4'}
                  </button>

                  {kind === 'carte' && !showPrintSheets && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 px-2 py-1 border border-slate-200 rounded bg-slate-50">
                      <input
                        type="checkbox"
                        checked={showBack}
                        onChange={(e) => setShowBack(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      Verso
                    </label>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="range"
                      min={50}
                      max={110}
                      step={5}
                      value={Math.round(zoom * 100)}
                      onChange={(e) => setZoom(Number(e.target.value) / 100)}
                      aria-label="Zoom de l'aperçu"
                      className="w-20 accent-blue-600"
                    />
                    <span className="font-mono tabular-nums w-9 text-right">
                      {Math.round(zoom * 100)}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerPrint(kind)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer
                  </button>
                </div>
              </div>

              {/* Sélecteur d'étudiant de test */}
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-600 shrink-0">
                    Données d’essai :
                  </span>
                  <select
                    value={sampleId}
                    onChange={(e) =>
                      setSampleId(
                        e.target.value === 'auto' ? 'auto' : Number(e.target.value)
                      )
                    }
                    aria-label="Étudiant affiché dans l'aperçu"
                    className="px-2 py-1 text-[11px] border border-slate-300 rounded bg-white max-w-[240px]"
                  >
                    <option value="auto">
                      Par défaut ({defaultSample.nom} {defaultSample.prenom})
                    </option>
                    {allEnriched.slice(0, 80).map((stu) => (
                      <option key={stu.idInscription} value={stu.idInscription}>
                        {stu.nom} {stu.prenom} · {stu.niveau} ({stu.sexeNormalized})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {maleSample && (
                    <button
                      type="button"
                      onClick={() => setSampleId(maleSample.idInscription)}
                      className={`px-2 py-0.5 rounded border ${
                        sample.idInscription === maleSample.idInscription
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Test Homme (M)
                    </button>
                  )}
                  {femaleSample && (
                    <button
                      type="button"
                      onClick={() => setSampleId(femaleSample.idInscription)}
                      className={`px-2 py-0.5 rounded border ${
                        sample.idInscription === femaleSample.idInscription
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Test Femme (F)
                    </button>
                  )}
                  {photoSample && (
                    <button
                      type="button"
                      onClick={() => setSampleId(photoSample.idInscription)}
                      className={`px-2 py-0.5 rounded border ${
                        sample.idInscription === photoSample.idInscription
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Avec photo
                    </button>
                  )}
                </div>
              </div>

              {/* Canevas du document */}
              <div
                className="p-5 bg-slate-100/80 overflow-auto max-h-[75vh] space-y-3"
                onClick={() => {
                  setActiveZone(null);
                  setPageSelection(null);
                }}
              >
                {kind === 'certificat' &&
                  !showPrintSheets &&
                  interactivePreview &&
                  pageToolbarProps && (
                    <div className="max-w-[794px] mx-auto">
                      <PageElementToolbar {...pageToolbarProps} />
                    </div>
                  )}

                <div
                  style={{
                    zoom: showPrintSheets
                      ? zoom * (kind === 'carte' ? 0.34 : 0.48)
                      : zoom,
                  }}
                  className="mx-auto w-fit"
                >
                  {kind === 'certificat' ? (
                    showPrintSheets ? (
                      <CertificatePrintSheets
                        records={[sample]}
                        template={template}
                      />
                    ) : (
                      <CertificateDocument
                        record={sample}
                        template={template}
                        token={sample.certificateToken}
                        onSelectZone={
                          interactivePreview ? handleZoneSelect : undefined
                        }
                        activeZone={interactivePreview ? activeZone : null}
                        pageSelection={interactivePreview ? pageSelection : null}
                        onSelectPageElement={
                          interactivePreview
                            ? (sel) => setPageSelection(sel)
                            : undefined
                        }
                        onUpdateHeaderLineText={
                          interactivePreview
                            ? (id, text) => handleUpdateHeaderLine(id, { text })
                            : undefined
                        }
                        onAddHeaderLine={
                          interactivePreview ? handleAddHeaderLine : undefined
                        }
                        onUpdateReference={
                          interactivePreview
                            ? (refPatch) => patchSection('layout', refPatch)
                            : undefined
                        }
                        onUpdateTitleText={
                          interactivePreview
                            ? (title) => patchSection('texts', { title })
                            : undefined
                        }
                        onUpdateBodyText={
                          interactivePreview
                            ? ({ template: bodyTpl, intro, closing }) => {
                                if (bodyTpl !== undefined) {
                                  patchSection('body', { template: bodyTpl });
                                }
                                if (intro !== undefined || closing !== undefined) {
                                  patchSection('texts', {
                                    ...(intro !== undefined ? { intro } : {}),
                                    ...(closing !== undefined ? { closing } : {}),
                                  });
                                }
                              }
                            : undefined
                        }
                        onUpdateFreeZoneText={
                          interactivePreview
                            ? (zoneId, text) =>
                                handleUpdateFreeZone(zoneId, { text })
                            : undefined
                        }
                        onAddFreeZone={
                          interactivePreview ? handleAddFreeZone : undefined
                        }
                        onUpdateSignatureText={
                          interactivePreview
                            ? ({ datePhraseTemplate, title, name }) => {
                                if (datePhraseTemplate !== undefined) {
                                  patchSection('layout', { datePhraseTemplate });
                                }
                                if (title !== undefined || name !== undefined) {
                                  patchSection('signature', {
                                    ...(title !== undefined ? { title } : {}),
                                    ...(name !== undefined ? { name } : {}),
                                  });
                                }
                              }
                            : undefined
                        }
                        onUpdateFooterText={
                          interactivePreview
                            ? (footerPatch) => patchSection('footer', footerPatch)
                            : undefined
                        }
                        onUpdateLegalMention={
                          interactivePreview
                            ? (legalMention) =>
                                patchSection('texts', { legalMention })
                            : undefined
                        }
                        onUpdateZonePosition={
                          interactivePreview ? handleUpdateZonePosition : undefined
                        }
                        onUpdateFreeZonePosition={
                          interactivePreview
                            ? handleUpdateFreeZonePosition
                            : undefined
                        }
                        onRestoreSection={
                          interactivePreview ? handleRestoreSection : undefined
                        }
                      />
                    )
                  ) : showPrintSheets ? (
                    <StudentCardPrintSheets
                      records={[sample]}
                      template={template}
                    />
                  ) : (
                    <StudentCardDocument
                      record={sample}
                      template={template}
                      side={showBack ? 'both' : 'front'}
                      onSelectZone={
                        interactivePreview ? handleZoneSelect : undefined
                      }
                      activeZone={interactivePreview ? activeZone : null}
                    />
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 px-1">
              {interactivePreview
                ? 'Astuce : cliquez directement sur n’importe quel élément de la page (ligne d’en-tête, référence, titre, texte, bloc libre, signature, pied de page) pour le modifier en direct.'
                : `Modèle par défaut : ${DEFAULT_DOCUMENT_TEMPLATES[kind].texts.title}. Utilisez « Exporter » pour sauvegarder ou transférer vos modèles.`}
            </p>
          </div>
        </div>
      </div>

      {/* Impression plein format */}
      {printTargets === 'certificat' && (
        <div className="hidden print:block">
          <CertificatePrintSheets
            records={[sample]}
            template={templates.certificat}
          />
        </div>
      )}
      {printTargets === 'carte' && (
        <div className="hidden print:block">
          <StudentCardPrintSheets records={[sample]} template={templates.carte} />
        </div>
      )}
    </div>
  );
}
