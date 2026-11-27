import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Move, Plus } from 'lucide-react';
import {
  DEFAULT_CERTIFICATE_PHRASE,
  DEFAULT_DOCUMENT_TEMPLATES,
  DEFAULT_SECTION_ORDER,
  buildCertificateQrPayload,
  buildCertificateVariables,
  formatDateFR,
  getCertificateFieldValue,
  getDocumentRowValue,
  getQrPixelSize,
  getResolvedHeaderLines,
  normalizeSex,
  renderCertificateBody,
} from '../services/database';
import {
  BodyFontFamily,
  CertificateSectionKey,
  CertificateSettings,
  DocumentFreeZone,
  DocumentLayoutConfig,
  DocumentTemplate,
  ElementTypography,
  EnrichedInscription,
  PageElementSelection,
  PageTextAlign,
  StyledZoneKey,
} from '../types/scolarite';
import { QrCodeCanvas } from './QrCodeCanvas';
import { BODY_FONT_CLASS, resolveHeaderFontStack } from './typography';

export type DocumentZoneTarget =
  | 'header'
  | 'reference'
  | 'title'
  | 'body'
  | 'signature'
  | 'qr'
  | 'footer'
  | 'legalMention'
  | 'cardFront'
  | 'cardBack'
  | 'cardPhoto';

interface CertificateDocumentProps {
  record: EnrichedInscription;
  issueDate?: string;
  settings?: CertificateSettings;
  /** Modèle défini dans la page Administration (certificat par défaut) */
  template?: DocumentTemplate;
  /** Facteur d'échelle du texte (impression 2 certificats par feuille) */
  scale?: number;
  /** Multiplicateur du QR code pour rester lisible en impression réduite */
  qrBoost?: number;
  /** Jeton forcé (certificat en cours d'émission) */
  token?: string;
  /** Masque l'en-tête institutionnel (éditeur pleine page) */
  hideHeader?: boolean;
  /** Masque le pied de page (éditeur pleine page) */
  hideFooter?: boolean;
  /** Rendu « dans la page » : pas de marge interne ni d'ombre */
  embedded?: boolean;
  /** Mode interactif du studio : clic sur une zone pour l'inspecter */
  onSelectZone?: (zone: DocumentZoneTarget) => void;
  activeZone?: DocumentZoneTarget | null;
  /** Sélection & édition directe sur toute la page dans le studio */
  pageSelection?: PageElementSelection | null;
  onSelectPageElement?: (sel: PageElementSelection | null) => void;
  onUpdateHeaderLineText?: (lineId: string, text: string) => void;
  onAddHeaderLine?: () => void;
  onUpdateReference?: (patch: {
    referenceTemplate?: string;
    matriculeLabel?: string;
  }) => void;
  onUpdateTitleText?: (title: string) => void;
  onUpdateBodyText?: (patch: {
    template?: string;
    intro?: string;
    closing?: string;
  }) => void;
  onUpdateFreeZoneText?: (zoneId: string, text: string) => void;
  onAddFreeZone?: () => void;
  onUpdateSignatureText?: (patch: {
    datePhraseTemplate?: string;
    title?: string;
    name?: string;
  }) => void;
  onUpdateFooterText?: (patch: {
    address?: string;
    contacts?: string;
    note?: string;
  }) => void;
  onUpdateLegalMention?: (legalMention: string) => void;
  onUpdateZonePosition?: (
    zoneKey: StyledZoneKey,
    offsetX: number,
    offsetY: number
  ) => void;
  onUpdateFreeZonePosition?: (
    zoneId: string,
    offsetX: number,
    offsetY: number
  ) => void;
  onRestoreSection?: (section: CertificateSectionKey | 'qr') => void;
}

/** Piles de polices web utilisées pour toute la feuille (en-tête compris). */
const FONT_STACK: Record<BodyFontFamily, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  display: '"Poppins", "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

const FONT_CLASS: Record<DocumentTemplate['appearance']['fontFamily'], string> = {
  sans: 'font-sans',
  display: 'font-display',
  mono: 'font-mono',
};

const ALIGN_CLASS: Record<PageTextAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

