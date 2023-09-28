import DOMPurify, { type DOMPurifyI } from "dompurify";

export const DOMPurifyDefault = createDefault();
export const DOMPurifyOneLine = createOneLine();

function createDefault(): DOMPurifyI {
    const domPurify = DOMPurify();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class", "userId"],
        CUSTOM_ELEMENT_HANDLING: {
            tagNameCheck: (tag) => tag === "profile-link",
            attributeNameCheck: (attr) => ["text", "userId"].includes(attr),
            allowCustomizedBuiltInElements: true,
        },
    });
    return domPurify;
}

function createOneLine(): DOMPurifyI {
    const domPurify = DOMPurify();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class", "userId"],
        FORBID_TAGS: ["br"],
        CUSTOM_ELEMENT_HANDLING: {
            tagNameCheck: (tag) => tag === "profile-link",
            attributeNameCheck: (attr) => ["text", "userId"].includes(attr),
            allowCustomizedBuiltInElements: true,
        },
    });
    domPurify.addHook("uponSanitizeElement", (node) => {
        if (node.tagName === "BR") {
            node.outerHTML = " ";
        }
    });
    return domPurify;
}
