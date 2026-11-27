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
const HALF_MM = PAGE_MM.width / 2;

/**
 * Impression des cartes d'étudiant.
 * - `fold` : recto et verso côte à côte sur une A4, avec trait de pliure au
 *   centre — la feuille est pliée en deux pour obtenir une carte à deux faces.
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
            margin: '0 auto',
            backgroundColor: '#ffffff',
          }}
        >
          {(['front', 'back'] as const).map((side, index) => (
            <div
              key={side}
              style={{
                width: `${HALF_MM}mm`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3mm',
                borderLeft: index === 1 ? '1px dashed #94a3b8' : undefined,
                position: 'relative',
              }}
            >
              <span className="print:hidden text-[10px] uppercase tracking-widest text-slate-400">
                {side === 'front' ? 'Recto' : 'Verso'}
              </span>
              <StudentCardDocument record={record} template={template} side={side} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