export function CertificateDocument({
  record,
  issueDate,
  settings,
  template,
  scale = 1,
  qrBoost = 1,
  token,
  hideHeader = false,
  hideFooter = false,
  embedded = false,
  onSelectZone,
  activeZone,
  pageSelection,
  onSelectPageElement,
  onUpdateHeaderLineText,
  onAddHeaderLine,
  onUpdateReference,
  onUpdateTitleText,
  onUpdateBodyText,
  onUpdateFreeZoneText,
  onAddFreeZone,
  onUpdateSignatureText,
  onUpdateFooterText,
  onUpdateLegalMention,
  onUpdateZonePosition,
  onUpdateFreeZonePosition,
  onRestoreSection,
}: CertificateDocumentProps) {
  const [bodyEditRaw, setBodyEditRaw] = useState(true);
  const articleRef = useRef<HTMLElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    targetKey: string;
    x: number;
    y: number;
  } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const tpl = template ?? DEFAULT_DOCUMENT_TEMPLATES.certificat;
  const { blocks, appearance, texts, qr } = tpl;
  const layout: DocumentLayoutConfig =
    tpl.layout ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.layout;

  const isFemale = (record.sexeNormalized ?? normalizeSex(record.sexe)) === 'F';
  const resolvedDate =
    issueDate || settings?.issueDate || record.dateDelivrance;
  const todayFR = resolvedDate
    ? formatDateFR(resolvedDate)
    : new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

  const signatoryTitle =
    settings?.signatoryTitle?.trim() ||
    tpl.signature.title ||
    'Le Responsable de la Scolarité Centrale';
  const signatoryName = settings?.signatoryName?.trim() || tpl.signature.name;
  const showFiliation = (settings?.showFiliation ?? true) && blocks.filiation;

  const refCode =
    record.reference || record.numInscription || String(record.idInscription);
  const qrPayload = buildCertificateQrPayload(record, tpl, { token });
  const qrPx = Math.round(getQrPixelSize(tpl) * qrBoost);

  const variables = buildCertificateVariables(record, tpl, {
    token,
    numeroCertificat: record.numeroCertificat,
    dateDelivrance: record.dateDelivrance,
    signataireTitre: signatoryTitle,
    signataireNom: signatoryName,
  });
  const extendedVars: Record<string, string> = {
    ...variables,
    reference: refCode,
    lieu: tpl.signature.place || 'Toliara',
    date: todayFR,
  };

  const phraseMode = (tpl.body.mode ?? 'phrase') !== 'table';
  const bodyStyle = tpl.body.style ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;
  const headerCharStyle = {
    fontWeight: bodyStyle.bold ? 700 : undefined,
    fontStyle: bodyStyle.italic ? 'italic' : undefined,
    textDecoration: bodyStyle.underline ? 'underline' : undefined,
    textTransform: bodyStyle.uppercase ? ('uppercase' as const) : undefined,
  };

  const isStudioInteractive = Boolean(onSelectPageElement);

  const getVisualZoomRatio = (): number => {
    const el = articleRef.current;
    if (!el || !el.offsetWidth) return 1;
    const rectWidth = el.getBoundingClientRect().width;
    const ratio = rectWidth / el.offsetWidth;
    return ratio > 0.1 ? ratio : 1;
  };

  const startElementDrag = (
    e: React.PointerEvent,
    targetKey: string,
    initialX: number,
    initialY: number,
    onCommit: (x: number, y: number) => void,
    ignoreInputs = true
  ) => {
    if (!isStudioInteractive || e.button !== 0) return;
    if (ignoreInputs) {
      const targetEl = e.target as HTMLElement | null;
      const interactiveAncestor = targetEl?.closest(
        'input, textarea, select, button:not([data-drag-handle="true"])'
      );
      if (interactiveAncestor) return;
    }
    e.stopPropagation();
    e.preventDefault();

    dragCleanupRef.current?.();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const visualZoom = getVisualZoomRatio();
    let latestX = Math.round(initialX);
    let latestY = Math.round(initialY);
    let moved = false;

    const handleMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startClientX) / visualZoom);
      const dy = Math.round((ev.clientY - startClientY) / visualZoom);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        moved = true;
      }
      latestX = Math.max(-500, Math.min(500, Math.round(initialX + dx)));
      latestY = Math.max(-500, Math.min(500, Math.round(initialY + dy)));
      setDragPreview({ targetKey, x: latestX, y: latestY });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      dragCleanupRef.current = null;
    };

    const handleUp = () => {
      cleanup();
      setDragPreview(null);
      if (moved) {
        onCommit(latestX, latestY);
      }
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const getZoneOffset = (zoneKey: StyledZoneKey): { x: number; y: number } => {
    if (dragPreview && dragPreview.targetKey === zoneKey) {
      return { x: dragPreview.x, y: dragPreview.y };
    }
    const custom = layout.elementStyles?.[zoneKey];
    return {
      x: custom?.offsetX ?? 0,
      y: custom?.offsetY ?? 0,
    };
  };

  const getFreeZoneOffset = (
    zone: DocumentFreeZone
  ): { x: number; y: number } => {
    const key = `freeZone:${zone.id}`;
    if (dragPreview && dragPreview.targetKey === key) {
      return { x: dragPreview.x, y: dragPreview.y };
    }
    return {
      x: zone.offsetX ?? 0,
      y: zone.offsetY ?? 0,
    };
  };

  const getZoneStyle = (
    zoneKey: StyledZoneKey,
    defaults: Partial<ElementTypography> & { fontSizeEm?: number }
  ): CSSProperties => {
    const custom = layout.elementStyles?.[zoneKey];
    const offset = getZoneOffset(zoneKey);
    const fontFamily = custom?.fontFamily
      ? resolveHeaderFontStack(custom.fontFamily)
      : defaults.fontFamily
        ? resolveHeaderFontStack(defaults.fontFamily)
        : undefined;
    const fontSize =
      custom?.fontSize && custom.fontSize > 0
        ? `${Math.round(custom.fontSize * scale * 10) / 10}px`
        : defaults.fontSizeEm
          ? `${defaults.fontSizeEm}em`
          : undefined;
    const bold = custom?.bold ?? defaults.bold;
    const italic = custom?.italic ?? defaults.italic;
    const underline = custom?.underline ?? defaults.underline;
    const uppercase = custom?.uppercase ?? defaults.uppercase;
    const align = custom?.align ?? defaults.align;
    const color = custom?.color || defaults.color;

    return {
      fontFamily,
      fontSize,
      fontWeight: bold === undefined ? undefined : bold ? 700 : 400,
      fontStyle: italic === undefined ? undefined : italic ? 'italic' : 'normal',
      textDecoration:
        underline === undefined ? undefined : underline ? 'underline' : 'none',
      textTransform:
        uppercase === undefined ? undefined : uppercase ? 'uppercase' : 'none',
      textAlign: align,
      color,
      position: offset.x || offset.y ? 'relative' : undefined,
      left: offset.x ? `${Math.round(offset.x * scale * 10) / 10}px` : undefined,
      top: offset.y ? `${Math.round(offset.y * scale * 10) / 10}px` : undefined,
      zIndex: offset.x || offset.y ? 15 : undefined,
    };
  };

  const bodyCustom = layout.elementStyles?.body;
  const bodyOffset = getZoneOffset('body');
  const bodyInlineStyle: CSSProperties = {
    fontFamily: bodyCustom?.fontFamily
      ? resolveHeaderFontStack(bodyCustom.fontFamily)
      : undefined,
    fontSize:
      bodyCustom?.fontSize && bodyCustom.fontSize > 0
        ? `${Math.round(bodyCustom.fontSize * scale * 10) / 10}px`
        : bodyStyle.fontSize
          ? `${bodyStyle.fontSize * scale}px`
          : '0.98em',
    fontWeight: (bodyCustom?.bold ?? bodyStyle.bold) ? 700 : undefined,
    fontStyle: (bodyCustom?.italic ?? bodyStyle.italic) ? 'italic' : undefined,
    textDecoration: (bodyCustom?.underline ?? bodyStyle.underline)
      ? 'underline'
      : undefined,
    textTransform: (bodyCustom?.uppercase ?? bodyStyle.uppercase)
      ? ('uppercase' as const)
      : undefined,
    textAlign: bodyCustom?.align ?? bodyStyle.align,
    lineHeight: bodyStyle.lineHeight || 1.5,
    tabSize: 4,
  };
  const renderedBody = renderCertificateBody(tpl.body.template, extendedVars);
  const hasCustomBody = renderedBody.trim().length > 0;
  const bodyText = (
    hasCustomBody
      ? renderedBody
      : phraseMode
        ? renderCertificateBody(DEFAULT_CERTIFICATE_PHRASE, extendedVars)
        : ''
  ).replace(/\n+$/, '');

  const activeFields = tpl.fields.filter((field) => field.enabled);
  const activeRows = tpl.rows.filter((row) => row.enabled);

  const dividerColor = layout.headerDividerColor || appearance.accentColor;
  const logoSize = Math.max(32, Math.round((layout.logoSizePx || 80) * scale));
  const secondaryLogoSize = Math.max(
    24,
    Math.round((layout.secondaryLogoSizePx || 40) * scale)
  );

  const selectedHeaderLineId =
    pageSelection?.kind === 'headerLine' ? pageSelection.id : null;

  const isZoneElementActive = (zone: DocumentZoneTarget): boolean => {
    if (!pageSelection) return activeZone === zone;
    if (zone === 'header') return pageSelection.kind === 'headerLine';
    if (zone === 'reference') return pageSelection.kind === 'reference';
    if (zone === 'title') return pageSelection.kind === 'title';
    if (zone === 'body') return pageSelection.kind === 'body';
    if (zone === 'signature') return pageSelection.kind === 'signature';
    if (zone === 'qr') return pageSelection.kind === 'qr';
    if (zone === 'footer') return pageSelection.kind === 'footer';
    if (zone === 'legalMention') return pageSelection.kind === 'legalMention';
    return activeZone === zone;
  };

  const mapZoneToSelection = (
    zone: DocumentZoneTarget
  ): PageElementSelection | null => {
    if (zone === 'header') {
      const firstId = getResolvedHeaderLines(tpl.header)[0]?.id;
      return firstId ? { kind: 'headerLine', id: firstId } : null;
    }
    if (
      zone === 'reference' ||
      zone === 'title' ||
      zone === 'body' ||
      zone === 'signature' ||
      zone === 'qr' ||
      zone === 'footer' ||
      zone === 'legalMention'
    ) {
      return { kind: zone };
    }
    return null;
  };

  const wrapInteractive = (
    zone: DocumentZoneTarget,
    label: string,
    node: React.ReactNode
  ) => {
    if (!onSelectZone || !node) return node;
    const isElementHighlighted =
      Boolean(pageSelection) && isZoneElementActive(zone);
    const showBlueRing = !isElementHighlighted && activeZone === zone;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onSelectZone(zone);
          const mapped = mapZoneToSelection(zone);
          if (mapped && onSelectPageElement) onSelectPageElement(mapped);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onSelectZone(zone);
            const mapped = mapZoneToSelection(zone);
            if (mapped && onSelectPageElement) onSelectPageElement(mapped);
          }
        }}
        className={`group/zone relative rounded transition-colors cursor-pointer ${
          showBlueRing
            ? 'ring-2 ring-blue-500 ring-offset-2'
            : isElementHighlighted
              ? ''
              : 'hover:ring-1 hover:ring-emerald-400/70 hover:ring-offset-2'
        }`}
        title={`Cliquer pour modifier : ${label}`}
      >
        <span
          className={`no-print pointer-events-none absolute -top-2.5 right-1 px-1.5 py-0.5 text-[9px] font-medium rounded text-white transition-opacity z-10 ${
            isElementHighlighted
              ? 'bg-emerald-600 opacity-100'
              : showBlueRing
                ? 'bg-blue-600 opacity-100'
                : 'bg-emerald-600 opacity-0 group-hover/zone:opacity-100'
          }`}
        >
          {label}
        </span>
        {node}
      </div>
    );
  };

  const renderDragHandle = (
    label: string,
    targetKey: string,
    offset: { x: number; y: number },
    onCommit: (x: number, y: number) => void
  ) => {
    if (!isStudioInteractive || !onUpdateZonePosition) return null;
    return (
      <button
        type="button"
        data-drag-handle="true"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) =>
          startElementDrag(e, targetKey, offset.x, offset.y, onCommit, false)
        }
        title="Cliquer et glisser pour déplacer librement sur la page"
        className="no-print inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-600 text-white rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-emerald-700 select-none"
      >
        <Move className="w-3 h-3" />
        <span>{label}</span>
      </button>
    );
  };

  const renderFreeZones = (position: DocumentFreeZone['position']) => {
    const zones = (layout.freeZones ?? []).filter(
      (z) =>
        z.enabled &&
        z.position === position &&
        (isStudioInteractive || z.text.trim())
    );
    if (zones.length === 0) return null;
    return (
      <div className="space-y-2 my-3">
        {zones.map((zone) => {
          const isSelected =
            pageSelection?.kind === 'freeZone' && pageSelection.id === zone.id;
          const rendered = renderCertificateBody(zone.text, extendedVars);
          const fzOffset = getFreeZoneOffset(zone);
          const zoneStyle: CSSProperties = {
            fontFamily: zone.fontFamily
              ? resolveHeaderFontStack(zone.fontFamily)
              : undefined,
            fontSize: zone.fontSize ? `${zone.fontSize * scale}px` : '0.86em',
            fontWeight: zone.bold ? 700 : 400,
            fontStyle: zone.italic ? 'italic' : 'normal',
            textDecoration: zone.underline ? 'underline' : 'none',
            textTransform: zone.uppercase ? 'uppercase' : 'none',
            textAlign: zone.align,
            color: zone.color || undefined,
            tabSize: 4,
            position: fzOffset.x || fzOffset.y ? 'relative' : undefined,
            left: fzOffset.x
              ? `${Math.round(fzOffset.x * scale * 10) / 10}px`
              : undefined,
            top: fzOffset.y
              ? `${Math.round(fzOffset.y * scale * 10) / 10}px`
              : undefined,
            zIndex: fzOffset.x || fzOffset.y ? 15 : undefined,
          };

          if (isStudioInteractive && isSelected) {
            return (
              <div
                key={zone.id}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) =>
                  onUpdateFreeZonePosition &&
                  startElementDrag(
                    e,
                    `freeZone:${zone.id}`,
                    fzOffset.x,
                    fzOffset.y,
                    (x, y) => onUpdateFreeZonePosition(zone.id, x, y)
                  )
                }
                style={zoneStyle}
                className="relative bg-emerald-50/75 border border-emerald-400/80 rounded-md px-2.5 py-1.5 transition-colors cursor-grab active:cursor-grabbing"
              >
                {onUpdateFreeZonePosition && (
                  <div className="no-print absolute -top-5 left-1 z-20">
                    <button
                      type="button"
                      data-drag-handle="true"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) =>
                        startElementDrag(
                          e,
                          `freeZone:${zone.id}`,
                          fzOffset.x,
                          fzOffset.y,
                          (x, y) => onUpdateFreeZonePosition(zone.id, x, y),
                          false
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-600 text-white rounded shadow-sm cursor-grab active:cursor-grabbing select-none"
                    >
                      <Move className="w-3 h-3" />
                      <span>Déplacer</span>
                    </button>
                  </div>
                )}
                <textarea
                  rows={Math.max(2, zone.text.split('\n').length)}
                  value={zone.text}
                  onChange={(e) => onUpdateFreeZoneText?.(zone.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const target = e.currentTarget;
                      const start = target.selectionStart ?? zone.text.length;
                      const end = target.selectionEnd ?? zone.text.length;
                      const nextText = `${zone.text.slice(0, start)}\t${zone.text.slice(end)}`;
                      onUpdateFreeZoneText?.(zone.id, nextText);
                      requestAnimationFrame(() => {
                        target.selectionStart = start + 1;
                        target.selectionEnd = start + 1;
                      });
                    }
                  }}
                  placeholder="Texte ou variables {{nom_complet}}, {{annee_scolaire}}..."
                  aria-label={zone.label || 'Bloc libre'}
                  style={{ textAlign: zone.align, tabSize: 4 }}
                  className="w-full bg-transparent outline-none resize-y leading-snug cursor-text"
                />
              </div>
            );
          }

          return (
            <div
              key={zone.id}
              onClick={
                isStudioInteractive
                  ? (e) => {
                      e.stopPropagation();
                      onSelectZone?.('body');
                      onSelectPageElement?.({ kind: 'freeZone', id: zone.id });
                    }
                  : undefined
              }
              className={`${ALIGN_CLASS[zone.align]} whitespace-pre-wrap ${
                zone.boxed
                  ? 'border border-slate-300 rounded px-3 py-2 bg-slate-50/50'
                  : ''
              } ${
                isStudioInteractive
                  ? 'rounded-md px-2 py-0.5 hover:bg-emerald-50/40 hover:outline hover:outline-1 hover:outline-emerald-300/70 cursor-text transition-colors'
                  : ''
              }`}
              style={zoneStyle}
            >
              {rendered || (
                <span className="text-slate-400 italic font-normal">
                  Bloc vide (cliquer pour saisir)
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const qrOffset = getZoneOffset('qr');
  const isQrSelected = isStudioInteractive && pageSelection?.kind === 'qr';
  const qrStyle: CSSProperties = {
    position: qrOffset.x || qrOffset.y || isQrSelected ? 'relative' : undefined,
    left: qrOffset.x ? `${Math.round(qrOffset.x * scale * 10) / 10}px` : undefined,
    top: qrOffset.y ? `${Math.round(qrOffset.y * scale * 10) / 10}px` : undefined,
    zIndex: isQrSelected ? 25 : qrOffset.x || qrOffset.y ? 15 : undefined,
  };

  const qrBlock = (
    <div
      style={qrStyle}
      className={`flex flex-col items-center gap-1 transition-colors ${
        isQrSelected
          ? 'bg-emerald-50/75 border border-emerald-400/80 rounded-md p-1.5 cursor-grab active:cursor-grabbing'
          : isStudioInteractive
            ? 'rounded-md p-1 hover:bg-emerald-50/40 hover:outline hover:outline-1 hover:outline-emerald-300/70 cursor-pointer'
            : ''
      }`}
      onClick={(e) => {
        if (!onSelectZone && !onSelectPageElement) return;
        e.stopPropagation();
        onSelectZone?.('qr');
        onSelectPageElement?.({ kind: 'qr' });
      }}
      onPointerDown={(e) => {
        if (!isQrSelected || !onUpdateZonePosition) return;
        startElementDrag(e, 'qr', qrOffset.x, qrOffset.y, (x, y) =>
          onUpdateZonePosition('qr', x, y)
        );
      }}
      title={isStudioInteractive ? 'Cliquer ou glisser pour déplacer le QR code' : undefined}
    >
      {isQrSelected && onUpdateZonePosition && (
        <div className="no-print absolute -top-5 left-0 z-30">
          {renderDragHandle('Déplacer QR', 'qr', qrOffset, (x, y) =>
            onUpdateZonePosition('qr', x, y)
          )}
        </div>
      )}
      <QrCodeCanvas value={qrPayload} size={qrPx} />
      {qr.showLabel && qr.label && (
        <p className="text-[0.62em] text-slate-500 text-center leading-tight max-w-[140px]">
          {qr.label}
        </p>
      )}
    </div>
  );

  const dateLine = renderCertificateBody(
    layout.datePhraseTemplate || 'Fait à {{lieu}}, le {{date}}',
    extendedVars
  );
  const sigOffset = getZoneOffset('signature');
  const sigStyle = getZoneStyle('signature', {
    align: 'center',
  });
  const isSignatureSelected = pageSelection?.kind === 'signature';

  const signatureBlock = blocks.signature && (
    <div
      className={`min-w-[210px] space-y-2.5 ${
        isStudioInteractive && isSignatureSelected
          ? 'relative bg-emerald-50/75 border border-emerald-400/80 rounded-md px-3 py-2.5 cursor-grab active:cursor-grabbing z-20'
          : isStudioInteractive
            ? 'rounded-md px-2 py-1 hover:bg-emerald-50/40 hover:outline hover:outline-1 hover:outline-emerald-300/70 cursor-pointer transition-colors'
            : ''
      }`}
      style={sigStyle}
      onClick={(e) => {
        if (!isStudioInteractive) return;
        e.stopPropagation();
        onSelectZone?.('signature');
        onSelectPageElement?.({ kind: 'signature' });
      }}
      onPointerDown={(e) => {
        if (!isSignatureSelected || !onUpdateZonePosition) return;
        startElementDrag(
          e,
          'signature',
          sigOffset.x,
          sigOffset.y,
          (x, y) => onUpdateZonePosition('signature', x, y)
        );
      }}
      title={
        isStudioInteractive
          ? 'Cliquer pour modifier ou glisser pour déplacer la signature'
          : undefined
      }
    >
      {isStudioInteractive && isSignatureSelected && onUpdateZonePosition && (
        <div className="no-print absolute -top-5 left-2 z-30 flex items-center gap-1.5">
          {renderDragHandle('Déplacer', 'signature', sigOffset, (x, y) =>
            onUpdateZonePosition('signature', x, y)
          )}
        </div>
      )}

      {tpl.signature.showDate &&
        (isStudioInteractive && isSignatureSelected ? (
          <input
            type="text"
            value={layout.datePhraseTemplate}
            onChange={(e) =>
              onUpdateSignatureText?.({ datePhraseTemplate: e.target.value })
            }
            onClick={(e) => e.stopPropagation()}
            placeholder="Fait à {{lieu}}, le {{date}}"
            aria-label="Phrase de date"
            style={{ textAlign: sigStyle.textAlign }}
            className="w-full bg-transparent border-b border-emerald-300/70 pb-0.5 text-[0.85em] outline-none cursor-text"
          />
        ) : (
          <p className="text-[0.85em]">{dateLine}</p>
        ))}

      {tpl.signature.showImage && tpl.signature.imageUrl && (
        <img
          src={tpl.signature.imageUrl}
          alt="Signature et cachet"
          style={{
            height: `${Math.max(24, Math.round((layout.signatureImageHeightPx || 64) * scale))}px`,
          }}
          className="mx-auto object-contain pointer-events-none"
        />
      )}

      <div className="border-t border-slate-400 pt-1.5 text-[0.8em]">
        {isStudioInteractive && isSignatureSelected ? (
          <div className="space-y-1">
            <input
              type="text"
              value={tpl.signature.title}
              onChange={(e) =>
                onUpdateSignatureText?.({ title: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              placeholder="Titre du signataire"
              aria-label="Titre du signataire"
              style={{ textAlign: sigStyle.textAlign }}
              className="w-full bg-transparent font-semibold border-b border-emerald-300/70 outline-none cursor-text"
            />
            <input
              type="text"
              value={tpl.signature.name}
              onChange={(e) =>
                onUpdateSignatureText?.({ name: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              placeholder="Nom du signataire (optionnel)"
              aria-label="Nom du signataire"
              style={{ textAlign: sigStyle.textAlign }}
              className="w-full bg-transparent text-slate-600 outline-none cursor-text"
            />
          </div>
        ) : (
          <>
            <p className="font-semibold">{signatoryTitle}</p>
            {signatoryName && (
              <p className="mt-0.5 font-normal text-slate-600">
                {signatoryName}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderHeader = () => {
    if (!blocks.header || hideHeader) return null;

    const resolvedLines = getResolvedHeaderLines(tpl.header);
    const visibleLines = isStudioInteractive
      ? resolvedLines
      : resolvedLines.filter((line) => line.text.trim().length > 0);
    const minimalMainLine =
      resolvedLines.find((line) => line.id === 'h4' && line.text.trim()) ??
      resolvedLines.find((line) => line.text.trim());
    const minimalSubLine = resolvedLines.find(
      (line) => line.id !== minimalMainLine?.id && line.text.trim()
    );

    const headerLines = (
      <div className="space-y-0.5">
        {visibleLines.map((line) => {
          const isLineSelected =
            isStudioInteractive && selectedHeaderLineId === line.id;
          const lineStyle: CSSProperties = {
            fontFamily: resolveHeaderFontStack(line.fontFamily),
            fontSize: `${Math.max(8, Math.round((line.fontSize || 11) * scale * 10) / 10)}px`,
            fontWeight: line.bold ? 700 : 400,
            fontStyle: line.italic ? 'italic' : 'normal',
            textDecoration: line.underline ? 'underline' : 'none',
            textAlign:
              line.align || (layout.headerLayout === 'left' ? 'left' : 'center'),
            textTransform: line.uppercase ? 'uppercase' : undefined,
            color: line.color
              ? line.color
              : line.id === 'h4'
                ? appearance.accentColor
                : undefined,
            lineHeight: 1.35,
          };

          if (isStudioInteractive) {
            if (isLineSelected) {
              return (
                <div
                  key={line.id}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-emerald-50/75 border border-emerald-400/80 rounded-md px-2 py-0.5 transition-colors"
                >
                  <input
                    type="text"
                    value={line.text}
                    onChange={(e) =>
                      onUpdateHeaderLineText?.(line.id, e.target.value)
                    }
                    placeholder="Saisir le texte de la ligne..."
                    aria-label={line.label || "Ligne d'en-tête"}
                    style={lineStyle}
                    className="w-full bg-transparent outline-none"
                  />
                </div>
              );
            }
            return (
              <button
                key={line.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectZone?.('header');
                  onSelectPageElement?.({ kind: 'headerLine', id: line.id });
                }}
                style={lineStyle}
                title="Cliquer pour modifier cette ligne"
                className="w-full block rounded-md px-2 py-0.5 hover:bg-emerald-50/40 hover:outline hover:outline-1 hover:outline-emerald-300/70 transition-colors cursor-text"
              >
                {line.text || (
                  <span className="text-slate-400 italic font-normal">
                    Ligne vide (cliquer pour saisir)
                  </span>
                )}
              </button>
            );
          }

          return (
            <p key={line.id} style={lineStyle}>
              {line.text}
            </p>
          );
        })}

        {tpl.footer.showFooter &&
          tpl.footer.address &&
          layout.headerLayout !== 'minimal' && (
            <p
              className={`text-[0.65em] text-slate-500 pt-0.5 ${
                layout.headerLayout === 'left' ? 'text-left' : 'text-center'
              }`}
              style={headerCharStyle}
            >
              {tpl.footer.address}
              {tpl.footer.contacts ? ` · ${tpl.footer.contacts}` : ''}
            </p>
          )}

        {onAddHeaderLine && (
          <div
            className={`no-print pt-1.5 flex ${
              layout.headerLayout === 'left' ? 'justify-start' : 'justify-center'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectZone?.('header');
                onAddHeaderLine();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-600 bg-white border border-dashed border-slate-300 rounded-md hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/40 transition-colors"
            >
              <Plus className="w-3 h-3" /> Ajouter une ligne
            </button>
          </div>
        )}
      </div>
    );

    const dividerStyle = layout.showHeaderDivider
      ? { borderBottom: `2px solid ${dividerColor}` }
      : undefined;

    let content: React.ReactNode;
    if (layout.headerLayout === 'centered') {
      content = (
        <div
          className="pb-4 relative flex flex-col items-center gap-2.5"
          style={dividerStyle}
        >
          <div className="flex items-center justify-center gap-4">
            {tpl.header.showLogo && tpl.header.logoUrl && (
              <img
                src={tpl.header.logoUrl}
                alt="Logo institutionnel"
                referrerPolicy="no-referrer"
                style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
                className="object-contain"
              />
            )}
            {tpl.header.showSecondaryLogo && tpl.header.secondaryLogoUrl && (
              <img
                src={tpl.header.secondaryLogoUrl}
                alt="Logo secondaire"
                referrerPolicy="no-referrer"
                style={{
                  width: `${secondaryLogoSize}px`,
                  height: `${secondaryLogoSize}px`,
                }}
                className="object-contain opacity-90"
              />
            )}
            {qr.enabled && qr.position === 'header' && qrBlock}
          </div>
          <div className="w-full">{headerLines}</div>
        </div>
      );
    } else if (layout.headerLayout === 'left') {
      content = (
        <div
          className="flex items-center justify-between gap-4 pb-4 relative"
          style={dividerStyle}
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {tpl.header.showLogo && tpl.header.logoUrl && (
              <img
                src={tpl.header.logoUrl}
                alt="Logo institutionnel"
                referrerPolicy="no-referrer"
                style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
                className="object-contain shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">{headerLines}</div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            {qr.enabled && qr.position === 'header' && qrBlock}
            {tpl.header.showSecondaryLogo && tpl.header.secondaryLogoUrl && (
              <img
                src={tpl.header.secondaryLogoUrl}
                alt="Logo secondaire"
                referrerPolicy="no-referrer"
                style={{
                  width: `${secondaryLogoSize}px`,
                  height: `${secondaryLogoSize}px`,
                }}
                className="object-contain opacity-85"
              />
            )}
          </div>
        </div>
      );
    } else if (layout.headerLayout === 'minimal') {
      content = (
        <div
          className="flex items-center justify-between gap-3 pb-3 relative"
          style={dividerStyle}
        >
          <div className="flex items-center gap-3 min-w-0">
            {tpl.header.showLogo && tpl.header.logoUrl && (
              <img
                src={tpl.header.logoUrl}
                alt="Logo institutionnel"
                referrerPolicy="no-referrer"
                style={{
                  width: `${Math.round(logoSize * 0.65)}px`,
                  height: `${Math.round(logoSize * 0.65)}px`,
                }}
                className="object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              {minimalMainLine && (
                <h2
                  className="text-[1.1em] font-bold uppercase font-display truncate"
                  style={{
                    color: minimalMainLine.color || appearance.accentColor,
                    fontFamily: resolveHeaderFontStack(minimalMainLine.fontFamily),
                  }}
                >
                  {minimalMainLine.text}
                </h2>
              )}
              {minimalSubLine && (
                <p
                  className="text-[0.72em] text-slate-600 truncate"
                  style={{
                    fontFamily: resolveHeaderFontStack(minimalSubLine.fontFamily),
                  }}
                >
                  {minimalSubLine.text}
                </p>
              )}
            </div>
          </div>
          {qr.enabled && qr.position === 'header' && qrBlock}
        </div>
      );
    } else {
      content = (
        <div
          className="flex items-start justify-between gap-4 pb-5 relative"
          style={dividerStyle}
        >
          <div className="w-24 shrink-0 flex flex-col items-center">
            {tpl.header.showLogo && tpl.header.logoUrl && (
              <img
                src={tpl.header.logoUrl}
                alt="Logo institutionnel"
                referrerPolicy="no-referrer"
                style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
                className="object-contain"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">{headerLines}</div>

          <div className="w-24 shrink-0 flex flex-col items-center justify-center gap-2">
            {qr.enabled && qr.position === 'header' && qrBlock}
            {tpl.header.showSecondaryLogo && tpl.header.secondaryLogoUrl && (
              <img
                src={tpl.header.secondaryLogoUrl}
                alt="Logo secondaire"
                referrerPolicy="no-referrer"
                style={{
                  width: `${secondaryLogoSize}px`,
                  height: `${secondaryLogoSize}px`,
                }}
                className="object-contain opacity-80"
              />
            )}
          </div>
        </div>
      );
    }

    return wrapInteractive('header', 'En-tête & Logos', content);
  };

  const renderSection = (key: CertificateSectionKey) => {
    switch (key) {
      case 'reference': {
        if (!blocks.reference) return null;
        const refText = renderCertificateBody(
          layout.referenceTemplate ||
            'Réf : {{reference}}/MEsupRes/U. U/DSIN/Sco.Cent',
          extendedVars
        );
        const refOffset = getZoneOffset('reference');
        const refStyle = getZoneStyle('reference', {
          fontFamily: 'JetBrains Mono',
          fontSizeEm: 0.78,
          align: 'left',
        });
        const isRefSelected =
          isStudioInteractive && pageSelection?.kind === 'reference';

        return wrapInteractive(
          'reference',
          'Référence',
          isRefSelected ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) =>
                onUpdateZonePosition &&
                startElementDrag(e, 'reference', refOffset.x, refOffset.y, (x, y) =>
                  onUpdateZonePosition('reference', x, y)
                )
              }
              className="relative mt-3 mb-3 bg-emerald-50/75 border border-emerald-400/80 rounded-md px-3 py-2 space-y-1.5 cursor-grab active:cursor-grabbing"
              style={refStyle}
            >
              {onUpdateZonePosition && (
                <div className="no-print absolute -top-5 left-2 z-20">
                  {renderDragHandle('Déplacer', 'reference', refOffset, (x, y) =>
                    onUpdateZonePosition('reference', x, y)
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  value={layout.referenceTemplate}
                  onChange={(e) =>
                    onUpdateReference?.({ referenceTemplate: e.target.value })
                  }
                  placeholder="Réf : {{reference}}/..."
                  aria-label="Gabarit de référence"
                  style={{ textAlign: refStyle.textAlign }}
                  className="flex-1 min-w-[200px] bg-transparent border-b border-emerald-300/70 outline-none font-medium"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={layout.matriculeLabel}
                    onChange={(e) =>
                      onUpdateReference?.({ matriculeLabel: e.target.value })
                    }
                    placeholder="Matricule :"
                    aria-label="Libellé du matricule"
                    className="w-28 bg-transparent border-b border-emerald-300/70 outline-none text-right"
                  />
                  <span className="font-semibold text-slate-900">
                    {record.numInscription}
                  </span>
                </div>
              </div>
              <p className="no-print text-[10px] text-emerald-700 font-sans">
                Aperçu : {refText}
              </p>
            </div>
          ) : (
            <div
              className="flex flex-wrap items-center justify-between gap-2 pt-4 pb-4 text-slate-700"
              style={refStyle}
            >
              <p className="tabular-nums font-medium">{refText}</p>
              {record.numInscription && (
                <p className="tabular-nums text-slate-600">
                  {layout.matriculeLabel || 'Matricule :'}{' '}
                  <span className="font-semibold text-slate-900">
                    {record.numInscription}
                  </span>
                </p>
              )}
            </div>
          )
        );
      }

      case 'title': {
        if (!blocks.title || (!texts.title && !isStudioInteractive)) return null;
        const customTitle = layout.elementStyles?.title;
        const titleOffset = getZoneOffset('title');
        const align =
          (customTitle?.align === 'left' ||
          customTitle?.align === 'center' ||
          customTitle?.align === 'right'
            ? customTitle.align
            : layout.titleAlign) ?? 'center';
        const titleUppercase =
          customTitle?.uppercase ?? layout.titleUppercase ?? true;
        const titleUnderline =
          customTitle?.underline ?? layout.titleUnderline ?? true;
        const titleStyle: CSSProperties = {
          fontFamily: customTitle?.fontFamily
            ? resolveHeaderFontStack(customTitle.fontFamily)
            : undefined,
          fontSize:
            customTitle?.fontSize && customTitle.fontSize > 0
              ? `${Math.round(customTitle.fontSize * scale * 10) / 10}px`
              : `${layout.titleSizeEm || 1.65}em`,
          fontWeight: customTitle?.bold === false ? 400 : 700,
          fontStyle: customTitle?.italic ? 'italic' : 'normal',
          textTransform: titleUppercase ? 'uppercase' : 'none',
          color: customTitle?.color || undefined,
          borderBottom: titleUnderline
            ? `2px solid ${appearance.accentColor}`
            : undefined,
          textAlign: align,
        };
        const titleContainerStyle: CSSProperties = {
          position: titleOffset.x || titleOffset.y ? 'relative' : undefined,
          left: titleOffset.x
            ? `${Math.round(titleOffset.x * scale * 10) / 10}px`
            : undefined,
          top: titleOffset.y
            ? `${Math.round(titleOffset.y * scale * 10) / 10}px`
            : undefined,
          zIndex: titleOffset.x || titleOffset.y ? 15 : undefined,
        };
        const isTitleSelected =
          isStudioInteractive && pageSelection?.kind === 'title';

        return wrapInteractive(
          'title',
          'Titre',
          <div className={`mb-6 ${ALIGN_CLASS[align]}`} style={titleContainerStyle}>
            {isTitleSelected ? (
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) =>
                  onUpdateZonePosition &&
                  startElementDrag(e, 'title', titleOffset.x, titleOffset.y, (x, y) =>
                    onUpdateZonePosition('title', x, y)
                  )
                }
                className="relative bg-emerald-50/75 border border-emerald-400/80 rounded-md px-3 py-1 cursor-grab active:cursor-grabbing"
              >
                {onUpdateZonePosition && (
                  <div className="no-print absolute -top-5 left-2 z-20">
                    {renderDragHandle('Déplacer', 'title', titleOffset, (x, y) =>
                      onUpdateZonePosition('title', x, y)
                    )}
                  </div>
                )}
                <input
                  type="text"
                  value={texts.title}
                  onChange={(e) => onUpdateTitleText?.(e.target.value)}
                  placeholder="Titre du document..."
                  aria-label="Titre du document"
                  style={titleStyle}
                  className="w-full bg-transparent outline-none pb-1 tracking-wide font-display cursor-text"
                />
              </div>
            ) : (
              <h1
                className={`inline-block tracking-wide font-display pb-1.5 ${
                  align === 'center' ? 'px-6' : 'pr-6'
                }`}
                style={titleStyle}
              >
                {texts.title || 'Titre du document'}
              </h1>
            )}
          </div>
        );
      }

      case 'body': {
        const isBodySelected =
          isStudioInteractive && pageSelection?.kind === 'body';

        const bodyContent = (
          <div
            style={{
              position: bodyOffset.x || bodyOffset.y ? 'relative' : undefined,
              left: bodyOffset.x
                ? `${Math.round(bodyOffset.x * scale * 10) / 10}px`
                : undefined,
              top: bodyOffset.y
                ? `${Math.round(bodyOffset.y * scale * 10) / 10}px`
                : undefined,
              zIndex: bodyOffset.x || bodyOffset.y ? 15 : undefined,
            }}
            onPointerDown={(e) => {
              if (!isBodySelected || !onUpdateZonePosition) return;
              startElementDrag(e, 'body', bodyOffset.x, bodyOffset.y, (x, y) =>
                onUpdateZonePosition('body', x, y)
              );
            }}
            className="relative space-y-4 leading-relaxed text-slate-800"
          >
            {isBodySelected && onUpdateZonePosition && (
              <div className="no-print absolute -top-5 left-2 z-20">
                {renderDragHandle('Déplacer', 'body', bodyOffset, (x, y) =>
                  onUpdateZonePosition('body', x, y)
                )}
              </div>
            )}
            {renderFreeZones('body')}
            {blocks.identity && (
              <>
                {!phraseMode &&
                  (isBodySelected ? (
                    <input
                      type="text"
                      value={texts.intro}
                      onChange={(e) =>
                        onUpdateBodyText?.({ intro: e.target.value })
                      }
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Phrase d'introduction..."
                      aria-label="Introduction"
                      className="w-full bg-emerald-50/75 border border-emerald-400/80 rounded px-2.5 py-1 text-[0.95em] outline-none"
                    />
                  ) : (
                    texts.intro && <p style={bodyInlineStyle}>{texts.intro}</p>
                  ))}

                {isBodySelected && phraseMode ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-emerald-50/75 border border-emerald-400/80 rounded-md p-2.5 space-y-2"
                  >
                    <div className="no-print flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                      <span className="font-medium text-emerald-800">
                        {bodyEditRaw
                          ? 'Édition directe du texte (espaces, alinéas et sauts de ligne conservés)'
                          : `Aperçu pour ${record.nom} ${record.prenom}`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {bodyEditRaw && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = tpl.body.template;
                              const el = bodyTextareaRef.current;
                              const start = el?.selectionStart ?? 0;
                              const end = el?.selectionEnd ?? start;
                              const nextText = `${current.slice(0, start)}\t${current.slice(end)}`;
                              onUpdateBodyText?.({ template: nextText });
                              requestAnimationFrame(() => {
                                if (!el) return;
                                el.focus();
                                el.selectionStart = start + 1;
                                el.selectionEnd = start + 1;
                              });
                            }}
                            title="Insérer un retrait (alinéa / tabulation)"
                            className="px-2 py-0.5 rounded border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 font-medium"
                          >
                            + Alinéa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setBodyEditRaw((v) => !v)}
                          className="px-2 py-0.5 rounded border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 font-medium"
                        >
                          {bodyEditRaw
                            ? 'Voir aperçu élève'
                            : 'Modifier le texte'}
                        </button>
                      </div>
                    </div>

                    {bodyEditRaw ? (
                      <textarea
                        ref={bodyTextareaRef}
                        rows={Math.max(
                          8,
                          (tpl.body.template || DEFAULT_CERTIFICATE_PHRASE).split(
                            '\n'
                          ).length + 2,
                          Math.ceil(
                            (tpl.body.template || DEFAULT_CERTIFICATE_PHRASE)
                              .length / 68
                          ) + 2
                        )}
                        value={tpl.body.template}
                        onChange={(e) =>
                          onUpdateBodyText?.({ template: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const target = e.currentTarget;
                            const start =
                              target.selectionStart ?? tpl.body.template.length;
                            const end =
                              target.selectionEnd ?? tpl.body.template.length;
                            const nextText = `${tpl.body.template.slice(0, start)}\t${tpl.body.template.slice(end)}`;
                            onUpdateBodyText?.({ template: nextText });
                            requestAnimationFrame(() => {
                              target.selectionStart = start + 1;
                              target.selectionEnd = start + 1;
                            });
                          }
                        }}
                        placeholder={DEFAULT_CERTIFICATE_PHRASE}
                        aria-label="Texte du corps du certificat"
                        style={bodyInlineStyle}
                        className={`w-full bg-transparent outline-none resize-y ${
                          BODY_FONT_CLASS[bodyStyle.fontFamily] ?? 'font-sans'
                        }`}
                      />
                    ) : (
                      <div
                        className={`whitespace-pre-wrap ${
                          BODY_FONT_CLASS[bodyStyle.fontFamily] ?? 'font-sans'
                        }`}
                        style={bodyInlineStyle}
                      >
                        {bodyText}
                      </div>
                    )}
                  </div>
                ) : (
                  bodyText.trim().length > 0 && (
                    <div
                      className={`whitespace-pre-wrap ${
                        BODY_FONT_CLASS[bodyStyle.fontFamily] ?? 'font-sans'
                      }`}
                      style={bodyInlineStyle}
                    >
                      {bodyText}
                    </div>
                  )
                )}

                {!phraseMode && activeFields.length > 0 && (
                  <div className="border border-slate-300 divide-y divide-slate-200 text-[0.92em]">
                    {activeFields.map((field, index) => {
                      const value = getCertificateFieldValue(record, field, {
                        numeroCertificat: record.numeroCertificat,
                        dateDelivrance: record.dateDelivrance,
                      });
                      return (
                        <div
                          key={field.id}
                          className={`grid grid-cols-12 px-4 py-1.5 ${
                            index % 2 === 1 ? 'bg-slate-50/60' : ''
                          }`}
                        >
                          <span className="col-span-5 font-semibold text-slate-700">
                            {field.label}
                          </span>
                          <span className="col-span-7 text-slate-900 break-words">
                            {value || '—'}
                          </span>
                        </div>
                      );
                    })}
                    {showFiliation &&
                      tpl.fields.some(
                        (f) => f.id === 'filiation' && !f.enabled
                      ) &&
                      (record.nomPere || record.nomMere) && (
                        <div className="grid grid-cols-12 px-4 py-1.5">
                          <span className="col-span-5 font-semibold text-slate-700">
                            Filiation
                          </span>
                          <span className="col-span-7 text-slate-900">
                            {record.nomPere ? `Père : ${record.nomPere}` : ''}
                            {record.nomPere && record.nomMere ? ' · ' : ''}
                            {record.nomMere ? `Mère : ${record.nomMere}` : ''}
                          </span>
                        </div>
                      )}
                  </div>
                )}

                {!phraseMode && (
                  <p className="font-medium text-slate-900 text-[0.95em]">
                    {isFemale
                      ? "Est inscrite régulièrement au sein de l'Université de Toliara pour l'Année Universitaire"
                      : "Est inscrit régulièrement au sein de l'Université de Toliara pour l'Année Universitaire"}{' '}
                    <span className="font-bold font-mono tabular-nums">
                      {record.annee}
                    </span>{' '}
                    :
                  </p>
                )}
              </>
            )}

            {!phraseMode && blocks.academicTable && activeRows.length > 0 && (
              <div className="border border-slate-300 divide-y divide-slate-200 text-[0.92em]">
                {activeRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`grid grid-cols-12 px-4 py-1.5 ${
                      index % 2 === 1 ? 'bg-slate-50/50' : ''
                    }`}
                  >
                    <span className="col-span-4 font-semibold text-slate-700">
                      {row.label}
                    </span>
                    <span
                      className={`col-span-8 ${
                        row.id === 'niveau' || row.id === 'mention'
                          ? 'font-bold'
                          : ''
                      } text-slate-900`}
                    >
                      {getDocumentRowValue(record, row.id) || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!phraseMode &&
              (isBodySelected ? (
                <input
                  type="text"
                  value={texts.closing}
                  onChange={(e) =>
                    onUpdateBodyText?.({ closing: e.target.value })
                  }
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Formule de clôture..."
                  aria-label="Formule de clôture"
                  className="w-full bg-emerald-50/75 border border-emerald-400/80 rounded px-2.5 py-1 text-[0.88em] outline-none"
                />
              ) : (
                texts.closing && (
                  <p
                    className="text-[0.88em] text-slate-700 pt-1"
                    style={bodyInlineStyle}
                  >
                    {texts.closing}
                  </p>
                )
              ))}
          </div>
        );
        return wrapInteractive('body', 'Corps du certificat', bodyContent);
      }

      case 'signatureQr': {
        if (!blocks.signature && (!blocks.qr || !qr.enabled)) return null;
        const customSigAlign = layout.elementStyles?.signature?.align;
        const sigAlign =
          (customSigAlign === 'left' ||
          customSigAlign === 'center' ||
          customSigAlign === 'right'
            ? customSigAlign
            : layout.signatureAlign) ?? 'right';
        const showLeftQr =
          blocks.qr &&
          qr.enabled &&
          (qr.position === 'bottom-left' || qr.position === 'beside-signature');
        const showRightQr =
          blocks.qr &&
          qr.enabled &&
          (qr.position === 'bottom-right' || qr.position === 'footer');

        let sigQrContent: React.ReactNode;
        if (sigAlign === 'left') {
          sigQrContent = (
            <div className="mt-6 pt-5 border-t border-slate-200 flex items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                {signatureBlock}
                {showLeftQr && qrBlock}
              </div>
              <div className="flex items-end gap-3">
                {showRightQr && qrBlock}
              </div>
            </div>
          );
        } else if (sigAlign === 'center') {
          sigQrContent = (
            <div className="mt-6 pt-5 border-t border-slate-200 flex items-end justify-between gap-4">
              <div className="w-28 flex justify-start">
                {showLeftQr && qrBlock}
              </div>
              <div className="flex-1 flex justify-center">{signatureBlock}</div>
              <div className="w-28 flex justify-end">
                {showRightQr && qrBlock}
              </div>
            </div>
          );
        } else {
          sigQrContent = (
            <div className="mt-6 pt-5 border-t border-slate-200 flex items-end justify-between gap-4">
              <div className="flex items-end gap-3">
                {showLeftQr && qrBlock}
              </div>
              <div className="flex items-end gap-4">
                {showRightQr && qrBlock}
                {signatureBlock}
              </div>
            </div>
          );
        }

        return wrapInteractive('signature', 'Signature & QR Code', sigQrContent);
      }

      case 'footer': {
        if (
          hideFooter ||
          !tpl.footer.showFooter ||
          (!isStudioInteractive &&
            !tpl.footer.address &&
            !tpl.footer.contacts &&
            !tpl.footer.note)
        ) {
          return null;
        }
        const footerOffset = getZoneOffset('footer');
        const footerStyle = getZoneStyle('footer', {
          fontSizeEm: 0.65,
          align: 'left',
          color: '#64748b',
        });
        const isFooterSelected =
          isStudioInteractive && pageSelection?.kind === 'footer';

        return wrapInteractive(
          'footer',
          'Pied de page',
          isFooterSelected ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) =>
                onUpdateZonePosition &&
                startElementDrag(e, 'footer', footerOffset.x, footerOffset.y, (x, y) =>
                  onUpdateZonePosition('footer', x, y)
                )
              }
              className="relative mt-4 bg-emerald-50/75 border border-emerald-400/80 rounded-md px-3 py-2 grid grid-cols-1 sm:grid-cols-3 gap-2 cursor-grab active:cursor-grabbing"
              style={footerStyle}
            >
              {onUpdateZonePosition && (
                <div className="no-print absolute -top-5 left-2 z-20">
                  {renderDragHandle('Déplacer', 'footer', footerOffset, (x, y) =>
                    onUpdateZonePosition('footer', x, y)
                  )}
                </div>
              )}
              <input
                type="text"
                value={tpl.footer.address}
                onChange={(e) =>
                  onUpdateFooterText?.({ address: e.target.value })
                }
                placeholder="Adresse..."
                aria-label="Adresse pied de page"
                className="bg-transparent border-b border-emerald-300/70 outline-none cursor-text"
              />
              <input
                type="text"
                value={tpl.footer.contacts}
                onChange={(e) =>
                  onUpdateFooterText?.({ contacts: e.target.value })
                }
                placeholder="Téléphone, e-mail..."
                aria-label="Contacts pied de page"
                className="bg-transparent border-b border-emerald-300/70 outline-none cursor-text"
              />
              <input
                type="text"
                value={tpl.footer.note}
                onChange={(e) =>
                  onUpdateFooterText?.({ note: e.target.value })
                }
                placeholder="Note de bas de page..."
                aria-label="Note pied de page"
                className="bg-transparent border-b border-emerald-300/70 outline-none cursor-text"
              />
            </div>
          ) : (
            <div
              className="mt-4 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2"
              style={footerStyle}
            >
              <span>
                {tpl.footer.address}
                {tpl.footer.address && tpl.footer.contacts ? ' · ' : ''}
                {tpl.footer.contacts}
              </span>
              <span>{tpl.footer.note}</span>
            </div>
          )
        );
      }

      case 'legalMention': {
        if (
          !blocks.legalMention ||
          (!texts.legalMention && !isStudioInteractive)
        ) {
          return null;
        }
        const legalOffset = getZoneOffset('legalMention');
        const legalStyle = getZoneStyle('legalMention', {
          fontSizeEm: 0.68,
          align: 'center',
          color: '#94a3b8',
        });
        const isLegalSelected =
          isStudioInteractive && pageSelection?.kind === 'legalMention';

        return wrapInteractive(
          'legalMention',
          'Mention légale',
          isLegalSelected ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) =>
                onUpdateZonePosition &&
                startElementDrag(
                  e,
                  'legalMention',
                  legalOffset.x,
                  legalOffset.y,
                  (x, y) => onUpdateZonePosition('legalMention', x, y)
                )
              }
              style={{
                position:
                  legalOffset.x || legalOffset.y ? 'relative' : undefined,
                left: legalOffset.x
                  ? `${Math.round(legalOffset.x * scale * 10) / 10}px`
                  : undefined,
                top: legalOffset.y
                  ? `${Math.round(legalOffset.y * scale * 10) / 10}px`
                  : undefined,
                zIndex: 15,
              }}
              className="relative mt-2 bg-emerald-50/75 border border-emerald-400/80 rounded-md px-2.5 py-1 cursor-grab active:cursor-grabbing"
            >
              {onUpdateZonePosition && (
                <div className="no-print absolute -top-5 left-2 z-20">
                  {renderDragHandle(
                    'Déplacer',
                    'legalMention',
                    legalOffset,
                    (x, y) => onUpdateZonePosition('legalMention', x, y)
                  )}
                </div>
              )}
              <input
                type="text"
                value={texts.legalMention}
                onChange={(e) => onUpdateLegalMention?.(e.target.value)}
                placeholder="Mention légale..."
                aria-label="Mention légale"
                style={{
                  ...legalStyle,
                  position: undefined,
                  left: undefined,
                  top: undefined,
                }}
                className="w-full bg-transparent outline-none cursor-text"
              />
            </div>
          ) : (
            <p className="mt-2" style={legalStyle}>
              {texts.legalMention || 'Mention légale'}
            </p>
          )
        );
      }

      default:
        return null;
    }
  };

  const borderStyleValue =
    appearance.borderStyle === 'none'
      ? 'none'
      : appearance.borderStyle === 'double'
        ? `${Math.max(3, layout.borderWidthPx || 4)}px double ${appearance.accentColor}`
        : `${Math.max(1, layout.borderWidthPx || 1)}px solid ${appearance.accentColor}`;

  const sectionOrder =
    layout.sectionOrder && layout.sectionOrder.length > 0
      ? layout.sectionOrder
      : DEFAULT_SECTION_ORDER;

  return (
    <article
      ref={articleRef}
      className={`text-slate-900 ${
        embedded
          ? 'p-0 shadow-none max-w-none'
          : 'shadow-sm max-w-[794px] mx-auto print:p-4 print:shadow-none'
      } print:border-0 print:break-inside-avoid relative overflow-hidden ${FONT_CLASS[appearance.fontFamily]}`}
      style={{
        backgroundColor: layout.backgroundColor || '#ffffff',
        border: embedded ? 'none' : borderStyleValue,
        borderRadius: embedded ? undefined : `${layout.borderRadiusPx ?? 2}px`,
        padding: embedded
          ? undefined
          : `${Math.round((layout.pagePaddingPx ?? 36) * scale)}px`,
        color: appearance.textColor,
        fontSize: `${appearance.fontSize * scale}px`,
        fontFamily: FONT_STACK[bodyStyle.fontFamily] ?? undefined,
      }}
    >
      {blocks.watermark && appearance.watermarkText && (
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] whitespace-nowrap font-display font-black uppercase tracking-widest"
          style={{
            color: appearance.accentColor,
            opacity: appearance.watermarkOpacity,
            fontSize: `${58 * scale}px`,
          }}
        >
          {appearance.watermarkText}
        </span>
      )}

      {renderHeader()}
      {renderFreeZones('top')}
      {sectionOrder.map((secKey) => (
        <div key={secKey}>{renderSection(secKey)}</div>
      ))}
      {renderFreeZones('bottom')}

      {isStudioInteractive && (onAddFreeZone || onRestoreSection) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="no-print mt-4 pt-3 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-2"
        >
          {onAddFreeZone && (
            <button
              type="button"
              onClick={onAddFreeZone}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-700 bg-white border border-dashed border-slate-300 rounded-md hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/40 transition-colors"
            >
              <Plus className="w-3 h-3" /> Ajouter un bloc libre sur la page
            </button>
          )}

          {onRestoreSection && (
            <div className="flex flex-wrap items-center gap-1.5">
              {!blocks.reference && (
                <button
                  type="button"
                  onClick={() => onRestoreSection('reference')}
                  className="px-2 py-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  + Référence
                </button>
              )}
              {!blocks.title && (
                <button
                  type="button"
                  onClick={() => onRestoreSection('title')}
                  className="px-2 py-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  + Titre
                </button>
              )}
              {!blocks.signature && (
                <button
                  type="button"
                  onClick={() => onRestoreSection('signatureQr')}
                  className="px-2 py-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  + Signature
                </button>
              )}
              {(!blocks.qr || !qr.enabled) && (
                <button
                  type="button"
                  onClick={() => onRestoreSection('qr')}
                  className="px-2 py-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  + QR code
                </button>
              )}
              {!tpl.footer.showFooter && (
                <button
                  type="button"
                  onClick={() => onRestoreSection('footer')}
                  className="px-2 py-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  + Pied de page
                </button>
              )}
              {!blocks.legalMention && (
                <button
                  type="button"
                  onClick={() => onRestoreSection('legalMention')}
                  className="px-2 py-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  + Mention légale
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
