import { ChangeEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  commitExcelImport,
  downloadExcelTemplate,
  EXCEL_IMPORT_FIELDS,
  ExcelHeaderInspection,
  ExcelRowStatus,
  formatDateFR,
  getWorkbookSheetNames,
  inspectExcelHeaders,
  ParsedExcelRow,
  parseExcelWorkbook,
} from '../services/database';
import { ImportDuplicateMode, ScolariteDatabase } from '../types/scolarite';
import { LoadingWaitModal, nextAnimationFrame } from './LoadingWaitModal';

interface ImportationViewProps {
  db: ScolariteDatabase;
  /** Année universitaire de travail (une seule à la fois) */
  anneeActive: string;
  onUpdateDb: (nextDb: ScolariteDatabase, toastMessage?: string) => void;
}

export function ImportationView({
  db,
  anneeActive,
  onUpdateDb,
}: ImportationViewProps) {
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rows, setRows] = useState<ParsedExcelRow[]>([]);
  const [headerInspection, setHeaderInspection] =
    useState<ExcelHeaderInspection | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExcelRowStatus>(
    'ALL'
  );
  const [duplicateMode, setDuplicateMode] = useState<ImportDuplicateMode>(
    'skip_existing_inscription'
  );
  const [importReport, setImportReport] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMessage(`Chargement et analyse de "${file.name}" en cours...`);
    try {
      await nextAnimationFrame();
      const buffer = await file.arrayBuffer();
      await nextAnimationFrame();
      const sheets = getWorkbookSheetNames(buffer);
      const firstSheet = sheets[0] ?? '';
      const inspection = inspectExcelHeaders(buffer, firstSheet);
      const parsed = parseExcelWorkbook(buffer, firstSheet, db);
      setFileBuffer(buffer);
      setFileName(file.name);
      setSheetNames(sheets);
      setSelectedSheet(firstSheet);
      setHeaderInspection(inspection);
      setRows(parsed);
      setStatusFilter('ALL');
      setImportReport(null);
    } finally {
      setLoadingMessage(null);
      e.target.value = '';
    }
  };

  const handleSheetChange = async (sheet: string) => {
    setSelectedSheet(sheet);
    if (!fileBuffer) return;
    setLoadingMessage(`Analyse de la feuille "${sheet}" en cours...`);
    try {
      await nextAnimationFrame();
      setHeaderInspection(inspectExcelHeaders(fileBuffer, sheet));
      setRows(parseExcelWorkbook(fileBuffer, sheet, db));
      setStatusFilter('ALL');
      setImportReport(null);
    } finally {
      setLoadingMessage(null);
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

  const handleCommit = async () => {
    if (!actionableCount) return;
    setLoadingMessage(
      `Importation de ${actionableCount.toLocaleString('fr-FR')} ligne(s) dans la base...`
    );
    try {
      await nextAnimationFrame();
      const result = commitExcelImport(db, rows, duplicateMode);
      const msg = `Import terminé : ${result.importedCount} inscription(s) créée(s), ${result.updatedCount} mise(s) à jour, ${result.skippedCount} ignorée(s).`;
      onUpdateDb(result.nextDb, msg);
      setImportReport(msg);
      setRows([]);
      setHeaderInspection(null);
      setFileBuffer(null);
      setSheetNames([]);
    } finally {
      setLoadingMessage(null);
    }
  };

  const detectedFieldSet = useMemo(
    () => new Set(headerInspection?.detectedFields ?? []),
    [headerInspection]
  );

  const detectedCount = useMemo(
    () =>
      EXCEL_IMPORT_FIELDS.filter((f) => detectedFieldSet.has(f.key)).length,
    [detectedFieldSet]
  );

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
                Support multi-feuilles, détection automatique des 23 champs étudiant et gestion des réinscriptions / doublons
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={downloadExcelTemplate}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Télécharger le modèle Excel (23 colonnes)
          </button>
        </div>

        <div className="flex items-start gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Année de travail en cours :{' '}
            <strong className="font-mono tabular-nums">{anneeActive || '—'}</strong>.
            Les inscriptions importées conservent l&apos;année indiquée dans la
            colonne <span className="font-mono">Année Universitaire</span> ;
            utilisez le sélecteur d&apos;année de l&apos;en-tête pour consulter
            une autre année.
          </p>
        </div>

        {/* Upload Zone */}
        <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-slate-50/50">
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {fileName
              ? `Fichier chargé : ${fileName}`
              : 'Cliquez pour sélectionner un fichier .xlsx, .xls ou .csv'}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-4xl mx-auto leading-relaxed">
            Colonnes reconnues ({EXCEL_IMPORT_FIELDS.length}) :{' '}
            {EXCEL_IMPORT_FIELDS.map((f) => f.label).join(', ')}.
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

        {/* Detected Columns Summary */}
        {headerInspection && rows.length > 0 && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">
                Colonnes détectées dans la feuille ({detectedCount} /{' '}
                {EXCEL_IMPORT_FIELDS.length})
              </span>
              {headerInspection.unrecognizedHeaders.length > 0 && (
                <span className="text-[11px] text-amber-700">
                  Colonnes ignorées :{' '}
                  {headerInspection.unrecognizedHeaders.join(', ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXCEL_IMPORT_FIELDS.map((field) => {
                const found = detectedFieldSet.has(field.key);
                return (
                  <span
                    key={field.key}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      found
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : field.required
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    {found && <Check className="w-3 h-3 shrink-0" />}
                    {field.label}
                    {field.required && !found && ' *'}
                  </span>
                );
              })}
            </div>
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
                  <th className="py-2.5 px-3">Ligne</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3">Réf / Inscr. (Adm. &amp; Péd.)</th>
                  <th className="py-2.5 px-3">Identité &amp; Naissance</th>
                  <th className="py-2.5 px-3">Sexe</th>
                  <th className="py-2.5 px-3">CIN &amp; Délivrance</th>
                  <th className="py-2.5 px-3">Contact &amp; Adresse</th>
                  <th className="py-2.5 px-3">Filiation</th>
                  <th className="py-2.5 px-3">Formation &amp; Année</th>
                  <th className="py-2.5 px-3">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedRows.slice(0, 250).map((r) => (
                  <tr key={r.rowIndex} className="hover:bg-slate-50/70 align-top">
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      #{r.rowIndex}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
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
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 space-y-0.5">
                      <div>Réf : {r.reference || '—'}</div>
                      <div>Adm : {r.numInscription || '—'}</div>
                      {r.numInscriptionPedagogique && (
                        <div className="text-blue-700">
                          Péd : {r.numInscriptionPedagogique}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">
                        {r.nom} {r.prenom}
                      </div>
                      {(r.dateNaissance || r.lieuNaissance) && (
                        <div className="text-[11px] text-slate-500">
                          {r.dateNaissance ? formatDateFR(r.dateNaissance) : '—'}
                          {r.lieuNaissance ? ` à ${r.lieuNaissance}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{r.sexe}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] space-y-0.5">
                      <div className="font-mono">{r.numeroCin || '—'}</div>
                      {(r.dateCin || r.lieuDelivrance) && (
                        <div className="text-slate-500">
                          {r.dateCin ? formatDateFR(r.dateCin) : '—'}
                          {r.lieuDelivrance ? ` · ${r.lieuDelivrance}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] space-y-0.5 max-w-[200px]">
                      <div className="font-mono">{r.telephone || '—'}</div>
                      {r.email && (
                        <div className="text-blue-700 truncate" title={r.email}>
                          {r.email}
                        </div>
                      )}
                      {r.adresse && (
                        <div className="text-slate-500 truncate" title={r.adresse}>
                          {r.adresse}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] space-y-0.5 max-w-[180px]">
                      {r.nomPere || r.nomMere ? (
                        <>
                          {r.nomPere && (
                            <div className="truncate" title={r.nomPere}>
                              P : {r.nomPere}
                            </div>
                          )}
                          {r.nomMere && (
                            <div className="truncate" title={r.nomMere}>
                              M : {r.nomMere}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-[11px] space-y-0.5">
                      <div className="font-medium text-slate-900">
                        {r.niveau} ({r.grade}) · {r.mention}
                      </div>
                      <div className="text-slate-500">
                        {r.faculte} · {r.domaine}
                        {r.parcours ? ` · ${r.parcours}` : ''}
                      </div>
                      <div className="font-mono text-blue-700">{r.annee}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
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
      <LoadingWaitModal
        open={Boolean(loadingMessage)}
        title="Veuillez patienter..."
        message={loadingMessage ?? undefined}
      />
    </div>
  );
}
