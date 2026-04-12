import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiGetSystemPrompt, apiUpdateSystemPrompt } from '../services/api';

const GOAL_LABELS = {
  finance: "Managing Education Finances",
  academics: "Acing Academics",
  career: "Career Readiness",
  scholarships: "Scholarships / Grants"
};

const JOURNEY_LABELS = {
  ug: "Undergraduate", pg: "Graduate (PG)", pro: "Working Professional"
};

const CONFIDENCE_COLORS = {
  beginner: "#f59e0b", intermediate: "#10b981", expert: "#9f4042"
};

const CONFIDENCE_LABELS = {
  beginner: "Needs guidance", intermediate: "Basics sorted", expert: "Finance pro"
};

const Navbar = ({ activeView, setActiveView, user, onLogout }) => {
    const [showProfile, setShowProfile] = useState(false);
    const [showSystemPrompt, setShowSystemPrompt] = useState(false);
    const [systemPromptText, setSystemPromptText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (showSystemPrompt) {
            apiGetSystemPrompt().then(data => setSystemPromptText(data.prompt)).catch(console.error);
        }
    }, [showSystemPrompt]);

    const handleSavePrompt = async () => {
        setIsSaving(true);
        try {
            await apiUpdateSystemPrompt(systemPromptText);
            setShowSystemPrompt(false);
            setShowProfile(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const initials = user?.full_name
        ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    const answers = (() => {
        try {
            const raw = user?.onboarding_data;
            if (!raw) return {};
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return parsed.answers || parsed || {};
        } catch { return {}; }
    })();

    // Render sidebar via portal directly into document.body
    // This escapes overflow:hidden and any parent transforms that break position:fixed
    const drawer = showProfile ? createPortal(
        <>
            {/* Backdrop */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => setShowProfile(false)}
            />

            {/* Left Compact Card */}
            <div style={{
                position: 'fixed',
                left: '16px',
                top: '76px',
                zIndex: 9999,
                width: '220px',
            }} className="glass-panel rounded-3xl shadow-2xl border border-white/40 overflow-hidden">

                {/* Header */}
                <div className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-b border-white/20">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-headline font-black text-xs shadow-md shadow-primary/20">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-headline font-black text-on-surface text-sm truncate">{user?.full_name}</p>
                            <p className="font-body text-on-surface-variant text-[11px] truncate">{user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-4 py-3 space-y-3">
                    {answers.journey && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-label font-bold tracking-widest text-on-surface-variant uppercase">Stage</span>
                            <span className="text-xs font-headline font-bold text-on-surface">{JOURNEY_LABELS[answers.journey] || answers.journey}</span>
                        </div>
                    )}
                    {answers.goal && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-label font-bold tracking-widest text-on-surface-variant uppercase">Goal</span>
                            <span className="text-xs font-headline font-bold text-on-surface">{GOAL_LABELS[answers.goal] || answers.goal}</span>
                        </div>
                    )}
                    {answers.confidence && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-label font-bold tracking-widest text-on-surface-variant uppercase">Finance</span>
                            <span
                                className="text-xs font-headline font-bold"
                                style={{ color: CONFIDENCE_COLORS[answers.confidence] || 'inherit' }}
                            >
                                {CONFIDENCE_LABELS[answers.confidence] || answers.confidence}
                            </span>
                        </div>
                    )}
                </div>

                {/* System Settings */}
                <div className="border-t border-white/20 px-3 pt-2">
                    <button
                        onClick={() => setShowSystemPrompt(true)}
                        className="w-full flex items-center gap-2 py-2 px-2 text-left text-on-surface-variant hover:text-primary transition-colors text-xs font-body font-semibold rounded-xl hover:bg-primary/10"
                    >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current flex-shrink-0">
                            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                        </svg>
                        System Settings
                    </button>
                </div>

                {/* Logout */}
                <div className="px-3 pb-2 pt-1 border-t border-transparent">
                    <button
                        onClick={() => { setShowProfile(false); onLogout(); }}
                        className="w-full flex items-center gap-2 py-2 px-2 text-left text-on-surface-variant hover:text-red-500 transition-colors text-xs font-body font-semibold rounded-xl hover:bg-red-50"
                    >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current flex-shrink-0">
                            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                        </svg>
                        Sign out
                    </button>
                </div>
            </div>
        </>,
        document.body
    ) : null;

    const systemPromptModal = showSystemPrompt ? createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-black/40 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-2xl bg-white/90 rounded-3xl shadow-2xl p-7 flex flex-col gap-4 max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <h2 className="text-xl font-headline font-black text-on-surface flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary fill-current">
                            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                        </svg>
                        Custom AI Instructions
                    </h2>
                    <button onClick={() => setShowSystemPrompt(false)} className="text-on-surface-variant hover:text-primary transition-colors bg-black/5 hover:bg-black/10 rounded-full p-1.5 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <p className="text-[13px] font-body text-on-surface-variant mb-2 bg-primary/5 p-3 rounded-xl border border-primary/10">
                    Edit the fundamental instructions of the AI. Changes applied here will update the backend `system_prompt.txt` file and instantly apply to all conversations.
                </p>
                <textarea 
                    value={systemPromptText} 
                    onChange={e => setSystemPromptText(e.target.value)}
                    className="w-full flex-1 min-h-[350px] p-4 rounded-xl border border-black/10 bg-white/70 focus:bg-white focus:ring-2 focus:ring-primary/50 text-sm font-mono whitespace-pre-wrap outline-none shadow-inner custom-scrollbar"
                />
                <div className="flex justify-end gap-3 mt-2">
                    <button onClick={() => setShowSystemPrompt(false)} className="px-5 py-2.5 font-bold text-sm text-on-surface-variant hover:bg-black/5 rounded-full transition-colors active:scale-95">Cancel</button>
                    <button onClick={handleSavePrompt} disabled={isSaving} className="px-6 py-2.5 font-bold text-sm text-white bg-gradient-to-r from-primary to-secondary hover:shadow-lg shadow-md rounded-full transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2">
                        {isSaving ? (
                            <>
                                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                Saving...
                            </>
                        ) : "Deploy Prompt"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <nav className="relative z-20 flex items-center justify-between px-6 py-4">

                {/* Brand */}
                <div className="flex items-center gap-2">
                    <span className="font-headline font-black text-primary tracking-widest text-sm uppercase">SAAITA</span>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 bg-white/40 p-1.5 rounded-full backdrop-blur-md shadow-inner border border-white/40">
                    {[
                        { key: 'chat', label: 'Chat' },
                        { key: 'dashboard', label: 'Dashboard' },
                        { key: 'learn', label: 'Learn' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            className={`px-5 py-2 rounded-full text-sm font-headline tracking-wide font-bold transition-all ${
                                activeView === key
                                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/30'
                            }`}
                            onClick={() => setActiveView(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Profile Avatar */}
                <button
                    onClick={() => setShowProfile(prev => !prev)}
                    className={`flex items-center gap-2 p-1.5 pr-3 rounded-full backdrop-blur-md border transition-all ${
                        showProfile
                            ? 'bg-primary/20 border-primary/40'
                            : 'bg-white/40 border-white/40 hover:bg-white/60'
                    }`}
                >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-headline font-black text-xs">
                        {initials}
                    </div>
                    <span className="text-on-surface font-body text-sm font-semibold hidden sm:block max-w-[100px] truncate">
                        {user?.full_name?.split(' ')[0] || 'User'}
                    </span>
                    <svg viewBox="0 0 24 24" className={`w-4 h-4 fill-current text-on-surface-variant transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`}>
                        <path d="M7 10l5 5 5-5z" />
                    </svg>
                </button>
            </nav>

            {/* Portal drawer — rendered into document.body, escapes all parent constraints */}
            {drawer}
            {systemPromptModal}
        </>
    );
};

export default Navbar;
