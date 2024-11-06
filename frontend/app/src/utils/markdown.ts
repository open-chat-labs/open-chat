import { isAbsoluteUrl, synonymousUrlRegex } from "./urls";
import { marked } from "marked";

interface Link {
    href: string;
    title?: string | null;
    text: string;
}

const renderer = {
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

marked.use({ renderer });
