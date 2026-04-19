import React, { useState } from 'react';
import { useVoice } from '../context/VoiceContext';

// ── Voice Control Button ──
// Floating button in bottom-right corner for activating/deactivating voice mode
export const VoiceControlButton = () => {
  const { isVoiceActive, isListening, startListening, stopListening } = useVoice();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (isVoiceActive) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Tooltip */}
      {showTooltip && (
        <div className="bg-black/80 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap">
          {isVoiceActive ? 'Click to stop listening' : 'Click to start voice mode'}
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={isVoiceActive ? 'Stop voice control' : 'Start voice control'}
        className={`
          w-14 h-14 rounded-full font-headline font-bold text-white
          transition-all duration-300 shadow-lg hover:shadow-xl
          flex items-center justify-center relative
          ${
            isVoiceActive
              ? 'bg-gradient-to-r from-primary to-secondary scale-110'
              : 'bg-gray-600 hover:bg-gray-700'
          }
          ${isListening ? 'animate-pulse' : ''}
        `}
      >
        {/* Microphone Icon */}
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 16.91c-1.48 1.45-3.76 2.36-6 2.36s-4.51-.91-6-2.36l-1.43 1.43c1.77 1.77 4.49 2.93 7.43 2.93s5.66-1.16 7.43-2.93L17 16.91zM19 11h-1.7c0 .58-.1 1.13-.27 1.64l1.27 1.27c.44-1.52.7-3.13.7-4.91z" />
        </svg>

        {/* Listening Indicator Pulse */}
        {isListening && (
          <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75" />
        )}
      </button>

      {/* Status Text */}
      {isVoiceActive && (
        <div className="text-xs text-on-surface-variant font-body">
          {isListening ? 'Listening...' : 'Voice mode active'}
        </div>
      )}
    </div>
  );
};

export default VoiceControlButton;
