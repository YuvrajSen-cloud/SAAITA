import React, { useState, useRef, useEffect } from 'react';
import LearningPathUI from './LearningPathUI';

const parseLearningPathJSON = (text) => {
    if (typeof text !== 'string') return { json: null, text: text };
    try {
        let cleanText = text.trim();
        const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch && jsonMatch[1]) {
            cleanText = jsonMatch[1].trim();
            const textWithoutJson = text.replace(jsonMatch[0], '').trim();
            
            if ((cleanText.startsWith('{') && cleanText.endsWith('}')) || (cleanText.startsWith('[') && cleanText.endsWith(']'))) {
                const parsed = JSON.parse(cleanText);
                return { json: parsed, text: textWithoutJson };
            }
        }
    } catch (e) {
        return { json: null, text: text };
    }
    return { json: null, text: text };
};

const ChatArea = ({ sessionId, onChatActive, refreshChatId }) => {
    const [inputValue, setInputValue] = useState('');
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [speakingIdx, setSpeakingIdx] = useState(null);

    const toggleSpeech = (text, idx) => {
        if (speakingIdx === idx) {
            window.speechSynthesis.cancel();
            setSpeakingIdx(null);
        } else {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => setSpeakingIdx(null);
            utterance.onerror = () => setSpeakingIdx(null);
            window.speechSynthesis.speak(utterance);
            setSpeakingIdx(idx);
        }
    };

    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Fetch chat history on load or switch
    useEffect(() => {
        if (!sessionId) return;
        fetch(`http://localhost:5002/api/chat/history?session_id=${sessionId}`)
            .then(res => res.json())
            .then(data => {
                if (data.messages) {
                    setMessages(data.messages);
                } else {
                    setMessages([]);
                }
            })
            .catch(console.error);
    }, [sessionId, refreshChatId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (onChatActive) {
            onChatActive(messages.length > 0);
        }
    }, [messages, onChatActive]);

    // Setup Speech Recognition for Voice Input
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setInputValue(currentTranscript);
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("Speech Recognition API not supported in this browser.");
        }
    }, []);

    const handleSend = async () => {
        if (!inputValue.trim() && attachedFiles.length === 0) return;
        const currentMessage = inputValue;
        const currentFiles = [...attachedFiles];
        
        let displayMessage = currentMessage;
        if (currentFiles.length > 0) {
            displayMessage += `\n[${currentFiles.length} image(s) attached]`;
        }
        
        setMessages(prev => [...prev, { sender: 'user', text: displayMessage.trim() }]);
        setInputValue('');
        setAttachedFiles([]);
        setIsLoading(true);

        try {
            const imagesBase64 = await Promise.all(currentFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64String = reader.result.split(',')[1];
                        resolve({
                            mime_type: file.type || "image/jpeg",
                            data: base64String
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }));

            const response = await fetch('http://localhost:5002/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    session_id: sessionId, 
                    prompt: currentMessage,
                    images: imagesBase64
                })
            });
            const data = await response.json();
            if (data.text) {
                setMessages(prev => [...prev, { sender: 'ai', text: data.text }]);
            } else if (data.error) {
                setMessages(prev => [...prev, { sender: 'ai', text: "Error: " + data.error }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { sender: 'ai', text: "Failed to connect to AI server." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = async () => {
        if (!window.confirm("Are you sure you want to clear this chat history and start a new one?")) return;
        
        try {
            await fetch('http://localhost:5002/api/chat/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            setMessages([]);
        } catch (error) {
            console.error("Failed to clear chat", error);
        }
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setAttachedFiles((prev) => [...prev, ...filesArray]);
        }
        e.target.value = '';
    };

    const removeFile = (index) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleVoiceClick = () => {
        if (!recognitionRef.current) {
            alert("Sorry, your browser doesn't support the Speech Recognition API.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    return (
        <div className={`flex flex-col items-center w-full h-full pb-6 px-4 ${messages.length === 0 ? 'justify-center' : 'justify-between'}`}>
            
            {/* Header Area */}
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center mb-6">
                    <h1 className="text-4xl md:text-5xl font-headline font-black text-on-surface tracking-tight text-center text-glow">
                        What's on the agenda today?
                    </h1>
                </div>
            ) : (
                <div className="w-full max-w-4xl flex flex-col flex-1 min-h-0 pt-4">
                    <div className="flex justify-end mb-3">
                        <button 
                            onClick={handleNewChat}
                            className="bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/30 rounded-full px-4 py-1.5 text-sm font-medium text-on-surface-variant flex items-center gap-2 transition active:scale-95 shadow-sm"
                            title="Start exactly where you are, but clear the visual and context chat history."
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                            New Chat
                        </button>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-6 pr-2 custom-scrollbar">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`max-w-[90%] rounded-2xl ${msg.sender === 'user' ? 'self-end bg-primary/10 border border-primary/20 p-4 shadow-sm' : 'self-start w-full'}`}>
                                
                                {msg.sender === 'ai' && (
                                    <div className="flex justify-between items-center mb-2">
                                        <strong className="text-primary font-headline text-lg tracking-wide">SAAITA</strong>
                                        <button 
                                            onClick={() => toggleSpeech(msg.text, idx)}
                                            className={`p-1.5 rounded-full hover:bg-black/5 transition-colors ${speakingIdx === idx ? 'text-primary' : 'text-on-surface-variant'}`}
                                            title={speakingIdx === idx ? "Stop speaking" : "Read aloud"}
                                        >
                                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                                {speakingIdx === idx ? (
                                                    <path d="M6 6h12v12H6z"/>
                                                ) : (
                                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                                )}
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                
                                {(() => {
                                    if (msg.sender === 'ai') {
                                        const parsed = parseLearningPathJSON(msg.text);
                                        if (parsed.json) {
                                            return (
                                                <div className="flex flex-col gap-4 w-full">
                                                    {parsed.text && (
                                                        <span className="whitespace-pre-wrap leading-relaxed text-on-surface text-[15px] font-body">
                                                            {parsed.text}
                                                        </span>
                                                    )}
                                                    <LearningPathUI data={parsed.json} />
                                                </div>
                                            );
                                        }
                                    }
                                    return <span className="whitespace-pre-wrap leading-relaxed text-on-surface text-[15px] font-body">{msg.text}</span>;
                                })()}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="self-start text-on-surface-variant text-sm font-medium animate-pulse ml-1">
                                SAAITA is thinking...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className={`w-full max-w-4xl flex flex-col gap-3 mt-4 ${messages.length === 0 ? 'mb-10' : ''}`}>
                
                {/* File Attachments Chips */}
                {attachedFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap px-4">
                        {attachedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/60 backdrop-blur border border-white rounded-full px-3 py-1.5 text-xs text-on-surface-variant shadow-sm">
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                </svg>
                                <span className="max-w-[150px] truncate">{file.name}</span>
                                <button
                                    onClick={() => removeFile(idx)}
                                    className="hover:text-primary focus:outline-none transition-colors"
                                    title="Remove attachment"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Container */}
                <div className="glass-panel w-full flex items-center p-2 rounded-full shadow-lg">
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <button 
                        className="p-3 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-black/5 mx-1 focus:outline-none" 
                        title="Add attachment" 
                        onClick={handleFileClick}
                    >
                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                    </button>

                    <input
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-[15px] font-body text-on-surface px-2 placeholder:text-on-surface-variant/70"
                        placeholder={isListening ? "Listening... (Speak now)" : "Ask SAAITA anything..."}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />

                    <button
                        className={`p-3 rounded-full transition-all mx-1 focus:outline-none ${isListening ? 'text-primary bg-primary/10 animate-pulse' : 'text-on-surface-variant hover:text-primary hover:bg-black/5'}`}
                        title="Voice input"
                        onClick={handleVoiceClick}
                    >
                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                    </button>

                    <button
                        className={`p-3 rounded-full transition-all mx-1 focus:outline-none flex items-center justify-center ${
                            (inputValue.trim() || attachedFiles.length > 0) 
                            ? 'bg-primary text-white shadow-md hover:scale-105 active:scale-95' 
                            : 'bg-black/5 text-on-surface-variant/50 pointer-events-none'
                        }`}
                        onClick={handleSend}
                        title="Send message"
                    >
                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-current -mr-0.5 mt-0.5">
                            <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
                        </svg>
                    </button>
                </div>
            </div>

        </div>
    );
};

export default ChatArea;
