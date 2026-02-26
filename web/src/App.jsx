import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Docs from './components/Docs';
import SingleVerifier from './components/SingleVerifier';
import EmailExtractor from './components/EmailExtractor';
import SpamAnalysis from './components/SpamAnalysis';
import ListCleaner from './components/ListCleaner';
import Setup from './components/Setup';
import Login from './components/Login';
import axios from 'axios';
import {
  ShieldCheck,
  BookOpen,
  LayoutDashboard,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  Settings,
  Mail,
  Search,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Filter,
  Loader2
} from 'lucide-react';

// Configure Axios
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('cleanmails_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// For native fetch
const originalFetch = window.fetch;
window.fetch = (...args) => {
  const token = localStorage.getItem('cleanmails_token');
  if (token && args[1]) {
    args[1].headers = {
      ...args[1].headers,
      'Authorization': `Bearer ${token}`
    };
  } else if (token) {
    args[1] = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
  }
  return originalFetch(...args);
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(null); // null means checking
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sharedEmails, setSharedEmails] = useState(null);

  const startValidation = (emails) => {
    setSharedEmails(emails);
    setActiveTab('dashboard');
  };

  useEffect(() => {
    checkStatus();

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetch('/v1/auth/status');
      const data = await response.json();
      setIsInitialized(data.initialized);

      const token = localStorage.getItem('cleanmails_token');
      if (token) {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Failed to check auth status', err);
      setIsInitialized(true); // default to true to show login if server is unreachable
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogin = (token) => {
    setIsAuthenticated(true);
    localStorage.setItem('cleanmails_token', token);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('cleanmails_token');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Email Validation', icon: LayoutDashboard, category: 'PRIMARY TOOLS' },
    { id: 'extractor', label: 'Email Extractor', icon: Mail, category: 'PRIMARY TOOLS' },
    { id: 'cleaner', label: 'List Cleaner', icon: Filter, category: 'PRIMARY TOOLS' },
    { id: 'spam', label: 'Spam Analysis', icon: Search, category: 'PRIMARY TOOLS' },
    { id: 'single', label: 'Single Verifier', icon: User, category: 'SUPPORT TOOLS' },
    { id: 'docs', label: 'Documentation', icon: BookOpen, category: 'SUPPORT TOOLS' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard initialEmails={sharedEmails} onResetState={() => setSharedEmails(null)} />;
      case 'extractor': return <EmailExtractor onValidate={startValidation} />;
      case 'cleaner': return <ListCleaner onValidate={startValidation} />;
      case 'spam': return <SpamAnalysis />;
      case 'single': return <SingleVerifier />;
      case 'docs': return <Docs />;
      case 'settings': return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Settings configuration coming soon...</div>;
      default: return <Dashboard />;
    }
  };

  if (isInitialized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-500 font-black tracking-[0.3em] text-[10px] uppercase">Booting Hygiene Engine...</p>
      </div>
    );
  }

  if (!isInitialized) {
    return <Setup onComplete={() => checkStatus()} />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const primaryTools = menuItems.filter(item => item.category === 'PRIMARY TOOLS');
  const supportTools = menuItems.filter(item => item.category === 'SUPPORT TOOLS');

  return (
    <div className={`min-h-screen flex bg-background text-foreground transition-all duration-300 font-sans ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar Overlay for Mobile */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-primary text-primary-foreground rounded-full shadow-2xl animate-bounce"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 glass border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full flex flex-col p-8">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary/20 rounded-2xl shadow-lg shadow-primary/10">
                <ShieldCheck className="w-8 h-8 text-primary animate-pulse shadow-glow" />
              </div>
              <span className="text-2xl font-black tracking-tighter italic">
                Cleanmails
              </span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            <div className="space-y-10">
              <div>
                <span className="text-[10px] font-black tracking-[0.3em] text-muted-foreground opacity-50 block mb-6 px-4 uppercase">Primary Tools</span>
                <nav className="space-y-3">
                  {primaryTools.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all group ${activeTab === item.id
                        ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/30 scale-[1.02]'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                        <span className="font-bold text-sm tracking-tight">{item.label}</span>
                      </div>
                      {activeTab === item.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    </button>
                  ))}
                </nav>
              </div>

              <div>
                <span className="text-[10px] font-black tracking-[0.3em] text-muted-foreground opacity-50 block mb-6 px-4 uppercase">Support & Docs</span>
                <nav className="space-y-3">
                  {supportTools.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all group ${activeTab === item.id
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon className="w-5 h-5 opacity-60" />
                        <span className="font-bold text-sm tracking-tight">{item.label}</span>
                      </div>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-auto space-y-6">

            <div className="flex items-center justify-between px-2">
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-all"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{darkMode ? 'Light' : 'Dark'} Mode</span>
              </button>

              <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Log Out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
        {/* Top bar refined */}
        <header className="sticky top-0 z-30 w-full bg-background/60 backdrop-blur-xl border-b border-white/5 px-10 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground transition-all">
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-xl font-black italic tracking-tight">{menuItems.find(m => m.id === activeTab)?.label}</h2>
            </div>

            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 shadow-xl shadow-primary/20 border border-white/10" />
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;


