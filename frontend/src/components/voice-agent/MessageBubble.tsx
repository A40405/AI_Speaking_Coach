import { Bot, Languages, Loader2, Mic, Play, User, Check, Copy } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '../../i18n/useLanguage';
import ReasoningSteps from './ReasoningSteps';
import type { ToolCallStep } from '../../api/chat';

export type { ToolCallStep };

export interface Mistake {
  wrong: string;
  correct: string;
  type: 'Pronunciation' | 'Grammar' | 'Word choice' | 'Fluency';
  note?: string;
  phonemes?: { phoneme: string; accuracy_score: number }[];
}

export interface ScoreDetails {
  overall: number;
  pronunciation: number;
  fluency: number;
  accuracy: number;
  completeness?: number;
}

export interface Message {
  id: number;
  backendMessageId?: string;
  role: 'agent' | 'user';
  text: string;
  timestamp: Date;
  typing?: boolean;
  audioUrl?: string;
  score?: number;
  minioUrl?: string;
  userAudioUrl?: string;
  audioBlob?: Blob;
  scoreDetails?: ScoreDetails;
  mistakes?: Mistake[];
  assessmentStatus?: 'available' | 'unavailable' | 'failed' | 'pending';
  assessmentNote?: string;
  toolSteps?: ToolCallStep[];
  grammarChecked?: boolean;
}

