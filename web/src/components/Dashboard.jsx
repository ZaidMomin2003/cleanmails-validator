import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, CheckCircle2, AlertCircle, Trash2,
    Server, User, Zap, Download, Loader2, Search, Filter, List
} from 'lucide-react';
import axios from 'axios';

const Dashboard = () => {
    const [step, setStep] = useState('upload');
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [results, setResults] = useState([]);
    const [stats, setStats] = useState({ good: 0, risky: 0, bad: 0, syntax: 0, disposable: 0, mx: 0 });
    const [level, setLevel] = useState(1);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPhase2Lists, setSelectedPhase2Lists] = useState({ good: true, risky: false, bad: false });

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
        setCurrentPage(1);
    }, [filter, results]);

    const filteredResults = results.filter(item => {
        if (filter === 'all') return true;
        const status = item.result?.reachable || 'unknown';
        const isGood = status === 'yes';
        const isBad = status === 'no' || item.result?.disposable === true || item.result?.has_mx_records === false;
        const isRisky = !isGood && !isBad;

        if (filter === 'good') return isGood;
        if (filter === 'risky') return isRisky;
        if (filter === 'bad') return isBad;
        return true;
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
            setResults(data.results || []);
            calculateStats(data.results || []);
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
                const isGood = result.reachable === 'yes';
                const isBad = result.reachable === 'no' || result.disposable === true || result.has_mx_records === false;
                const isRisky = !isGood && !isBad;

                if (isGood) s.good++;
                else if (isBad) s.bad++;
                else s.risky++;

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
        const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        if (emails.length === 0) return alert('No emails found');
        startVerification(emails, 1);
    };

    const startVerification = async (emails, l) => {
        try {
            setStep('processing');
            setLevel(l);
            const { data } = await axios.post('/v1/bulk', { emails, level: l });
            setJobId(data.id);
        } catch (err) {
            alert('Backend error');
            setStep('upload');
        }
    };

    const resetSession = () => {
        setStep('upload');
        setJobId(null);
        setJobStatus(null);
        setResults([]);
        setStats({ good: 0, risky: 0, bad: 0, syntax: 0, disposable: 0, mx: 0 });
        setFilter('all');
        setCurrentPage(1);
        setSelectedPhase2Lists({ good: true, risky: false, bad: false });
    };

    const proceedToLevel2 = async () => {
        try {
            const { data } = await axios.get('/v1/network-check');
            if (!data.port25) {
                alert("⚠️ Port 25 Blocked: Your server/ISP is blocking outgoing SMTP connections. Level 2 (Handshake) will likely fail or return inaccurate results. Please open port 25 or use a different VPS (like Contabo) that allows SMTP traffic.");
                return;
            }
        } catch (e) {
            console.error("Network check failed", e);
        }

        const emailsToVerify = results.filter(item => {
            const status = item.result?.reachable || 'unknown';
            const isGood = status === 'yes';
            const isBad = status === 'no' || item.result?.disposable === true || item.result?.has_mx_records === false;
            const isRisky = !isGood && !isBad;

            if (selectedPhase2Lists.good && isGood) return true;
            if (selectedPhase2Lists.risky && isRisky) return true;
            if (selectedPhase2Lists.bad && isBad) return true;
            return false;
        }).map(item => item.email);

        if (emailsToVerify.length === 0) return alert('No emails selected for Phase 2');
        startVerification(emailsToVerify, 2);
    };

    const togglePhase2List = (list) => {
        setSelectedPhase2Lists(prev => ({ ...prev, [list]: !prev[list] }));
    };

    return (
        <div className="space-y-6">
            {step === 'upload' && (
                <div
                    className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-slate-400 cursor-pointer"
                    onClick={() => fileInputRef.current.click()}
                >
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept=".csv,.txt" />
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Upload Email List</h1>
                    <p className="text-slate-500 text-sm">Select a .txt or .csv file to start Phase 1. Limit: 100k</p>
                </div>
            )}

            {step === 'processing' && (
                <div className="card text-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <h2 className="text-lg font-bold">
                        {level === 1 ? 'Phase 1: Basic Analysis' : 'Phase 2: SMTP Checks'}
                    </h2>
                    <p className="text-slate-500 text-sm mb-6">Processing {jobStatus?.done || 0} / {jobStatus?.total || 0}</p>
                    <div className="max-w-xs mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-indigo-600 h-full transition-all duration-300"
                            style={{ width: `${((jobStatus?.done || 0) / (jobStatus?.total || 1)) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {step === 'results' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard label="Good Mails" value={stats.good} color="text-emerald-600" />
                        <StatCard label="Risky Mails" value={stats.risky} color="text-amber-600" />
                        <StatCard label="Bad Mails" value={stats.bad} color="text-rose-600" />
                    </div>

                    {level === 1 && (
                        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Phase 1 Complete</h3>
                                <p className="text-sm text-slate-500 mt-1">Select which lists you'd like to proceed with for deep SMTP validation:</p>

                                <div className="flex flex-wrap gap-3 mt-4">
                                    <ListToggle
                                        label="Good"
                                        count={stats.good}
                                        active={selectedPhase2Lists.good}
                                        onClick={() => togglePhase2List('good')}
                                        color="emerald"
                                    />
                                    <ListToggle
                                        label="Risky"
                                        count={stats.risky}
                                        active={selectedPhase2Lists.risky}
                                        onClick={() => togglePhase2List('risky')}
                                        color="amber"
                                    />
                                    <ListToggle
                                        label="Bad"
                                        count={stats.bad}
                                        active={selectedPhase2Lists.bad}
                                        onClick={() => togglePhase2List('bad')}
                                        color="rose"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={proceedToLevel2}
                                className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center"
                            >
                                Start Phase 2 Check
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div className="flex gap-2">
                                {['all', 'good', 'risky', 'bad'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all ${filter === f ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-600'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <button onClick={resetSession} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 text-xs font-bold uppercase transition-colors">
                                <Trash2 className="w-3 h-3" />
                                New Verification
                            </button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Email Address</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Infrastructure</th>
                                    <th className="px-4 py-3">SMTP Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedResults.map((item, idx) => {
                                    const result = item.result;
                                    const isDisposable = result?.disposable;
                                    const hasMX = result?.has_mx_records;
                                    const reachable = result?.reachable || 'unknown';
                                    const smtp = result?.smtp;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-700">{item.email}</td>
                                            <td className="px-4 py-3">
                                                {isDisposable ?
                                                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-bold">DISPOSABLE</span> :
                                                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">CORPORATE</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                {hasMX ?
                                                    <span className="text-emerald-600 flex items-center gap-1 font-bold text-[10px]"><CheckCircle2 className="w-3 h-3" /> MX ACTIVE</span> :
                                                    <span className="text-rose-600 flex items-center gap-1 font-bold text-[10px]"><XCircle className="w-3 h-3" /> NO MX</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                <SMTPBadge reachable={reachable} smtp={smtp} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                                <span>Page {currentPage} of {totalPages}</span>
                                <div className="flex gap-1">
                                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 border border-slate-200 rounded-lg bg-white font-bold hover:bg-slate-50 disabled:opacity-50">PREV</button>
                                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 border border-slate-200 rounded-lg bg-white font-bold hover:bg-slate-50 disabled:opacity-50">NEXT</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, color }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{label}</div>
        <div className={`text-3xl font-black ${color}`}>{value.toLocaleString()}</div>
    </div>
);

const ListToggle = ({ label, count, active, onClick, color }) => {
    const colors = {
        emerald: active ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        amber: active ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
        rose: active ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100',
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 border border-transparent ${colors[color]}`}
        >
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-white' : `bg-${color}-500`}`} />
            {label} ({count})
            {active && <CheckCircle2 className="w-3 h-3" />}
        </button>
    );
};

const SMTPBadge = ({ reachable, smtp }) => {
    if (reachable === 'yes') return <span className="text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">DELIVERABLE / GOOD</span>;
    if (smtp?.catch_all) return <span className="text-amber-700 bg-amber-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">CATCH ALL / RISKY</span>;
    if (reachable === 'no') return <span className="text-rose-700 bg-rose-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">NON-EXISTENT / BAD</span>;
    return <span className="text-slate-400 bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">UNTESTED</span>;
};

const XCircle = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
);

const ArrowRight = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);

export default Dashboard;
