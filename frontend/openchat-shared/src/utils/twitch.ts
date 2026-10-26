import type { OgPreview, TwitchEmbed } from "../domain";

// Twitch's embedded players (https://dev.twitch.tv/docs/embed). Twitch won't show one smaller
// than 400x300.
const PLAYER_URL = "https://player.twitch.tv/";
const CLIP_PLAYER_URL = "https://clips.twitch.tv/embed";
export const TWITCH_PLAYER_MIN_WIDTH = 400;
export const TWITCH_PLAYER_MIN_HEIGHT = 300;

const TWITCH_HOSTS = new Set(["twitch.tv", "www.twitch.tv", "m.twitch.tv"]);
const CLIPS_HOST = "clips.twitch.tv";

const LOGIN = /^[A-Za-z0-9_]{1,25}$/;
const VIDEO_ID = /^\d{1,20}$/;
const CLIP_SLUG = /^[A-Za-z0-9_-]{1,100}$/;
// A video's start time in its ?t=, eg. 1h2m3s or 90s
const VIDEO_TIME = /^(?=\d)(\d{1,3}h)?(\d{1,4}m)?(\d{1,6}s)?$/;
const HOSTNAME = /^[A-Za-z0-9.-]{1,253}$/;
// The title of a Twitch page's preview when Twitch doesn't say what the page is
const GENERIC_TITLE = "Twitch";

// twitch.tv/<name> pages that aren't channels
const NOT_CHANNELS = new Set([
    "broadcast",
    "directory",
    "downloads",
    "drops",
    "embed",
    "friends",
    "inventory",
    "jobs",
    "login",
    "logout",
    "messages",
    "moderator",
    "p",
    "popout",
    "prime",
    "search",
    "settings",
    "signup",
    "store",
    "subscriptions",
    "team",
    "turbo",
    "videos",
    "wallet",
]);

/**
 * The Twitch channel, video or clip a link is to, if it's to one: twitch.tv/<login>,
 * twitch.tv/videos/<id>, clips.twitch.tv/<slug> or twitch.tv/<login>/clip/<slug>, with or without
 * www. or m. on twitch.tv.
 */
export function parseTwitchUrl(url: string): TwitchEmbed | undefined {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    if (parsed.username !== "" || parsed.password !== "" || parsed.port !== "") return undefined;

    const path = parsed.pathname.split("/").filter((s) => s !== "");

    if (parsed.hostname === CLIPS_HOST) {
        const [slug] = path;
        return path.length === 1 && slug !== "embed" && CLIP_SLUG.test(slug)
            ? { kind: "twitch_clip", url, slug }
            : undefined;
    }

    if (!TWITCH_HOSTS.has(parsed.hostname)) return undefined;

    if (path.length === 1) {
        const login = path[0].toLowerCase();
        return LOGIN.test(login) && !NOT_CHANNELS.has(login)
            ? { kind: "twitch_channel", url, login }
            : undefined;
    }

    if (path.length === 2 && path[0].toLowerCase() === "videos" && VIDEO_ID.test(path[1])) {
        const t = parsed.searchParams.get("t");
        const time = t !== null && VIDEO_TIME.test(t) ? t : undefined;
        return { kind: "twitch_video", url, videoId: path[1], time };
    }

    if (
        path.length === 3 &&
        path[1].toLowerCase() === "clip" &&
        LOGIN.test(path[0]) &&
        CLIP_SLUG.test(path[2])
    ) {
        return { kind: "twitch_clip", url, slug: path[2] };
    }

    return undefined;
}

/**
 * The player's address on a page served from `parent`, the page's host name, or undefined if that
 * isn't a host name. Twitch only plays in a page whose host the player's `parent` names. The
 * player waits to be clicked: a phone won't start one without a tap, so none autoplays.
 */
export function twitchPlayerUrl(embed: TwitchEmbed, parent: string): string | undefined {
    if (!HOSTNAME.test(parent)) return undefined;

    const params = new URLSearchParams();
    switch (embed.kind) {
        case "twitch_channel":
            params.set("channel", embed.login);
            break;
        case "twitch_video":
            params.set("video", `v${embed.videoId}`);
            if (embed.time !== undefined) params.set("time", embed.time);
            break;
        case "twitch_clip":
            params.set("clip", embed.slug);
            break;
    }
    params.set("parent", parent);
    params.set("autoplay", "false");

    return `${embed.kind === "twitch_clip" ? CLIP_PLAYER_URL : PLAYER_URL}?${params}`;
}

// The page on Twitch itself, built from the checked parts rather than the link as written
export function twitchWatchUrl(embed: TwitchEmbed): string {
    switch (embed.kind) {
        case "twitch_channel":
            return `https://www.twitch.tv/${embed.login}`;
        case "twitch_video":
            return `https://www.twitch.tv/videos/${embed.videoId}${embed.time !== undefined ? `?t=${embed.time}` : ""}`;
        case "twitch_clip":
            return `https://clips.twitch.tv/${embed.slug}`;
    }
}

export type TwitchPoster = { title: string; image: string | undefined };

// What the player shows before it's clicked: the link's preview, if the sender fetched one that
// says what it is, else where it's to. Twitch only describes a channel to a preview fetch; a video or
// clip gets its site-wide title and logo, which says nothing, so that is left out.
export function twitchPoster(embed: TwitchEmbed, ogPreview: OgPreview | undefined): TwitchPoster {
    if (ogPreview !== undefined && ogPreview.title !== GENERIC_TITLE) {
        return { title: ogPreview.title, image: ogPreview.image?.url };
    }
    return { title: twitchWatchUrl(embed).replace(/^https:\/\/(www\.)?/, ""), image: undefined };
}
