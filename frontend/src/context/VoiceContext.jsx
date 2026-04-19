import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Create Voice Context ──
const VoiceContext = createContext();

export const VoiceProvider = ({ children }) => {
  const navigate = useNavigate();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);

  // ── Initialize Web Speech API ──
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      // Process only when user stops speaking (final result)
      if (event.results[event.results.length - 1].isFinal) {
        handleGlobalCommand(transcript.toLowerCase().trim());
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if voice mode is still active
      if (isVoiceActive) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Could not restart recognition:', e);
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;
  }, [handleGlobalCommand, isVoiceActive]);

  // ── Text-to-Speech (define first) ──
  const speak = useCallback((text) => {
    if (!text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Handle Global Voice Commands ──
  const handleGlobalCommand = useCallback((transcript) => {
    console.log('Voice command detected:', transcript);

    // ── Navigation Commands ──
    if (transcript.includes('go to dashboard') || transcript.includes('dashboard')) {
      speak('Navigating to dashboard');
      navigate('/dashboard');
      return;
    }

    if (
      transcript.includes('go to onboarding') ||
      transcript.includes('onboarding') ||
      transcript.includes('new user')
    ) {
      speak('Navigating to onboarding');
      navigate('/onboarding');
      return;
    }

    // ── Chat Commands ──
    if (transcript.includes('open chat') || transcript.includes('start chat')) {
      speak('Opening chat');
      navigate('/dashboard');
      // Will trigger chat panel open (handled in ChatArea)
      window.dispatchEvent(new CustomEvent('voiceOpenChat'));
      return;
    }

    // ── Roadmap/Checklist Commands ──
    if (transcript.includes('show my roadmaps') || transcript.includes('what are my roadmaps')) {
      speak('Showing learning roadmaps');
      navigate('/dashboard');
      window.dispatchEvent(new CustomEvent('voiceShowRoadmaps'));
      return;
    }

    if (transcript.includes('show my checklists') || transcript.includes('what are my checklists')) {
      speak('Showing checklists');
      navigate('/dashboard');
      window.dispatchEvent(new CustomEvent('voiceShowChecklists'));
      return;
    }

    // ── Chat with context commands (e.g., "create a roadmap about algebra") ──
    if (
      transcript.includes('create a roadmap') ||
      transcript.includes('make a roadmap') ||
      transcript.includes('roadmap about')
    ) {
      speak('Opening chat to create roadmap');
      navigate('/dashboard');
      window.dispatchEvent(
        new CustomEvent('voiceChatCommand', {
          detail: { text: transcript },
        })
      );
      return;
    }

    if (
      transcript.includes('lets chat') ||
      transcript.includes('let\'s chat') ||
      transcript.includes('chat with me')
    ) {
      speak('Ready to chat');
      navigate('/dashboard');
      window.dispatchEvent(new CustomEvent('voiceOpenChat'));
      return;
    }
  }, [navigate, speak]);

  // ── Start Listening ──
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      speak('Speech recognition not available');
      return;
    }

    setIsVoiceActive(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn('Could not start recognition:', e);
    }
  }, [speak]);

  // ── Stop Listening ──
  const stopListening = useCallback(() => {
    setIsVoiceActive(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.warn('Could not stop recognition:', e);
      }
    }
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.warn('Could not cleanup recognition:', e);
        }
      }
    };
  }, []);

  const value = {
    isVoiceActive,
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

// ── Hook to use Voice Context ──
export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
