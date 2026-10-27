import { extractTwitchEmbeds, MAX_LINK_PREVIEWS } from "./linkPreviews";
import type { OgPreview } from "../domain";
import {
    parseTwitchUrl,
    twitchPlayerParent,
    twitchPlayersAndCards,
    twitchPlayerUrl,
    twitchPoster,
    twitchWatchUrl,
} from "./twitch";

describe("parseTwitchUrl", () => {
    test.each([
        "https://twitch.tv/nelly",
        "https://www.twitch.tv/nelly",
        "https://m.twitch.tv/nelly",
        "http://www.twitch.tv/nelly/",
        "https://www.twitch.tv/nelly?sr=a",
    ])("a channel: %s", (url) => {
        expect(parseTwitchUrl(url)).toEqual({ kind: "twitch_channel", url, login: "nelly" });
    });

    test("a channel's login is lower-cased", () => {
        expect(parseTwitchUrl("https://www.twitch.tv/Nelly_99")).toMatchObject({
            login: "nelly_99",
        });
    });

    test.each([
        ["https://www.twitch.tv/videos/2290587843", undefined],
        ["https://m.twitch.tv/videos/2290587843?t=1h2m3s", "1h2m3s"],
        ["https://twitch.tv/videos/2290587843?t=90s", "90s"],
        // a time Twitch wouldn't take is dropped, not the video
        ["https://www.twitch.tv/videos/2290587843?t=5", undefined],
        ["https://www.twitch.tv/videos/2290587843?t=1h%26parent%3Devil.com", undefined],
    ])("a video: %s", (url, time) => {
        expect(parseTwitchUrl(url)).toEqual({
            kind: "twitch_video",
            url,
            videoId: "2290587843",
            time,
        });
    });

    test.each([
        "https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
        "https://www.twitch.tv/nelly/clip/AwkwardHelplessSalamanderSwiftRage?filter=clips",
        "https://m.twitch.tv/nelly/clip/AwkwardHelplessSalamanderSwiftRage",
        "https://m.twitch.tv/clip/AwkwardHelplessSalamanderSwiftRage",
    ])("a clip: %s", (url) => {
        expect(parseTwitchUrl(url)).toEqual({
            kind: "twitch_clip",
            url,
            slug: "AwkwardHelplessSalamanderSwiftRage",
        });
    });

    test("a clip's slug can have a hyphen and underscore", () => {
        expect(
            parseTwitchUrl("https://clips.twitch.tv/BrightOtter-2aB3c_D4eF5gH6iJ7"),
        ).toMatchObject({ slug: "BrightOtter-2aB3c_D4eF5gH6iJ7" });
    });

    test.each([
        // not Twitch
        "https://twitch.tv.evil.com/nelly",
        "https://eviltwitch.tv/nelly",
        "https://player.twitch.tv/nelly",
        "https://www.clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
        "ftp://twitch.tv/nelly",
        "https://user@twitch.tv/nelly",
        "https://twitch.tv:8443/nelly",
        "not a url",
        // Twitch, but not a channel, video or clip
        "https://www.twitch.tv",
        "https://www.twitch.tv/directory",
        "https://www.twitch.tv/settings",
        "https://www.twitch.tv/activate",
        "https://m.twitch.tv/clip",
        "https://www.twitch.tv/videos",
        "https://www.twitch.tv/nelly/videos",
        "https://www.twitch.tv/nelly/about",
        "https://clips.twitch.tv/embed?clip=AwkwardHelplessSalamanderSwiftRage",
        "https://clips.twitch.tv/",
        // logins and ids that aren't valid
        "https://www.twitch.tv/nel-ly",
        "https://www.twitch.tv/nel%22ly",
        "https://www.twitch.tv/abcdefghijklmnopqrstuvwxyz",
        "https://www.twitch.tv/videos/v2290587843",
        "https://www.twitch.tv/videos/229058784a",
        "https://clips.twitch.tv/Awkward%20Salamander",
        "https://clips.twitch.tv/Awkward.Salamander",
        "https://www.twitch.tv/nel-ly/clip/AwkwardHelplessSalamanderSwiftRage",
        "https://www.twitch.tv/nelly/clip/Awkward%26Salamander",
    ])("not a channel, video or clip: %s", (url) => {
        expect(parseTwitchUrl(url)).toBeUndefined();
    });

    test("a login of 25 characters is valid", () => {
        const login = "a".repeat(25);
        expect(parseTwitchUrl(`https://twitch.tv/${login}`)).toMatchObject({ login });
    });
});

