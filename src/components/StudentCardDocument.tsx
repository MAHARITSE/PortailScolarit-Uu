import {
  CARD_FRONT_FIELD_OPTIONS,
  DEFAULT_CARD_FRONT_FIELDS,
  DEFAULT_DOCUMENT_TEMPLATES,
  buildDocumentQrPayload,
  getDocumentRowValue,
} from '../services/database';
import { DocumentTemplate, EnrichedInscription } from '../types/scolarite';
import { DocumentZoneTarget } from './CertificateDocument';
import { QrCodeCanvas } from './QrCodeCanvas';

interface StudentCardDocumentProps {
  record: EnrichedInscription;
  template?: DocumentTemplate;
  /** Face(s) à rendre : recto seul par défaut */
  side?: 'front' | 'back' | 'both';
  /** Mode interactif du studio : clic sur une zone pour l'inspecter */
  onSelectZone?: (zone: DocumentZoneTarget) => void;
  activeZone?: DocumentZoneTarget | null;
}

const FONT_CLASS: Record<DocumentTemplate['appearance']['fontFamily'], string> = {
  sans: 'font-sans',
  display: 'font-display',
  mono: 'font-mono',
};

/**
 * Carte d'étudiant au format CR80 (85,6 × 54 mm), recto/verso.
 * Les dimensions sont exprimées en mm pour une impression fidèle.
 */
