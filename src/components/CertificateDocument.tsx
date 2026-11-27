import { formatDateFR, normalizeSex } from '../services/database';
import { CertificateSettings, EnrichedInscription } from '../types/scolarite';
import { QrCodeCanvas } from './QrCodeCanvas';

interface CertificateDocumentProps {
  record: EnrichedInscription;
  issueDate?: string;
  settings?: CertificateSettings;
}

export function CertificateDocument({
  record,
  issueDate,
  settings,
}: CertificateDocumentProps) {
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
    settings?.signatoryTitle?.trim() || 'Le Responsable de la Scolarité Centrale';
  const signatoryName = settings?.signatoryName?.trim() || '';
  const showFiliation = settings?.showFiliation ?? true;

  const refCode = record.reference || record.numInscription || String(record.idInscription);

  const qrPayload = [
    '===== SCOLARITE LOG =====',
    `NOM        : ${record.nom} ${record.prenom}`.trim(),
    `Institution : ${record.faculte}`,
    `Domaine     : ${record.domaine}`,
    `Mention     : ${record.mention}`,
    `Parcours    : ${record.parcours}`,
    `Grade       : ${record.grade}`,
    `Niveau      : ${record.niveau}`,
    `Année       : ${record.annee}`,
    `Référence   : ${refCode}`,
    '====================',
  ].join('\n');

  return (
    <article className="bg-white text-slate-900 border border-slate-200 rounded-sm shadow-sm p-8 sm:p-10 max-w-[794px] mx-auto print:border-0 print:shadow-none print:p-4 print:break-inside-avoid">
      {/* En-tête institutionnel */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-5">
        <div className="w-24 shrink-0 flex flex-col items-center">
          <img
            src="/assets/logo-uu.jpg"
            alt="Logo Université de Toliara"
            referrerPolicy="no-referrer"
            className="w-20 h-20 object-contain"
          />
        </div>

        <div className="flex-1 text-center space-y-1">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-700">
            Repoblikan&apos;i Madagasikara
          </p>
          <p className="text-[10px] italic text-slate-500">
            Fitiavana - Tanindrazana - Fandrosoana
          </p>
          <p className="text-xs font-semibold uppercase text-slate-800 pt-1">
            Ministère de l&apos;Enseignement Supérieur et de la Recherche Scientifique
          </p>
          <h2 className="text-lg font-bold tracking-tight uppercase text-slate-900 font-display">
            Université de Toliara
          </h2>
          <p className="text-xs font-medium text-slate-700">
            Direction des Systèmes d&apos;Information et du Numérique · Scolarité Centrale
          </p>
        </div>

        <div className="w-24 shrink-0 flex flex-col items-center justify-center">
          {record.faculteLogo && record.faculteLogo !== '/assets/logo-uu.jpg' ? (
            <img
              src={record.faculteLogo}
              alt={`Logo ${record.faculte}`}
              referrerPolicy="no-referrer"
              className="w-20 h-20 object-contain"
            />
          ) : (
            <img
              src="/assets/phoenix-logo.png"
              alt="Scolarité Log"
              referrerPolicy="no-referrer"
              className="w-12 h-12 object-contain opacity-80"
            />
          )}
        </div>
      </div>

      {/* Référence & Date */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 pb-6 text-xs text-slate-700">
        <p className="font-mono tabular-nums font-medium">
          Réf : {refCode}/MEsupRes/U. U/DSIN/Sco.Cent
        </p>
        {record.numInscription && (
          <p className="font-mono tabular-nums text-slate-600">
            N° Inscription :{' '}
            <span className="font-semibold text-slate-900">{record.numInscription}</span>
          </p>
        )}
      </div>

      {/* Titre du certificat */}
      <div className="text-center mb-7">
        <h1 className="inline-block text-2xl font-bold tracking-wide uppercase border-b-2 border-slate-900 pb-1.5 px-6 font-display">
          Certificat de Scolarité
        </h1>
      </div>

      {/* Corps de l'attestation */}
      <div className="space-y-5 text-[14px] leading-relaxed text-slate-800">
        <p>
          Le Responsable de la Scolarité Centrale de l&apos;Université de Toliara certifie par la
          présente que :
        </p>

        <div className="bg-slate-50/80 border border-slate-200 px-5 py-4 space-y-2">
          <div className="text-base font-bold text-slate-900">
            {civilPrefix} {record.nom} {record.prenom}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Né(e) le :</span>{' '}
              <span className="tabular-nums">
                {record.dateNaissance ? formatDateFR(record.dateNaissance) : '—'}
              </span>
              {record.lieuNaissance ? ` à ${record.lieuNaissance}` : ''}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Nationalité :</span>{' '}
              {record.nationalite || 'MALAGASY'}
            </p>
            <p>
              <span className="font-semibold text-slate-900">CIN N° :</span>{' '}
              <span className="font-mono tabular-nums">
                {record.numeroCin || 'Non renseigné'}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-900">Délivré le :</span>{' '}
              <span className="tabular-nums">
                {record.dateCin ? formatDateFR(record.dateCin) : '—'}
              </span>
              {record.lieuDelivrance ? ` à ${record.lieuDelivrance}` : ''}
            </p>
            {showFiliation && (record.nomPere || record.nomMere) && (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Filiation :</span>{' '}
                {record.nomPere ? `Père : ${record.nomPere}` : ''}
                {record.nomPere && record.nomMere ? ' · ' : ''}
                {record.nomMere ? `Mère : ${record.nomMere}` : ''}
              </p>
            )}
          </div>
        </div>

        <p className="font-medium text-slate-900">
          {inscritPhrase}{' '}
          <span className="font-bold font-mono tabular-nums">{record.annee}</span> :
        </p>

        {/* Tableau récapitulatif académique */}
        <div className="border border-slate-300 divide-y divide-slate-200 text-[13.5px]">
          <div className="grid grid-cols-12 px-4 py-2">
            <span className="col-span-4 font-semibold text-slate-700">NOM et Prénom(s)</span>
            <span className="col-span-8 font-bold text-slate-900">
              {record.nom} {record.prenom}
            </span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/50">
            <span className="col-span-4 font-semibold text-slate-700">Institution</span>
            <span className="col-span-8 text-slate-900">{record.faculte}</span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2">
            <span className="col-span-4 font-semibold text-slate-700">Domaine</span>
            <span className="col-span-8 text-slate-900">{record.domaine}</span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/50">
            <span className="col-span-4 font-semibold text-slate-700">Mention</span>
            <span className="col-span-8 font-medium text-slate-900">{record.mention}</span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2">
            <span className="col-span-4 font-semibold text-slate-700">Parcours</span>
            <span className="col-span-8 text-slate-900">{record.parcours}</span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/50">
            <span className="col-span-4 font-semibold text-slate-700">Grade</span>
            <span className="col-span-8 text-slate-900">{record.grade}</span>
          </div>
          <div className="grid grid-cols-12 px-4 py-2">
            <span className="col-span-4 font-semibold text-slate-700">Niveau</span>
            <span className="col-span-8 font-bold text-slate-900">{record.niveau}</span>
          </div>
        </div>

        <p className="text-[13px] text-slate-700 pt-1">
          En foi de quoi, le présent certificat est délivré à l&apos;intéressé(e) pour servir et
          valoir ce que de droit.
        </p>
      </div>

      {/* Pied de page : QR Code + Signature */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex items-end justify-between gap-6">
        <div className="flex items-center gap-3">
          <QrCodeCanvas value={qrPayload} size={96} />
          <div className="text-[11px] text-slate-500 space-y-0.5 max-w-[200px]">
            <p className="font-semibold text-slate-700">Scolarité Log · Vérification</p>
            <p className="font-mono tabular-nums">
              ID #{record.idEtudiant} / #{record.idInscription}
            </p>
            <p>Document officiel de l&apos;Université de Toliara</p>
          </div>
        </div>

        <div className="text-center space-y-12 min-w-[220px]">
          <p className="text-[13px] text-slate-800">
            Fait à Toliara, le <span className="font-semibold tabular-nums">{todayFR}</span>
          </p>
          <div className="border-t border-slate-400 pt-1.5 text-xs font-semibold text-slate-800">
            <p>{signatoryTitle}</p>
            {signatoryName && (
              <p className="mt-0.5 font-normal text-slate-600">{signatoryName}</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
