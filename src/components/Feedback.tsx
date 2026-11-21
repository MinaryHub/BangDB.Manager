import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ISSUES_URL, openExternal } from '../appinfo';
import { FEEDBACK, diagnostics, issueUrl, type FeedbackKind } from '../feedback';
import { useConnections } from '../store/store';
import { t } from '../i18n';
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
    <Modal title={t('Contact us on GitHub')} onClose={onClose} wide>
      <div className="seg" role="radiogroup" aria-label={t('Kind')} style={{ marginBottom: 12 }}>
        {(Object.keys(FEEDBACK) as FeedbackKind[]).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{t(FEEDBACK[k].label)}</button>
        ))}
      </div>
      <Field label={t('Title')}>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
          placeholder={kind === 'bug' ? t('e.g. Saving a row in a SQL Server table fails') : kind === 'feature' ? t('e.g. Export to Excel') : t('e.g. How do I connect over SSH?')} />
      </Field>
      <Field label={t('Message')}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={t(FEEDBACK[kind].placeholder)} />
      </Field>
      <label className="check"><input type="checkbox" checked={withEnv} onChange={(e) => setWithEnv(e.target.checked)} /> {t('Include app and system details')}</label>
      {withEnv && <pre className="out small" style={{ marginTop: 6 }}>{env}</pre>}
      <p className="muted small">{t('This opens a new issue on GitHub with your text filled in — review it there and press Submit (a free GitHub account is needed). Issues are public: do not include passwords, server addresses or private data.')}</p>
      <div className="actions">
        <button className="btn ghost" onClick={() => openExternal(ISSUES_URL)}>{t('Browse existing issues')}</button>
        <span className="grow" />
        <button className="btn" onClick={onClose}>{t('Cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => { openExternal(issueUrl(kind, title, text, withEnv ? env : undefined)); onClose(); }}>{t('Continue on GitHub')}</button>
      </div>
    </Modal>
  );
}
