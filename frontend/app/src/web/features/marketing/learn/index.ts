import type { LearnContent } from "@openchat/ui/src/pages/learnContent";
import { faqGroups } from "./faq";
import { posts } from "./posts";
import { roadmap } from "./roadmap";
import { whitepaper } from "./whitepaper";

// Learn's content: the existing roadmap, whitepaper, blog posts and FAQs, converted to Learn's
// shapes. Loaded with the Learn pages (MarketingScreen), not with Landing. The Architecture page
// is the canister map, not a doc (MarketingScreen).

// the whitepaper's section ids are the old page's outline: 3-4-1 sits under 3-4, under 3
const outlinedWhitepaper = {
    ...whitepaper,
    sections: whitepaper.sections.map((s) => ({ ...s, depth: s.id.split("-").length })),
};

/** The content, with the FAQs in the app's current language. */
export function learnContent(translate: (key: string) => string): LearnContent {
    return { docs: { whitepaper: outlinedWhitepaper }, posts, roadmap, faq: faqGroups(translate) };
}
