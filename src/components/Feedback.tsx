import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ISSUES_URL, openExternal } from '../appinfo';
import { FEEDBACK, diagnostics, issueUrl, type FeedbackKind } from '../feedback';
import { useConnections } from '../store/store';
import { Field, Modal } from './ui';

/** Write a bug report / feature request / question and continue on GitHub Issues. */
export function FeedbackModal({ kind: initial, onClose }: { kind: FeedbackKind; onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>(initial);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [withEnv, setWithEnv] = useState(true);
  const conns = useConnections();
  const loc = useLocation();
  const env = diagnostics(conns.map((c) => c.kind), loc.pathname);
  const ok = title.trim().length > 0;
  return (
    <Modal title="Contact us on GitHub" onClose={onClose} wide>
      <div className="seg" role="radiogroup" aria-label="Kind" style={{ marginBottom: 12 }}>
        {(Object.keys(FEEDBACK) as FeedbackKind[]).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{FEEDBACK[k].label}</button>
        ))}
      </div>
      <Field label="Title">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
          placeholder={kind === 'bug' ? 'e.g. Saving a row in a SQL Server table fails' : kind === 'feature' ? 'e.g. Export to Excel' : 'e.g. How do I connect over SSH?'} />
      </Field>
      <Field label="Details">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={FEEDBACK[kind].placeholder} />
      </Field>
      <label className="check"><input type="checkbox" checked={withEnv} onChange={(e) => setWithEnv(e.target.checked)} /> Include app and system details</label>
      {withEnv && <pre className="out small" style={{ marginTop: 6 }}>{env}</pre>}
      <p className="muted small">This opens a new issue on GitHub with your text filled in — review it there and press Submit (a free GitHub account is needed). Issues are public: do not include passwords, server addresses or private data.</p>
      <div className="actions">
        <button className="btn ghost" onClick={() => openExternal(ISSUES_URL)}>Browse existing issues</button>
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => { openExternal(issueUrl(kind, title, text, withEnv ? env : undefined)); onClose(); }}>Continue on GitHub</button>
      </div>
    </Modal>
  );
}
