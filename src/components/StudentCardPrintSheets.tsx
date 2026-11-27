import { useEffect } from 'react';
import {
  CardPrintMode,
  DocumentTemplate,
  EnrichedInscription,
} from '../types/scolarite';
import { StudentCardDocument } from './StudentCardDocument';

interface StudentCardPrintSheetsProps {
  records: EnrichedInscription[];
  template: DocumentTemplate;
  /** Force le mode d'impression (sinon celui du modèle) */
  mode?: CardPrintMode;
}

const PAGE_MM = { width: 210, height: 297 };
/** Largeur réelle d'une carte CR80 (85,6 mm) */
const CARD_MM = { width: 85.6 };

/**
 * Impression des cartes d'étudiant.
 * - `fold` : recto et verso strictement côte à côte (jointifs, centrés sur la
 *   pliure de la feuille), sans trait de séparation — l'A4 pliée en deux donne
 *   une carte à deux faces parfaitement superposées.
 * - `side` : recto sur une page, verso sur la suivante.
 */
export function StudentCardPrintSheets({
  records,
  template,
  mode,
}: StudentCardPrintSheetsProps) {
  const printMode: CardPrintMode = mode ?? template.card.printMode ?? 'fold';

  useEffect(() => {
    const styleId = 'card-print-page-rule';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent =
      printMode === 'fold'
        ? '@media print { @page { size: A4 portrait; margin: 0; } }'
        : '';
    return () => {
      const node = document.getElementById(styleId);
      if (node) node.remove();
    };
  }, [printMode]);

  if (printMode === 'side') {
    return (
      <div className="card-sheets">
        {records.map((record) => (
          <div key={`card-${record.idInscription}`}>
            <div className="print-page-break">
              <StudentCardDocument record={record} template={template} side="front" />
            </div>
            <div className="print-page-break">
              <StudentCardDocument record={record} template={template} side="back" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card-sheets">
      {records.map((record) => (
        <div
          key={`card-${record.idInscription}`}
          className="card-sheet"
          style={{
            width: `${PAGE_MM.width}mm`,
            height: `${PAGE_MM.height}mm`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            backgroundColor: '#ffffff',
          }}
        >
          {/* Recto et verso strictement côte à côte, centrés sur la pliure */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {(['front', 'back'] as const).map((side) => (
              <div
                key={side}
                style={{
                  width: `${CARD_MM.width}mm`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <StudentCardDocument
                  record={record}
                  template={template}
                  side={side}
                />
                <span className="print:hidden mt-1 text-[9px] uppercase tracking-widest text-slate-400">
                  {side === 'front' ? 'Recto' : 'Verso'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