describe("extractTwitchEmbeds", () => {
    test("finds each Twitch link in the text", () => {
        expect(
            extractTwitchEmbeds(
                "live now https://www.twitch.tv/nelly and https://example.com, and the clip " +
                    "https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
            ),
        ).toEqual([
            { kind: "twitch_channel", url: "https://www.twitch.tv/nelly", login: "nelly" },
            {
                kind: "twitch_clip",
                url: "https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
                slug: "AwkwardHelplessSalamanderSwiftRage",
            },
        ]);
    });

    test("finds a link behind markdown display text", () => {
        expect(extractTwitchEmbeds("[watch me](https://www.twitch.tv/nelly)")).toEqual([
            { kind: "twitch_channel", url: "https://www.twitch.tv/nelly", login: "nelly" },
        ]);
    });

    test("one player per channel, however it's linked", () => {
        expect(
            extractTwitchEmbeds("https://twitch.tv/nelly https://m.twitch.tv/Nelly"),
        ).toHaveLength(1);
    });

    test("skips a link whose preview was removed", () => {
        expect(extractTwitchEmbeds("https://www.twitch.tv/nelly#LINK_REMOVED")).toEqual([]);
    });

    test("no more players than link previews", () => {
        const text = Array.from({ length: MAX_LINK_PREVIEWS + 2 }, (_, i) => {
            return `https://twitch.tv/channel${i}`;
        }).join(" ");
        expect(extractTwitchEmbeds(text)).toHaveLength(MAX_LINK_PREVIEWS);
    });

    test("only links among those that get previews, which other links count towards", () => {
        const others = Array.from({ length: MAX_LINK_PREVIEWS }, (_, i) => {
            return `https://example${i}.com`;
        }).join(" ");
        expect(extractTwitchEmbeds(`${others} https://twitch.tv/nelly`)).toEqual([]);
    });

    test("a link to an OpenChat message doesn't count towards them", () => {
        const messages = Array.from({ length: MAX_LINK_PREVIEWS }, (_, i) => {
            return `https://oc.app/group/abc/${i}`;
        }).join(" ");
        expect(extractTwitchEmbeds(`${messages} https://twitch.tv/nelly`)).toHaveLength(1);
    });

    test("nothing in text without a Twitch link", () => {
        expect(extractTwitchEmbeds("")).toEqual([]);
        expect(extractTwitchEmbeds("twitch.tv/nelly has no scheme")).toEqual([]);
    });
});

describe("twitchPlayerUrl", () => {
    test("a channel plays from player.twitch.tv", () => {
        const embed = parseTwitchUrl("https://www.twitch.tv/nelly")!;
        expect(twitchPlayerUrl(embed, "oc.app")).toBe(
            "https://player.twitch.tv/?channel=nelly&parent=oc.app&autoplay=true",
        );
    });

    test("a video plays from player.twitch.tv, from its start time", () => {
        const embed = parseTwitchUrl("https://www.twitch.tv/videos/2290587843?t=1h2m3s")!;
        expect(twitchPlayerUrl(embed, "webtest.oc.app")).toBe(
            "https://player.twitch.tv/?video=v2290587843&time=1h2m3s&parent=webtest.oc.app&autoplay=true",
        );
    });

    test("a clip plays from clips.twitch.tv", () => {
        const embed = parseTwitchUrl("https://www.twitch.tv/nelly/clip/Awkward-Salamander")!;
        expect(twitchPlayerUrl(embed, "localhost")).toBe(
            "https://clips.twitch.tv/embed?clip=Awkward-Salamander&parent=localhost&autoplay=true",
        );
    });

});

