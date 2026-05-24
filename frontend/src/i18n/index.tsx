import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en from './en.json';
import id from './id.json';

type Lang = 'en' | 'id';

const translations: Record<Lang, Record<string, string>> = { en, id };

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('pwguard-lang') as Lang) || 'en';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('pwguard-lang', l);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[lang][key] || translations['en'][key] || key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