const PHONEME_TIPS_BASE: Record<string, string> = {
  p: "Bật môi mạnh, không rung thanh quản (ví dụ 'pen'). Chú ý bật hơi rõ ở đầu từ.",
  b: "Khép môi, bật ra và rung thanh quản (ví dụ 'book').",
  t: "Đầu lưỡi chạm lợi trên rồi bật ra, không rung (ví dụ 'top'). Bật hơi rõ ở đầu từ.",
  d: "Đầu lưỡi chạm lợi trên, bật ra và rung thanh quản (ví dụ 'dog').",
  k: "Phần sau lưỡi chạm vòm mềm rồi bật ra, không rung (ví dụ 'cat').",
  g: "Phần sau lưỡi chạm vòm mềm, bật ra và rung thanh quản (ví dụ 'go').",
  f: "Răng trên chạm môi dưới, thổi hơi ra, không rung (ví dụ 'fish').",
  v: "Chạm răng trên vào môi dưới và rung, không bật môi (ví dụ 'very').",
  θ: "Đặt đầu lưỡi giữa hai cửa răng, thổi nhẹ, không rung (ví dụ 'think').",
  ð: "Đặt đầu lưỡi giữa răng, thổi và rung nhẹ (ví dụ 'this').",
  s: "Đầu lưỡi gần lợi trên, thổi hơi ra như tiếng rắn, không rung (ví dụ 'see').",
  z: "Như 's' nhưng rung thanh quản (ví dụ 'zoo'). Đừng phát âm thành 's'.",
  ʃ: "Đặt lưỡi hơi lùi, môi tròn nhẹ, thổi nhẹ, không rung (ví dụ 'she').",
  ʒ: "Tương tự 'ʃ' nhưng có rung thanh quản (ví dụ 'vision', 'measure').",
  h: "Thổi hơi nhẹ ra từ cổ họng, miệng mở (ví dụ 'hat').",
  tʃ: "Kết hợp 't' + 'ʃ', bật ra một tiếng ngắn (ví dụ 'church').",
  dʒ: "Kết hợp 'd' + 'ʒ', có rung thanh quản (ví dụ 'judge', 'gym').",
  m: "Khép môi, hơi đi qua mũi, có rung (ví dụ 'mom').",
  n: "Đầu lưỡi chạm lợi trên, hơi đi qua mũi, có rung (ví dụ 'no').",
  ŋ: "Sau lưỡi chạm vòm mềm, hơi đi qua mũi (ví dụ 'sing'). Không bật 'g' ra cuối.",
  l: "Chạm đầu lưỡi vào lợi trên khi phát âm (ví dụ 'light'). Cuối từ thì lưỡi cong nhẹ về sau.",
  r: "Cuộn nhẹ phần sau lưỡi hoặc uốn nhẹ lưỡi về sau, không chạm vòm; tránh phát âm giống 'đ' tiếng Việt.",
  w: "Tròn môi và đẩy môi ra trước (ví dụ 'we', 'water').",
  j: "Lưỡi gần vòm cứng, lướt nhanh sang nguyên âm sau (ví dụ 'yes').",
  ɪ: "Ngắn, không kéo dài, miệng hơi mở (ví dụ 'sit'). Không phát âm thành 'iː'.",
  iː: "Kéo dài âm 'ee', miệng hơi cười (ví dụ 'see', 'meet').",
  e: "Miệng mở vừa, lưỡi giữa-trước (ví dụ 'bed', 'red').",
  æ: "Mở miệng rộng, lưỡi thấp phía trước (ví dụ 'cat', 'apple').",
  ʌ: "Miệng mở vừa, lưỡi giữa, ngắn (ví dụ 'cup', 'love').",
  ɑ: "Mở rộng miệng, lưỡi thấp sau (ví dụ 'father', 'car').",
  ɒ: "Môi hơi tròn, miệng mở, ngắn (giọng Anh 'lot').",
  ɔ: "Môi tròn, kéo dài hơn 'ɒ' (ví dụ 'thought', 'law').",
  ʊ: "Ngắn, môi tròn nhẹ, giống 'u' (ví dụ 'book', 'put').",
  uː: "Kéo dài âm 'oo', môi tròn chặt (ví dụ 'food', 'blue').",
  ɜ: "Âm giữa miệng, giữ lưỡi ở giữa, kéo dài (ví dụ 'bird', 'work').",
  ə: "Schwa — âm trung tính, ngắn và yếu, không nhấn (ví dụ 'sofa', 'about').",
  eɪ: "Âm đôi, từ 'e' chuyển sang 'i' (ví dụ 'say', 'day').",
  aɪ: "Âm đôi, từ 'a' sang 'i' (ví dụ 'my', 'time').",
  ɔɪ: "Âm đôi, từ 'ɔ' sang 'i' (ví dụ 'boy', 'coin').",
  aʊ: "Âm đôi, từ 'a' sang 'u', môi tròn dần (ví dụ 'now', 'house').",
  oʊ: "Âm đôi, từ 'o' sang 'u' (giọng Mỹ 'go', 'no').",
  əʊ: "Âm đôi, bắt đầu schwa rồi sang 'u' (giọng Anh 'go', 'no').",
  ɪə: "Âm đôi, từ 'ɪ' sang schwa (giọng Anh 'here', 'near').",
  eə: "Âm đôi, từ 'e' sang schwa (giọng Anh 'hair', 'care').",
  ʊə: "Âm đôi, từ 'ʊ' sang schwa (giọng Anh 'tour', 'pure').",
};

