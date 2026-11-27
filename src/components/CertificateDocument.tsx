import {
  DEFAULT_DOCUMENT_TEMPLATES,
  buildDocumentQrPayload,
  formatDateFR,
  getDocumentRowValue,
  normalizeSex,
} from '../services/database';
import {
  CertificateSettings,
  DocumentTemplate,
  EnrichedInscription,
} from '../types/scolarite';
import { QrCodeCanvas } from './QrCodeCanvas';

interface CertificateDocumentProps {
  record: EnrichedInscription;
  issueDate?: string;
  settings?: CertificateSettings;
  /** Modèle défini dans la page Administration (certificat par défaut) */
  template?: DocumentTemplate;
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
}: CertificateDocumentProps) {
  const tpl = template ?? DEFAULT_DOCUMENT_TEMPLATES.certificat;
  const { blocks, appearance, texts } = tpl;

  const isFemale = (record.sexeNormalized ?? normalizeSex(record.sexe)) === 'F';
  const civilPrefix = isFemale ? 'Mme/Mlle' : 'M.';
  const inscritPhrase = isFemale
    ? "Est inscrite régulièrement au sein de l'Université de Toliara pour l'Année Universitaire"
    : "Est inscrit régulièrement au sein de l'Université de Toliara pour l'Année Universitaire";

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
  const qrPayload = buildDocumentQrPayload(record, tpl);

  const borderClass =
    appearance.borderStyle === 'double'
      ? 'border-4 border-double'
      : appearance.borderStyle === 'thin'
        ? 'border'
        : 'border-0';
  const activeRows = tpl.rows.filter((row) => row.enabled);

  return (
    <article
      className={`bg-white text-slate-900 ${borderClass} rounded-sm shadow-sm p-8 sm:p-10 max-w-[794px] mx-auto print:border-0 print:shadow-none print:p-4 print:break-inside-avoid relative overflow-hidden ${FONT_CLASS[appearance.fontFamily]}`}
      style={{
        borderColor: appearance.accentColor,
        color: appearance.textColor,
        fontSize: `${appearance.fontSize}px`,
      }}
    >
      {blocks.watermark && appearance.watermarkText && (
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] whitespace-nowrap font-display font-black uppercase tracking-widest"
          style={{
            color: appearance.accentColor,
            opacity: appearance.watermarkOpacity,
            fontSize: '58px',
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
              <p className="text-[0.75em] font-semibold tracking-wider uppercase text-slate-700">
                {tpl.header.line1}
              </p>
            )}
            {tpl.header.line2 && (
              <p className="text-[0.7em] italic text-slate-500">
                {tpl.header.line2}
              </p>
            )}
            {tpl.header.line3 && (
              <p className="text-[0.8em] font-semibold uppercase text-slate-800 pt-1">
                {tpl.header.line3}
              </p>
            )}
            {tpl.header.line4 && (
              <h2
                className="text-[1.35em] font-bold tracking-tight uppercase font-display"
                style={{ color: appearance.accentColor }}
              >
                {tpl.header.line4}
              </h2>
            )}
            {tpl.header.line5 && (
              <p className="text-[0.8em] font-medium text-slate-700">
                {tpl.header.line5}
              </p>
            )}
          </div>

          <div className="w-24 shrink-0 flex flex-col items-center justify-center">
            {tpl.header.showSecondaryLogo && tpl.header.secondaryLogoUrl && (
              <img
                src={tpl.header.secondaryLogoUrl}
                alt="Logo secondaire"
                referrerPolicy="no-referrer"
                className="w-12 h-12 object-contain opacity-80"
              />
            )}
          </div>
        </div>
      )}

      {/* Référence & date */}
      {blocks.reference && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 pb-6 text-[0.8em] text-slate-700">
          <p className="font-mono tabular-nums font-medium">
            Réf : {refCode}/MEsupRes/U. U/DSIN/Sco.Cent
          </p>
          {record.numInscription && (
            <p className="font-mono tabular-nums text-slate-600">
              N° Inscription :{' '}
              <span className="font-semibold text-slate-900">
                {record.numInscription}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Titre */}
      {blocks.title && texts.title && (
        <div className="text-center mb-7">
          <h1
            className="inline-block text-[1.7em] font-bold tracking-wide uppercase font-display pb-1.5 px-6"
            style={{ borderBottom: `2px solid ${appearance.accentColor}` }}
          >
            {texts.title}
          </h1>
        </div>
      )}

      {/* Corps */}
      <div className="space-y-5 leading-relaxed text-slate-800">
        {blocks.identity && (
          <>
            {texts.intro && <p>{texts.intro}</p>}

            <div className="bg-slate-50/80 border border-slate-200 px-5 py-4 space-y-2">
              <div className="text-[1.15em] font-bold text-slate-900">
                {civilPrefix} {record.nom} {record.prenom}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[0.95em] text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">
                    Né(e) le :
                  </span>{' '}
                  <span className="tabular-nums">
                    {record.dateNaissance
                      ? formatDateFR(record.dateNaissance)
                      : '—'}
                  </span>
                  {record.lieuNaissance ? ` à ${record.lieuNaissance}` : ''}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">
                    Nationalité :
                  </span>{' '}
                  {record.nationalite || 'MALAGASY'}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">CIN N° :</span>{' '}
                  <span className="font-mono tabular-nums">
                    {record.numeroCin || 'Non renseigné'}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-slate-900">
                    Délivré le :
                  </span>{' '}
                  <span className="tabular-nums">
                    {record.dateCin ? formatDateFR(record.dateCin) : '—'}
                  </span>
                  {record.lieuDelivrance ? ` à ${record.lieuDelivrance}` : ''}
                </p>
                {showFiliation && (record.nomPere || record.nomMere) && (
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-slate-900">
                      Filiation :
                    </span>{' '}
                    {record.nomPere ? `Père : ${record.nomPere}` : ''}
                    {record.nomPere && record.nomMere ? ' · ' : ''}
                    {record.nomMere ? `Mère : ${record.nomMere}` : ''}
                  </p>
                )}
              </div>
            </div>

            <p className="font-medium text-slate-900">
              {inscritPhrase}{' '}
              <span className="font-bold font-mono tabular-nums">
                {record.annee}
              </span>{' '}
              :
            </p>
          </>
        )}

        {/* Tableau académique */}
        {blocks.academicTable && activeRows.length > 0 && (
          <div className="border border-slate-300 divide-y divide-slate-200 text-[0.95em]">
            {activeRows.map((row, index) => (
              <div
                key={row.id}
                className={`grid grid-cols-12 px-4 py-2 ${
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

        {texts.closing && (
          <p className="text-[0.9em] text-slate-700 pt-1">{texts.closing}</p>
        )}
      </div>

      {/* Pied de page : QR + signature */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex items-end justify-between gap-6">
        {blocks.qr ? (
          <div className="flex items-center gap-3">
            <QrCodeCanvas value={qrPayload} size={tpl.qr.size} />
            <div className="text-[0.75em] text-slate-500 space-y-0.5 max-w-[200px]">
              <p className="font-semibold text-slate-700">
                Scolarité Log · Vérification
              </p>
              <p className="font-mono tabular-nums">
                ID #{record.idEtudiant} / #{record.idInscription}
              </p>
              <p>Document officiel de l&apos;Université de Toliara</p>
            </div>
          </div>
        ) : (
          <div />
        )}

        {blocks.signature && (
          <div className="text-center space-y-12 min-w-[220px]">
            {tpl.signature.showDate && (
              <p className="text-[0.9em] text-slate-800">
                Fait à {tpl.signature.place || 'Toliara'}, le{' '}
                <span className="font-semibold tabular-nums">{todayFR}</span>
              </p>
            )}
            <div className="border-t border-slate-400 pt-1.5 text-[0.85em] font-semibold text-slate-800">
              <p>{signatoryTitle}</p>
              {signatoryName && (
                <p className="mt-0.5 font-normal text-slate-600">
                  {signatoryName}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {blocks.legalMention && texts.legalMention && (
        <p className="mt-4 text-[0.7em] text-center text-slate-400">
          {texts.legalMention}
        </p>
      )}
    </article>
  );
}
