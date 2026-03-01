import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, CheckCircle2, AlertCircle, Trash2,
    Zap, Download, Loader2, Search, Filter, List, XCircle, ArrowRight, Mail, Globe, Shield, RefreshCw
} from 'lucide-react';
import axios from 'axios';

const Dashboard = ({ initialEmails = null, onResetState }) => {
    const [step, setStep] = useState('upload');
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [results, setResults] = useState([]);
    const [originalRows, setOriginalRows] = useState([]);
    const [stats, setStats] = useState({ good: 0, risky: 0, bad: 0, syntax: 0, disposable: 0, mx: 0 });
    const [level, setLevel] = useState(1);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPhase2Lists, setSelectedPhase2Lists] = useState({ good: true, bad: false });
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    const resultsPerPage = 50;
    const fileInputRef = useRef(null);

    useEffect(() => {
        let interval;
        if (jobId && step === 'processing') {
            interval = setInterval(pollJobStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [jobId, step]);

    useEffect(() => {
        if (initialEmails && initialEmails.length > 0) {
            const rows = initialEmails.map(email => ({
                original: email,
                email: email.toLowerCase()
            }));
            setOriginalRows(rows);
            startVerification(initialEmails, 1);
            if (onResetState) onResetState();
        }
    }, [initialEmails, onResetState]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, results]);

    const filteredResults = results.filter(item => {
        if (filter === 'all') return true;
        const result = item.result;
        if (!result) return false;

        const isBad = result.reachable === 'no' || result.disposable === true || result.has_mx_records === false;
        if (filter === 'bad') return isBad;
        if (isBad) return false;

        if (level === 1) {
            return filter === 'good';
        } else {
            const isRisky = result.reachable === 'unknown' || result.smtp?.catch_all;
            if (filter === 'good') return !isRisky;
            if (filter === 'risky') return isRisky;
        }
        return false;
    });

    const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
    const paginatedResults = filteredResults.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

    const pollJobStatus = async () => {
        try {
            const { data } = await axios.get(`/v1/bulk/${jobId}`);
            setJobStatus(data.job);
            if (data.job.status === 'completed') {
                fetchResults();
            }
        } catch (err) {
            console.error('Polling error', err);
        }
    };

    const fetchResults = async () => {
        try {
            const { data } = await axios.get(`/v1/bulk/${jobId}/results?limit=100000`);
            const resultMap = {};
            (data.results || []).forEach(r => {
                resultMap[r.email] = r.result;
            });

            const merged = originalRows.map(row => ({
                ...row,
                result: resultMap[row.email]
            }));

            setResults(merged);
            calculateStats(merged);
            setStep('results');
        } catch (err) {
            console.error('Fetch results error', err);
        }
    };

    const calculateStats = (resList) => {
        const s = { good: 0, risky: 0, bad: 0, syntax: 0, disposable: 0, mx: 0 };
        resList.forEach((item) => {
            const result = item.result;
            if (result) {
                const isBad = result.reachable === 'no' || result.disposable === true || result.has_mx_records === false;
                if (isBad) {
                    s.bad++;
                } else {
                    const isRisky = result.reachable === 'unknown' || result.smtp?.catch_all;
                    if (level === 2 && isRisky) {
                        s.risky++;
                    } else {
                        s.good++;
                    }
                }

                if (result.syntax?.valid) s.syntax++;
                if (result.disposable) s.disposable++;
                if (!result.has_mx_records) s.mx++;
            }
        });
        setStats(s);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();

        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;

        const rows = lines.map(line => {
            const match = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            return {
                original: line,
                email: match ? match[0] : null
            };
        }).filter(row => row.email !== null);

        if (rows.length === 0) return;

        setOriginalRows(rows);
        const emails = rows.map(r => r.email);
        startVerification(emails, 1);
    };

    const startVerification = async (emails, l) => {
        try {
            setStep('processing');
            setLevel(l);
            const { data } = await axios.post('/v1/bulk', { emails, level: l });
            setJobId(data.id);
        } catch (err) {
            setStep('upload');
        }
    };

    const resetSession = () => {
        setStep('upload');
        setJobId(null);
        setJobStatus(null);
        setResults([]);
        setOriginalRows([]);
        setStats({ good: 0, risky: 0, bad: 0, syntax: 0, disposable: 0, mx: 0 });
        setFilter('all');
        setCurrentPage(1);
    };

    const downloadResults = (type) => {
        const toDownload = results.filter(row => {
            if (type === 'all') return true;
            const result = row.result;
            if (!result) return false;

            const isBad = result.reachable === 'no' || result.disposable === true || result.has_mx_records === false;
            if (type === 'bad') return isBad;
            if (isBad) return false;

            if (level === 1) {
                return type === 'good';
            } else {
                const isRisky = result.reachable === 'unknown' || result.smtp?.catch_all;
                if (type === 'good') return !isRisky;
                if (type === 'risky') return isRisky;
            }
            return false;
        });

        if (toDownload.length === 0) return;

        const csvContent = toDownload.map(row => {
            const result = row.result;
            const isBad = result?.reachable === 'no' || result?.disposable || !result?.has_mx_records;
            let label = "Good";
            if (isBad) label = "Bad";
            else if (level === 2 && (result?.reachable === 'unknown' || result?.smtp?.catch_all)) label = "Risky/Catchall";

            return `${row.original},${label},${result?.disposable ? 'Disposable' : 'Corporate'},${result?.smtp?.catch_all ? 'Catch-all' : 'Direct'}`;
        }).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cleanmails_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        setShowDownloadMenu(false);
    };

    const proceedToLevel2 = async () => {
        try {
            const { data } = await axios.get('/v1/network-check');
            if (!data.port25) {
                alert("Port 25 is blocked. Results may be inaccurate.");
            }
        } catch (e) { }

        const emailsToVerify = results.filter(item => {
            const isBad = item.result?.reachable === 'no' || item.result?.disposable === true || item.result?.has_mx_records === false;
            const isGood = !isBad;

            if (selectedPhase2Lists.good && isGood) return true;
            if (selectedPhase2Lists.bad && isBad) return true;
            return false;
        }).map(item => item.email);

        if (emailsToVerify.length === 0) return;
        startVerification(emailsToVerify, 2);
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {step === 'upload' && (
                <div className="flex flex-col items-center">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-black tracking-tight mb-3 italic">Bulk Email Hygiene</h1>
                        <p className="text-muted-foreground font-medium uppercase text-xs tracking-[0.3em]">Phase 1: Basic Analysis & Filtering</p>
                    </div>

                    <div
                        className="group relative w-full max-w-4xl bg-card border-4 border-dashed border-muted rounded-[2rem] p-20 text-center hover:border-primary/50 cursor-pointer transition-all duration-500 overflow-hidden"
                        onClick={() => fileInputRef.current.click()}
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept=".csv,.txt" />

                        <div className="relative z-10">
                            <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">
                                <Upload className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">Drop your list here</h3>
                            <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-10 font-medium">Supporting .txt and .csv formats. Optimized for high-volume batches up to 100k.</p>

                            <div className="flex items-center justify-center gap-6">
                                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                    <Zap className="w-3 h-3 text-amber-500" /> Fast Scan
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                    <Shield className="w-3 h-3 text-emerald-500" /> Secure
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                    <Globe className="w-3 h-3 text-blue-500" /> MX Records
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 'processing' && (
                <div className="flex flex-col items-center py-20">
                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                        <Loader2 className="w-20 h-20 text-primary animate-spin relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black mb-2 italic">
                        {level === 1 ? 'Phase 1: Analyzing Infrastructure' : 'Phase 2: SMTP Deep-Handshake'}
                    </h2>
                    <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest mb-10">
                        Synchronizing node {jobStatus?.done || 0} of {jobStatus?.total || 0}
                    </p>

                    <div className="w-full max-w-md bg-muted h-4 rounded-full overflow-hidden shadow-inner border border-white/5">
                        <div
                            className="bg-gradient-to-r from-primary to-indigo-600 h-full transition-all duration-700 ease-out"
                            style={{ width: `${((jobStatus?.done || 0) / (jobStatus?.total || 1)) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {step === 'results' && (
                <div className="space-y-10">
                    <div className={`grid grid-cols-1 ${level === 1 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
                        <ResultStat label="Good / Deliverable" value={stats.good} color="text-emerald-500" icon={<CheckCircle2 className="w-5 h-5" />} />
                        {level === 2 && <ResultStat label="Risky / Catchall" value={stats.risky} color="text-amber-500" icon={<AlertTriangle className="w-5 h-5" />} />}
                        <ResultStat label="Bad / Invalid" value={stats.bad} color="text-rose-500" icon={<XCircle className="w-5 h-5" />} />
                    </div>

                    {level === 1 && (
                        <div className="glass p-10 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-10 border-primary/20">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-amber-500/10 rounded-lg">
                                        <Zap className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <h3 className="text-xl font-bold italic underline decoration-amber-500/30 underline-offset-4">Phase 1 Complete</h3>
                                </div>
                                <p className="text-sm text-muted-foreground font-medium mb-8 max-w-lg leading-relaxed">Infrastructure check finished. Would you like to proceed with real-time mailbox verification for selected segments?</p>

                                <div className="flex flex-wrap gap-4">
                                    <SegmentToggle label="Good" count={stats.good} active={selectedPhase2Lists.good} onClick={() => setSelectedPhase2Lists(p => ({ ...p, good: !p.good }))} color="bg-emerald-500" />
                                    <SegmentToggle label="Bad" count={stats.bad} active={selectedPhase2Lists.bad} onClick={() => setSelectedPhase2Lists(p => ({ ...p, bad: !p.bad }))} color="bg-rose-500" />
                                </div>
                            </div>
                            <button
                                onClick={proceedToLevel2}
                                className="group bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 rounded-2xl font-black italic tracking-tight flex items-center gap-3 transition-all shadow-xl shadow-primary/20"
                            >
                                Start Handshake
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    )}

                    <div className="bg-card glass border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex flex-wrap justify-between items-center gap-6">
                            <div className="flex flex-wrap gap-3 items-center">
                                {['all', 'good', level === 2 ? 'risky' : null, 'bad'].filter(Boolean).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-muted text-muted-foreground'}`}
                                    >
                                        {f}
                                    </button>
                                ))}

                                <div className="h-6 w-[1px] bg-muted mx-2" />

                                <div className="relative">
                                    <button
                                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                        className="flex items-center gap-2 px-5 py-2 bg-foreground text-background dark:bg-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-90"
                                    >
                                        <Download className="w-3 h-3" />
                                        Export List
                                    </button>

                                    {showDownloadMenu && (
                                        <div className="absolute left-0 mt-3 w-56 bg-card border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-200">
                                            <DownloadOption onClick={() => downloadResults('all')} label="All Results" icon={<List className="w-4 h-4" />} />
                                            <DownloadOption onClick={() => downloadResults('good')} label="Good Only" icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} />
                                            {level === 2 && <DownloadOption onClick={() => downloadResults('risky')} label="Risky Only" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} />}
                                            <DownloadOption onClick={() => downloadResults('bad')} label="Bad Only" icon={<XCircle className="w-4 h-4 text-rose-500" />} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button onClick={resetSession} className="text-muted-foreground hover:text-destructive flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors">
                                <RefreshCw className="w-3.5 h-3.5" />
                                Start Fresh
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 text-muted-foreground">
                                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Recipient Email</th>
                                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Segment</th>
                                        <th className="px-8 py-4 font-black uppercase tracking-widest text-[10px]">MX Status</th>
                                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Verification Result</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedResults.map((item, idx) => {
                                        const result = item.result;
                                        const isDisposable = result?.disposable;
                                        const hasMX = result?.has_mx_records;
                                        const reachable = result?.reachable || 'unknown';
                                        const smtp = result?.smtp;

                                        return (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-8 py-5 font-bold">
                                                    <div className="flex items-center gap-3">
                                                        <Mail className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        {item.email}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${isDisposable ? 'border-rose-500/20 text-rose-500 bg-rose-500/5' : 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'}`}>
                                                        {isDisposable ? 'DISPOSABLE' : 'CORPORATE'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className={`flex items-center gap-2 text-[10px] font-bold ${hasMX ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {hasMX ? <Globe className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                        {hasMX ? 'ACTIVE' : 'INACTIVE'}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <ResultBadge result={result} level={level} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="p-8 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <div className="flex gap-4">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => p - 1)}
                                        className="px-6 py-3 bg-muted rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent disabled:opacity-20 transition-all font-mono"
                                    >
                                        [PREV]
                                    </button>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                        className="px-6 py-3 bg-muted rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent disabled:opacity-20 transition-all font-mono"
                                    >
                                        [NEXT]
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ResultStat = ({ label, value, color, icon }) => (
    <div className="bg-card glass border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className={`absolute -right-4 -top-4 w-24 h-24 ${color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
        <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</span>
            <div className={`p-2 rounded-lg bg-card border border-white/10 ${color}`}>{icon}</div>
        </div>
        <div className={`text-4xl font-black italic ${color}`}>{value.toLocaleString()}</div>
    </div>
);

const SegmentToggle = ({ label, count, active, onClick, color }) => (
    <button
        onClick={onClick}
        className={`px-6 py-3 rounded-2xl flex items-center gap-3 border transition-all duration-300 ${active
            ? `${color} text-white shadow-lg border-transparent`
            : 'bg-card border-white/10 text-muted-foreground hover:border-primary/30'
            }`}
    >
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-white' : color} animate-pulse`} />
        <span className="text-[11px] font-black uppercase tracking-widest">{label} ({count})</span>
    </button>
);

const DownloadOption = ({ onClick, label, icon }) => (
    <button
        onClick={onClick}
        className="w-full text-left px-5 py-3 text-[10px] font-black text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-3 transition-colors uppercase tracking-widest"
    >
        {icon} {label}
    </button>
);

const ResultBadge = ({ result, level }) => {
    if (!result) return null;
    const { reachable, smtp, disposable, has_mx_records: mx } = result;
    const isBad = reachable === 'no' || disposable === true || mx === false;

    if (isBad) return (
        <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-4 py-1.5 rounded-full text-[9px] font-black italic uppercase tracking-wider">
            BAD / INVALID
        </span>
    );

    const isRisky = reachable === 'unknown' || smtp?.catch_all;
    if (level === 2 && isRisky) return (
        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-1.5 rounded-full text-[9px] font-black italic uppercase tracking-wider">
            RISKY / CATCHALL
        </span>
    );

    return (
        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-1.5 rounded-full text-[9px] font-black italic uppercase tracking-wider">
            GOOD / DELIVERABLE
        </span>
    );
};

export default Dashboard;

