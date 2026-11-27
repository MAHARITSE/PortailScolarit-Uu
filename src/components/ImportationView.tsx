import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  commitExcelImport,
  formatDateFR,
  ParsedExcelRow,
  parseExcelWorkbook,
} from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';

interface ImportationViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase) => void;
}

const EXCEL_COLUMNS = [
  { col: 'A', label: 'Référence', required: false },
  { col: 'B', label: 'Numéro Inscription', required: false },
  { col: 'C', label: 'Nom', required: true },
  { col: 'D', label: 'Prénom', required: false },
  { col: 'E', label: 'Date de naissance (JJ/MM/AAAA)', required: false },
  { col: 'F', label: 'Lieu de naissance', required: false },
  { col: 'G', label: 'Sexe (M/F)', required: false },
  { col: 'H', label: 'Téléphone', required: false },
  { col: 'I', label: 'Numéro CIN', required: false },
  { col: 'J', label: 'Date CIN (JJ/MM/AAAA)', required: false },
  { col: 'K', label: 'Délivrance CIN', required: false },
  { col: 'L', label: 'Nationalité', required: false },
  { col: 'M', label: 'Faculté', required: true },
  { col: 'N', label: 'Domaine', required: true },
  { col: 'O', label: 'Mention', required: true },
  { col: 'P', label: 'Grade', required: false },
  { col: 'Q', label: 'Niveau', required: true },
  { col: 'R', label: 'Parcours', required: false },
  { col: 'S', label: 'Année universitaire', required: true },
];

export function ImportationView({ db, onUpdateDb }: ImportationViewProps) {
  const [parsedRows, setParsedRows] = useState<ParsedExcelRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseExcelWorkbook(buffer);
      if (rows.length === 0) {
        setParsedRows([]);
        setStatusMessage({
          type: 'error',
          text: 'Aucune donnée trouvée dans le fichier Excel. La ligne 1 doit contenir les en-têtes.',
        });
        return;
      }
      setParsedRows(rows);
    } catch {
      setParsedRows([]);
      setStatusMessage({
        type: 'error',
        text: "Impossible d'ouvrir le fichier Excel ! Vérifiez que le format (.xlsx / .xls) est valide.",
      });
    }
    e.target.value = '';
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.length - validCount;

  const handleImport = () => {
    if (validCount === 0) return;
    const { nextDb, importedCount } = commitExcelImport(db, parsedRows);
    onUpdateDb(nextDb);
    setParsedRows([]);
    setFileName('');
    setStatusMessage({
      type: 'success',
      text: `${importedCount} étudiant(s) importés avec succès !`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Specification Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Importation des étudiants depuis Excel
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Avant d&apos;importer, vérifiez que votre fichier Excel respecte la disposition des colonnes A à S (la ligne 1 doit contenir les en-têtes).
            </p>
          </div>
          <a
            href="/assets/IMPORTATION_Format.xlsx"
            download="IMPORTATION_Format.xlsx"
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Télécharger modèle (.xlsx)
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
          {EXCEL_COLUMNS.map((c) => (
            <div
              key={c.col}
              className="px-2.5 py-2 border border-slate-200 rounded bg-slate-50/70 text-xs"
            >
              <span className="font-mono font-semibold text-blue-700 mr-1.5">{c.col}</span>
              <span className="text-slate-700">{c.label}</span>
              {c.required && <span className="text-red-600 ml-1">*</span>}
            </div>
          ))}
        </div>

        {/* Upload Dropzone */}
        <label className="mt-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 rounded-lg p-8 cursor-pointer transition-colors">
          <Upload className="w-8 h-8 text-blue-600 mb-2" />
          <span className="text-sm font-semibold text-slate-800">
            Sélectionner un fichier Excel (.xlsx, .xls)
          </span>
          <span className="text-xs text-slate-500 mt-1">
            {fileName ? `Fichier chargé : ${fileName}` : 'Cliquez pour parcourir vos fichiers'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {statusMessage && (
          <div
            className={`px-4 py-3 rounded-md border text-sm flex items-center gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Aperçu de l&apos;importation ({parsedRows.length} lignes)
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {validCount} valide(s) · {invalidCount} ignorée(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setFileName('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={validCount === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-40"
              >
                Importer {validCount} étudiant(s)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Ligne</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Réf.</th>
                  <th className="px-3 py-2">Nom &amp; Prénom</th>
                  <th className="px-3 py-2">Naissance</th>
                  <th className="px-3 py-2">Faculté</th>
                  <th className="px-3 py-2">Mention</th>
                  <th className="px-3 py-2">Niveau</th>
                  <th className="px-3 py-2">Année</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(0, 100).map((r) => (
                  <tr key={r.rowIndex} className={r.valid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                    <td className="px-3 py-2 font-mono tabular-nums text-slate-500">
                      {r.rowIndex}
                    </td>
                    <td className="px-3 py-2">
                      {r.valid ? (
                        <span className="text-emerald-700 font-medium">Prêt</span>
                      ) : (
                        <span className="text-red-700 font-medium">{r.error}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.reference || '—'}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {r.nom} {r.prenom}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {formatDateFR(r.dateNaissance) || '—'}
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{r.faculte}</td>
                    <td className="px-3 py-2">{r.mention}</td>
                    <td className="px-3 py-2">{r.niveau}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.annee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 100 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              Affichage limité aux 100 premières lignes sur {parsedRows.length}. Toutes les lignes valides seront importées.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