describe("twitchPlayerParent", () => {
    const page = { native: false, framed: false };

    test.each(["oc.app", "webtest.oc.app", "6hsbt-vqaaa-aaaaf-aaafq-cai.icp0.io", "localhost"])(
        "the page's host name: %s",
        (hostname) => {
            expect(twitchPlayerParent({ ...page, hostname })).toBe(hostname);
        },
    );

    test.each(["", "oc.app&parent=evil.com", "oc.app/x", "[::1]"])(
        "none for a host name that isn't one: %s",
        (hostname) => {
            expect(twitchPlayerParent({ ...page, hostname })).toBeUndefined();
        },
    );

    test("none in the native apps", () => {
        expect(twitchPlayerParent({ ...page, hostname: "tauri.localhost", native: true })).toBe(
            undefined,
        );
    });

    test("none in a page another site frames", () => {
        expect(twitchPlayerParent({ ...page, hostname: "oc.app", framed: true })).toBe(undefined);
    });
});

describe("twitchPlayersAndCards", () => {
    const preview = (url: string, title = url): OgPreview => ({
        kind: "opengraph",
        url,
        title,
        description: "",
    });

    test("a Twitch link's preview goes with its player, and other previews are cards", () => {
        const twitch = preview("https://www.twitch.tv/nelly", "Nelly - Live on Twitch");
        const github = preview("https://github.com");
        const embeds = extractTwitchEmbeds("https://www.twitch.tv/nelly https://github.com");
        expect(twitchPlayersAndCards(embeds, [twitch, github])).toEqual({
            players: [{ embed: embeds[0], ogPreview: twitch }],
            cards: [github],
        });
    });

    test("a preview goes with the player for where it goes, however its link is written", () => {
        const embeds = extractTwitchEmbeds("https://twitch.tv/nelly https://www.twitch.tv/Nelly");
        const first = preview("https://twitch.tv/nelly");
        const second = preview("https://www.twitch.tv/Nelly");
        expect(twitchPlayersAndCards(embeds, [first, second])).toEqual({
            players: [{ embed: embeds[0], ogPreview: first }],
            cards: [],
        });
    });

    test("a player without a preview, and a Twitch preview without a player stays a card", () => {
        const embeds = extractTwitchEmbeds("https://www.twitch.tv/nelly");
        const other = preview("https://www.twitch.tv/someoneelse");
        expect(twitchPlayersAndCards(embeds, [other])).toEqual({
            players: [{ embed: embeds[0], ogPreview: undefined }],
            cards: [other],
        });
    });
});

describe("twitchWatchUrl", () => {
    test.each([
        ["https://m.twitch.tv/Nelly/", "https://www.twitch.tv/nelly"],
        [
            "http://twitch.tv/videos/2290587843?t=90s&foo=bar",
            "https://www.twitch.tv/videos/2290587843?t=90s",
        ],
        ["https://www.twitch.tv/videos/2290587843", "https://www.twitch.tv/videos/2290587843"],
        [
            "https://www.twitch.tv/nelly/clip/AwkwardHelplessSalamanderSwiftRage",
            "https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
        ],
    ])("%s is watched at %s", (url, watchUrl) => {
        expect(twitchWatchUrl(parseTwitchUrl(url)!)).toBe(watchUrl);
    });
});

describe("twitchPoster", () => {
    const channel = parseTwitchUrl("https://www.twitch.tv/nelly")!;
    const clip = parseTwitchUrl("https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage")!;
    const preview = (title: string, image?: string): OgPreview => ({
        kind: "opengraph",
        url: "https://www.twitch.tv/nelly",
        title,
        description: "",
        image: image === undefined ? undefined : { url: image, width: 300, height: 300 },
    });

    test("the link's preview, when it has one", () => {
        expect(
            twitchPoster(channel, preview("Nelly - Live on Twitch", "https://cdn/nelly.png")),
        ).toEqual({ title: "Nelly - Live on Twitch", image: "https://cdn/nelly.png" });
    });

    test("where the link goes, without a preview", () => {
        expect(twitchPoster(channel, undefined)).toEqual({
            title: "twitch.tv/nelly",
            image: undefined,
        });
        expect(twitchPoster(clip, undefined)).toEqual({
            title: "clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
            image: undefined,
        });
    });

    test("where the link goes, when the preview is Twitch's generic one", () => {
        expect(twitchPoster(clip, preview("Twitch", "https://cdn/twitch_logo3.jpg"))).toEqual({
            title: "clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
            image: undefined,
        });
    });
});
