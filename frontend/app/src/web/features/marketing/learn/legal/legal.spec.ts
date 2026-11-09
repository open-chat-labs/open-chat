import { inlineMarkdown, plainText, safeHref } from "@openchat/ui/src/pages/inlineMarkdown";
import type { LearnBlock, LearnDoc } from "@openchat/ui/src/pages/learnContent";
import { guidelines } from "./guidelines";
import { privacy } from "./privacy";
import { terms } from "./terms";

const docs: Record<string, LearnDoc> = { terms, privacy, guidelines };

// every piece of text a doc renders with Learn's markdown subset
function texts(doc: LearnDoc): string[] {
    const ofBlocks = (blocks: LearnBlock[]): string[] =>
        blocks.flatMap((b) => {
            switch (b.kind) {
                case "para":
                    return [b.text];
                case "bullets":
                    return b.items;
                case "definitions":
                    return b.items.flatMap((d) => [d.term, d.meaning]);
                case "clauses":
                    return b.items.flatMap((c) => [...(c.title ? [c.title] : []), ...ofBlocks(c.body)]);
            }
        });
    return [...(doc.intro ?? []), ...doc.sections.flatMap((s) => [s.title, ...ofBlocks(s.blocks ?? [])])];
}

const fullText = (doc: LearnDoc) => texts(doc).map(plainText).join(" ");

describe("the legal docs, as Learn content", () => {
    test("/guidelines?section=3 scrolls to the platform rules section", () => {
        // the backend's report replies and both trees' report and deleted-message notes link to it
        const section = guidelines.sections.find((s) => s.id === "3");
        expect(section?.title).toBe("Content Standards");
        expect(fullText({ ...guidelines, sections: [section!] })).toContain(
            "Do not threaten to harm another individual or group of people.",
        );
    });

    test("keep the old pages' ?section= ids, in order", () => {
        const ids = (doc: LearnDoc) => doc.sections.map((s) => s.id);
        const count = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
        expect(ids(terms)).toEqual(count(11));
        expect(ids(privacy)).toEqual(count(9));
        expect(ids(guidelines)).toEqual(count(8));
    });

    test.each(Object.entries(docs))("%s writes every link so it's kept as a link", (_, doc) => {
        const parts = texts(doc).flatMap(inlineMarkdown);
        expect(parts.filter((p) => p.kind === "text" && /\]\(|\*\*/.test(p.text))).toEqual([]);
        for (const p of parts) if (p.kind === "link") expect(safeHref(p.href)).toBe(true);
    });

    test("number every clause list from 1, as the old pages' counters did", () => {
        const lists: string[][] = [];
        const walk = (blocks: LearnBlock[]) =>
            blocks.forEach((b) => {
                if (b.kind !== "clauses") return;
                lists.push(b.items.map((c) => c.number));
                b.items.forEach((c) => walk(c.body));
            });
        Object.values(docs).forEach((d) => d.sections.forEach((s) => walk(s.blocks ?? [])));
        expect(lists.length).toBeGreaterThan(0);
        for (const numbers of lists) {
            numbers.forEach((n, i) => expect(n).toMatch(new RegExp(`(^|\\D)${i + 1}\\)?$`)));
        }
    });

    test("read as they do now: media isn't sent to general-purpose classifiers, and PhotoDNA is named", () => {
        // #9150 and #9173
        expect(fullText(terms)).toContain(
            "Message media is not sent to general-purpose classifiers",
        );
        expect(fullText(terms)).toContain("PhotoDNA technology licensed by Microsoft");
        expect(fullText(privacy)).toContain("PhotoDNA technology licensed by Microsoft");
    });
});
