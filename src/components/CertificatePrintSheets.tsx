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
const DESIGN_HEIGHT_PX = 1123;

/**
 * Pages d'impression A4 : 1 certificat par feuille, ou 2 (A5) côte à côte /
 * l'un au-dessus de l'autre, avec ligne de découpe optionnelle.
 */
export function CertificatePrintSheets({
  records,
  template,
  settings,
}: CertificatePrintSheetsProps) {
  const print = template.print;
  const landscape = print.orientation === 'landscape';
  const pageW = landscape ? PAGE_MM.height : PAGE_MM.width;
  const pageH = landscape ? PAGE_MM.width : PAGE_MM.height;
  const margin = Math.max(0, Math.min(30, print.marginMm ?? 12));
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  useEffect(() => {
    const styleId = 'certificate-print-page-rule';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = `@media print { @page { size: A4 ${print.orientation}; margin: 0; } }`;
    return () => {
      const node = document.getElementById(styleId);
      if (node) node.remove();
    };
  }, [print.orientation]);

  // Construction des pages
  const sheets: EnrichedInscription[][] = [];
  if (print.perSheet === 2) {
    if (print.duplicateSame) {
      for (const record of records) sheets.push([record, record]);
    } else {
      for (let i = 0; i < records.length; i += 2) {
        const pair = records.slice(i, i + 2);
        if (pair.length === 1) pair.push(pair[0]);
        sheets.push(pair);
      }
    }
  } else {
    for (const record of records) sheets.push([record]);
  }

  const twoUp = print.perSheet === 2;
  const stacked = twoUp && print.twoUpLayout === 'stacked';
  const cellWidthMm = twoUp && !stacked ? usableW / 2 : usableW;
  const cellHeightMm = twoUp && stacked ? usableH / 2 : usableH;
  // Le certificat doit tenir dans la cellule en largeur ET en hauteur
  const zoom = Math.min(
    1,
    (cellWidthMm * MM_TO_PX) / DESIGN_WIDTH_PX,
    (cellHeightMm * MM_TO_PX) / DESIGN_HEIGHT_PX
  );

  return (
    <div className="certificate-sheets">
      {sheets.map((pair, sheetIndex) => (
        <div
          key={`sheet-${sheetIndex}`}
          className="certificate-sheet bg-white print:break-after-page"
          style={{
            width: `${pageW}mm`,
            height: `${pageH}mm`,
            padding: `${margin}mm`,
            position: 'relative',
            overflow: 'hidden',
            margin: '0 auto',
          }}
        >
          <div
            className="flex h-full w-full"
            style={{
              flexDirection: stacked ? 'column' : 'row',
            }}
          >
            {pair.map((record, cellIndex) => (
              <div
                key={`${record.idInscription}-${cellIndex}`}
                style={{
                  width: twoUp && !stacked ? `${cellWidthMm}mm` : '100%',
                  height: twoUp && stacked ? `${cellHeightMm}mm` : '100%',
                  borderRight:
                    twoUp && !stacked && print.cutLine && cellIndex === 0
                      ? '1px dashed #94a3b8'
                      : undefined,
                  borderBottom:
                    twoUp && stacked && print.cutLine && cellIndex === 0
                      ? '1px dashed #94a3b8'
                      : undefined,
                  padding: twoUp ? '4mm' : 0,
                  overflow: 'hidden',
                }}
              >
                <div style={{ zoom }}>
                  <CertificateDocument
                    record={record}
                    settings={settings}
                    template={template}
                    scale={twoUp ? 0.8 : 1}
                    qrBoost={twoUp ? Math.min(3, Math.max(1, 0.9 / zoom)) : 1}
                    token={record.certificateToken}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
