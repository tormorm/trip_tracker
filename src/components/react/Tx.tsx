// React twin of T.astro: renders both languages, CSS shows the active one.
import type { Localized } from '../../data/schema';
import { ui, type UiKey } from '../../i18n/ui';

export function Tx({ v }: { v?: Localized | null }) {
  if (v == null) return null;
  if (typeof v === 'string') return <>{v}</>;
  return (
    <>
      <span data-l="et" lang="et">{v.et}</span>
      <span data-l="en" lang="en">{v.en}</span>
    </>
  );
}

export const U = ({ k }: { k: UiKey }) => <Tx v={ui[k]} />;
