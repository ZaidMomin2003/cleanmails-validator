import React, { useState } from 'react';
import axios from 'axios';
import { Search, Shield, Zap, Mail, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Globe, Info } from 'lucide-react';

const SingleVerifier = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [confirmLevel2, setConfirmLevel2] = useState('');
    const [error, setError] = useState(null);

    const checkLevel1 = async (e) => {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setConfirmLevel2('');

        try {
            const { data } = await axios.post('/v1/verify', { email, level: 1 });
            setResult({ ...data, level: 1 });
        } catch (err) {
            setError(err.response?.data?.error || 'Validation failed');
        } finally {
            setLoading(false);
        }
    };

    const checkLevel2 = async () => {
        if (confirmLevel2.toLowerCase() !== 'yes') return;

        setLoading(true);
        setError(null);

        try {
            const { data } = await axios.post('/v1/verify', { email, level: 2 });
            setResult({ ...data, level: 2 });
        } catch (err) {
            setError(err.response?.data?.error || 'Level 2 Validation failed');
        } finally {
            setLoading(false);
            setConfirmLevel2('');
        }
    };

    const getStatusInfo = () => {
        if (!result) return null;

        const reachable = result.reachable;
        const mx = result.has_mx_records;
        const disposable = result.disposable;
        const smtp = result.smtp;
        const level = result.level || 1;

        const isBad = reachable === 'no' || disposable === true || mx === false;

        if (isBad) {
            if (disposable) return { icon: <XCircle className="w-12 h-12 text-rose-500" />, label: 'Disposable Address', color: 'border-rose-500/20 bg-rose-500/5 text-rose-500', subLabel: 'Temporary mailbox. High bounce risk.' };
            return { icon: <XCircle className="w-12 h-12 text-rose-500" />, label: 'Invalid Recipient', color: 'border-rose-500/20 bg-rose-500/5 text-rose-500', subLabel: 'Mailbox target does not exist or host is down.' };
        }

        if (level === 2) {
            const isRisky = smtp?.catch_all || reachable === 'unknown';
            if (isRisky) return { icon: <AlertTriangle className="w-12 h-12 text-amber-500" />, label: 'Risky / Catch-All', color: 'border-amber-500/20 bg-amber-500/5 text-amber-500', subLabel: 'Catch-all domain or existence undefined. Moderate risk.' };
            return { icon: <CheckCircle2 className="w-12 h-12 text-emerald-500" />, label: 'Verified Deliverable', color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500', subLabel: 'Mailbox confirmed via SMTP handshake.' };
        }

        // Phase 1 - Good/Risky Merged
        return { icon: <CheckCircle2 className="w-12 h-12 text-emerald-500" />, label: 'Deliverable (L1)', color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500', subLabel: 'Infrastructure verified. Deep-handshake recommended.' };
    };

    const status = getStatusInfo();

    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="text-center">
                <h1 className="text-4xl font-black italic tracking-tight mb-3">Single Point Verification</h1>
                <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.4em]">Node-Level Email Intelligence</p>
            </div>

            <div className="bg-card glass border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-50" />

                <form onSubmit={checkLevel1} className="relative z-10">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="email"
                                placeholder="target@example.com"
                                className="w-full pl-14 pr-6 py-5 rounded-2xl bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-card focus:outline-none transition-all font-bold text-lg"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 rounded-2xl font-black italic tracking-tight flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                        >
                            {loading ? 'Analyzing Host...' : 'Run Diagnostics'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    {error && (
                        <div className="mt-6 flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-wider animate-in fade-in slide-in-from-top-2">
                            <XCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                </form>
            </div>

            {result && (
                <div className={`p-10 rounded-[2.5rem] border glass shadow-2xl animate-in fade-in zoom-in-95 duration-500 ${status.color}`}>
                    <div className="flex flex-col items-center text-center mb-12">
                        <div className="p-4 bg-background/50 rounded-3xl mb-6 shadow-inner">
                            {status.icon}
                        </div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">{status.label}</h2>
                        <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{status.subLabel}</p>
                        <div className="mt-6 px-4 py-2 bg-background/50 rounded-xl font-mono text-sm border border-black/5 dark:border-white/5">{result.email}</div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <DiagCard label="Syntax" value={result.syntax?.valid ? 'RFC PASS' : 'FAIL'} success={result.syntax?.valid} icon={<Info className="w-3 h-3" />} />
                        <DiagCard label="MX Records" value={result.has_mx_records ? 'ACTIVE' : 'NONE'} success={result.has_mx_records} icon={<Globe className="w-3 h-3" />} />
                        <DiagCard label="Host Type" value={result.disposable ? 'DISPOSABLE' : 'CORPORATE'} success={!result.disposable} icon={<Shield className="w-3 h-3" />} />
                        <DiagCard label="SMTP Rank" value={result.reachable === 'yes' ? 'RANK A' : result.reachable === 'no' ? 'RANK F' : 'RANK U'} success={result.reachable === 'yes'} icon={<Zap className="w-3 h-3" />} />
                    </div>

                    {result.reachable === 'unknown' && result.has_mx_records && (
                        <div className="mt-12 pt-10 border-t border-black/5 dark:border-white/5 space-y-6">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Phase 2 Authorization</span>
                                <h3 className="text-lg font-bold italic">Deep Handshake Analysis Required</h3>
                            </div>

                            <div className="flex max-w-sm mx-auto gap-3">
                                <input
                                    type="text"
                                    placeholder="Type 'yes' to pulse..."
                                    className="flex-1 px-5 py-3 rounded-xl bg-background/50 border border-black/10 dark:border-white/10 focus:outline-none focus:border-primary/50 text-sm font-bold uppercase tracking-widest"
                                    value={confirmLevel2}
                                    onChange={(e) => setConfirmLevel2(e.target.value)}
                                />
                                <button
                                    onClick={checkLevel2}
                                    disabled={confirmLevel2.toLowerCase() !== 'yes' || loading}
                                    className="bg-foreground text-background dark:bg-white dark:text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-20 transition-all"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const DiagCard = ({ label, value, success, icon }) => (
    <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center text-center border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-[9px] uppercase font-black tracking-widest opacity-50">{label}</span>
        </div>
        <span className={`text-xs font-black italic tracking-tight ${success ? 'text-emerald-500' : 'text-rose-500'}`}>{value}</span>
    </div>
);

export default SingleVerifier;

