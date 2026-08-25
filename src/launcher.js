import { el, assurance } from './shell.js';

import { TOOLS } from './tools.js';

const compass = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
const anchor = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>';

const nav = el('nav', { class:'gs-nav', 'aria-label':'The Good Ship local tools' });
nav.innerHTML = anchor + '<span>The Good Ship · local tools</span>';

const wrap = el('main', { class:'gs-wrap' });
const head = el('header');
const label = el('div', { class:'gs-label', style:{ display:'flex', alignItems:'center', gap:'.4rem' } });
label.innerHTML = compass + '<span>the good ship · local tools</span>';
head.append(
  label,
  el('h1', { style:{ fontSize:'2.15rem', margin:'.3rem 0 .5rem' } }, 'Small tools that keep your files to yourself'),
  el('p', { class:'gs-lead' }, 'Useful everyday jobs without sending a document, photo or dataset to somebody else’s server. Each tool also builds as a standalone HTML file.'),
  el('div', { style:{ margin:'1.25rem 0 .7rem' } }, assurance()),
  el('p', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', margin:'.45rem 0 1.4rem' } }, 'No analytics · no cookies · no remote fonts · no account'),
);

const search = el('input', { type:'search', placeholder:'Find a tool…', 'aria-label':'Find a tool', style:{ width:'min(100%, 430px)', marginBottom:'1rem' } });
const count = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', marginBottom:'.65rem' }, 'aria-live':'polite' });
const grid = el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' } });

function renderTools() {
  const q = search.value.trim().toLowerCase();
  const visible = TOOLS.filter(t => !q || `${t.name} ${t.blurb} ${t.category} ${t.keywords}`.toLowerCase().includes(q));
  count.textContent = q ? `${visible.length} matching tool${visible.length === 1 ? '' : 's'}` : `${TOOLS.length} local tools`;
  grid.innerHTML = '';
  for (const t of visible) {
    const card = el('a', { href:`./tools/${t.id}/index.html`, class:'gs-card', style:{ display:'block', textDecoration:'none', color:'inherit' } });
    card.append(
      el('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.6rem' } },
        el('div', { class:'gs-icon-circle', html:compass }),
        el('span', { class:'gs-pill gs-pill-live' }, t.category)),
      el('div', { style:{ fontFamily:'var(--fh)', color:'var(--text)', fontSize:'1.15rem', marginBottom:'.3rem' } }, t.name),
      el('p', { style:{ fontSize:'.85rem', margin:0, fontFamily:'var(--fb)' } }, t.blurb),
    );
    grid.append(card);
  }
  if (!visible.length) grid.append(el('div', { class:'gs-card' }, 'No matching tool yet.'));
}
search.addEventListener('input', renderTools);
head.append(search, count, grid);
renderTools();

const foot = el('footer', { class:'gs-foot' });
foot.innerHTML = '<b>The Good Ship</b> <span>· tomcw.xyz · CC BY-NC 4.0</span>';
wrap.append(head, foot);
document.body.append(nav, wrap);
