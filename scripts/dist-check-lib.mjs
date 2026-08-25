import { createHash } from 'node:crypto';

export function sha256HexText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function verifyStandaloneHtml(html, label = 'HTML') {
  const errors = [];
  const cspMeta = html.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i)?.[0];
  const csp = cspMeta?.match(/\bcontent=(["'])(.*?)\1/i)?.[2];

  if (!csp) errors.push('missing Content-Security-Policy meta tag');
  else {
    if (!/(?:^|;)\s*connect-src\s+'none'\s*(?:;|$)/i.test(csp)) errors.push("CSP must contain connect-src 'none'");
    if (!/(?:^|;)\s*object-src\s+'none'\s*(?:;|$)/i.test(csp)) errors.push("CSP must contain object-src 'none'");
    if (!/(?:^|;)\s*base-uri\s+'none'\s*(?:;|$)/i.test(csp)) errors.push("CSP must contain base-uri 'none'");
    if (!/(?:^|;)\s*form-action\s+'none'\s*(?:;|$)/i.test(csp)) errors.push("CSP must contain form-action 'none'");
    if (!/script-src[^;]*'sha256-[^']+'/i.test(csp)) errors.push('CSP must hash the inlined production script');
  }

  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) errors.push('contains an external script tag');
  if (/<link\b[^>]*\brel\s*=\s*["']?stylesheet\b[^>]*\bhref\s*=/i.test(html)
      || /<link\b[^>]*\bhref\s*=\s*[^>]+\brel\s*=\s*["']?stylesheet\b/i.test(html)) errors.push('contains an external stylesheet link');
  if (/<(?:iframe|object|embed)\b/i.test(html)) errors.push('contains an iframe/object/embed element');
  if (/sourceMappingURL\s*=\s*(?!data:)/i.test(html)) errors.push('contains an external source-map reference');

  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
  return true;
}
