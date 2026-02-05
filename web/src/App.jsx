import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Docs from './components/Docs';
import SingleVerifier from './components/SingleVerifier';
import { ShieldCheck, BookOpen, LayoutDashboard, User } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'single': return <SingleVerifier />;
      case 'docs': return <Docs />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <span className="text-xl font-bold tracking-tight">Cleanmails</span>
        </div>

        <nav className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Bulk
          </button>
          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'single' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <User className="w-4 h-4" />
            Single
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'docs' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <BookOpen className="w-4 h-4" />
            Docs
          </button>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-8">
        {renderContent()}
      </main>

      <footer className="py-8 text-center text-slate-400 text-xs border-t border-slate-100">
        <p>&copy; 2026 Cleanmails email validator v1.0.0.</p>
      </footer>
    </div>
  );
}

export default App;
