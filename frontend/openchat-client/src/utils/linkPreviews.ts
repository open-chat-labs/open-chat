import {
    type LinkPreview,
    type Message,
    type MessagePreview,
    type OgPreview,
} from "openchat-shared";
import { communityMessageRegex, groupMessageRegex } from "./media";
import { extractUrls } from "./url";

const LINK_REMOVED = "#LINK_REMOVED";
const LINK_REMOVED_REGEX = new RegExp(LINK_REMOVED, "g");

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

export function extractEnabledLinks(text?: string): string[] {
    return text ? extractLinkUrls(text).filter((url) => classifyUrl(url) === undefined) : [];
}

export function removeOpenGraphPreviews(msg: Message, urls: string[]): Message {
    return {
        ...msg,
        ogPreviews: msg.ogPreviews.filter((p) => !urls.find((u) => p.url === u)),
    };
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

export function fetchOgData(url: string): Promise<OgData | null> {
    const proxyUrl = import.meta.env.OC_PREVIEW_PROXY_URL;
    if (!proxyUrl) return Promise.resolve(null);

    const cached = ogPromiseCache.get(url);
    if (cached !== undefined) return cached;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const promise = fetch(
        `${import.meta.env.OC_PREVIEW_PROXY_URL}/preview?url=${encodeURIComponent(url)}`,
        {
            signal: controller.signal,
        },
    )
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

async function fetchSinglePreview(url: string): Promise<OgPreview | null> {
    const data = await fetchOgData(url);
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

export async function fetchOgPreviews(urls: string[]): Promise<OgPreview[]> {
    const results = await Promise.all(urls.map((url) => fetchSinglePreview(url).catch(() => null)));
    return results.filter((r): r is OgPreview => r !== null);
}

function extractLinkUrls(text: string): string[] {
    const links = [];
    for (const url of extractUrls(text)) {
        if (url.endsWith(LINK_REMOVED)) {
            links.push(url.substring(0, url.length - LINK_REMOVED.length));
        } else {
            links.push(url);
        }
    }
    return links;
}

export function classifyUrl(url: string): LinkPreview | undefined {
    const messagePreview = parseMessageUrl(url);
    if (messagePreview) {
        return messagePreview;
    }
}

function parseMessageUrl(urlText: string): MessagePreview | undefined {
    let url: URL;
    try {
        url = new URL(urlText);
    } catch {
        return;
    }
    if (
        url.hostname !== "oc.app" &&
        !url.hostname.endsWith(".oc.app") &&
        url.hostname !== "localhost"
    ) {
        return;
    }

    let regexMatch = url.pathname.match(communityMessageRegex());
    if (regexMatch) {
        return {
            kind: "message",
            url: urlText,
            chatId: {
                kind: "channel",
                communityId: regexMatch[1],
                channelId: Number(regexMatch[2]),
            },
            threadRootMessageIndex: regexMatch[4] ? Number(regexMatch[3]) : undefined,
            messageIndex: regexMatch[4] ? Number(regexMatch[4]) : Number(regexMatch[3]),
        };
    }

    regexMatch = url.pathname.match(groupMessageRegex());
    if (regexMatch) {
        return {
            kind: "message",
            url: urlText,
            chatId: {
                kind: "group_chat",
                groupId: regexMatch[1],
            },
            threadRootMessageIndex: regexMatch[3] ? Number(regexMatch[2]) : undefined,
            messageIndex: regexMatch[3] ? Number(regexMatch[3]) : Number(regexMatch[2]),
        };
    }
}
