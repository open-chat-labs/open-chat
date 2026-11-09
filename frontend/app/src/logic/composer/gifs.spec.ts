import type { KlipyObject, KlipySearchResponse } from "@client";
import { GifFeed } from "./gifFeed.svelte";
import { gifContent, gifsNotFound, klipySuggestionsUrl, klipyUrl, nextPosition } from "./gifs";

function gif(id: string): KlipyObject {
    return {
        id,
        title: id === "untitled" ? "" : `GIF ${id}`,
        content_description: `about ${id}`,
        media_formats: {
            mp4: { url: `${id}.mp4`, dims: [480, 270] },
            tinygif: { url: `${id}.gif`, dims: [220, 124] },
        },
    } as unknown as KlipyObject;
}

describe("a page of GIFs", () => {
    test("is the trending ones with nothing typed, else those matching", () => {
        expect(klipyUrl("k", " ", "", 24)).toBe(
            "https://api.klipy.com/v2/featured?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=k&limit=24&pos=",
        );
        expect(klipyUrl("k", " thumbs up ", "48", 24)).toBe(
            "https://api.klipy.com/v2/search?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=k&limit=24&pos=48&q=thumbs%20up",
        );
    });

    test("says where the next starts, none at the end", () => {
        expect(nextPosition({ next: 24 })).toBe("24");
        expect(nextPosition({ next: "" as unknown as number })).toBeUndefined();
        expect(nextPosition({ next: 0 })).toBeUndefined();
    });
});

describe("a GIF picked", () => {
    test("is sent as its mp4 on the desktop and its small GIF on phones", () => {
        expect(gifContent(gif("a"), "")).toEqual({
            kind: "giphy_content",
            title: "GIF a",
            desktop: { height: 270, width: 480, url: "a.mp4", mimeType: "video/mp4" },
            mobile: { height: 124, width: 220, url: "a.gif", mimeType: "image/gif" },
            caption: undefined,
        });
    });

    test("is titled by its description when it has no title, with a caption", () => {
        const content = gifContent(gif("untitled"), "lol");
        expect(content.title).toBe("about untitled");
        expect(content.caption).toBe("lol");
    });
});

describe("the GIFs a picker shows", () => {
    function pages(...results: KlipyObject[][]) {
        let i = 0;
        return vi.fn(async (_url: string): Promise<KlipySearchResponse> => {
            const page = results[i] ?? [];
            i += 1;
            return { locale: "en", next: i < results.length ? i * 2 : 0, results: page };
        });
    }

    test("load a page at a time, without repeats, until there are no more", async () => {
        const fetchPage = pages([gif("a"), gif("b")], [gif("b"), gif("c")]);
        const feed = new GifFeed("k", fetchPage);
        await feed.search("");
        await feed.more();
        await feed.more();
        expect(feed.gifs.map((g) => g.id)).toEqual(["a", "b", "c"]);
        expect(fetchPage).toHaveBeenCalledTimes(2);
        expect(fetchPage.mock.calls[1][0]).toContain("pos=2");
    });

    test("start again for a search, a page still on its way dropped", async () => {
        let resolveFirst: (page: KlipySearchResponse) => void = () => {};
        const fetchPage = vi.fn(
            (url: string) =>
                new Promise<KlipySearchResponse>((resolve) => {
                    if (url.includes("featured")) resolveFirst = resolve;
                    else resolve({ locale: "en", next: 0, results: [gif("cat")] });
                }),
        );
        const feed = new GifFeed("k", fetchPage);
        const first = feed.search("");
        await feed.search("cat");
        resolveFirst({ locale: "en", next: 0, results: [gif("trending")] });
        await first;
        expect(feed.gifs.map((g) => g.id)).toEqual(["cat"]);
        expect(feed.loading).toBe(false);
    });

    test("say when a page couldn't load", async () => {
        const feed = new GifFeed("k", async () => {
            throw new Error("offline");
        });
        await feed.search("");
        expect(feed.failed).toBe(true);
        expect(feed.loading).toBe(false);
    });
});

describe("a GIF search that finds none", () => {
    test("offers related search terms (not the one searched), else the trending GIFs", () => {
        expect(gifsNotFound("cats", ["cat", "kitten", "cats"])).toEqual({
            kind: "suggestions",
            query: "cats",
            terms: ["cat", "kitten"],
        });
        expect(gifsNotFound("zzqq", [])).toEqual({ kind: "trending", query: "zzqq" });
        expect(gifsNotFound("zzqq", undefined)).toEqual({ kind: "trending", query: "zzqq" });
    });

    test("asks Klipy for the related terms", () => {
        expect(klipySuggestionsUrl("k", " happy birthday ", 8)).toBe(
            "https://api.klipy.com/v2/search_suggestions?key=k&limit=8&q=happy%20birthday",
        );
    });

    const none = async (url: string): Promise<KlipySearchResponse> =>
        url.includes("featured")
            ? { locale: "en", next: 0, results: [gif("trending")] }
            : { locale: "en", next: 0, results: [] };

    test("with related terms, shows them, no GIFs", async () => {
        const feed = new GifFeed("k", none, async () => ({ results: ["cat", "kitten"] }));
        await feed.search("catz");
        expect(feed.notFound).toEqual({
            kind: "suggestions",
            query: "catz",
            terms: ["cat", "kitten"],
        });
        expect(feed.gifs).toEqual([]);
    });

    test("without (or when they can't be had), the trending GIFs under the message", async () => {
        let feed = new GifFeed("k", none, async () => ({ results: [] }));
        await feed.search("zzqq");
        expect(feed.notFound).toEqual({ kind: "trending", query: "zzqq" });
        expect(feed.gifs.map((g) => g.id)).toEqual(["trending"]);

        vi.spyOn(console, "warn").mockImplementation(() => {});
        feed = new GifFeed("k", none, async () => {
            throw new Error("offline");
        });
        await feed.search("zzqq");
        expect(feed.notFound?.kind).toBe("trending");
        expect(feed.gifs.map((g) => g.id)).toEqual(["trending"]);
    });

    test("a new search starts over", async () => {
        const feed = new GifFeed("k", none, async () => ({ results: ["cat"] }));
        await feed.search("catz");
        await feed.search("");
        expect(feed.notFound).toBeUndefined();
        expect(feed.gifs.map((g) => g.id)).toEqual(["trending"]);
    });
});
