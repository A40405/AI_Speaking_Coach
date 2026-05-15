/**
 * Dictionary Service for word lookups.
 * Combines data from local Oxford JSON, Free Dictionary API, and MyMemory API.
 */

export interface WordDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface WordData {
  word: string;
  cefr?: string; // Oxford CEFR level (A1-C2)
  phonetic?: string; // IPA
  audio?: string; // Audio URL
  definitions: WordDefinition[];
  translation?: string; // Vietnamese translation
}

interface DictionaryApiPhonetic {
  text?: string;
  audio?: string;
}

interface DictionaryApiDefinition {
  definition?: string;
  example?: string;
}

interface DictionaryApiMeaning {
  partOfSpeech?: string;
  definitions?: DictionaryApiDefinition[];
}

interface DictionaryApiEntry {
  phonetic?: string;
  phonetics?: DictionaryApiPhonetic[];
  meanings?: DictionaryApiMeaning[];
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
  };
}

// Mock Oxford CEFR data for demo purposes.
// In production, this would be loaded from a local JSON file.
const OXFORD_MOCK: Record<string, string> = {
  remarkable: 'B2',
  excellent: 'B1',
  fantastic: 'B2',
  good: 'A1',
  bad: 'A1',
  complex: 'B2',
  advanced: 'C1',
  beginner: 'A1',
};

/**
 * Fetches word details from multiple sources concurrently.
 */
export async function fetchWordDetails(word: string): Promise<WordData> {
  const cleanWord = word.toLowerCase().replace(/[^a-z-]/g, '');

  const results = await Promise.allSettled([
    // 1. Oxford JSON (Mocked)
    Promise.resolve(OXFORD_MOCK[cleanWord] || null),

    // 2. Free Dictionary API
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`).then(
      async (res): Promise<DictionaryApiEntry[] | null> =>
        res.ok ? ((await res.json()) as DictionaryApiEntry[]) : null,
    ),

    // 3. MyMemory Translation API (En -> Vi)
    fetch(`https://api.mymemory.translated.net/get?q=${cleanWord}&langpair=en|vi`).then(
      async (res): Promise<MyMemoryResponse | null> =>
        res.ok ? ((await res.json()) as MyMemoryResponse) : null,
    ),
  ]);

  const cefr = results[0].status === 'fulfilled' ? results[0].value : undefined;
  const dictData = results[1].status === 'fulfilled' ? results[1].value?.[0] : null;
  const transData = results[2].status === 'fulfilled' ? results[2].value : null;

  const wordData: WordData = {
    word: cleanWord,
    cefr: cefr || undefined,
    phonetic: dictData?.phonetic || dictData?.phonetics?.find((phonetic) => phonetic.text)?.text,
    audio: dictData?.phonetics?.find((phonetic) => phonetic.audio)?.audio,
    definitions:
      dictData?.meanings?.flatMap((meaning): WordDefinition[] => {
        const primaryDefinition = meaning.definitions?.[0];
        if (!primaryDefinition?.definition) return [];

        const definition: WordDefinition = {
          partOfSpeech: meaning.partOfSpeech ?? 'unknown',
          definition: primaryDefinition.definition,
        };

        if (primaryDefinition.example) {
          definition.example = primaryDefinition.example;
        }

        return [definition];
      }) || [],
    translation: transData?.responseData?.translatedText,
  };

  return wordData;
}
