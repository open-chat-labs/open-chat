import * as DOMPurify from "dompurify";

export const DOMPurifyDefault = createDefault();

function createDefault(): DOMPurify.DOMPurify {
    const domPurify = DOMPurify.default();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class", "user-id", "suppress-links", "src", "alt"],
        CUSTOM_ELEMENT_HANDLING: {
            tagNameCheck: (tag) => tag === "profile-link" || tag === "custom-emoji" || tag === "spoiler-span",
            attributeNameCheck: (attr) => ["text", "userId", "data-id"].includes(attr),
            allowCustomizedBuiltInElements: true,
        },
    });
    return domPurify;
}

// One-line previews must collapse hard line breaks. We sanitise with the
// *identical* default configuration - so the security boundary is exactly the
// same as everywhere else - and only then strip <br> from the already
// sanitised, trusted output, replacing each with a space. Removing a void <br>
// tag from safe HTML cannot re-introduce anything unsafe.
//
// This replaces an earlier approach that mutated the DOM inside an
// `uponSanitizeElement` hook (`element.outerHTML = " "`). That detached the
// node mid-traversal; from dompurify 3.4.11 the stricter node-detachment guard
// throws "refusing to sanitize in place" for a parentless force-removed node,
// which surfaced messages to users as the literal text "unsafe".
export function sanitizeOneLine(html: string): string {
    return DOMPurifyDefault.sanitize(html).replace(/<br\b[^>]*>/gi, " ");
}
