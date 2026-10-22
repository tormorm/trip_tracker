import { useEffect, useState } from 'react';
import type { Traveller } from '../../data/schema';
import { setLang } from '../../lib/lang';
import { U } from './Tx';
import './namepicker.css';

const KEY = 'tc.name';

export function getName(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Ask "who are you?" once; reopen via window event 'tc:pick-name'. */
export default function NamePicker({ travellers }: { travellers: Pick<Traveller, 'id' | 'name' | 'color'>[] }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [otherName, setOtherName] = useState('');

  useEffect(() => {
    const current = getName();
    if (!current) setOpen(true);
    const reopen = () => {
      const n = getName();
      const known = travellers.some((t) => t.name === n);
      setChosen(known ? n : null);
      setOther(!!n && !known);
      setOtherName(n && !known ? n : '');
      setOpen(true);
    };
    addEventListener('tc:pick-name', reopen);
    return () => removeEventListener('tc:pick-name', reopen);
  }, [travellers]);

  if (!open) return null;
  const name = other ? otherName.trim() : chosen;

  const save = () => {
    if (!name) return;
    try {
      localStorage.setItem(KEY, name);
    } catch {}
    dispatchEvent(new CustomEvent('tc:name', { detail: name }));
    setOpen(false);
  };

  return (
    <div className="np" role="dialog" aria-modal="true" aria-labelledby="np-title">
      <div className="np-inner">
        <div className="np-lang">
          <button type="button" onClick={() => setLang('et')}>ET</button>
          <button type="button" onClick={() => setLang('en')}>EN</button>
        </div>
        <p className="label np-kicker"><U k="name.kicker" /></p>
        <h1 id="np-title" className="serif"><U k="name.title" /></h1>
        <p className="np-sub"><U k="name.sub" /></p>
        <div className="np-grid">
          {travellers.map((t) => (
            <button key={t.id} type="button" className="np-person" aria-pressed={!other && chosen === t.name} onClick={() => { setOther(false); setChosen(t.name); }}>
              <span className="np-av" style={{ background: t.color }}>{t.name[0]}</span>
              {t.name}
            </button>
          ))}
          <button type="button" className="np-person np-other" aria-pressed={other} onClick={() => setOther(true)}>
            + <U k="name.other" />
          </button>
        </div>
        {other && (
          <input className="np-input" autoFocus maxLength={40} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="…" aria-label="Name" />
        )}
        <div className="np-foot">
          <button type="button" className="btn btn-primary np-go" disabled={!name} onClick={save}><U k="name.confirm" /></button>
          <p className="np-note"><U k="name.note" /></p>
        </div>
      </div>
    </div>
  );
}
