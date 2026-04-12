import React, { useState } from 'react';

const Navbar = ({ activeView, setActiveView, user, onLogout }) => {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const initials = user?.full_name
        ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    return (
        <nav className="relative z-10 flex items-center justify-between px-6 py-4">

            {/* Brand */}
            <div className="flex items-center gap-2">
                <span className="font-headline font-black text-primary tracking-widest text-sm uppercase">SAAITA</span>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-white/40 p-1.5 rounded-full backdrop-blur-md shadow-inner border border-white/40">
                {[
                    { key: 'dashboard', label: 'Home' },
                    { key: 'chat', label: 'Chat' },
                    { key: 'learn', label: 'Learn' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        className={`px-5 py-2 rounded-full text-sm font-headline tracking-wide font-bold transition-all ${activeView === key
                            ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-white/30'
                            }`}
                        onClick={() => setActiveView(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* User Avatar + Menu */}
            <div className="relative">
                <button
                    onClick={() => setShowUserMenu(prev => !prev)}
                    className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white/40 backdrop-blur-md border border-white/40 hover:bg-white/60 transition-all"
                >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-headline font-black text-xs">
                        {initials}
                    </div>
                    <span className="text-on-surface font-body text-sm font-semibold hidden sm:block max-w-[100px] truncate">
                        {user?.full_name?.split(' ')[0] || 'User'}
                    </span>
                    <svg viewBox="0 0 24 24" className={`w-4 h-4 fill-current text-on-surface-variant transition-transform ${showUserMenu ? 'rotate-180' : ''}`}>
                        <path d="M7 10l5 5 5-5z" />
                    </svg>
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-52 glass-panel rounded-2xl py-2 shadow-xl border border-white/30 z-50">
                        <div className="px-4 py-2 border-b border-black/5 mb-1">
                            <p className="font-headline font-bold text-on-surface text-sm truncate">{user?.full_name}</p>
                            <p className="font-body text-on-surface-variant text-xs truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={() => { setShowUserMenu(false); onLogout(); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors text-sm font-body font-semibold"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                            </svg>
                            Sign out
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
