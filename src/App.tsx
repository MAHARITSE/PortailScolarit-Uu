import { useState } from 'react';
import {
  Database,
  FileCheck2,
  FileSpreadsheet,
  Home,
  Menu,
  Printer,
  Table2,
  X,
} from 'lucide-react';
import { AccueilView } from './components/AccueilView';
import { CertificatsView } from './components/CertificatsView';
import { ImportationView } from './components/ImportationView';
import { SauvegardeView } from './components/SauvegardeView';
import { TablesSaisieView } from './components/TablesSaisieView';
import { loadDatabase, saveDatabase } from './services/database';
import { NavigationView, ScolariteDatabase } from './types/scolarite';

const NAV_ITEMS: {
  key: NavigationView;
  label: string;
  icon: typeof Home;
}[] = [
  { key: 'accueil', label: 'Accueil & Inscriptions', icon: Home },
  { key: 'certificats', label: 'Certificats de Scolarité', icon: FileCheck2 },
  { key: 'importation', label: 'Importation Excel', icon: FileSpreadsheet },
  { key: 'tables', label: 'Tables de Saisie', icon: Table2 },
  { key: 'sauvegarde', label: 'Sauvegarde & Purge', icon: Database },
];

export default function App() {
  const [db, setDb] = useState<ScolariteDatabase>(() => loadDatabase());
  const [activeView, setActiveView] = useState<NavigationView>('accueil');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleUpdateDb = (nextDb: ScolariteDatabase) => {
    setDb(nextDb);
    saveDatabase(nextDb);
  };

  const currentNav = NAV_ITEMS.find((item) => item.key === activeView) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (256px) */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Block */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/logo-uu.jpg"
              alt="Logo Université de Toliara"
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-contain shrink-0 rounded border border-slate-200 bg-white p-0.5"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate font-display">
                Portail Scolarité Uu
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Université de Toliara
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-700"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveView(item.key);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Institutional Footer */}
        <div className="px-4 py-3.5 border-t border-slate-200 flex items-center gap-2.5 text-xs text-slate-500">
          <img
            src="/assets/phoenix-logo.png"
            alt="Phoenix"
            referrerPolicy="no-referrer"
            className="w-6 h-6 object-contain shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium text-slate-700 truncate">Scolarité Centrale</p>
            <p className="text-[11px] text-slate-400 truncate">DSIN · Université de Toliara</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Portail Scolarité Uu
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate font-display">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeView !== 'certificats' && (
              <button
                type="button"
                onClick={() => setActiveView('certificats')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Éditer Certificats
              </button>
            )}
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeView === 'accueil' && (
            <AccueilView db={db} onUpdateDb={handleUpdateDb} />
          )}
          {activeView === 'certificats' && <CertificatsView db={db} />}
          {activeView === 'importation' && (
            <ImportationView db={db} onUpdateDb={handleUpdateDb} />
          )}
          {activeView === 'tables' && (
            <TablesSaisieView db={db} onUpdateDb={handleUpdateDb} />
          )}
          {activeView === 'sauvegarde' && (
            <SauvegardeView db={db} onUpdateDb={handleUpdateDb} />
          )}
        </main>
      </div>
    </div>
  );
}
