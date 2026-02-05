import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, CheckCircle2, AlertCircle, Trash2,
    Server, User, Zap, Download, Loader2, Search
} from 'lucide-react';
import axios from 'axios';

const Dashboard = () => {
    const [step, setStep] = useState('upload');
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [results, setResults] = useState([]);
    const [stats, setStats] = useState({ syntax: 0, disposable: 0, mx: 0, free: 0 });
    const [level, setLevel] = useState(1);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
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
        if (filter === 'good') return status === 'yes';
        if (filter === 'risky') return status === 'unknown';
        if (filter === 'bad') return status === 'no';
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
        const s = { syntax: 0, disposable: 0, mx: 0, free: 0 };
        resList.forEach((item) => {
            const result = item.result;
            if (result) {
                if (result.syntax?.valid) s.syntax++;
                if (result.disposable) s.disposable++;
                if (!result.has_mx_records) s.mx++;
                if (result.free) s.free++;
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
        setStats({ syntax: 0, disposable: 0, mx: 0, free: 0 });
        setFilter('all');
        setCurrentPage(1);
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

        const cleanEmails = results
            .filter(({ result }) => result && result.syntax?.valid && !result.disposable && result.has_mx_records)
            .map(({ email }) => email);
        if (cleanEmails.length === 0) return alert('No valid emails');
        startVerification(cleanEmails, 2);
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Valid Syntax" value={stats.syntax} />
                        <StatCard label="Disposable" value={stats.disposable} />
                        <StatCard label="Dormant/No MX" value={stats.mx} />
                        <StatCard label="Personal/Free" value={stats.free} />
                    </div>

                    {level === 1 && (
                        <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                            <span className="text-sm font-medium">Phase 1 Complete. Run Phase 2 for SMTP validation?</span>
                            <button onClick={proceedToLevel2} className="btn-primary">Start Phase 2</button>
                        </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div className="flex gap-2">
                                {['all', 'good', 'risky', 'bad'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1 rounded text-xs font-medium ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                                    >
                                        {f.toUpperCase()}
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
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedResults.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 truncate max-w-xs">{item.email}</td>
                                        <td className="px-4 py-3">
                                            {item.result?.disposable ? 'Disposable' : 'Corporate'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusLabel status={item.result?.reachable || 'unknown'} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                                <span>Page {currentPage} of {totalPages}</span>
                                <div className="flex gap-1">
                                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-1 border border-slate-200 rounded bg-white">Prev</button>
                                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-1 border border-slate-200 rounded bg-white">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value }) => (
    <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
        <div className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
);

const StatusLabel = ({ status }) => {
    const colors = {
        yes: 'text-emerald-600',
        no: 'text-rose-600',
        unknown: 'text-slate-400'
    };
    const labels = { yes: 'Valid', no: 'Invalid', unknown: 'Unknown' };
    return <span className={`font-bold uppercase text-[10px] ${colors[status]}`}>{labels[status]}</span>;
};

export default Dashboard;
