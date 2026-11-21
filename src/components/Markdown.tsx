import { Fragment, type ReactNode } from 'react';

/**
 * Just enough Markdown for release notes: headings, bullet lists (nested by
 * indent), paragraphs, **bold**, `code` and [links](https://…). Built as
 * React elements — release text is never injected as HTML.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let para: string[] = [];
  let list: { depth: number; text: string }[] = [];
  let code: string[] | null = null;
  const flushPara = () => { if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>); para = []; };
  const flushList = () => { if (list.length) blocks.push(<Fragment key={blocks.length}>{renderList(list)}</Fragment>); list = []; };
  for (const line of lines) {
    if (code) {
      if (/^```/.test(line.trim())) { blocks.push(<pre key={blocks.length} className="out">{code.join('\n')}</pre>); code = null; } else code.push(line);
      continue;
    }
    if (/^```/.test(line.trim())) { flushPara(); flushList(); code = []; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const li = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); blocks.push(<h4 key={blocks.length}>{inline(h[2])}</h4>); }
    else if (li) { flushPara(); list.push({ depth: Math.floor(li[1].replace(/\t/g, '  ').length / 2), text: li[2] }); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else if (list.length && /^\s+/.test(line)) list[list.length - 1].text += ` ${line.trim()}`;
    else { flushList(); para.push(line.trim()); }
  }
  if (code) blocks.push(<pre key={blocks.length} className="out">{code.join('\n')}</pre>);
  flushPara(); flushList();
  return <div className="md">{blocks}</div>;
}

function renderList(items: { depth: number; text: string }[]): ReactNode {
  // nest by depth: children are the following items that are deeper
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const base = items[i].depth;
    let j = i + 1;
    while (j < items.length && items[j].depth > base) j++;
    const kids = items.slice(i + 1, j);
    out.push(<li key={i}>{inline(items[i].text)}{kids.length > 0 && renderList(kids)}</li>);
    i = j - 1;
  }
  return <ul>{out}</ul>;
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<b key={m.index}>{t.slice(2, -2)}</b>);
    else if (t.startsWith('`')) out.push(<code key={m.index}>{t.slice(1, -1)}</code>);
    else out.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer">{/^\[([^\]]+)\]/.exec(t)![1]}</a>);
    last = m.index! + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
