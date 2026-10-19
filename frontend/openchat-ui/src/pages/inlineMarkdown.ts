// The small markdown subset Learn's content text may use: links `[text](href)`, bold `**text**` and inline code
// `` `text` `` inside a paragraph, list item or answer, and a post paragraph that is just an image `![alt](src)`. Learn
// renders these as elements, never as HTML, so the content can't inject markup; anything else is plain text.

export type InlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

// a link's href may itself contain balanced parentheses, one level deep (a Wikipedia URL …)
const TOKEN = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*\*(.+?)\*\*|`([^`]+)`/g;
const IMAGE = /^!\[([^\]]*)\]\(([^()\s]+)\)$/;

/** Whether a link can be followed: web and mail links, and the host's own paths and fragments (not javascript: …). */
export function safeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href);
}

/** The parts of a line of content text, in order. A link that can't be followed is its text. */
export function inlineMarkdown(source: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const text = (t: string) => {
    if (!t) return;
    const last = parts[parts.length - 1];
    if (last?.kind === 'text') last.text += t;
    else parts.push({ kind: 'text', text: t });
  };
  let at = 0;
  for (const m of source.matchAll(TOKEN)) {
    text(source.slice(at, m.index));
    const [, label, href, bold, code] = m;
    if (label !== undefined) {
      if (safeHref(href)) parts.push({ kind: 'link', text: label, href });
      else text(label);
    } else if (bold !== undefined) parts.push({ kind: 'bold', text: bold });
    else parts.push({ kind: 'code', text: code });
    at = m.index + m[0].length;
  }
  text(source.slice(at));
  return parts;
}

/** The text a reader sees, without the markup: for searching. */
export function plainText(source: string): string {
  return inlineMarkdown(source)
    .map((p) => p.text)
    .join('');
}

/** A post paragraph that is just an image: its alt text and source. */
export function imageOf(paragraph: string): { alt: string; src: string } | null {
  const m = IMAGE.exec(paragraph.trim());
  if (!m || !(safeHref(m[2]) || /^[\w.-]+\//.test(m[2]))) return null;
  return { alt: m[1], src: m[2] };
}
