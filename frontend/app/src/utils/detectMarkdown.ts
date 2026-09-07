// a few regexes to detect various block level markdown elements (possibly incomplete)
const headerRegex = /^(?:#{1,6}\s+)/m;
const tableRegex = /(?:\|(?:[^\r\n|\\]|\\.)*\|)+/;
const bulletedListRegex = /^(?:\s*[-*+]\s+)/m;
const numberedListRegex = /^(?:\s*\d+\.\s+)/m;
const blockquoteRegex = /^(?:\s*>)/m;
const codeBlockRegex = /(?:^```[\s\S]*?^```)/m;
const regexList = [
    headerRegex,
    tableRegex,
    bulletedListRegex,
    numberedListRegex,
    blockquoteRegex,
    codeBlockRegex,
];

export function detectMarkdown(text: string | null | undefined): boolean {
    if (!text) return false;
    return regexList.some((regex) => regex.test(text));
}
