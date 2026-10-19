import type { FaqGroup } from "@openchat/ui/src/pages/learnContent";
import { allQuestions } from "@client";

// The FAQs, from the app's translations (faq.<id>_q / faq.<id>_a), so every language keeps them.
// The answers are HTML written for the old FAQ page; Learn's text is the markdown subset in
// inlineMarkdown.ts, so they're converted here.

/**
 * An old FAQ answer as Learn text: links become `[text](href)`, line breaks and lists become
 * lines (a blank line between paragraphs), table rows become lines of their cells, and any other
 * markup is dropped, keeping its text. Backtick code is already in the subset.
 */
export function answerText(html: string): string {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    return tidy(convert(body));
}

function convert(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return "";
    const inner = () => [...node.childNodes].map(convert).join("");
    switch (node.tagName) {
        case "A": {
            const href = node.getAttribute("href");
            const text = inner().trim();
            return href ? `[${text}](${href})` : text;
        }
        case "BR":
            return "\n";
        case "STRONG":
        case "B":
            return `**${inner().trim()}**`;
        case "UL":
        case "OL": {
            const items = [...node.children].filter((c) => c.tagName === "LI");
            const lines = items.map(
                (li, i) => `${node.tagName === "OL" ? `${i + 1}.` : "•"} ${tidy(convert(li))}`,
            );
            return `\n\n${lines.join("\n")}\n\n`;
        }
        case "TR":
            return `${[...node.children].map((cell) => tidy(convert(cell))).join(" · ")}\n`;
        case "TABLE":
            return `\n\n${inner()}\n\n`;
        default:
            return inner();
    }
}

// one space between words, no spaces around line breaks, at most one blank line in a row
function tidy(text: string): string {
    return text
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** The FAQs in the old page's order, each question's id its key (`?q=<id>`). */
export function faqGroups(translate: (key: string) => string): FaqGroup[] {
    return [
        {
            // one list, as the old page has: Learn shows no heading for an untitled group
            title: "",
            items: allQuestions.map((id) => ({
                id,
                q: translate(`faq.${id}_q`),
                a: answerText(translate(`faq.${id}_a`)),
            })),
        },
    ];
}
