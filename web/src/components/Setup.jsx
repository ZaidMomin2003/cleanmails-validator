import React, { useState } from 'react';
import { ShieldAlert, Rocket, ArrowRight, User, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';

const Setup = ({ onComplete }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/v1/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to setup');
            }

            onComplete();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100">
            <div className="max-w-xl w-full">
                <div className="text-center mb-10">
                    <div className="bg-primary/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20 border border-primary/30">
                        <Rocket className="w-10 h-10 text-primary animate-pulse" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight italic mb-2">WELCOME TO CLEANMAILS</h1>
                    <p className="text-slate-400 font-medium">First-time initialization required</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5 p-10">
                    <div className="mb-8 flex items-start gap-4 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-amber-500 font-black text-sm uppercase tracking-wider mb-1">CRITICAL WARNING</h3>
                            <p className="text-slate-300 text-sm font-medium">
                                This system is self-hosted and 100% private. <b>We do not store your password.</b>
                                If you forget it, you will lose access to this installation permanently.
                                Write it down or use a manager.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Admin Identity</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter admin name"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-slate-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Master Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create password (min. 8 chars)"
                                    className="w-full pl-12 pr-12 py-4 bg-slate-950/50 border border-white/5 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-slate-600"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Validate Security</label>
                            <div className="relative">
                                <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm master password"
                                    className="w-full pl-12 pr-12 py-4 bg-slate-950/50 border border-white/5 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-slate-600"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="text-rose-500 text-sm font-black text-center bg-rose-500/10 py-3 rounded-xl border border-rose-500/20">
                                {error.toUpperCase()}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-5 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-primary/20 disabled:opacity-50"
                        >
                            {loading ? 'INITIALIZING...' : 'FINISH SYSTEM SETUP'}
                            <ArrowRight className="w-6 h-6" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Setup;
