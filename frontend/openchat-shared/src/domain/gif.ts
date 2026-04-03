export type KlipySearchResponse = {
    locale: string;
    next: number;
    results: KlipyObject[];
};

export type KlipyContentFormat =
    | "preview"
    | "gif"
    | "mediumgif"
    | "tinygif"
    | "nanogif"
    | "mp4"
    | "loopedmp4"
    | "tinymp4"
    | "nanomp4"
    | "webm"
    | "tinywebm"
    | "nanowebm"
    | "webp_transparent"
    | "tinywebp_transparent"
    | "nanowebp_transparent"
    | "gif_transparent"
    | "tinygif_transparent"
    | "nanogif_transparent";

export type KlipyMediaObject = {
    url: string;
    dims: number[];
    duration: number;
    size: number;
};

export type KlipyObject = {
    content_description: string;
    created: number;
    flags: string[];
    hasaudio: boolean;
    id: string;
    itemurl: string;
    tags: string[];
    title: string;
    url: string;
    media_formats: Record<KlipyContentFormat, KlipyMediaObject>;
};
