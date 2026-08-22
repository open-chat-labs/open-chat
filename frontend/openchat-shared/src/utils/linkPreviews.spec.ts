import { vi } from "vitest";
import {
    classifyUrl,
    extractEnabledLinks,
    extractMessagePreviews,
    fetchOgData,
    fetchOgPreviews,
    getCachedOgData,
    MAX_LINK_PREVIEWS,
    OG_CACHE_MAX,
    ogCacheSizes,
} from "./linkPreviews";

describe("extractMessagePreviews", () => {
    test("returns empty array for empty string", () => {
        expect(extractMessagePreviews("")).toEqual([]);
    });

    test("ignores non-OC URLs", () => {
        expect(extractMessagePreviews("check out https://example.com")).toEqual([]);
    });

    test("parses community channel message URL", () => {
        const url = "https://oc.app/community/abc123/channel/456/789";
        const result = extractMessagePreviews(`see ${url}`);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            kind: "message",
            url,
            chatId: { kind: "channel", communityId: "abc123", channelId: 456 },
            messageIndex: 789,
            threadRootMessageIndex: undefined,
        });
    });

    test("parses community channel thread message URL", () => {
        const url = "https://oc.app/community/abc123/channel/456/789/42";
        const result = extractMessagePreviews(`see ${url}`);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            kind: "message",
            url,
            chatId: { kind: "channel", communityId: "abc123", channelId: 456 },
            threadRootMessageIndex: 789,
            messageIndex: 42,
        });
    });

    test("parses group message URL", () => {
        const url = "https://oc.app/group/mygroup-abc/100";
        const result = extractMessagePreviews(`link: ${url}`);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            kind: "message",
            url,
            chatId: { kind: "group_chat", groupId: "mygroup-abc" },
            messageIndex: 100,
            threadRootMessageIndex: undefined,
        });
    });

    test("parses group thread message URL", () => {
        const url = "https://oc.app/group/mygroup-abc/100/5";
        const result = extractMessagePreviews(`link: ${url}`);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            kind: "message",
            url,
            chatId: { kind: "group_chat", groupId: "mygroup-abc" },
            threadRootMessageIndex: 100,
            messageIndex: 5,
        });
    });

    test("skips LINK_REMOVED URLs", () => {
        const url = "https://oc.app/group/mygroup-abc/100#LINK_REMOVED";
        expect(extractMessagePreviews(`link: ${url}`)).toEqual([]);
    });

    test("deduplicates repeated URLs", () => {
        const url = "https://oc.app/group/mygroup-abc/100";
        const result = extractMessagePreviews(`${url} and again ${url}`);
        expect(result).toHaveLength(1);
    });

    test("extracts multiple distinct previews", () => {
        const url1 = "https://oc.app/group/mygroup-abc/100";
        const url2 = "https://oc.app/community/xyz/channel/1/5";
        const result = extractMessagePreviews(`${url1} and ${url2}`);
        expect(result).toHaveLength(2);
    });

    test("strips markdown display text before matching", () => {
        const url = "https://oc.app/group/mygroup-abc/100";
        // [display text](url) — should extract the url, not the display text
        const result = extractMessagePreviews(`[click here](${url})`);
        expect(result).toHaveLength(1);
        expect(result[0].url).toBe(url);
    });

    test("no limit applied (more than MAX_LINK_PREVIEWS)", () => {
        const urls = [
            "https://oc.app/group/g1/1",
            "https://oc.app/group/g2/2",
            "https://oc.app/group/g3/3",
            "https://oc.app/group/g4/4",
        ];
        const result = extractMessagePreviews(urls.join(" "));
        expect(result).toHaveLength(4);
    });
});

describe("classifyUrl", () => {
    test("returns undefined for non-OC URL", () => {
        expect(classifyUrl("https://example.com")).toBeUndefined();
    });

    test("returns undefined for OC URL without message path", () => {
        expect(classifyUrl("https://oc.app")).toBeUndefined();
    });

    test("returns MessagePreview for OC group message URL", () => {
        const result = classifyUrl("https://oc.app/group/mygroup/5");
        expect(result).toMatchObject({ kind: "message" });
    });

    test("returns MessagePreview for OC community message URL", () => {
        const result = classifyUrl("https://oc.app/community/cid/channel/123/5");
        expect(result).toMatchObject({ kind: "message" });
    });

    test("returns undefined for invalid URL", () => {
        expect(classifyUrl("not-a-url")).toBeUndefined();
    });
});