export function StudentCardDocument({
  record,
  template,
  side = 'front',
  onSelectZone,
  activeZone,
}: StudentCardDocumentProps) {
  const tpl = template ?? DEFAULT_DOCUMENT_TEMPLATES.carte;
  const { header, texts, appearance, card, blocks } = tpl;
  const layout = tpl.layout ?? DEFAULT_DOCUMENT_TEMPLATES.carte.layout;

  const qrSize = Math.max(44, Math.round(tpl.qr.size * 0.72));
  const qrPayload = buildDocumentQrPayload(record, tpl);
  const activeRows = tpl.rows.filter((row) => row.enabled);
  const validityStart = record.annee ? record.annee.split('-')[0] : '';
  const validityEnd =
    validityStart && card.validityYears > 0
      ? String(Number(validityStart) + card.validityYears)
      : '';

  const photoPosition = card.photoPosition ?? 'left';
  const photoShape = card.photoShape ?? 'rounded';
  const qrPlacement = card.qrPlacement ?? 'both';
  const headerStyle = card.headerStyle ?? 'solid';
  const frontFieldIds =
    card.frontFields && card.frontFields.length > 0
      ? card.frontFields
      : DEFAULT_CARD_FRONT_FIELDS;

  const showFrontQr =
    blocks.qr &&
    tpl.qr.enabled &&
    (qrPlacement === 'front' || qrPlacement === 'both');
  const showBackQr =
    blocks.qr &&
    tpl.qr.enabled &&
    (qrPlacement === 'back' || qrPlacement === 'both');

  const cardBase =
    'text-slate-900 overflow-hidden shadow-sm print:shadow-none relative flex flex-col';
  const radius = card.rounded ? 'rounded-[3mm]' : 'rounded-none';
  const cardStyle = {
    width: '85.6mm',
    height: '54mm',
    backgroundColor: layout.backgroundColor || '#ffffff',
    border: `${Math.max(0.3, (layout.borderWidthPx ?? 1) * 0.4)}mm solid ${appearance.accentColor}`,
    color: appearance.textColor,
    fontSize: `${Math.max(8, Math.round(appearance.fontSize * 0.62))}pt`,
  } as const;

  const headerBandStyle =
    headerStyle === 'gradient'
      ? {
          background: `linear-gradient(120deg, ${card.headerColor} 0%, ${appearance.accentColor} 100%)`,
          color: '#ffffff',
        }
      : headerStyle === 'minimal'
        ? {
            backgroundColor: '#ffffff',
            color: appearance.textColor,
            borderBottom: `0.45mm solid ${card.headerColor}`,
          }
        : {
            backgroundColor: card.headerColor,
            color: '#ffffff',
          };

  const isMinimalHeader = headerStyle === 'minimal';

  const headerBand = (
    <div
      className="flex items-center gap-[2mm] px-[3mm] py-[1.6mm]"
      style={headerBandStyle}
    >
      {header.showLogo && header.logoUrl && (
        <img
          src={header.logoUrl}
          alt="Logo"
          referrerPolicy="no-referrer"
          className="w-[7mm] h-[7mm] object-contain rounded-[1mm] bg-white/90 p-[0.4mm]"
        />
      )}
      <div className="min-w-0">
        <p
          className="text-[6.5pt] font-bold uppercase leading-tight truncate"
          style={isMinimalHeader ? { color: card.headerColor } : undefined}
        >
          {header.line4 || 'Université de Toliara'}
        </p>
        <p
          className={`text-[5.2pt] uppercase tracking-wide truncate ${
            isMinimalHeader ? 'text-slate-600' : 'opacity-90'
          }`}
        >
          {texts.title || "Carte d'Étudiant"}
        </p>
      </div>
      <div
        className={`ml-auto text-[5pt] font-mono tabular-nums text-right leading-tight ${
          isMinimalHeader ? 'text-slate-600' : 'text-white/90'
        }`}
      >
        <p>Année</p>
        <p
          className="font-bold text-[6.5pt]"
          style={isMinimalHeader ? { color: card.headerColor } : undefined}
        >
          {record.annee}
        </p>
      </div>
    </div>
  );

  const photoShapeClass =
    photoShape === 'circle'
      ? 'rounded-full w-[17mm] h-[17mm]'
      : photoShape === 'rect'
        ? 'rounded-none w-[16mm] h-[20mm]'
        : 'rounded-[1mm] w-[16mm] h-[20mm]';

  const photoElement = card.showPhoto && (
    <div
      className={`shrink-0 ${photoShapeClass} overflow-hidden flex items-center justify-center text-center`}
      style={{
        border: `0.3mm solid ${appearance.accentColor}55`,
        backgroundColor: '#f1f5f9',
      }}
      onClick={(e) => {
        if (!onSelectZone) return;
        e.stopPropagation();
        onSelectZone('cardPhoto');
      }}
    >
      {record.photo ? (
        <img
          src={record.photo}
          alt={`Photo de ${record.nom}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[4.6pt] text-slate-400 px-[1mm] leading-tight">
          {card.photoHint || 'Photo'}
        </span>
      )}
    </div>
  );

  const fieldLabelFor = (id: string): string => {
    const custom = tpl.fields.find((f) => f.id === id);
    if (custom) return custom.label;
    const row = tpl.rows.find((r) => r.id === id);
    if (row) return row.label;
    return CARD_FRONT_FIELD_OPTIONS.find((o) => o.id === id)?.label ?? id;
  };

  const frontFieldList = frontFieldIds.slice(0, 6);

  return (
    <div className={`${FONT_CLASS[appearance.fontFamily]} space-y-[6mm]`}>
      {/* ---------- RECTO ---------- */}
      {side !== 'back' && (
        <section
          className={`${cardBase} ${radius} ${
            onSelectZone ? 'cursor-pointer' : ''
          } ${activeZone === 'cardFront' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          style={cardStyle}
          onClick={() => onSelectZone?.('cardFront')}
        >
          {blocks.watermark && appearance.watermarkText && (
            <span
              aria-hidden="true"
              className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] whitespace-nowrap font-black uppercase"
              style={{
                color: appearance.accentColor,
                opacity: appearance.watermarkOpacity,
                fontSize: '9mm',
              }}
            >
              {appearance.watermarkText}
            </span>
          )}

          {blocks.header && headerBand}

          <div className="flex gap-[2.5mm] px-[3mm] py-[2mm] flex-1">
            {photoPosition === 'left' && photoElement}

            <div className="min-w-0 flex-1 space-y-[1mm]">
              <div>
                <p className="text-[5pt] uppercase tracking-wide text-slate-500 leading-none">
                  Nom et prénom(s)
                </p>
                <p className="text-[8.4pt] font-bold leading-tight truncate">
                  {record.nom} {record.prenom}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-[2mm] gap-y-[0.7mm] text-[5.4pt] leading-tight">
                {frontFieldList.map((fieldId) => {
                  const full = fieldId === 'mention' || fieldId === 'faculte' || fieldId === 'parcours' || fieldId === 'domaine';
                  return (
                    <div key={fieldId} className={full ? 'col-span-2' : ''}>
                      <p className="text-[4.4pt] uppercase text-slate-500 leading-none truncate">
                        {fieldLabelFor(fieldId)}
                      </p>
                      <p
                        className={`truncate ${
                          fieldId === 'numInscription' || fieldId === 'reference'
                            ? 'font-mono font-semibold'
                            : fieldId === 'niveau' || fieldId === 'mention'
                              ? 'font-semibold'
                              : ''
                        }`}
                      >
                        {getDocumentRowValue(record, fieldId) || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {blocks.signature && (
                <p className="text-[4.6pt] text-slate-500 leading-tight pt-[0.4mm] truncate">
                  {tpl.signature.title}
                </p>
              )}
            </div>

            {photoPosition === 'right' && photoElement}

            {showFrontQr && (
              <div
                className="shrink-0 flex flex-col items-center justify-between"
                onClick={(e) => {
                  if (!onSelectZone) return;
                  e.stopPropagation();
                  onSelectZone('qr');
                }}
              >
                <div className="bg-white p-[0.6mm] rounded-[0.8mm]">
                  <QrCodeCanvas value={qrPayload} size={qrSize} />
                </div>
                {card.showValidity && validityEnd && (
                  <p className="text-[4.4pt] text-slate-600 text-center leading-tight mt-[0.6mm]">
                    Valable
                    <br />
                    {validityStart}–{validityEnd}
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            className="px-[3mm] py-[1mm] text-[4.6pt] flex items-center justify-between gap-[2mm]"
            style={{ backgroundColor: `${card.headerColor}12` }}
          >
            <span className="truncate">
              {card.footerText?.trim() ? card.footerText : record.faculte}
            </span>
            <span className="font-mono tabular-nums shrink-0">
              {record.reference ? `Réf. ${record.reference}` : ''}
            </span>
          </div>
        </section>
      )}

      {/* ---------- VERSO ---------- */}
      {side !== 'front' && (
        <section
          className={`${cardBase} ${radius} ${
            onSelectZone ? 'cursor-pointer' : ''
          } ${activeZone === 'cardBack' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          style={cardStyle}
          onClick={() => onSelectZone?.('cardBack')}
        >
          <div
            className="flex items-center justify-between px-[3mm] py-[1.4mm]"
            style={headerBandStyle}
          >
            <p
              className="text-[6pt] font-bold uppercase tracking-wide"
              style={isMinimalHeader ? { color: card.headerColor } : undefined}
            >
              {card.backTitle || texts.title}
            </p>
            <p
              className={`text-[5pt] font-mono tabular-nums ${
                isMinimalHeader ? 'text-slate-600' : ''
              }`}
            >
              #{record.idEtudiant}
            </p>
          </div>

          <div className="flex gap-[2.5mm] px-[3mm] py-[1.8mm] flex-1">
            <div className="flex-1 min-w-0 space-y-[0.7mm]">
              {activeRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-baseline gap-[1.2mm] text-[5.4pt] leading-tight"
                >
                  <span className="text-slate-500 shrink-0 w-[14mm] truncate">
                    {row.label}
                  </span>
                  <span className="font-semibold truncate">
                    {getDocumentRowValue(record, row.id) || '—'}
                  </span>
                </div>
              ))}
              {blocks.filiation && (record.nomPere || record.nomMere) && (
                <div className="text-[5pt] text-slate-600 leading-tight pt-[0.6mm] truncate">
                  {record.nomPere ? `Père : ${record.nomPere}` : ''}
                  {record.nomPere && record.nomMere ? ' · ' : ''}
                  {record.nomMere ? `Mère : ${record.nomMere}` : ''}
                </div>
              )}
              {card.backNote && (
                <p className="text-[4.6pt] text-slate-500 leading-tight pt-[0.8mm] line-clamp-3">
                  {card.backNote}
                </p>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-center justify-between w-[18mm]">
              {showBackQr && (
                <div
                  className="bg-white p-[0.6mm] rounded-[0.8mm]"
                  onClick={(e) => {
                    if (!onSelectZone) return;
                    e.stopPropagation();
                    onSelectZone('qr');
                  }}
                >
                  <QrCodeCanvas value={`${qrPayload}\nVERSO`} size={qrSize} />
                </div>
              )}
              {blocks.signature && (
                <div className="text-center leading-tight mt-[0.8mm]">
                  <p className="text-[4.4pt] text-slate-500">
                    {tpl.signature.title}
                  </p>
                  <div
                    className="mt-[2mm] pt-[0.6mm] text-[4.6pt] font-semibold"
                    style={{ borderTop: `0.2mm solid ${appearance.textColor}55` }}
                  >
                    {tpl.signature.name || 'Signature & cachet'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {blocks.legalMention && texts.legalMention && (
            <p className="px-[3mm] pb-[1mm] text-[4pt] text-center text-slate-400 leading-tight truncate">
              {texts.legalMention}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
