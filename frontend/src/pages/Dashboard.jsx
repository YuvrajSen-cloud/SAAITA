import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGetMe, apiLogout } from '../services/api';
import ChatArea from '../components/ChatArea';
import LearningPathUI from '../components/LearningPathUI';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    apiGetMe()
      .then(data => {
        if (!data.user.is_onboarded) {
          navigate('/onboarding', { replace: true });
        } else {
          setUser(data.user);
        }
      })
      .catch(() => {
        navigate('/', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await apiLogout();
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen w-full iridescent-bg font-body text-on-surface relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 aurora-blur rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-secondary/10 aurora-blur rounded-full pointer-events-none" />

      {/* Navbar */}
      <Navbar 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full mx-auto overflow-hidden">
        {activeView === 'chat' && (
          <ChatArea sessionId={localStorage.getItem("session_id") || "default_session"} />
        )}
        {activeView === 'learn' && (
          <LearningPathUI />
        )}
        {activeView === 'dashboard' && (
          <div className="flex items-center justify-center h-full text-on-surface-variant font-headline text-2xl font-black">
            Dashboard Content Coming Soon...
          </div>
        )}
      </main>
    </div>
  );
}
