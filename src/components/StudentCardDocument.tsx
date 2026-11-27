import {
  DEFAULT_DOCUMENT_TEMPLATES,
  buildDocumentQrPayload,
  formatDateFR,
  getDocumentRowValue,
} from '../services/database';
import { DocumentTemplate, EnrichedInscription } from '../types/scolarite';
import { QrCodeCanvas } from './QrCodeCanvas';

interface StudentCardDocumentProps {
  record: EnrichedInscription;
  template?: DocumentTemplate;
  /** Face(s) à rendre : recto seul par défaut */
  side?: 'front' | 'back' | 'both';
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
}: StudentCardDocumentProps) {
  const tpl = template ?? DEFAULT_DOCUMENT_TEMPLATES.carte;
  const { header, texts, appearance, card, blocks } = tpl;

  const qrSize = Math.max(44, Math.round(tpl.qr.size * 0.72));
  const qrPayload = buildDocumentQrPayload(record, tpl);
  const activeRows = tpl.rows.filter((row) => row.enabled);
  const validityStart = record.annee ? record.annee.split('-')[0] : '';
  const validityEnd =
    validityStart && card.validityYears > 0
      ? String(Number(validityStart) + card.validityYears)
      : '';

  const cardBase =
    'bg-white text-slate-900 overflow-hidden shadow-sm print:shadow-none relative flex flex-col';
  const radius = card.rounded ? 'rounded-[3mm]' : 'rounded-none';
  const cardStyle = {
    width: '85.6mm',
    height: '54mm',
    border: `0.4mm solid ${appearance.accentColor}`,
    color: appearance.textColor,
    fontSize: `${Math.max(8, Math.round(appearance.fontSize * 0.62))}pt`,
  } as const;

  const headerBand = (
    <div
      className="flex items-center gap-[2mm] px-[3mm] py-[1.6mm]"
      style={{ backgroundColor: card.headerColor }}
    >
      {header.showLogo && (
        <img
          src={header.logoUrl}
          alt="Logo"
          referrerPolicy="no-referrer"
          className="w-[7mm] h-[7mm] object-contain rounded-[1mm] bg-white/90 p-[0.4mm]"
        />
      )}
      <div className="min-w-0 text-white">
        <p className="text-[6.5pt] font-bold uppercase leading-tight truncate">
          {header.line4 || 'Université de Toliara'}
        </p>
        <p className="text-[5.2pt] uppercase tracking-wide opacity-90 truncate">
          {texts.title || "Carte d'Étudiant"}
        </p>
      </div>
      <div className="ml-auto text-white/90 text-[5pt] font-mono tabular-nums text-right leading-tight">
        <p>Année</p>
        <p className="font-bold text-[6.5pt]">{record.annee}</p>
      </div>
    </div>
  );

  return (
    <div className={`${FONT_CLASS[appearance.fontFamily]} space-y-[6mm]`}>
      {/* ---------- RECTO ---------- */}
      {side !== 'back' && (
      <section className={`${cardBase} ${radius}`} style={cardStyle}>
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
          {card.showPhoto && (
            <div
              className="shrink-0 w-[16mm] h-[20mm] rounded-[1mm] overflow-hidden flex items-center justify-center text-center"
              style={{
                border: `0.3mm solid ${appearance.accentColor}55`,
                backgroundColor: '#f1f5f9',
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
          )}

          <div className="min-w-0 flex-1 space-y-[1mm]">
            <div>
              <p className="text-[5pt] uppercase tracking-wide text-slate-500 leading-none">
                Nom et prénom(s)
              </p>
              <p className="text-[8.6pt] font-bold leading-tight truncate">
                {record.nom} {record.prenom}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-[2mm] gap-y-[0.8mm] text-[5.6pt] leading-tight">
              <div>
                <p className="text-[4.6pt] uppercase text-slate-500 leading-none">
                  N° inscription
                </p>
                <p className="font-mono font-semibold">
                  {record.numInscription || '—'}
                </p>
              </div>
              <div>
                <p className="text-[4.6pt] uppercase text-slate-500 leading-none">
                  Niveau
                </p>
                <p className="font-semibold">{record.niveau}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[4.6pt] uppercase text-slate-500 leading-none">
                  Mention
                </p>
                <p className="font-semibold truncate">{record.mention}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[4.6pt] uppercase text-slate-500 leading-none">
                  Né(e) le
                </p>
                <p className="tabular-nums">
                  {formatDateFR(record.dateNaissance) || '—'}
                </p>
              </div>
            </div>

            {blocks.signature && (
              <p className="text-[4.6pt] text-slate-500 leading-tight pt-[0.6mm]">
                {tpl.signature.title}
              </p>
            )}
          </div>

          {blocks.qr && (
            <div className="shrink-0 flex flex-col items-center justify-between">
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
          <span className="truncate">{record.faculte}</span>
          <span className="font-mono tabular-nums shrink-0">
            {record.reference ? `Réf. ${record.reference}` : ''}
          </span>
        </div>
      </section>
      )}

      {/* ---------- VERSO ---------- */}
      {side !== 'front' && (
        <section className={`${cardBase} ${radius}`} style={cardStyle}>
          <div
            className="flex items-center justify-between px-[3mm] py-[1.4mm] text-white"
            style={{ backgroundColor: card.headerColor }}
          >
            <p className="text-[6pt] font-bold uppercase tracking-wide">
              {card.backTitle || texts.title}
            </p>
            <p className="text-[5pt] font-mono tabular-nums">
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
                  <span className="text-slate-500 shrink-0 w-[13mm] truncate">
                    {row.label}
                  </span>
                  <span className="font-semibold truncate">
                    {getDocumentRowValue(record, row.id)}
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
              {blocks.qr && (
                <div className="bg-white p-[0.6mm] rounded-[0.8mm]">
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
