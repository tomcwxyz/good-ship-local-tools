function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHref(raw) {
  const href = raw.trim();
  if (!href) return '#';
  if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(href)) return escapeHtml(href);
  return '#';
}

function inline(text) {
  const code = [];
  let out = String(text).replace(/`([^`\n]+)`/g, (_, value) => {
    const token = `@@CODE${code.length}@@`;
    code.push(`<code>${escapeHtml(value)}</code>`);
    return token;
  });

  out = escapeHtml(out)
    .replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g,
      (_, alt, src, title) => {
        const url = safeHref(src);
        if (url === '#') return `<span title="Image source blocked">${escapeHtml(alt || 'image')}</span>`;
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${url}" alt="${escapeHtml(alt)}"${t} loading="lazy">`;
      })
    .replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g,
      (_, label, href, title) => {
        const url = safeHref(href);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${url}"${t} target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  code.forEach((html, i) => { out = out.replace(`@@CODE${i}@@`, html); });
  return out;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

export function renderMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let listType = null;

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      closeList();
      const language = line.trim().slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++;
      html.push(`<pre><code${language ? ` data-language="${escapeHtml(language)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2].replace(/\s+#+\s*$/, ''))}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      closeList();
      html.push('<hr>');
      i++;
      continue;
    }

    if (i + 1 < lines.length && line.includes('|') && isTableDivider(lines[i + 1])) {
      closeList();
      const heads = tableCells(line);
      html.push('<table><thead><tr>' + heads.map(cell => `<th>${inline(cell)}</th>`).join('') + '</tr></thead><tbody>');
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const cells = tableCells(lines[i]);
        html.push('<tr>' + heads.map((_, idx) => `<td>${inline(cells[idx] ?? '')}</td>`).join('') + '</tr>');
        i++;
      }
      html.push('</tbody></table>');
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      closeList();
      const parts = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*>\s?(.*)$/);
        if (!m) break;
        parts.push(m[1]);
        i++;
      }
      html.push(`<blockquote>${parts.map(part => `<p>${inline(part)}</p>`).join('')}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType && listType !== nextType) closeList();
      if (!listType) { listType = nextType; html.push(`<${listType}>`); }
      let item = (unordered || ordered)[1];
      const task = item.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        item = `<input type="checkbox" disabled${task[1].toLowerCase() === 'x' ? ' checked' : ''}> ${inline(task[2])}`;
      } else {
        item = inline(item);
      }
      html.push(`<li>${item}</li>`);
      i++;
      continue;
    }

    closeList();
    const paragraph = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim()
      && !/^(#{1,6})\s+/.test(lines[i])
      && !/^\s*```/.test(lines[i])
      && !/^\s*>/.test(lines[i])
      && !/^\s*[-+*]\s+/.test(lines[i])
      && !/^\s*\d+[.)]\s+/.test(lines[i])) {
      if (i + 1 < lines.length && lines[i].includes('|') && isTableDivider(lines[i + 1])) break;
      paragraph.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  closeList();
  return html.join('\n');
}

export function markdownStats(markdown) {
  const text = String(markdown ?? '');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, characters: text.length, lines: text ? text.split(/\r\n?|\n/).length : 0 };
}