const ARPABET_TO_IPA: Record<string, string> = {
  AA: 'ɑ',
  AE: 'æ',
  AH: 'ʌ',
  AO: 'ɔ',
  AW: 'aʊ',
  AY: 'aɪ',
  EH: 'e',
  ER: 'ɜ',
  EY: 'eɪ',
  IH: 'ɪ',
  IY: 'iː',
  OW: 'oʊ',
  OY: 'ɔɪ',
  UH: 'ʊ',
  UW: 'uː',
  AX: 'ə',
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'g',
  HH: 'h',
  H: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

export const PHONEME_TIPS: Record<string, string> = (() => {
  const out: Record<string, string> = { ...PHONEME_TIPS_BASE };
  for (const [key, tip] of Object.entries(PHONEME_TIPS_BASE)) {
    if (key.endsWith('ː')) {
      const short = key.slice(0, -1);
      if (!(short in out)) out[short] = tip;
    } else {
      const long = key + 'ː';
      if (!(long in out)) out[long] = tip;
    }
  }
  for (const [arpa, ipa] of Object.entries(ARPABET_TO_IPA)) {
    const tip = out[ipa];
    if (!tip) continue;
    if (!(arpa in out)) out[arpa] = tip;
    const lower = arpa.toLowerCase();
    if (!(lower in out)) out[lower] = tip;
  }
  return out;
})();

interface MessageBubbleProps {
  message: Message;
  onReplay?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <div
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-blue-400"
          style={{ animation: `dotPulse 1.2s ease-in-out ${delay}ms infinite` }}
        />
      ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const t = useT();
  const isGood = score >= 85;
  const isMid = score >= 70;
  const cls = isGood
    ? 'text-green-700 bg-green-50 border-green-500/35 dark:text-green-200 dark:bg-green-500/25 dark:border-green-400/60'
    : isMid
      ? 'text-amber-700 bg-yellow-50 border-yellow-500/35 dark:text-amber-200 dark:bg-amber-500/25 dark:border-amber-400/60'
      : 'text-orange-700 bg-orange-50 border-orange-500/35 dark:text-orange-200 dark:bg-orange-500/25 dark:border-orange-400/60';
  return (
    <span
      title={t('bubble.score.title')}
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-full border text-[10px] font-bold leading-4 tracking-wide select-none ${cls}`}
    >
      <span className="tabular-nums font-bold">{score}</span>
      <span data-score-suffix className="font-normal text-[10px] ml-0.5 opacity-70">
        /<span className="font-semibold">100</span>
      </span>
    </span>
  );
}

export default function MessageBubble({
  message,
  onReplay,
  expandable,
  expanded,
  onToggleExpanded,
}: MessageBubbleProps) {
  const t = useT();
  const isAgent = message.role === 'agent';
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(message.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    },
    [message.text],
  );

  const handleTranslate = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    if (translatedText) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    try {
      const API_KEY = import.meta.env.VITE_GG_TRANSLATE_API || 'YOUR_API_KEY_HERE';

      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
        {
          method: 'POST',
          body: JSON.stringify({
            q: message.text,
            target: 'vi',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = await response.json();
      if (data.data?.translations?.[0]?.translatedText) {
        setTranslatedText(data.data.translations[0].translatedText);
        setShowTranslation(true);
      } else {
        throw new Error(data.error?.message || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const renderContent = () => {
    if (message.typing) return <TypingIndicator />;
    if (!message.text && !isAgent && message.userAudioUrl) {
      return (
        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Mic className="w-3 h-3 animate-pulse" />
          <span>Sending</span>
          <span className="flex items-center gap-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1 h-1 rounded-full bg-gray-400 inline-block"
                style={{ animation: `dotPulse 1.2s ease-in-out ${delay}ms infinite` }}
              />
            ))}
          </span>
        </span>
      );
    }
    if (!message.text) return null;

    const mistakes = message.mistakes || [];
    const pronunciationMistakes = mistakes.filter((m) => m.type === 'Pronunciation');
    const grammarMistakes = mistakes.filter((m) => m.type === 'Grammar');

    const words = message.text.split(/(\s+)/);
    return words.map((segment, idx) => {
      const cleanWord = segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z-]/g, '');
      if (!cleanWord) return <span key={idx}>{segment}</span>;

      const pMistake = pronunciationMistakes.find(
        (m) => m.wrong.toLowerCase().replace(/[^a-z-]/g, '') === cleanWord,
      );

      const gMistake = grammarMistakes.find(
        (m) => m.wrong.toLowerCase().replace(/[^a-z-]/g, '') === cleanWord,
      );

      let className = 'transition-colors duration-150';
      if (pMistake) {
        className +=
          ' text-red-600 font-medium underline decoration-red-300 decoration-2 underline-offset-2';
      } else if (gMistake) {
        className += ' text-orange-600 border-b-2 border-orange-200 border-dotted';
      }

      return (
        <span key={idx} className={className}>
          {segment}
        </span>
      );
    });
  };

  const tsDate =
    message.timestamp instanceof Date
      ? message.timestamp
      : new Date(message.timestamp as unknown as string | number);
  const timeStr = tsDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const canSelect = !isAgent && expandable && !message.typing;

  return (
    <div
      ref={containerRef}
      className={`flex gap-2.5 ${isAgent ? 'flex-row' : 'flex-row-reverse'} items-end relative`}
      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
      onMouseEnter={() => !message.typing && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mb-0.5 ${
          isAgent
            ? 'bg-blue-100 border-2 border-blue-300'
            : 'bg-violet-100 border-2 border-violet-300'
        }`}
      >
        {isAgent ? (
          <Bot className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <User className="w-3.5 h-3.5 text-purple-600" />
        )}
      </div>

      <div className={`max-w-[75%] flex flex-col gap-1 ${isAgent ? 'items-start' : 'items-end'}`}>
        <div className={`flex items-center gap-1.5 ${isAgent ? '' : 'flex-row-reverse'}`}>
          <span className="text-[10px] font-medium text-gray-600">
            {isAgent ? t('common.agent') : t('common.you')}
          </span>
          <span className="text-[10px] text-gray-400">{timeStr}</span>

          {!message.typing &&
            !isAgent &&
            (message.score !== undefined || message.scoreDetails?.overall !== undefined) && (
              <ScoreBadge score={message.score ?? message.scoreDetails?.overall ?? 0} />
            )}
        </div>

        <div
          className={`flex items-center gap-2 ${isAgent ? 'flex-row' : 'flex-row-reverse'} w-full relative`}
        >
          <button
            type="button"
            onClick={() => {
              if (message.typing) return;
              if (canSelect) {
                onToggleExpanded?.();
              }
              setShowActions(!showActions);
            }}
            disabled={message.typing}
            className={`text-left px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap relative transition-all flex-1 ${
              isAgent
                ? 'bg-blue-50 border border-blue-300 text-gray-900 rounded-tl-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 cursor-default'
                : `bg-violet-50 border text-gray-900 rounded-tr-sm dark:bg-violet-900/20 dark:text-gray-100 ${
                    canSelect
                      ? expanded
                        ? 'border-violet-500 ring-2 ring-violet-300/50 bg-violet-100 dark:bg-violet-900/40 cursor-pointer'
                        : 'border-violet-300 hover:border-violet-400 hover:bg-violet-100/70 dark:border-violet-700 dark:hover:bg-violet-900/30 cursor-pointer'
                      : 'border-violet-300 dark:border-violet-700 cursor-default'
                  }`
            } ${showActions ? 'ring-2 ring-blue-400 dark:ring-blue-500 ring-opacity-50' : ''}`}
          >
            {renderContent()}

            <AnimatePresence>
              {showTranslation && translatedText && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`mt-2 pt-2 border-t text-xs italic overflow-hidden ${isAgent ? 'border-blue-200 text-blue-800' : 'border-violet-200 text-violet-800'}`}
                >
                  <div className="flex items-center gap-1 mb-1 opacity-70 not-italic font-semibold uppercase tracking-wider text-[9px]">
                    <Languages className="w-2.5 h-2.5" />
                    <span>Vietnamese</span>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: translatedText }} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {showActions && !message.typing && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`absolute z-20 flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 ${
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
                  onClick={(e) => handleTranslate(e)}
                  active={showTranslation}
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
                {onReplay && (
                  <ToolbarButton
                    icon={<Play className="w-3 h-3 fill-current" />}
                    label="Speak"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReplay();
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isAgent && !message.typing && (message.toolSteps?.length ?? 0) > 0 && (
          <ReasoningSteps steps={message.toolSteps!} />
        )}
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
}

function ToolbarButton({ icon, label, onClick, active }: ToolbarButtonProps) {
  return (
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
}
