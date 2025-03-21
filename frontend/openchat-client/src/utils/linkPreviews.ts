const LINK_REMOVED = "#LINK_REMOVED";
const LINK_REMOVED_REGEX = new RegExp(LINK_REMOVED, "g");

// Taken from here - https://stackoverflow.com/a/6041965
const URL_REGEX = new RegExp((`(https?):\\/\\/([\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:\\/~+#-]*[\\w@?^=%&\\/~+#-])`), "g");

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
    const links: { url: string; preview: boolean }[] = [];
    const matches = text.match(URL_REGEX);
    if (matches) {
        for (const match of matches) {
            const preview = !match.endsWith(LINK_REMOVED);
            const url = preview
                ? match
                : match.substring(0, match.length - LINK_REMOVED.length);

            // Dedup by url
            if (url && links.find((l) => l.url === url) === undefined) {
                links.push({ url, preview });
            }
        }
    }
    return links;
}