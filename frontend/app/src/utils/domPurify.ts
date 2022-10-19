import DOMPurify, { DOMPurifyI } from "dompurify";

export const DOMPurifyDefault = createDefault();
export const DOMPurifyOneLine = createOneLine();

function createDefault(): DOMPurifyI {
    const domPurify = DOMPurify();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class"],
    });
    return domPurify;
}

function createOneLine(): DOMPurifyI {
    const domPurify = DOMPurify();
    domPurify.setConfig({
        ALLOWED_ATTR: ["target", "href", "class"],
        FORBID_TAGS: ["br"],
    });
    domPurify.addHook("uponSanitizeElement", (node) => {
        if (node.tagName === "BR") {
            node.outerHTML = " ";
        }
    });
    return domPurify;
}