describe("extractEnabledLinks", () => {
    test("returns empty for undefined", () => {
        expect(extractEnabledLinks(undefined)).toEqual([]);
    });

    test("returns empty for empty string", () => {
        expect(extractEnabledLinks("")).toEqual([]);
    });

    test("extracts external URLs", () => {
        const result = extractEnabledLinks("see https://example.com for details");
        expect(result).toContain("https://example.com");
    });

    test("filters out OC message URLs", () => {
        const result = extractEnabledLinks("https://oc.app/group/mygroup/5");
        expect(result).toHaveLength(0);
    });

    test("filters out OC community message URLs", () => {
        const result = extractEnabledLinks("https://oc.app/community/cid/channel/123/5");
        expect(result).toHaveLength(0);
    });

    test("does not count filtered OC message URLs towards the limit", () => {
        const text = [
            "https://oc.app/group/mygroup/1",
            "https://oc.app/group/mygroup/2",
            "https://oc.app/group/mygroup/3",
            "https://example.com",
        ].join(" ");
        expect(extractEnabledLinks(text)).toEqual(["https://example.com"]);
    });

    test("strips LINK_REMOVED suffix", () => {
        const result = extractEnabledLinks("https://example.com#LINK_REMOVED");
        expect(result).toContain("https://example.com");
    });

    test(`limits to ${MAX_LINK_PREVIEWS} links`, () => {
        const urls = ["https://a.com", "https://b.com", "https://c.com", "https://d.com"];
        const result = extractEnabledLinks(urls.join(" "));
        expect(result).toHaveLength(MAX_LINK_PREVIEWS);
    });

    test("deduplicates URLs", () => {
        const result = extractEnabledLinks("https://example.com https://example.com");
        expect(result).toHaveLength(1);
    });
});

describe("fetchOgPreviews", () => {
    const proxyUrl = "https://preview.test";
    let imagesCreated = 0;

    beforeEach(() => {
        imagesCreated = 0;
        class FakeImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 800;
            naturalHeight = 600;
            constructor() {
                imagesCreated++;
            }
            set src(value: string) {
                if (value !== "") {
                    setTimeout(() => this.onload?.(), 0);
                }
            }
        }
        vi.stubGlobal("Image", FakeImage);
        vi.stubGlobal("fetch", (input: string) => {
            const target = new URL(input).searchParams.get("url");
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(ogResponses[target ?? ""]),
            });
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const ogResponses: Record<string, unknown> = {
        "https://with-dimensions.test": {
            title: "With dimensions",
            description: "desc",
            image: "https://with-dimensions.test/img.png",
            imageAlt: "alt text",
            imageWidth: 1200,
            imageHeight: 630,
        },
        "https://without-dimensions.test": {
            title: "Without dimensions",
            description: "desc",
            image: "https://without-dimensions.test/img.png",
        },
    };

    test("uses the camelCase dimensions from the service without measuring the image", async () => {
        const [preview] = await fetchOgPreviews(["https://with-dimensions.test"], proxyUrl);
        expect(preview.image).toEqual({
            url: "https://with-dimensions.test/img.png",
            width: 1200,
            height: 630,
        });
        expect(imagesCreated).toBe(0);
    });

    test("falls back to measuring the image when the service sends no dimensions", async () => {
        const [preview] = await fetchOgPreviews(["https://without-dimensions.test"], proxyUrl);
        expect(preview.image).toEqual({
            url: "https://without-dimensions.test/img.png",
            width: 800,
            height: 600,
        });
        expect(imagesCreated).toBe(1);
    });
});

describe("fetchOgData cache bounds", () => {
    const proxyUrl = "https://preview.test";

    beforeEach(() => {
        vi.stubGlobal("fetch", (input: string) => {
            const target = new URL(input).searchParams.get("url");
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ title: `title for ${target}` }),
            });
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("same url is fetched once and resolved data is cached", async () => {
        const url = "https://bounded-0.test";
        const a = fetchOgData(url, proxyUrl);
        const b = fetchOgData(url, proxyUrl);
        expect(a).toBe(b);
        const data = await a;
        expect(data?.title).toBe(`title for ${url}`);
        expect(getCachedOgData(url)?.title).toBe(`title for ${url}`);
    });

    test("caches never exceed OG_CACHE_MAX and evict the oldest entry", async () => {
        const oldest = "https://bounded-0.test";
        for (let i = 0; i <= OG_CACHE_MAX + 20; i++) {
            await fetchOgData(`https://bounded-${i}.test`, proxyUrl);
        }
        const sizes = ogCacheSizes();
        expect(sizes.promises).toBe(OG_CACHE_MAX);
        expect(sizes.resolved).toBe(OG_CACHE_MAX);
        expect(getCachedOgData(oldest)).toBeUndefined();
        expect(getCachedOgData(`https://bounded-${OG_CACHE_MAX + 20}.test`)).toBeDefined();
    });
});
