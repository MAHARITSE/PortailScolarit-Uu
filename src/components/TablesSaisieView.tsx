import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Printer, Search, Trash2, Upload, X } from 'lucide-react';
import { formatDateFR, getNextId } from '../services/database';
import { ScolariteDatabase, TableEntityKey } from '../types/scolarite';

interface TablesSaisieViewProps {
  db: ScolariteDatabase;
  onUpdateDb: (nextDb: ScolariteDatabase) => void;
}

const ENTITY_TABS: { key: TableEntityKey; label: string }[] = [
  { key: 'facultes', label: 'Facultés' },
  { key: 'domaines', label: 'Domaines' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'niveaux', label: 'Niveaux' },
  { key: 'parcours', label: 'Parcours' },
  { key: 'annees', label: 'Années Univ.' },
  { key: 'etudiants', label: 'Étudiants' },
  { key: 'inscriptions', label: 'Inscriptions' },
];

export function TablesSaisieView({ db, onUpdateDb }: TablesSaisieViewProps) {
  const [activeTab, setActiveTab] = useState<TableEntityKey>('facultes');
  const [search, setSearch] = useState<string>('');
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Generic form fields
  const [fText1, setFText1] = useState('');
  const [fText2, setFText2] = useState('');
  const [fLogo, setFLogo] = useState('/assets/logo-uu.jpg');
  const [fFk1, setFFk1] = useState<number>(0);
  const [fFk2, setFFk2] = useState<number>(0);
  const [fFk3, setFFk3] = useState<number>(0);
  const [fFkOpt, setFFkOpt] = useState<number | ''>('');

  // Etudiant specific fields
  const [eDateNaiss, setEDateNaiss] = useState('');
  const [eLieuNaiss, setELieuNaiss] = useState('');
  const [eSexe, setESexe] = useState('M');
  const [eTel, setETel] = useState('');
  const [eCin, setECin] = useState('');
  const [eDateCin, setEDateCin] = useState('');
  const [eLieuDel, setELieuDel] = useState('');
  const [eNat, setENat] = useState('MALAGASY');
  const [ePere, setEPere] = useState('');
  const [eMere, setEMere] = useState('');

  const facMap = useMemo(() => new Map(db.facultes.map((f) => [f.id, f.faculte])), [db.facultes]);
  const domMap = useMemo(() => new Map(db.domaines.map((d) => [d.id, d.domaine])), [db.domaines]);
  const menMap = useMemo(() => new Map(db.mentions.map((m) => [m.id, m.mention])), [db.mentions]);
  const nivMap = useMemo(() => new Map(db.niveaux.map((n) => [n.id, n.niveau])), [db.niveaux]);
  const annMap = useMemo(() => new Map(db.annees.map((a) => [a.id, a.annee])), [db.annees]);
  const parMap = useMemo(() => new Map(db.parcours.map((p) => [p.id, p.parcours])), [db.parcours]);
  const etuMap = useMemo(
    () => new Map(db.etudiants.map((e) => [e.id, `${e.nom} ${e.prenom}`.trim()])),
    [db.etudiants]
  );

  const openNew = () => {
    setEditingId(null);
    setErrorMsg('');
    setFText1('');
    setFText2('');
    setFLogo('/assets/logo-uu.jpg');
    setFFk1(
      activeTab === 'domaines'
        ? db.facultes[0]?.id ?? 0
        : activeTab === 'mentions'
          ? db.domaines[0]?.id ?? 0
          : activeTab === 'parcours'
            ? db.mentions[0]?.id ?? 0
            : activeTab === 'inscriptions'
              ? db.etudiants[0]?.id ?? 0
              : 0
    );
    setFFk2(
      activeTab === 'parcours'
        ? db.niveaux[0]?.id ?? 0
        : activeTab === 'inscriptions'
          ? db.mentions[0]?.id ?? 0
          : 0
    );
    setFFk3(activeTab === 'inscriptions' ? db.niveaux[0]?.id ?? 0 : 0);
    setFFkOpt(activeTab === 'inscriptions' ? db.annees[0]?.id ?? '' : '');
    setEDateNaiss('');
    setELieuNaiss('');
    setESexe('M');
    setETel('');
    setECin('');
    setEDateCin('');
    setELieuDel('');
    setENat('MALAGASY');
    setEPere('');
    setEMere('');
    setFormOpen(true);
  };

  const openEdit = (id: number) => {
    setEditingId(id);
    setErrorMsg('');
    if (activeTab === 'facultes') {
      const r = db.facultes.find((x) => x.id === id);
      if (r) {
        setFText1(r.faculte);
        setFLogo(r.logo || '/assets/logo-uu.jpg');
      }
    } else if (activeTab === 'domaines') {
      const r = db.domaines.find((x) => x.id === id);
      if (r) {
        setFText1(r.domaine);
        setFFk1(r.idFaculte);
      }
    } else if (activeTab === 'mentions') {
      const r = db.mentions.find((x) => x.id === id);
      if (r) {
        setFText1(r.mention);
        setFFk1(r.idDomaine);
      }
    } else if (activeTab === 'niveaux') {
      const r = db.niveaux.find((x) => x.id === id);
      if (r) {
        setFText1(r.niveau);
        setFText2(r.grade);
      }
    } else if (activeTab === 'parcours') {
      const r = db.parcours.find((x) => x.id === id);
      if (r) {
        setFText1(r.parcours);
        setFFk1(r.idMention);
        setFFk2(r.idNiveau);
      }
    } else if (activeTab === 'annees') {
      const r = db.annees.find((x) => x.id === id);
      if (r) setFText1(r.annee);
    } else if (activeTab === 'etudiants') {
      const r = db.etudiants.find((x) => x.id === id);
      if (r) {
        setFText1(r.nom);
        setFText2(r.prenom);
        setEDateNaiss(r.dateNaissance);
        setELieuNaiss(r.lieuNaissance);
        setESexe(r.sexe || 'M');
        setETel(r.telephone);
        setECin(r.numeroCin);
        setEDateCin(r.dateCin);
        setELieuDel(r.lieuDelivrance);
        setENat(r.nationalite || 'MALAGASY');
        setEPere(r.nomPere);
        setEMere(r.nomMere);
      }
    } else if (activeTab === 'inscriptions') {
      const r = db.inscriptions.find((x) => x.id === id);
      if (r) {
        setFText1(r.reference);
        setFText2(r.numInscription);
        setFFk1(r.idEtudiant);
        setFFk2(r.idMention);
        setFFk3(r.idNiveau);
        setFFkOpt(r.idAnnee);
      }
    }
    setFormOpen(true);
  };

  const handleDelete = (id: number) => {
    const next = structuredClone(db);
    if (activeTab === 'facultes') next.facultes = next.facultes.filter((x) => x.id !== id);
    else if (activeTab === 'domaines') next.domaines = next.domaines.filter((x) => x.id !== id);
    else if (activeTab === 'mentions') next.mentions = next.mentions.filter((x) => x.id !== id);
    else if (activeTab === 'niveaux') next.niveaux = next.niveaux.filter((x) => x.id !== id);
    else if (activeTab === 'parcours') next.parcours = next.parcours.filter((x) => x.id !== id);
    else if (activeTab === 'annees') next.annees = next.annees.filter((x) => x.id !== id);
    else if (activeTab === 'etudiants') {
      next.etudiants = next.etudiants.filter((x) => x.id !== id);
      next.inscriptions = next.inscriptions.filter((x) => x.idEtudiant !== id);
    } else if (activeTab === 'inscriptions') {
      next.inscriptions = next.inscriptions.filter((x) => x.id !== id);
    }
    onUpdateDb(next);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const next = structuredClone(db);

    if (activeTab === 'facultes') {
      if (!fText1.trim()) return setErrorMsg('Le nom de la faculté est requis.');
      if (editingId) {
        const idx = next.facultes.findIndex((x) => x.id === editingId);
        if (idx !== -1) next.facultes[idx] = { id: editingId, faculte: fText1.trim(), logo: fLogo };
      } else {
        next.facultes.push({ id: getNextId(next.facultes), faculte: fText1.trim(), logo: fLogo });
      }
    } else if (activeTab === 'domaines') {
      if (!fText1.trim() || !fFk1) return setErrorMsg('Nom du domaine et faculté requis.');
      if (editingId) {
        const idx = next.domaines.findIndex((x) => x.id === editingId);
        if (idx !== -1)
          next.domaines[idx] = { id: editingId, domaine: fText1.trim(), idFaculte: fFk1 };
      } else {
        next.domaines.push({
          id: getNextId(next.domaines),
          domaine: fText1.trim(),
          idFaculte: fFk1,
        });
      }
    } else if (activeTab === 'mentions') {
      if (!fText1.trim() || !fFk1) return setErrorMsg('Nom de la mention et domaine requis.');
      if (editingId) {
        const idx = next.mentions.findIndex((x) => x.id === editingId);
        if (idx !== -1)
          next.mentions[idx] = { id: editingId, mention: fText1.trim(), idDomaine: fFk1 };
      } else {
        next.mentions.push({
          id: getNextId(next.mentions),
          mention: fText1.trim(),
          idDomaine: fFk1,
        });
      }
    } else if (activeTab === 'niveaux') {
      if (!fText1.trim()) return setErrorMsg('Le libellé du niveau est requis.');
      if (editingId) {
        const idx = next.niveaux.findIndex((x) => x.id === editingId);
        if (idx !== -1)
          next.niveaux[idx] = {
            id: editingId,
            niveau: fText1.trim(),
            grade: fText2.trim() || 'Licence',
          };
      } else {
        next.niveaux.push({
          id: getNextId(next.niveaux),
          niveau: fText1.trim(),
          grade: fText2.trim() || 'Licence',
        });
      }
    } else if (activeTab === 'parcours') {
      if (!fText1.trim() || !fFk1 || !fFk2)
        return setErrorMsg('Parcours, Mention et Niveau sont requis.');
      if (editingId) {
        const idx = next.parcours.findIndex((x) => x.id === editingId);
        if (idx !== -1)
          next.parcours[idx] = {
            id: editingId,
            parcours: fText1.trim(),
            idMention: fFk1,
            idNiveau: fFk2,
          };
      } else {
        next.parcours.push({
          id: getNextId(next.parcours),
          parcours: fText1.trim(),
          idMention: fFk1,
          idNiveau: fFk2,
        });
      }
    } else if (activeTab === 'annees') {
      if (!fText1.trim()) return setErrorMsg("L'année universitaire est requise.");
      if (editingId) {
        const idx = next.annees.findIndex((x) => x.id === editingId);
        if (idx !== -1) next.annees[idx] = { id: editingId, annee: fText1.trim() };
      } else {
        next.annees.push({ id: getNextId(next.annees), annee: fText1.trim() });
      }
    } else if (activeTab === 'etudiants') {
      if (!fText1.trim()) return setErrorMsg("Le nom de l'étudiant est requis.");
      const payload = {
        id: editingId ?? getNextId(next.etudiants),
        nom: fText1.trim(),
        prenom: fText2.trim(),
        dateNaissance: eDateNaiss,
        lieuNaissance: eLieuNaiss.trim(),
        sexe: eSexe,
        telephone: eTel.trim(),
        numeroCin: eCin.trim(),
        dateCin: eDateCin,
        lieuDelivrance: eLieuDel.trim(),
        nationalite: eNat.trim() || 'MALAGASY',
        nomPere: ePere.trim(),
        nomMere: eMere.trim(),
      };
      if (editingId) {
        const idx = next.etudiants.findIndex((x) => x.id === editingId);
        if (idx !== -1) next.etudiants[idx] = payload;
      } else {
        next.etudiants.push(payload);
      }
    } else if (activeTab === 'inscriptions') {
      if (!fFk1 || !fFk2 || !fFk3 || !fFkOpt)
        return setErrorMsg('Étudiant, Mention, Niveau et Année requis.');
      const payload = {
        id: editingId ?? getNextId(next.inscriptions),
        idEtudiant: fFk1,
        idMention: fFk2,
        idNiveau: fFk3,
        idAnnee: Number(fFkOpt),
        idParcours: null,
        reference: fText1.trim(),
        numInscription: fText2.trim(),
      };
      if (editingId) {
        const idx = next.inscriptions.findIndex((x) => x.id === editingId);
        if (idx !== -1) next.inscriptions[idx] = payload;
      } else {
        next.inscriptions.push(payload);
      }
    }

    onUpdateDb(next);
    setFormOpen(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setFLogo(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const q = search.trim().toLowerCase();

  return (
    <div className="space-y-5">
      {/* Segmented Tabs for all 8 HFSQL tables */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-1.5 flex flex-wrap gap-1">
        {ENTITY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActiveTab(t.key);
              setSearch('');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === t.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Rechercher dans ${ENTITY_TABS.find((t) => t.key === activeTab)?.label}...`}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Imprimer liste
          </button>
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nouveau
          </button>
        </div>
      </div>

      {/* Print Report Header (ETAT_Liste_*) */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-4">
        <img src="/assets/phoenix-logo.png" alt="Logo" className="w-10 h-10 object-contain" />
        <div className="text-center">
          <p className="text-xs uppercase font-semibold text-slate-600">Université de Toliara</p>
          <h2 className="text-base font-bold uppercase">
            Liste — {ENTITY_TABS.find((t) => t.key === activeTab)?.label}
          </h2>
        </div>
        <span className="text-xs font-mono tabular-nums">
          {new Date().toLocaleDateString('fr-FR')}
        </span>
      </div>

      {/* Table Content */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          {activeTab === 'facultes' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Logo</th>
                  <th className="px-4 py-2.5">Faculté / Établissement</th>
                  <th className="px-4 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.facultes
                  .filter((f) => !q || f.faculte.toLowerCase().includes(q))
                  .map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                        {f.id}
                      </td>
                      <td className="px-4 py-2.5">
                        <img
                          src={f.logo || '/assets/logo-uu.jpg'}
                          alt={f.faculte}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 object-contain border border-slate-200 rounded bg-white p-0.5"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{f.faculte}</td>
                      <td className="px-4 py-2.5 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(f.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'domaines' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Domaine</th>
                  <th className="px-4 py-2.5">Faculté rattachée</th>
                  <th className="px-4 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.domaines
                  .filter(
                    (d) =>
                      !q ||
                      d.domaine.toLowerCase().includes(q) ||
                      (facMap.get(d.idFaculte) ?? '').toLowerCase().includes(q)
                  )
                  .map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                        {d.id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{d.domaine}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {facMap.get(d.idFaculte) ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(d.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'mentions' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Mention</th>
                  <th className="px-4 py-2.5">Domaine</th>
                  <th className="px-4 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.mentions
                  .filter((m) => !q || m.mention.toLowerCase().includes(q))
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                        {m.id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{m.mention}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {domMap.get(m.idDomaine) ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(m.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'niveaux' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Niveau</th>
                  <th className="px-4 py-2.5">Grade</th>
                  <th className="px-4 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.niveaux
                  .filter(
                    (n) =>
                      !q ||
                      n.niveau.toLowerCase().includes(q) ||
                      n.grade.toLowerCase().includes(q)
                  )
                  .map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                        {n.id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{n.niveau}</td>
                      <td className="px-4 py-2.5 text-slate-600">{n.grade}</td>
                      <td className="px-4 py-2.5 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(n.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(n.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'parcours' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Parcours</th>
                  <th className="px-4 py-2.5">Mention</th>
                  <th className="px-4 py-2.5">Niveau</th>
                  <th className="px-4 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.parcours.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-xs">
                      Aucun parcours configuré. Cliquez sur « Nouveau » pour en créer un.
                    </td>
                  </tr>
                ) : (
                  db.parcours
                    .filter((p) => !q || p.parcours.toLowerCase().includes(q))
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                          {p.id}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{p.parcours}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {menMap.get(p.idMention) ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {nivMap.get(p.idNiveau) ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right no-print">
                          <button
                            type="button"
                            onClick={() => openEdit(p.id)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'annees' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Année Universitaire</th>
                  <th className="px-4 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.annees
                  .filter((a) => !q || a.annee.toLowerCase().includes(q))
                  .map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                        {a.id}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 tabular-nums">
                        {a.annee}
                      </td>
                      <td className="px-4 py-2.5 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(a.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'etudiants' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">Nom</th>
                  <th className="px-3 py-2.5">Prénom(s)</th>
                  <th className="px-3 py-2.5">Sexe</th>
                  <th className="px-3 py-2.5">Naissance</th>
                  <th className="px-3 py-2.5">CIN</th>
                  <th className="px-3 py-2.5">Téléphone</th>
                  <th className="px-3 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.etudiants
                  .filter(
                    (e) =>
                      !q ||
                      `${e.nom} ${e.prenom} ${e.numeroCin}`.toLowerCase().includes(q)
                  )
                  .slice(0, 150)
                  .map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-900">{e.nom}</td>
                      <td className="px-3 py-2 text-slate-700">{e.prenom}</td>
                      <td className="px-3 py-2">{e.sexe}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {formatDateFR(e.dateNaissance) || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">{e.numeroCin || '—'}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{e.telephone || '—'}</td>
                      <td className="px-3 py-2 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(e.id)}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'inscriptions' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-600 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">Référence</th>
                  <th className="px-3 py-2.5">N° Inscr.</th>
                  <th className="px-3 py-2.5">Étudiant</th>
                  <th className="px-3 py-2.5">Mention</th>
                  <th className="px-3 py-2.5">Niveau</th>
                  <th className="px-3 py-2.5">Parcours</th>
                  <th className="px-3 py-2.5">Année</th>
                  <th className="px-3 py-2.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.inscriptions
                  .filter((i) => {
                    if (!q) return true;
                    const name = (etuMap.get(i.idEtudiant) ?? '').toLowerCase();
                    return (
                      name.includes(q) ||
                      i.reference.toLowerCase().includes(q) ||
                      i.numInscription.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 150)
                  .map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono tabular-nums">{i.reference || '—'}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {i.numInscription || '—'}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {etuMap.get(i.idEtudiant) ?? '—'}
                      </td>
                      <td className="px-3 py-2">{menMap.get(i.idMention) ?? '—'}</td>
                      <td className="px-3 py-2">{nivMap.get(i.idNiveau) ?? '—'}</td>
                      <td className="px-3 py-2">
                        {i.idParcours ? parMap.get(i.idParcours) ?? '—' : '— Aucun —'}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {annMap.get(i.idAnnee) ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right no-print">
                        <button
                          type="button"
                          onClick={() => openEdit(i.id)}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(i.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal (FEN_Fiche_*) */}
      {formOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                {editingId ? 'Modifier' : 'Ajouter'} —{' '}
                {ENTITY_TABS.find((t) => t.key === activeTab)?.label}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {activeTab === 'facultes' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom de la faculté
                    </label>
                    <input
                      type="text"
                      value={fText1}
                      onChange={(e) => setFText1(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Logo de la faculté
                    </label>
                    <div className="flex items-center gap-3">
                      <img
                        src={fLogo}
                        alt="Logo"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 object-contain border border-slate-200 rounded p-1"
                      />
                      <label className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        Choisir une image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'domaines' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom du domaine
                    </label>
                    <input
                      type="text"
                      value={fText1}
                      onChange={(e) => setFText1(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Faculté</label>
                    <select
                      value={fFk1}
                      onChange={(e) => setFFk1(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {db.facultes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.faculte}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'mentions' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom de la mention
                    </label>
                    <input
                      type="text"
                      value={fText1}
                      onChange={(e) => setFText1(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Domaine</label>
                    <select
                      value={fFk1}
                      onChange={(e) => setFFk1(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {db.domaines.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.domaine}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'niveaux' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Niveau</label>
                    <input
                      type="text"
                      value={fText1}
                      onChange={(e) => setFText1(e.target.value)}
                      placeholder="Ex : L1, Licence 2, Master 1"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Grade</label>
                    <input
                      type="text"
                      value={fText2}
                      onChange={(e) => setFText2(e.target.value)}
                      placeholder="Ex : Licence, Master, Doctorat"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                </>
              )}

              {activeTab === 'parcours' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom du parcours
                    </label>
                    <input
                      type="text"
                      value={fText1}
                      onChange={(e) => setFText1(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mention</label>
                    <select
                      value={fFk1}
                      onChange={(e) => setFFk1(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {db.mentions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.mention}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Niveau</label>
                    <select
                      value={fFk2}
                      onChange={(e) => setFFk2(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {db.niveaux.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.niveau}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'annees' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Année universitaire
                  </label>
                  <input
                    type="text"
                    value={fText1}
                    onChange={(e) => setFText1(e.target.value)}
                    placeholder="Ex : 2025-2026"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
              )}

              {activeTab === 'etudiants' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nom</label>
                    <input
                      type="text"
                      value={fText1}
                      onChange={(e) => setFText1(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Prénom(s)</label>
                    <input
                      type="text"
                      value={fText2}
                      onChange={(e) => setFText2(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Date naiss.
                    </label>
                    <input
                      type="date"
                      value={eDateNaiss}
                      onChange={(e) => setEDateNaiss(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Sexe</label>
                    <select
                      value={eSexe}
                      onChange={(e) => setESexe(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">CIN</label>
                    <input
                      type="text"
                      value={eCin}
                      onChange={(e) => setECin(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={eTel}
                      onChange={(e) => setETel(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'inscriptions' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Référence
                      </label>
                      <input
                        type="text"
                        value={fText1}
                        onChange={(e) => setFText1(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        N° Inscription
                      </label>
                      <input
                        type="text"
                        value={fText2}
                        onChange={(e) => setFText2(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Étudiant</label>
                    <select
                      value={fFk1}
                      onChange={(e) => setFFk1(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {db.etudiants.slice(0, 300).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nom} {e.prenom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mention</label>
                      <select
                        value={fFk2}
                        onChange={(e) => setFFk2(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                      >
                        {db.mentions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.mention}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Niveau</label>
                      <select
                        value={fFk3}
                        onChange={(e) => setFFk3(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                      >
                        {db.niveaux.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.niveau}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Année universitaire
                    </label>
                    <select
                      value={fFkOpt}
                      onChange={(e) => setFFkOpt(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {db.annees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.annee}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
