import type { LearnContent } from "@openchat/ui/src/pages/learnContent";
import { faqGroups } from "./faq";
import { posts } from "./posts";
import { roadmap } from "./roadmap";
import { whitepaper } from "./whitepaper";

// Learn's content: the existing roadmap, whitepaper, blog posts and FAQs, converted to Learn's
// shapes. Loaded with the Learn pages (MarketingScreen), not with Landing. The Architecture page
// is the canister map, not a doc (MarketingScreen).

/** The content, with the FAQs in the app's current language. */
export function learnContent(translate: (key: string) => string): LearnContent {
    return { docs: { whitepaper }, posts, roadmap, faq: faqGroups(translate) };
}
