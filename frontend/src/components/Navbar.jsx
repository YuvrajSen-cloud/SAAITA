import React from 'react';

const Navbar = ({ 
    toggleSidebar, 
    activeView, 
    setActiveView,  
}) => {
    return (
        <nav className="relative z-10 flex items-center justify-between px-8 py-5">
            <div 
                className="flex items-center text-on-surface hover:text-primary transition-colors cursor-pointer" 
                onClick={toggleSidebar}
            >
                <svg viewBox="0 0 24 24" style={{width: '24px', height: '24px'}} fill="currentColor">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                </svg>
            </div>

            <div className="flex items-center gap-1 bg-white/40 p-1.5 rounded-full backdrop-blur-md shadow-inner border border-white/40">
                <button 
                    className={`px-5 py-2 rounded-full text-sm font-headline tracking-wide font-bold transition-all ${
                        activeView === 'chat' 
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' 
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-white/30'
                    }`}
                    onClick={() => setActiveView('chat')}
                >
                    Chat
                </button>
                <button 
                    className={`px-5 py-2 rounded-full text-sm font-headline tracking-wide font-bold transition-all ${
                        activeView === 'dashboard' 
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' 
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-white/30'
                    }`}
                    onClick={() => setActiveView('dashboard')}
                >
                    Dashboard
                </button>
                <button 
                    className={`px-5 py-2 rounded-full text-sm font-headline tracking-wide font-bold transition-all ${
                        activeView === 'learn' 
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' 
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-white/30'
                    }`}
                    onClick={() => setActiveView('learn')}
                >
                    Learn
                </button>
            </div>

            <button className="flex items-center justify-center p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '28px', height: '28px'}}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </button>
        </nav>
    );
};

export default Navbar;
