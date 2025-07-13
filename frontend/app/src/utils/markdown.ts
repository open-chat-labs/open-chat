import hljs from "highlight.js";
import { marked, type Token } from "marked";
import { isAbsoluteUrl, synonymousUrlRegex } from "./urls";

interface Link {
    href: string;
    title?: string | null;
    text: string;
}

interface Code {
    text: string;
    lang?: string;
    escaped?: boolean;
}

const renderer = {
    code({ text, lang }: Code) {
        const highlighted =
            lang && hljs.getLanguage(lang)
                ? hljs.highlight(text, { language: lang }).value
                : hljs.highlightAuto(text).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    },
    link(link: Link) {
        let target = "";
        if (link.href !== null) {
            const abs = isAbsoluteUrl(link.href);
            // Check if the link is to a synonymous url (eg. https://oc.app), if so, convert it to a relative link
            if (synonymousUrlRegex.test(link.href)) {
                link.href = link.href.replace(synonymousUrlRegex, "");
                link.href = link.href.replace("/#/", "/");
            } else if (abs) {
                target = 'target="_blank"';
            } else {
                // if it's a relative url replace hash routes with normal ones
                link.href = link.href.replace("/#/", "/");
            }
        }

        return `<a href="${link.href}" ${link.title && `title="${link.title}"`} ${target}>${
            link.text
        }</a>`;
    },
};

const walkTokens = (token: Token) => {
    if (token.type === "escape") {
        // This ensures each instance of \\ is rendered correctly rather than being modified to \
        token.text = token.raw;
    }

    if (token.type === "html") {
        token.type = "text";
        token.raw = token.raw.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
};

marked.use({ renderer, walkTokens });
