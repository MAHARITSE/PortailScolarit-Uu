import { useEffect } from 'react';
import {
  CertificateSettings,
  DocumentTemplate,
  EnrichedInscription,
} from '../types/scolarite';
import { CertificateDocument } from './CertificateDocument';

interface CertificatePrintSheetsProps {
  records: EnrichedInscription[];
  template: DocumentTemplate;
  settings?: CertificateSettings;
}

const PAGE_MM = { width: 210, height: 297 };
const MM_TO_PX = 3.7795275591;
const DESIGN_WIDTH_PX = 794;

/**
 * Impression A4 des certificats, entièrement automatique :
 * - 1 certificat sélectionné → 1 par page A4
 * - plusieurs certificats    → 2 par page A4, empilés
 *
 * Chaque certificat est rendu exactement à la même taille que sur une page
 * complète (aucune mise à l'échelle forcée), avec pagination naturelle.
 */
export function CertificatePrintSheets({
  records,
  template,
  settings,
}: CertificatePrintSheetsProps) {
  const print = template.print;
  const margin = Math.max(0, Math.min(30, print.marginMm ?? 12));
  const landscape = print.orientation === 'landscape';
  const usableW = (landscape ? PAGE_MM.height : PAGE_MM.width) - margin * 2;
  const flowZoom = Math.min(1, (usableW * MM_TO_PX) / DESIGN_WIDTH_PX);

  useEffect(() => {
    const styleId = 'certificate-print-page-rule';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    // Marges verticales à 0 : le navigateur n'a alors plus d'espace pour
    // imprimer son en-tête (URL, n° de page) et son pied (date, titre).
    el.textContent = `@media print { @page { size: A4 ${print.orientation}; margin: 0 12mm; } }`;
    return () => {
      const node = document.getElementById(styleId);
      if (node) node.remove();
    };
  }, [print.orientation, margin]);

  return (
    <div className="certificate-flow bg-white">
      {records.map((record, index) => (
        <div
          key={`${record.idInscription}-${index}`}
          className={`certificate-flow-item${
            print.cutLine && index < records.length - 1
              ? ' certificate-cut'
              : ''
          }`}
          style={{ zoom: flowZoom }}
        >
          <CertificateDocument
            record={record}
            settings={settings}
            template={template}
            token={record.certificateToken}
          />
        </div>
      ))}
    </div>
  );
}
