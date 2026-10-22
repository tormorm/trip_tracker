// UI chrome strings (not trip content — that lives in src/data).
// Estonian is the default language; every key needs both.
export type Lang = 'et' | 'en';
export const LANGS: Lang[] = ['et', 'en'];
export const DEFAULT_LANG: Lang = 'et';

export const ui = {
  'tab.today': { et: 'Täna', en: 'Today' },
  'tab.map': { et: 'Kaart', en: 'Map' },
  'tab.plan': { et: 'Plaan', en: 'Plan' },
  'tab.wishlist': { et: 'Soovid', en: 'Wishlist' },
  'tab.kit': { et: 'Abi', en: 'Kit' },
  'banner.placeholder': { et: 'NÄIDISANDMED — päris marsruut tulemas', en: 'PLACEHOLDER DATA — real route to come' },
  'lang.switch': { et: 'Keel', en: 'Language' },
  'stub.soon': { et: 'Tuleb järgmises etapis.', en: 'Coming in the next phase.' },
} satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof ui;

/** For client code: look up a string in the active language. */
export function t(key: UiKey, lang: Lang): string {
  return ui[key][lang];
}
