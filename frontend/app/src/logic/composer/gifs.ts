import type { GiphyContent, KlipyObject, KlipySearchResponse } from "@client";

// GIFs from Klipy, as every tree's GIF picker has them: the trending ones, or those matching what's
// typed, a page at a time, and the message content a GIF picked is sent as.

const KLIPY = "https://api.klipy.com/v2";

/**
 * A page of GIFs: the trending ones with nothing typed, else those matching `query`; `pos` is
 * where the page before it ended ("" for the first).
 */
export function klipyUrl(apiKey: string, query: string, pos: string, limit: number): string {
    const params = `contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${apiKey}&limit=${limit}&pos=${pos}`;
    const typed = query.trim();
    return typed === ""
        ? `${KLIPY}/featured?${params}`
        : `${KLIPY}/search?${params}&q=${encodeURIComponent(typed)}`;
}

/** Search terms related to `query` (Klipy's search suggestions), for a search that found none. */
export function klipySuggestionsUrl(apiKey: string, query: string, limit: number): string {
    return `${KLIPY}/search_suggestions?key=${apiKey}&limit=${limit}&q=${encodeURIComponent(query.trim())}`;
}

/**
 * What a GIF search that found nothing shows under "No GIFs for …": the related search terms to
 * tap, or, with none (or none to be had), the trending GIFs.
 */
export type GifsNotFound =
    | { kind: "suggestions"; query: string; terms: string[] }
    | { kind: "trending"; query: string };

export function gifsNotFound(query: string, terms: readonly string[] | undefined): GifsNotFound {
    const offered = (terms ?? []).filter((t) => t.trim() !== "" && t.trim() !== query.trim());
    return offered.length > 0
        ? { kind: "suggestions", query, terms: offered }
        : { kind: "trending", query };
}

/** Where the next page starts, or none once there are no more. */
export function nextPosition(response: Pick<KlipySearchResponse, "next">): string | undefined {
    const next = response.next === undefined || response.next === null ? "" : `${response.next}`;
    return next === "" || next === "0" ? undefined : next;
}

/**
 * A GIF picked, as the message content it's sent as: its mp4 for the desktop, its small GIF for
 * phones, its title (or description) and an optional caption.
 */
export function gifContent(gif: KlipyObject, caption?: string): GiphyContent {
    return {
        kind: "giphy_content",
        title: gif.title || gif.content_description,
        desktop: {
            height: Number(gif.media_formats.mp4.dims[1]),
            width: Number(gif.media_formats.mp4.dims[0]),
            url: gif.media_formats.mp4.url,
            mimeType: "video/mp4",
        },
        mobile: {
            height: Number(gif.media_formats.tinygif.dims[1]),
            width: Number(gif.media_formats.tinygif.dims[0]),
            url: gif.media_formats.tinygif.url,
            mimeType: "image/gif",
        },
        caption: caption === "" ? undefined : caption,
    };
}
