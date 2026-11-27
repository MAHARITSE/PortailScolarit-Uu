import {
  DEFAULT_CERTIFICATE_PHRASE,
  DEFAULT_DOCUMENT_TEMPLATES,
  buildCertificateQrPayload,
  buildCertificateVariables,
  formatDateFR,
  getCertificateFieldValue,
  getDocumentRowValue,
  getQrPixelSize,
  normalizeSex,
  renderCertificateBody,
} from '../services/database';
import {
  CertificateSettings,
  DocumentTemplate,
  EnrichedInscription,
} from '../types/scolarite';
import { QrCodeCanvas } from './QrCodeCanvas';
import { BODY_FONT_CLASS } from './typography';

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
}

const FONT_CLASS: Record<DocumentTemplate['appearance']['fontFamily'], string> = {
  sans: 'font-sans',
  display: 'font-display',
  mono: 'font-mono',
};

export function CertificateDocument({
  record,
  issueDate,
  settings,
  template,
  scale = 1,
  qrBoost = 1,
  token,
}: CertificateDocumentProps) {
  const tpl = template ?? DEFAULT_DOCUMENT_TEMPLATES.certificat;
  const { blocks, appearance, texts, qr } = tpl;

  const isFemale = (record.sexeNormalized ?? normalizeSex(record.sexe)) === 'F';
  const resolvedDate = issueDate || settings?.issueDate;
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
  });
  // Mode « phrase rédigée » (par défaut) : le certificat est un texte suivi,
  // complété automatiquement avec les données — aucun tableau.
  const phraseMode = (tpl.body.mode ?? 'phrase') !== 'table';
  const bodyStyle = tpl.body.style ?? DEFAULT_DOCUMENT_TEMPLATES.certificat.body.style;
  const bodyInlineStyle = {
    fontFamily: undefined,
    fontSize: bodyStyle.fontSize ? `${bodyStyle.fontSize * scale}px` : '0.98em',
    fontWeight: bodyStyle.bold ? 700 : undefined,
    fontStyle: bodyStyle.italic ? 'italic' : undefined,
    textDecoration: bodyStyle.underline ? 'underline' : undefined,
    textTransform: bodyStyle.uppercase ? ('uppercase' as const) : undefined,
    textAlign: bodyStyle.align,
    lineHeight: bodyStyle.lineHeight || 1.5,
  };
  const renderedBody = renderCertificateBody(tpl.body.template, variables);
  const bodyText = (
    renderedBody.trim() ||
    (phraseMode
      ? renderCertificateBody(DEFAULT_CERTIFICATE_PHRASE, variables)
      : '')
  ).trim();
  const bodyParagraphs = bodyText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const activeFields = tpl.fields.filter((field) => field.enabled);
  const activeRows = tpl.rows.filter((row) => row.enabled);

  const borderClass =
    appearance.borderStyle === 'double'
      ? 'border-4 border-double'
      : appearance.borderStyle === 'thin'
        ? 'border'
        : 'border-0';

  const qrBlock = (
    <div className="flex flex-col items-center gap-1">
      <QrCodeCanvas value={qrPayload} size={qrPx} />
      {qr.showLabel && qr.label && (
        <p className="text-[0.62em] text-slate-500 text-center leading-tight max-w-[140px]">
          {qr.label}
        </p>
      )}
    </div>
  );

  const signatureBlock = blocks.signature && (
    <div className="text-center space-y-3 min-w-[200px]">
      {tpl.signature.showDate && (
        <p className="text-[0.85em] text-slate-800">
          Fait à {tpl.signature.place || 'Toliara'}, le{' '}
          <span className="font-semibold tabular-nums">{todayFR}</span>
        </p>
      )}
      {tpl.signature.showImage && tpl.signature.imageUrl && (
        <img
          src={tpl.signature.imageUrl}
          alt="Signature et cachet"
          className="h-16 mx-auto object-contain"
        />
      )}
      <div className="border-t border-slate-400 pt-1.5 text-[0.8em] font-semibold text-slate-800">
        <p>{signatoryTitle}</p>
        {signatoryName && (
          <p className="mt-0.5 font-normal text-slate-600">{signatoryName}</p>
        )}
      </div>
    </div>
  );

  return (
    <article
      className={`bg-white text-slate-900 ${borderClass} rounded-sm shadow-sm p-8 sm:p-10 max-w-[794px] mx-auto print:border-0 print:shadow-none print:p-4 print:break-inside-avoid relative overflow-hidden ${FONT_CLASS[appearance.fontFamily]}`}
      style={{
        borderColor: appearance.accentColor,
        color: appearance.textColor,
        fontSize: `${appearance.fontSize * scale}px`,
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

      {/* En-tête institutionnel */}
      {blocks.header && (
        <div
          className="flex items-start justify-between gap-4 pb-5 relative"
          style={{ borderBottom: `2px solid ${appearance.accentColor}` }}
        >
          <div className="w-24 shrink-0 flex flex-col items-center">
            {tpl.header.showLogo && (
              <img
                src={tpl.header.logoUrl}
                alt="Logo institutionnel"
                referrerPolicy="no-referrer"
                className="w-20 h-20 object-contain"
              />
            )}
          </div>

          <div className="flex-1 text-center space-y-1">
            {tpl.header.line1 && (
              <p className="text-[0.72em] font-semibold tracking-wider uppercase text-slate-700">
                {tpl.header.line1}
              </p>
            )}
            {tpl.header.line2 && (
              <p className="text-[0.68em] italic text-slate-500">
                {tpl.header.line2}
              </p>
            )}
            {tpl.header.line3 && (
              <p className="text-[0.78em] font-semibold uppercase text-slate-800 pt-1">
                {tpl.header.line3}
              </p>
            )}
            {tpl.header.line4 && (
              <h2
                className="text-[1.3em] font-bold tracking-tight uppercase font-display"
                style={{ color: appearance.accentColor }}
              >
                {tpl.header.line4}
              </h2>
            )}
            {tpl.header.line5 && (
              <p className="text-[0.78em] font-medium text-slate-700">
                {tpl.header.line5}
              </p>
            )}
            {tpl.footer.showFooter && tpl.footer.address && (
              <p className="text-[0.65em] text-slate-500">
                {tpl.footer.address}
                {tpl.footer.contacts ? ` · ${tpl.footer.contacts}` : ''}
              </p>
            )}
          </div>

          <div className="w-24 shrink-0 flex flex-col items-center justify-center gap-2">
            {qr.enabled && qr.position === 'header' && qrBlock}
            {tpl.header.showSecondaryLogo && tpl.header.secondaryLogoUrl && (
              <img
                src={tpl.header.secondaryLogoUrl}
                alt="Logo secondaire"
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain opacity-80"
              />
            )}
          </div>
        </div>
      )}

      {/* Référence & date */}
      {blocks.reference && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 pb-4 text-[0.78em] text-slate-700">
          <p className="font-mono tabular-nums font-medium">
            Réf : {refCode}/MEsupRes/U. U/DSIN/Sco.Cent
          </p>
          {record.numInscription && (
            <p className="font-mono tabular-nums text-slate-600">
              Matricule :{' '}
              <span className="font-semibold text-slate-900">
                {record.numInscription}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Titre */}
      {blocks.title && texts.title && (
        <div className="text-center mb-6">
          <h1
            className="inline-block text-[1.65em] font-bold tracking-wide uppercase font-display pb-1.5 px-6"
            style={{ borderBottom: `2px solid ${appearance.accentColor}` }}
          >
            {texts.title}
          </h1>
        </div>
      )}

      {/* Corps */}
      <div className="space-y-4 leading-relaxed text-slate-800">
        {blocks.identity && (
          <>
            {!phraseMode && texts.intro && <p>{texts.intro}</p>}
            {bodyParagraphs.length > 0 && (
              <div
                className={`space-y-3 ${
                  BODY_FONT_CLASS[bodyStyle.fontFamily] ?? 'font-sans'
                }`}
                style={bodyInlineStyle}
              >
                {bodyParagraphs.map((paragraph, index) => (
                  <p key={`para-${index}`} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
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
                  tpl.fields.some((f) => f.id === 'filiation' && !f.enabled) &&
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

        {/* Tableau académique (uniquement en mode tableau) */}
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
                  {getDocumentRowValue(record, row.id)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* En mode phrase, le texte rédigé contient déjà la formule de clôture */}
        {!phraseMode && texts.closing && (
          <p className="text-[0.88em] text-slate-700 pt-1">{texts.closing}</p>
        )}
      </div>

      {/* Pied de page : QR + signature */}
      <div className="mt-6 pt-5 border-t border-slate-200 flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          {qr.enabled && qr.position === 'bottom-left' && qrBlock}
          {qr.enabled && qr.position === 'beside-signature' && qrBlock}
        </div>

        <div className="flex items-end gap-4">
          {qr.enabled && qr.position === 'bottom-right' && qrBlock}
          {qr.enabled && qr.position === 'footer' && qrBlock}
          {signatureBlock}
        </div>
      </div>

      {tpl.footer.showFooter && (tpl.footer.address || tpl.footer.contacts || tpl.footer.note) && (
        <div className="mt-4 pt-2 border-t border-slate-200 text-[0.65em] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            {tpl.footer.address}
            {tpl.footer.address && tpl.footer.contacts ? ' · ' : ''}
            {tpl.footer.contacts}
          </span>
          <span>{tpl.footer.note}</span>
        </div>
      )}

      {blocks.legalMention && texts.legalMention && (
        <p className="mt-2 text-[0.68em] text-center text-slate-400">
          {texts.legalMention}
        </p>
      )}
    </article>
  );
}
