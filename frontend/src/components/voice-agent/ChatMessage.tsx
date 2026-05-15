import React, { useState, useRef, useEffect } from 'react';
import { Languages, Copy, Volume2, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessageProps {
  id?: string | number;
  text: string;
  role: 'user' | 'agent';
  timestamp?: Date;
  onTranslate?: (text: string) => Promise<string>;
  isTyping?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  text,
  role,
  timestamp = new Date(),
  onTranslate,
  isTyping = false,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isAgent = role === 'agent';

  // Click outside to close toolbar on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    if (translatedText) {
      setIsTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      if (onTranslate) {
        const result = await onTranslate(text);
        setTranslatedText(result);
      } else {
        // Fallback or internal translation logic
        const API_KEY = import.meta.env.VITE_GG_TRANSLATE_API || '';
        if (!API_KEY) throw new Error('No API Key');

        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
          {
            method: 'POST',
            body: JSON.stringify({
              q: text,
              target: 'vi',
            }),
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const data = await response.json();
        const result = data.data?.translations?.[0]?.translatedText;
        if (result) {
          setTranslatedText(result);
        }
      }
      setIsTranslated(true);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleActions = () => {
    setShowActions(!showActions);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full max-w-[85%] sm:max-w-[70%] mb-4 ${
        isAgent ? 'mr-auto items-start' : 'ml-auto items-end'
      }`}
      onMouseEnter={() => !isTyping && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleToggleActions}
    >
      {/* Contextual Action Toolbar */}
      <AnimatePresence>
        {showActions && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`absolute z-10 flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 ${
              isAgent ? 'left-0 -top-10' : 'right-0 -top-10'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <ToolbarButton
              icon={
                isTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )
              }
              label="Translate"
              onClick={handleTranslate}
              active={isTranslated}
            />
            <ToolbarButton
              icon={
                isCopied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              label="Copy"
              onClick={handleCopy}
            />
            <ToolbarButton
              icon={
                <Volume2
                  className={`w-3.5 h-3.5 ${isSpeaking ? 'text-blue-500 animate-pulse' : ''}`}
                />
              }
              label="Speak"
              onClick={handleSpeak}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Bubble */}
      <div
        className={`px-4 py-2.5 rounded-2xl transition-all duration-200 ease-in-out cursor-pointer select-none ${
          isAgent
            ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-gray-700 shadow-sm'
            : 'bg-blue-600 dark:bg-blue-700 text-white rounded-br-none shadow-md'
        } ${showActions ? 'ring-2 ring-blue-400 dark:ring-blue-500 ring-opacity-50' : ''}`}
      >
        {isTyping ? (
          <div className="flex gap-1.5 items-center py-1">
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
          </div>
        ) : (
          <>
            <p className="text-sm sm:text-base leading-relaxed">{text}</p>
            <AnimatePresence>
              {isTranslated && translatedText && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`mt-2 pt-2 border-t text-sm italic ${
                    isAgent
                      ? 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                      : 'border-blue-500 text-blue-100'
                  }`}
                >
                  <div dangerouslySetInnerHTML={{ __html: translatedText }} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Timestamp */}
      <span
        className={`text-[10px] mt-1 text-gray-400 dark:text-gray-500 ${isAgent ? 'ml-1' : 'mr-1'}`}
      >
        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    title={label}
    className={`p-1.5 rounded-full transition-colors duration-200 flex items-center justify-center ${
      active
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
    }`}
  >
    {icon}
  </button>
);

export default ChatMessage;
