import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === 'hubsellistrash') {
            onLogin();
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">CLEANMAILS</h1>
                    <p className="text-slate-500 font-medium mt-2">Professional Email Hygiene Engine</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <Lock className="w-5 h-5 text-slate-400" />
                        <h2 className="text-xl font-bold text-slate-800">System Locked</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter system password"
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none transition-all font-medium ${error
                                        ? 'border-rose-500 ring-2 ring-rose-100'
                                        : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50'
                                    }`}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-rose-600 text-sm font-bold animate-in fade-in duration-300">
                                <AlertCircle className="w-4 h-4" />
                                Invalid credentials sequence.
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            UNLOCK ENGINE
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Secure Self-Hosted Environment</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
