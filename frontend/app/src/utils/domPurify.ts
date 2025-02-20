import DOMPurify from "dompurify";

export const DOMPurifyDefault = createDefault();
export const DOMPurifyOneLine = createOneLine();

function createDefault(): DOMPurify.DOMPurify {
    const domPurify = DOMPurify();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class", "user-id", "suppress-links"],
        CUSTOM_ELEMENT_HANDLING: {
            tagNameCheck: (tag) => tag === "profile-link",
            attributeNameCheck: (attr) => ["text", "userId"].includes(attr),
            allowCustomizedBuiltInElements: true,
        },
    });
    return domPurify;
}

function createOneLine(): DOMPurify.DOMPurify {
    const domPurify = DOMPurify();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class", "user-id", "suppress-links"],
        FORBID_TAGS: ["br"],
        CUSTOM_ELEMENT_HANDLING: {
            tagNameCheck: (tag) => tag === "profile-link",
            attributeNameCheck: (attr) => ["text", "userId"].includes(attr),
            allowCustomizedBuiltInElements: true,
        },
    });
    domPurify.addHook("uponSanitizeElement", (node) => {
        const element = node as Element;
        if (element.tagName === "BR") {
            element.outerHTML = " ";
        }
    });
    return domPurify;
}
