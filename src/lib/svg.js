// SVGs opened as images are lower-risk than inline SVG, but they can still carry
// external-resource references. Local Tools rejects active/external constructs
// rather than relying on browser-specific fetch/script behaviour.
export function assertSafeSvgText(text) {
  const source = String(text);
  const rules = [
    [/<script\b/i, 'script'],
    [/<foreignObject\b/i, 'foreignObject content'],
    [/<(?:iframe|object|embed|link)\b/i, 'embedded active content'],
    [/\son[a-z]+\s*=/i, 'event-handler attributes'],
    [/<!ENTITY\b/i, 'XML entities'],
    [/@import\b/i, 'CSS imports'],
    [/(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|\/\/|file:|ftp:|javascript:)/i, 'external or executable references'],
    [/url\(\s*["']?\s*(?:https?:|\/\/|file:|ftp:|javascript:)/i, 'external CSS resources'],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(source)) throw new Error(`That SVG contains ${label}. It has been blocked so a local file cannot execute code or request an external resource.`);
  }
  return true;
}

export async function assertSafeSvgFile(file) {
  return assertSafeSvgText(await file.text());
}
