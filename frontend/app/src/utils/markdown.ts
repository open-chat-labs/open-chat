import { isAbsoluteUrl, synonymousUrlRegex } from "./urls";
import { marked } from "marked";

const renderer = {
    link(href: string | null, title: string | null, text: string) {
        let target = "";
        if (href !== null) {
            const abs = isAbsoluteUrl(href);
            // Check if the link is to a synonymous url (eg. https://oc.app), if so, convert it to a relative link
            if (synonymousUrlRegex.test(href)) {
                href = href.replace(synonymousUrlRegex, "");
                href = href.replace("/#/", "/");
            } else if (abs) {
                target = 'target="_blank"';
            } else {
                // if it's a relative url replace hash routes with normal ones
                href = href.replace("/#/", "/");
            }
        }

        return `<a href=${href} ${title && `title=${title}`} ${target}>${text}</a>`;
    },
};

marked.use({ renderer });
