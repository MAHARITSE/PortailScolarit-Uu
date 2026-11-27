import { useMemo, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { enrichInscriptions } from '../services/database';
import { ScolariteDatabase } from '../types/scolarite';
import { CertificateDocument } from './CertificateDocument';

interface CertificatsViewProps {
  db: ScolariteDatabase;
}

export function CertificatsView({ db }: CertificatsViewProps) {
  const [selectedAnnee, setSelectedAnnee] = useState<string>(db.annees[0]?.annee ?? 'Tous');
  const [selectedFaculte, setSelectedFaculte] = useState<string>('Tous');
  const [selectedDomaine, setSelectedDomaine] = useState<string>('Tous');
  const [selectedMention, setSelectedMention] = useState<string>('Tous');
  const [selectedNiveau, setSelectedNiveau] = useState<string>('Tous');
  const [selectedParcours, setSelectedParcours] = useState<string>('Tous');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState<boolean>(false);
  const [printMode, setPrintMode] = useState<'single' | 'batch'>('single');

  const allEnriched = useMemo(() => enrichInscriptions(db), [db]);

  const domaineOptions = useMemo(() => {
    const facObj = db.facultes.find((f) => f.faculte === selectedFaculte);
    return db.domaines
      .filter((d) => selectedFaculte === 'Tous' || !facObj || d.idFaculte === facObj.id)
      .map((d) => d.domaine)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.facultes, db.domaines, selectedFaculte]);

  const mentionOptions = useMemo(() => {
    const facObj = db.facultes.find((f) => f.faculte === selectedFaculte);
    const domObj = db.domaines.find(
      (d) =>
        d.domaine === selectedDomaine &&
        (selectedFaculte === 'Tous' || !facObj || d.idFaculte === facObj.id)
    );
    const validDomIds =
      selectedDomaine !== 'Tous' && domObj
        ? [domObj.id]
        : selectedFaculte !== 'Tous' && facObj
          ? db.domaines.filter((d) => d.idFaculte === facObj.id).map((d) => d.id)
          : null;
    return db.mentions
      .filter((m) => !validDomIds || validDomIds.includes(m.idDomaine))
      .map((m) => m.mention)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.facultes, db.domaines, db.mentions, selectedFaculte, selectedDomaine]);

  const parcoursOptions = useMemo(() => {
    const menObj = db.mentions.find((m) => m.mention === selectedMention);
    const nivObj = db.niveaux.find((n) => n.niveau === selectedNiveau);
    return db.parcours
      .filter(
        (p) =>
          (selectedMention === 'Tous' || !menObj || p.idMention === menObj.id) &&
          (selectedNiveau === 'Tous' || !nivObj || p.idNiveau === nivObj.id)
      )
      .map((p) => p.parcours)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.mentions, db.niveaux, db.parcours, selectedMention, selectedNiveau]);

  const matchingRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return allEnriched.filter((r) => {
      if (selectedAnnee !== 'Tous' && r.annee !== selectedAnnee) return false;
      if (selectedFaculte !== 'Tous' && r.faculte !== selectedFaculte) return false;
      if (selectedDomaine !== 'Tous' && r.domaine !== selectedDomaine) return false;
      if (selectedMention !== 'Tous' && r.mention !== selectedMention) return false;
      if (selectedNiveau !== 'Tous' && r.niveau !== selectedNiveau) return false;
      if (selectedParcours !== 'Tous' && r.parcours !== selectedParcours) return false;
      if (q) {
        const hay = `${r.nom} ${r.prenom} ${r.reference} ${r.numInscription}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allEnriched,
    selectedAnnee,
    selectedFaculte,
    selectedDomaine,
    selectedMention,
    selectedNiveau,
    selectedParcours,
    studentSearch,
  ]);

  const activeRecord = useMemo(() => {
    if (previewId) {
      const found = matchingRows.find((r) => r.idInscription === previewId);
      if (found) return found;
    }
    return matchingRows[0] ?? null;
  }, [matchingRows, previewId]);

  const triggerSinglePrint = () => {
    setPrintMode('single');
    setTimeout(() => window.print(), 50);
  };

  const confirmBatchPrint = () => {
    setBatchConfirmOpen(false);
    setPrintMode('batch');
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6">
      {/* Criteria Panel (FEN_Impression_Certificat) */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Impression des Certificats de Scolarité
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez vos critères pour prévisualiser ou imprimer un lot complet
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeRecord && (
              <button
                type="button"
                onClick={triggerSinglePrint}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                Imprimer cet étudiant
              </button>
            )}
            <button
              type="button"
              onClick={() => setBatchConfirmOpen(true)}
              disabled={matchingRows.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Imprimer le lot ({Math.min(matchingRows.length, 200)})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Année univ.
            </label>
            <select
              value={selectedAnnee}
              onChange={(e) => setSelectedAnnee(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="Tous">Tous</option>
              {db.annees.map((a) => (
                <option key={a.id} value={a.annee}>
                  {a.annee}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Faculté</label>
            <select
              value={selectedFaculte}
              onChange={(e) => {
                setSelectedFaculte(e.target.value);
                setSelectedDomaine('Tous');
                setSelectedMention('Tous');
                setSelectedParcours('Tous');
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="Tous">Tous</option>
              {db.facultes.map((f) => (
                <option key={f.id} value={f.faculte}>
                  {f.faculte}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Domaine</label>
            <select
              value={selectedDomaine}
              onChange={(e) => {
                setSelectedDomaine(e.target.value);
                setSelectedMention('Tous');
                setSelectedParcours('Tous');
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="Tous">Tous</option>
              {domaineOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Mention</label>
            <select
              value={selectedMention}
              onChange={(e) => {
                setSelectedMention(e.target.value);
                setSelectedParcours('Tous');
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="Tous">Tous</option>
              {mentionOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Niveau</label>
            <select
              value={selectedNiveau}
              onChange={(e) => {
                setSelectedNiveau(e.target.value);
                setSelectedParcours('Tous');
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="Tous">Tous</option>
              {db.niveaux.map((n) => (
                <option key={n.id} value={n.niveau}>
                  {n.niveau}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Parcours</label>
            <select
              value={selectedParcours}
              onChange={(e) => setSelectedParcours(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="Tous">Tous</option>
              {parcoursOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Split View: Matching Student Selector + Live Certificate Preview */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Filtrer un étudiant..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <p className="text-[11px] text-slate-500 tabular-nums">
              {matchingRows.length} certificat(s) correspondant(s)
            </p>
          </div>

          <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100">
            {matchingRows.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Aucun étudiant ne correspond aux critères sélectionnés.
              </div>
            ) : (
              matchingRows.slice(0, 150).map((r) => {
                const isSelected = activeRecord?.idInscription === r.idInscription;
                return (
                  <button
                    key={r.idInscription}
                    type="button"
                    onClick={() => setPreviewId(r.idInscription)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">
                      {r.nom} {r.prenom}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="font-mono tabular-nums">{r.reference || r.numInscription}</span>
                      <span>·</span>
                      <span>{r.mention}</span>
                      <span>·</span>
                      <span>{r.niveau}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {activeRecord ? (
            <CertificateDocument record={activeRecord} />
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
              Sélectionnez un étudiant pour afficher l&apos;aperçu du certificat de scolarité.
            </div>
          )}
        </div>
      </div>

      {/* Print-only area (single or batch) */}
      <div className="hidden print:block">
        {printMode === 'single' && activeRecord && (
          <CertificateDocument record={activeRecord} />
        )}
        {printMode === 'batch' &&
          matchingRows.slice(0, 200).map((rec) => (
            <div key={rec.idInscription} className="print-page-break">
              <CertificateDocument record={rec} />
            </div>
          ))}
      </div>

      {/* Confirmation Dialog matching FEN_Impression_Certificat */}
      {batchConfirmOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Impression des certificats par lot
            </h3>
            <div className="text-xs text-slate-700 space-y-1.5 bg-slate-50 border border-slate-200 p-3.5 rounded">
              <p className="font-medium text-slate-900 mb-2">
                Vous allez imprimer {Math.min(matchingRows.length, 200)} certificat(s) avec les critères suivants :
              </p>
              <p>· Faculté : <strong>{selectedFaculte}</strong></p>
              <p>· Domaine : <strong>{selectedDomaine}</strong></p>
              <p>· Mention : <strong>{selectedMention}</strong></p>
              <p>· Niveau : <strong>{selectedNiveau}</strong></p>
              <p>· Parcours : <strong>{selectedParcours}</strong></p>
              {matchingRows.length > 200 && (
                <p className="text-amber-700 pt-1">
                  Note : l&apos;impression par lot est limitée à 200 certificats par session.
                </p>
              )}
            </div>
            <p className="text-xs text-slate-600">Voulez-vous continuer ?</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmBatchPrint}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Lancer l&apos;impression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
