import { ChangeEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  commitExcelImport,
  downloadExcelTemplate,
  ExcelRowStatus,
  getWorkbookSheetNames,
  ParsedExcelRow,
  parseExcelWorkbook,
} from '../services/database';
import { ImportDuplicateMode, ScolariteDatabase } from '../types/scolarite';

interface ImportationViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
}

export function ImportationView({ db, onUpdateDb }: ImportationViewProps) {
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rows, setRows] = useState<ParsedExcelRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExcelRowStatus>(
    'ALL'
  );
  const [duplicateMode, setDuplicateMode] = useState<ImportDuplicateMode>(
    'skip_existing_inscription'
  );
  const [importReport, setImportReport] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const sheets = getWorkbookSheetNames(buffer);
    const firstSheet = sheets[0] ?? '';
    setFileBuffer(buffer);
    setFileName(file.name);
    setSheetNames(sheets);
    setSelectedSheet(firstSheet);
    setRows(parseExcelWorkbook(buffer, firstSheet, db));
    setStatusFilter('ALL');
    setImportReport(null);
    e.target.value = '';
  };

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    if (fileBuffer) {
      setRows(parseExcelWorkbook(fileBuffer, sheet, db));
      setStatusFilter('ALL');
      setImportReport(null);
    }
  };

  const summary = useMemo(() => {
    let newCount = 0;
    let reinscCount = 0;
    let dupCount = 0;
    let errCount = 0;
    for (const r of rows) {
      if (r.status === 'new') newCount++;
      else if (r.status === 'reinscription') reinscCount++;
      else if (r.status === 'duplicate_inscription') dupCount++;
      else errCount++;
    }
    return {
      newCount,
      reinscCount,
      dupCount,
      errCount,
      total: rows.length,
    };
  }, [rows]);

  const displayedRows = useMemo(() => {
    if (statusFilter === 'ALL') return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const actionableCount = useMemo(() => {
    if (duplicateMode === 'skip_existing_inscription') {
      return summary.newCount + summary.reinscCount;
    }
    return summary.newCount + summary.reinscCount + summary.dupCount;
  }, [duplicateMode, summary]);

  const handleCommit = () => {
    if (!actionableCount) return;
    const result = commitExcelImport(db, rows, duplicateMode);
    const msg = `Import terminé : ${result.importedCount} inscription(s) créée(s), ${result.updatedCount} mise(s) à jour, ${result.skippedCount} ignorée(s).`;
    onUpdateDb(result.nextDb, msg);
    setImportReport(msg);
    setRows([]);
    setFileBuffer(null);
    setSheetNames([]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Importation Excel / CSV
              </h2>
              <p className="text-xs text-slate-500">
                Support multi-feuilles, détection automatique des entêtes (dont téléphone en colonne H) et gestion des réinscriptions / doublons
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={downloadExcelTemplate}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Télécharger le modèle Excel
          </button>
        </div>

        {/* Upload Zone */}
        <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-slate-50/50">
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {fileName
              ? `Fichier chargé : ${fileName}`
              : 'Cliquez pour sélectionner un fichier .xlsx, .xls ou .csv'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Colonnes reconnues : Ref, Num Inscr, NOM, PRÉNOMS, DATE DE NAISSANCE, SEXE, Téléphone, CIN, Faculte, Domaine, Mention, Grade, Niveau, Parcours, Annee.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {importReport && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{importReport}</span>
          </div>
        )}

        {/* Import Options when file loaded */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            {sheetNames.length > 1 && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Feuille Excel à analyser ({sheetNames.length} détectées)
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Stratégie face aux doublons détectés
              </label>
              <select
                value={duplicateMode}
                onChange={(e) =>
                  setDuplicateMode(e.target.value as ImportDuplicateMode)
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="skip_existing_inscription">
                  Ignorer les inscriptions déjà présentes sur la même année (recommandé)
                </option>
                <option value="update_student">
                  Mettre à jour la fiche étudiant &amp; l&apos;inscription existante
                </option>
                <option value="create_new">
                  Tout créer comme nouvelles fiches (homonymes avérés)
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  ['ALL', `Toutes (${summary.total})`, 'bg-slate-900 text-white'],
                  [
                    'new',
                    `Nouveaux (${summary.newCount})`,
                    'bg-emerald-600 text-white',
                  ],
                  [
                    'reinscription',
                    `Réinscriptions (${summary.reinscCount})`,
                    'bg-blue-600 text-white',
                  ],
                  [
                    'duplicate_inscription',
                    `Déjà inscrits (${summary.dupCount})`,
                    'bg-amber-600 text-white',
                  ],
                  [
                    'error',
                    `Erreurs (${summary.errCount})`,
                    'bg-red-600 text-white',
                  ],
                ] as const
              ).map(([key, label, activeCls]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-md font-medium border ${
                    statusFilter === key
                      ? `${activeCls} border-transparent`
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={actionableCount === 0}
              onClick={handleCommit}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40"
            >
              Importer {actionableCount} ligne(s)
            </button>
          </div>

          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Ligne</th>
                  <th className="py-2.5 px-4">Statut</th>
                  <th className="py-2.5 px-4">Réf / N° Inscr.</th>
                  <th className="py-2.5 px-4">Nom &amp; Prénom</th>
                  <th className="py-2.5 px-4">Sexe</th>
                  <th className="py-2.5 px-4">CIN / Tél</th>
                  <th className="py-2.5 px-4">Formation &amp; Année</th>
                  <th className="py-2.5 px-4">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedRows.slice(0, 250).map((r) => (
                  <tr key={r.rowIndex} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      #{r.rowIndex}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.status === 'new' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Nouveau
                        </span>
                      )}
                      {r.status === 'reinscription' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                          <RefreshCw className="w-3 h-3" /> Réinscription
                        </span>
                      )}
                      {r.status === 'duplicate_inscription' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Déjà inscrit
                        </span>
                      )}
                      {r.status === 'error' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">
                          <AlertCircle className="w-3 h-3" /> Erreur
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {r.reference || '—'} / {r.numInscription || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {r.nom} {r.prenom}
                    </td>
                    <td className="py-2.5 px-4 font-mono">{r.sexe}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                      {r.numeroCin || '—'} · {r.telephone || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {r.niveau} {r.mention} · {r.annee}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {r.error ||
                        r.warning ||
                        (r.status === 'duplicate_inscription'
                          ? 'Déjà inscrit sur cette année'
                          : r.status === 'reinscription'
                            ? `Étudiant existant #${r.matchedEtudiantId}`
                            : 'Prêt')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayedRows.length > 250 && (
            <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
              Aperçu limité aux 250 premières lignes affichées (
              {displayedRows.length} au total dans ce filtre). Toutes les lignes
              valides seront traitées lors de l&apos;importation.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
