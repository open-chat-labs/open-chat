import { extractUrls } from "./url";

const LINK_REMOVED = "#LINK_REMOVED";
const LINK_REMOVED_REGEX = new RegExp(LINK_REMOVED, "g");

export function stripLinkDisabledMarker(text: string): string {
    return text.replace(LINK_REMOVED_REGEX, () => "");
}

export function extractEnabledLinks(text: string): string[] {
    return extractLinkUrls(text)
        .filter(({url: _, preview}) => preview)
        .map(({url, preview: _}) => url);
}

export function extractDisabledLinks(text: string): string[] {
    return extractLinkUrls(text)
        .filter(({url: _, preview}) => !preview)
        .map(({url, preview: _}) => url);
}

export function disableLinksInText(text: string, urls: string[]): string {
    for (const url of urls) {
        if (!url.endsWith(LINK_REMOVED)) {
            text = text.replace(url, url + LINK_REMOVED);
        }
    }

    return text;
}

function extractLinkUrls(text: string): {url: string; preview: boolean}[] {
    const links = [];
    for (const url of extractUrls(text)) {
        if (url.endsWith(LINK_REMOVED)) {
            links.push({ url: url.substring(0, url.length - LINK_REMOVED.length), preview: false });
        } else {
            links.push({ url: url, preview: true });
        }
    }
    return links;
}