import { isAbsoluteUrl, synonymousUrlRegex } from "./urls";
import { marked } from "marked";

const renderer = {
    link(href: string | null, title: string | null, text: string) {
        let target = "";
        if (href !== null) {
            // Check if the link is to a synonymous url (eg. https://oc.app), if so, convert it to a relative link
            if (synonymousUrlRegex.test(href)) {
                href = href.replace(synonymousUrlRegex, "");
                if (href === "" || href === "/") {
                    href = "/#";
                }
            } else if (isAbsoluteUrl(href)) {
                target = 'target="_blank"';
            }
        }

        return `<a href=${href} ${title && `title=${title}`} ${target}>${text}</a>`;
    },
};

marked.use({ renderer });
