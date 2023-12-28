const LINKS_REGEX = new RegExp("<link[^>]*>", "g");
const URL_REGEX = new RegExp(`(https?://[^\\s)]+)`, "g");

export function insertLinkTags(text: string): string {
    return text.replace(URL_REGEX, (match) => buildLinkTag(match, true));
}

export function stripLinkTags(text: string): string {
    if (text.includes("<link ")) {
        text = text.replace(LINKS_REGEX, (match) => {
            return replaceLink(match);
        });
    }

    return text;
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
    if (text.includes("<link ")) {
        text= text.replace(LINKS_REGEX, (match) => {
            const [url, preview] = extractAttributes(match);
            if (url && (!preview || urls.includes(url))) {
                return buildLinkTag(url, false);
            } else {
                return match;
            }
        });
    }

    return text;
}

function extractLinkUrls(text: string): {url: string; preview: boolean}[] {
    const links: { url: string; preview: boolean }[] = [];
    if (text.includes("<link ")) {
        const matches = text.match(LINKS_REGEX);
        if (matches) {
            for (const match of matches) {
                const [url, preview] = extractAttributes(match);
                // Dedup by url
                if (url && links.find((l) => l.url === url) === undefined) {
                    links.push({ url, preview });
                }
            }
        }
    }
    return links;
}

function buildLinkTag(url: string, preview: boolean): string {
    const previewText = preview ? "" : ' preview="false"'
    return `<link href="${url}"${previewText}>`;
}

function extractAttributes(link: string): [string | undefined, boolean] {
    const previewText = extractAttributeValue("preview", link);
    const preview =
        previewText !== undefined ? previewText.toLowerCase() === "true" : true;
    
    return [extractAttributeValue("href", link), preview];
}

function replaceLink(link: string): string {
    return extractAttributeValue("href", link) ?? link;
}

function extractAttributeValue(name: string, text: string): string | undefined {
    const regex = new RegExp(`${name}=["']([^"']+)["']`, "gi");
    const matches = regex.exec(text);
    if (matches !== null) {
        return matches[1];
    }
}