import React, { useState } from 'react';
import { Terminal, Code, Cpu, Globe, Rocket, ShieldCheck, Mail, Zap, ChevronRight } from 'lucide-react';

const Docs = () => {
    const [activeLang, setActiveLang] = useState('nodejs');

    const codeSnippets = {
        nodejs: `// Node.js (fetch)
async function verifyEmail(email) {
  const res = await fetch('https://taftlivingph.com/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, level: 1 })
  });
  return await res.json();
}`,
        python: `# Python (requests)
import requests

def verify_email(email):
    url = "https://taftlivingph.com/v1/verify"
    payload = {"email": email, "level": 1}
    response = requests.post(url, json=payload)
    return response.json()`,
        ruby: `# Ruby (Net::HTTP)
require 'net/http'
require 'json'

def verify_email(email)
  uri = URI('https://taftlivingph.com/v1/verify')
  res = Net::HTTP.post(uri, {email: email, level: 1}.to_json, "Content-Type" => "application/json")
  JSON.parse(res.body)
end`,
        go: `// Go (http.Post)
func verifyEmail(email string) {
    url := "https://taftlivingph.com/v1/verify"
    payload := map[string]interface{}{"email": email, "level": 1}
    jsonData, _ := json.Marshal(payload)
    resp, _ := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
    // ... parse response
}`,
        rest: `# REST (cURL)
curl -X POST https://taftlivingph.com/v1/verify \\
     -H "Content-Type: application/json" \\
     -d '{"email": "test@example.com", "level": 1}'`
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">API Documentation</h1>
                <p className="text-slate-500 font-medium">Professional integration guide for developers.</p>
            </div>

            <div className="space-y-12">
                {/* Connection Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-800">Connection Details</h2>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-6 text-slate-300 font-mono text-sm leading-relaxed">
                        <p className="text-emerald-400 mb-2"># Your Cleanmails Engine Endpoint</p>
                        <p className="text-white">URL: <span className="text-amber-300">https://taftlivingph.com</span></p>
                        <p className="text-white mt-2">Content-Type: <span className="text-amber-300">application/json</span></p>
                    </div>
                </section>

                {/* Multi-Language Code Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Code className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-800">Implementation Examples</h2>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex bg-slate-50 border-b border-slate-200 overflow-x-auto">
                            {Object.keys(codeSnippets).map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setActiveLang(lang)}
                                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${activeLang === lang
                                        ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {lang === 'nodejs' ? 'Node.js' : lang}
                                </button>
                            ))}
                        </div>
                        <div className="bg-slate-900 p-6 font-mono text-sm leading-relaxed text-indigo-100 min-h-[250px]">
                            <pre><code>{codeSnippets[activeLang]}</code></pre>
                        </div>
                    </div>
                </section>

                {/* Integration Steps */}
                <section className="space-y-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Rocket className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-800">Integration Workflow</h2>
                    </div>

                    <div className="grid gap-6">
                        <StepCard
                            num="01"
                            title="Phase 1: Basic Check"
                            desc="Instant lookup for Syntax, MX, and Disposables."
                            code={`POST /v1/verify { "level": 1 }`}
                        />

                        <StepCard
                            num="02"
                            title="Phase 2: SMTP Handshake"
                            desc="Deep-level validation of the mailbox existence."
                            code={`POST /v1/verify { "level": 2 }`}
                        />
                    </div>
                </section>
            </div>
        </div>
    );
};

const StepCard = ({ num, title, desc, code }) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
            <div className="flex items-start gap-4">
                <span className="text-4xl font-black text-slate-100 select-none">{num}</span>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <p className="text-slate-500 text-sm mt-1">{desc}</p>
                </div>
            </div>
            <div className="mt-4 bg-slate-50 border border-slate-100 rounded-lg p-3 font-mono text-[11px] text-indigo-600 flex items-center justify-between">
                <pre>{code}</pre>
                <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
        </div>
    </div>
);

export default Docs;
