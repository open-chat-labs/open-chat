import { inlineMarkdown, imageOf } from "@openchat/ui/src/pages/inlineMarkdown";
import { postsBySlug } from "@src/components/landingpages/blog/posts";
import { learnContent } from "./index";

const content = learnContent((key) => key);

// every piece of text Learn renders with the markdown subset
const texts = [
    ...(content.docs.whitepaper?.sections.flatMap((s) => [...s.paras, ...(s.list ?? [])]) ?? []),
    ...content.posts.flatMap((p) => p.body.filter((b) => imageOf(b) === null)),
    ...content.roadmap.flatMap((r) => [
        ...(r.detail?.paras ?? []),
        ...(r.detail?.points ?? []).filter((pt) => !pt.href).map((pt) => pt.label),
    ]),
];

describe("Learn's converted content", () => {
    test("keeps the old blog's slugs, so /blog/<slug> links still open their post", () => {
        expect(content.posts.map((p) => p.slug).sort()).toEqual(Object.keys(postsBySlug).sort());
    });

    test("has unique whitepaper section ids, the targets of ?section=", () => {
        const ids = content.docs.whitepaper!.sections.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("writes every link so it's kept as a link (none fall back to its text)", () => {
        const dropped = texts.filter((t) =>
            inlineMarkdown(t).some((part) => part.kind === "text" && /\]\(/.test(part.text)),
        );
        expect(dropped).toEqual([]);
    });

    test("writes every screenshot so it shows as one", () => {
        const broken = content.posts.flatMap((p) =>
            p.body.filter((b) => b.trim().startsWith("![") && imageOf(b) === null),
        );
        expect(broken).toEqual([]);
    });
});
