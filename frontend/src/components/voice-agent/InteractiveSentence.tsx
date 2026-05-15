import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Volume2, Languages, X, Search, MousePointer2 } from 'lucide-react';
import { fetchWordDetails, WordData } from '../../api/dictionary';

interface InteractiveSentenceProps {
  text: string;
  isAgent?: boolean;
  inline?: boolean;
}

export default function InteractiveSentence({ text, inline }: InteractiveSentenceProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [isWordLoading, setIsWordLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleWordClick = async (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z-]/g, '');
    if (!clean) return;

    console.log('InteractiveSentence: handleWordClick:', word);
    setSelectedWord(word);
    setShowModal(true);
    setIsWordLoading(true);
    setWordData(null);
    try {
      const data = await fetchWordDetails(clean);
      setWordData(data);
    } catch (error) {
      console.error('Word lookup failed:', error);
    } finally {
      setIsWordLoading(false);
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play();
    } else {
      const audio = new Audio(url);
      audio.play();
      audioRef.current = audio;
    }
  };

  const splitIntoWords = (text: string) => {
    if (!text) return null;
    const segments = text.split(/(\s+)/).filter((s) => s.length > 0);
    return segments.map((segment, idx) => {
      if (segment.trim() === '')
        return (
          <span key={idx} className="inline-block whitespace-pre">
            {segment}
          </span>
        );

      const match = segment.match(/^([^a-zA-Z0-9'-]*)([a-zA-Z0-9'-]+)([^a-zA-Z0-9'-]*)$/);
      if (!match)
        return (
          <span key={idx} className="inline-block">
            {segment}
          </span>
        );

      const [, prefix, word, suffix] = match;
      return (
        <span key={idx} className="inline-block">
          {prefix}
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleWordClick(word);
            }}
            className={`cursor-pointer px-1 rounded transition-all duration-150 border-b-2 ${
              selectedWord === word && showModal
                ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                : 'hover:bg-blue-100 text-blue-700 border-transparent hover:border-blue-300'
            }`}
          >
            {word}
          </span>
          {suffix}
        </span>
      );
    });
  };

  const renderModal = () => {
    if (!showModal) return null;
    return createPortal(
      <WordDetailModal
        wordData={wordData}
        isWordLoading={isWordLoading}
        selectedWord={selectedWord}
        onClose={() => setShowModal(false)}
        playAudio={playAudio}
        text={text}
        splitIntoWords={splitIntoWords}
      />,
      document.body,
    );
  };

  if (inline) {
    return (
      <div className="inline-block">
        <span className="inline-block cursor-default">{splitIntoWords(text)}</span>
        {renderModal()}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className="w-full text-left rounded-md border border-blue-200 bg-blue-50 dark:border-blue-700/40 dark:bg-blue-950/20 p-2 hover:shadow-md hover:-translate-y-px transition-all group cursor-pointer"
      >
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-1.5">
            <Languages className="w-3 h-3 shrink-0 text-blue-700 dark:text-blue-300" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Word Explorer
            </span>
          </div>
          <span className="text-[8.5px] font-semibold text-blue-700 dark:text-blue-300 opacity-70 italic">
            Click to explore words
          </span>
        </div>
        <p className="text-[10px] text-gray-700 dark:text-slate-200 leading-snug">
          Explore definitions, IPA, and translations for every word.
        </p>
      </button>

      {renderModal()}
    </>
  );
}

interface WordDetailModalProps {
  wordData: WordData | null;
  isWordLoading: boolean;
  selectedWord: string | null;
  onClose: () => void;
  playAudio: (url: string) => void;
  text: string;
  splitIntoWords: (text: string) => ReactNode;
}

function WordDetailModal({
  wordData,
  isWordLoading,
  selectedWord,
  onClose,
  playAudio,
  text,
  splitIntoWords,
}: WordDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col"
      >
        {/* Header Section */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-gray-50 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <Languages className="w-6 h-6 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                Interactive Explorer
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                Click words in the sentence above to explore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Section */}
        <div className="max-h-[65vh] overflow-y-auto p-6 space-y-8 scrollbar-thin">
          {/* Interactive Sentence Section - Kept for selection but styled compactly */}
          <section className="space-y-3">
            <div className="p-6 rounded-[2rem] bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 shadow-inner flex flex-wrap justify-center items-center gap-y-1 text-center">
              <div className="text-xl leading-relaxed text-gray-900 dark:text-white font-medium">
                {splitIntoWords(text)}
              </div>
            </div>
          </section>

          {/* Word Details Section */}
          <section className="min-h-[220px]">
            {!selectedWord ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-300 py-12">
                <MousePointer2 className="w-12 h-12 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">
                  Select a word above
                </p>
              </div>
            ) : isWordLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                  Searching...
                </p>
              </div>
            ) : wordData ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-xl">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-3xl font-black tracking-tighter">{wordData.word}</h2>
                      {wordData.cefr && (
                        <span className="px-2 py-0.5 rounded-lg bg-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider border border-white/30">
                          {wordData.cefr}
                        </span>
                      )}
                    </div>
                    <p className="text-blue-100 font-mono text-sm font-bold">{wordData.phonetic}</p>
                  </div>
                  {wordData.audio && (
                    <button
                      type="button"
                      onClick={() => playAudio(wordData.audio!)}
                      className="w-14 h-14 rounded-2xl bg-white text-blue-600 shadow-xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    >
                      <Volume2 className="w-7 h-7" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {wordData.translation && (
                    <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800/50 group transition-all">
                      <span className="text-[9px] font-black uppercase tracking-widest text-violet-400 block mb-1">
                        Vietnamese
                      </span>
                      <p className="text-xl font-bold text-violet-700 dark:text-violet-300">
                        {wordData.translation}
                      </p>
                    </div>
                  )}

                  {wordData.definitions.length > 0 && (
                    <div className="space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                        Definitions
                      </span>
                      <div className="space-y-3">
                        {wordData.definitions.slice(0, 2).map((def, idx) => (
                          <div key={idx} className="flex gap-3">
                            <span className="shrink-0 h-6 px-2 rounded-lg bg-white dark:bg-slate-700 shadow-sm border border-gray-100 dark:border-slate-600 text-gray-500 dark:text-slate-400 text-[10px] font-black flex items-center justify-center min-w-[44px]">
                              {def.partOfSpeech}
                            </span>
                            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed font-medium">
                              {def.definition}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Details not found</p>
              </div>
            )}
          </section>
        </div>

        {/* Footer Section */}
        <div className="p-6 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-violet-200 dark:shadow-none transition-all active:scale-[0.98] cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </motion.div>
    </div>
  );
}
