import { DEFAULT_LANG, type Lang } from '../i18n/ui';

const KEY = 'tc.lang';

export function getLang(): Lang {
  const v = document.documentElement.dataset.lang;
  return v === 'en' ? 'en' : DEFAULT_LANG;
}

export function setLang(lang: Lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  window.dispatchEvent(new CustomEvent('tc:lang', { detail: lang }));
}
