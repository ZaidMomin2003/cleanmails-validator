import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, AlertCircle, User, Eye, EyeOff } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Invalid credentials');
            }

            onLogin(data.token);
        } catch (err) {
            setError(err.message);
            setTimeout(() => setError(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
            <div className="max-w-md w-full">
                <div className="text-center mb-10">
                    <div className="bg-primary/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/20 border border-primary/30 outline outline-4 outline-primary/5">
                        <ShieldCheck className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight italic">CLEANMAILS</h1>
                    <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-[10px]">Professional Hygiene Engine</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/5 p-10">
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/5">
                            <Lock className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-xl font-black text-white italic tracking-tight">System Locked</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Identity</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Admin Username"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-slate-700"
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Access Key</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter system password"
                                    className={`w-full pl-12 pr-12 py-4 bg-slate-950/50 border rounded-2xl outline-none transition-all font-bold placeholder:text-slate-700 ${error
                                        ? 'border-rose-500/50 ring-4 ring-rose-500/10'
                                        : 'border-white/5 focus:border-primary focus:ring-4 focus:ring-primary/10'
                                        }`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-rose-500 text-xs font-black uppercase tracking-wider bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-5 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-primary/20 disabled:opacity-50"
                        >
                            {loading ? 'VERIFYING...' : 'UNLOCK SYSTEM'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-white/5 text-center">
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] leading-relaxed">
                            Secured Self-Hosted Cryptographic Node<br />
                            Unauthorized access is prohibited
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
