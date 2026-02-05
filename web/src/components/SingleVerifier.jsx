import React, { useState } from 'react';
import axios from 'axios';
import { Search, Shield, Zap, Mail, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

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
            setResult(data);
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
            setResult(data);
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

        if (reachable === 'yes') return { icon: <CheckCircle2 className="w-12 h-12 text-emerald-500" />, label: 'Good / Deliverable', color: 'bg-emerald-50 border-emerald-200' };
        if (smtp?.catch_all) return { icon: <AlertTriangle className="w-12 h-12 text-amber-500" />, label: 'Catch-All (Risky)', color: 'bg-amber-50 border-amber-200' };
        if (disposable) return { icon: <XCircle className="w-12 h-12 text-rose-500" />, label: 'Disposable Address', color: 'bg-rose-50 border-rose-200' };
        if (reachable === 'no' || !mx) return { icon: <XCircle className="w-12 h-12 text-rose-500" />, label: 'Invalid / Non-Existing', color: 'bg-rose-50 border-rose-200' };

        return { icon: <Shield className="w-12 h-12 text-slate-400" />, label: 'Unknown', color: 'bg-slate-50 border-slate-200' };
    };

    const status = getStatusInfo();

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-900">Single Email Verifier</h1>
                <p className="text-slate-500 mt-2 text-sm uppercase tracking-widest font-bold">Phase 1 & Phase 2 Validation</p>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <form onSubmit={checkLevel1} className="flex gap-2">
                    <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input
                            type="email"
                            placeholder="Enter email to check..."
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Verify Now'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
                {error && <p className="text-rose-500 text-sm mt-3 font-medium flex items-center gap-1"><XCircle className="w-4 h-4" /> {error}</p>}
            </div>

            {result && (
                <div className={`p-8 rounded-xl border animate-in fade-in slide-in-from-bottom-4 duration-500 ${status.color}`}>
                    <div className="flex flex-col items-center text-center">
                        {status.icon}
                        <h2 className="text-2xl font-black mt-4 uppercase tracking-tight">{status.label}</h2>
                        <div className="mt-2 text-slate-600 font-mono text-lg">{result.email}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <DetailRow label="Syntax" value={result.syntax?.valid ? 'Valid' : 'Invalid'} success={result.syntax?.valid} />
                        <DetailRow label="MX Records" value={result.has_mx_records ? 'Found' : 'Not Found'} success={result.has_mx_records} />
                        <DetailRow label="Disposable" value={result.disposable ? 'Yes' : 'No'} success={!result.disposable} />
                        <DetailRow label="SMTP" value={result.reachable === 'yes' ? 'Pass' : result.reachable === 'no' ? 'Fail' : 'Untested'} success={result.reachable === 'yes'} />
                    </div>

                    {result.reachable === 'unknown' && result.has_mx_records && (
                        <div className="mt-8 pt-8 border-t border-slate-200 text-center">
                            <p className="text-sm font-bold text-slate-600 mb-4">Want to perform deep SMTP Handshake? Type "yes" below:</p>
                            <div className="flex max-w-xs mx-auto gap-2">
                                <input
                                    type="text"
                                    placeholder="Type 'yes'..."
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={confirmLevel2}
                                    onChange={(e) => setConfirmLevel2(e.target.value)}
                                />
                                <button
                                    onClick={checkLevel2}
                                    disabled={confirmLevel2.toLowerCase() !== 'yes' || loading}
                                    className="bg-slate-900 text-white px-4 py-2 rounded font-bold text-sm hover:bg-black disabled:opacity-20 transition-all"
                                >
                                    Proceed
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const DetailRow = ({ label, value, success }) => (
    <div className="bg-white/50 p-4 rounded-lg flex flex-col items-center justify-center border border-white/20">
        <span className="text-[10px] uppercase font-black text-slate-400 mb-1">{label}</span>
        <span className={`text-sm font-bold ${success ? 'text-emerald-600' : 'text-rose-600'}`}>{value}</span>
    </div>
);

export default SingleVerifier;
