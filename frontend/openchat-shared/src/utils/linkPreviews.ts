import type { LinkPreview, Message, MessagePreview, OgPreview } from "../domain";

// Originally taken from here - https://stackoverflow.com/a/6041965
const URL_REGEX = new RegExp(
    `(https?):\\/\\/(localhost|[\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:\\/~+#-]*[\\w@?^=%&\\/~+#-])`,
    "g",
);

const communityMessageRegex = /\/community\/([a-z0-9_-]+)\/channel\/(\d+)\/(\d+)(?:\/(\d+))?/i;
const groupMessageRegex = /\/group\/([a-z0-9_-]+)\/(\d+)(?:\/(\d+))?/i;

const LINK_REMOVED = "#LINK_REMOVED";
const LINK_REMOVED_REGEX = new RegExp(LINK_REMOVED, "g");

export const MAX_LINK_PREVIEWS = 3;

export type OgData = {
    title?: string;
    description?: string;
    image?: string;
    image_alt?: string;
    image_width?: number;
    image_height?: number;
};

const ogPromiseCache = new Map<string, Promise<OgData | null>>();
const ogResolvedCache = new Map<string, OgData | null>();

export function getCachedOgData(url: string): OgData | null | undefined {
    return ogResolvedCache.get(url); // undefined = not yet resolved
}

export function stripLinkDisabledMarker(text: string): string {
    return text.replace(LINK_REMOVED_REGEX, () => "");
}

export function removeOpenGraphPreviews(msg: Message, urls: string[]): Message {
    return {
        ...msg,
        ogPreviews: msg.ogPreviews.filter((p) => !urls.find((u) => p.url === u)),
    };
}

function extractRawUrls(text: string): string[] {
    const withoutMarkdownDisplayText = text.replace(/\[[^\]]*\]\((https?:\/\/[^)]*)\)/g, "$1");
    return [...new Set(withoutMarkdownDisplayText.match(URL_REGEX) ?? [])];
}

function isOcUrl(url: string | URL): boolean {
    if (typeof url === "string") {
        try {
            url = new URL(url);
        } catch {
            return false;
        }
    }
    return (
        url.hostname === "oc.app" ||
        url.hostname.endsWith(".oc.app") ||
        url.hostname === "localhost"
    );
}

function parseMessageUrl(urlText: string): MessagePreview | undefined {
    let url: URL;
    try {
        url = new URL(urlText);
    } catch {
        return;
    }

    if (!isOcUrl(url)) return;

    let m = url.pathname.match(communityMessageRegex);
    if (m) {
        return {
            kind: "message",
            url: urlText,
            chatId: {
                kind: "channel",
                communityId: m[1],
                channelId: Number(m[2]),
            },
            threadRootMessageIndex: m[4] ? Number(m[3]) : undefined,
            messageIndex: m[4] ? Number(m[4]) : Number(m[3]),
        };
    }

    m = url.pathname.match(groupMessageRegex);
    if (m) {
        return {
            kind: "message",
            url: urlText,
            chatId: {
                kind: "group_chat",
                groupId: m[1],
            },
            threadRootMessageIndex: m[3] ? Number(m[2]) : undefined,
            messageIndex: m[3] ? Number(m[3]) : Number(m[2]),
        };
    }
}

export function classifyUrl(url: string): LinkPreview | undefined {
    return parseMessageUrl(url);
}

// Used by the agent layer to extract OC message previews from message text.
// No limit applied; LINK_REMOVED-suffixed URLs are skipped entirely.
export function extractMessagePreviews(text: string): MessagePreview[] {
    return extractRawUrls(text)
        .filter((u) => !u.endsWith(LINK_REMOVED))
        .reduce<MessagePreview[]>((previews, url) => {
            const preview = parseMessageUrl(url);
            if (preview) previews.push(preview);
            return previews;
        }, []);
}

// Used by the client layer to get URLs to fetch OG previews for.
// Strips LINK_REMOVED suffix, limits to MAX_LINK_PREVIEWS, and excludes OC message URLs.
export function extractEnabledLinks(text?: string): string[] {
    if (!text) return [];
    const links: string[] = [];
    for (const url of extractRawUrls(text).slice(0, MAX_LINK_PREVIEWS)) {
        const stripped = url.endsWith(LINK_REMOVED)
            ? url.substring(0, url.length - LINK_REMOVED.length)
            : url;
        links.push(stripped);
    }
    return links.filter((url) => classifyUrl(url) === undefined);
}

function getImageDimensions(url: string): Promise<{ width: number; height: number } | undefined> {
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            img.src = "";
            resolve(undefined);
        }, 5000);

        img.onload = () => {
            clearTimeout(timer);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(undefined);
        };
        img.src = url;
    });
}

export function fetchOgData(url: string, proxyUrl: string): Promise<OgData | null> {
    if (!proxyUrl) return Promise.resolve(null);

    const cached = ogPromiseCache.get(url);
    if (cached !== undefined) return cached;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const promise = fetch(`${proxyUrl}/preview?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
    })
        .finally(() => clearTimeout(timeoutId))
        .then((r) => {
            if (!r.ok) return null;
            return r.json() as Promise<OgData>;
        })
        .then((data) => (data?.title ? data : null))
        .catch(() => null)
        .then((data) => {
            if (data !== null) ogResolvedCache.set(url, data);
            else ogPromiseCache.delete(url); // don't cache failures — let next mount retry
            return data;
        });

    ogPromiseCache.set(url, promise);
    return promise;
}

async function fetchSinglePreview(url: string, proxyUrl: string): Promise<OgPreview | null> {
    const data = await fetchOgData(url, proxyUrl);
    if (!data || !data.title) return null;

    const preview: OgPreview = {
        kind: "opengraph",
        url,
        title: data.title,
        description: data.description ?? "",
    };

    if (data.image) {
        let width = data.image_width;
        let height = data.image_height;
        if (width === undefined || height === undefined) {
            const dims = await getImageDimensions(data.image);
            width = dims?.width;
            height = dims?.height;
        }
        if (width !== undefined && height !== undefined) {
            preview.image = { url: data.image, width, height };
        }
    }

    return preview;
}

export async function fetchOgPreviews(urls: string[], proxyUrl: string): Promise<OgPreview[]> {
    const results = await Promise.all(
        urls.map((url) => fetchSinglePreview(url, proxyUrl).catch(() => null)),
    );
    return results.filter((r): r is OgPreview => r !== null);
}
