import type { AttachmentContent, MessageContext, SendMessageOutcome } from "@client";
import { MAX_MEDIA, MediaPicks, picksTray, sendMoreMedia } from "./mediaPicks.svelte";

const photo = (id: string) => ({ id, video: false, thumb: `data:${id}` });
const video = (id: string) => ({ id, video: true, thumb: `data:${id}`, duration: "0:14" });

const image = (n: number): AttachmentContent => ({
    kind: "image_content",
    height: 1,
    width: 1,
    thumbnailData: `thumb${n}`,
    mimeType: "image/jpeg",
    blobUrl: `blob:${n}`,
});

describe("the photos and videos picked for a message", () => {
    test("are numbered in the order they're picked", () => {
        const picks = new MediaPicks();
        expect(picks.toggle(photo("a"))).toBe("picked");
        expect(picks.toggle(video("b"))).toBe("picked");
        expect(picks.numberOf("a")).toBe(1);
        expect(picks.numberOf("b")).toBe(2);
        expect(picks.numberOf("c")).toBeUndefined();
    });

    test("a second tap puts one back, and those after it move up", () => {
        const picks = new MediaPicks();
        ["a", "b", "c"].forEach((id) => picks.toggle(photo(id)));
        expect(picks.toggle(photo("a"))).toBe("unpicked");
        expect(picks.numberOf("b")).toBe(1);
        expect(picks.numberOf("c")).toBe(2);
    });

    test("are the composer's: a thumbnail removed there is put back in the panel", () => {
        const picks = new MediaPicks();
        ["a", "b", "c"].forEach((id) => picks.toggle(photo(id)));
        picks.removeAt(1);
        expect(picks.numberOf("b")).toBeUndefined();
        expect(picks.numberOf("c")).toBe(2);
        picks.clear();
        expect(picks.count).toBe(0);
    });

    test("take up to ten, the eleventh refused", () => {
        const picks = new MediaPicks();
        for (let i = 0; i < MAX_MEDIA; i++) expect(picks.toggle(photo(`${i}`))).toBe("picked");
        expect(picks.toggle(photo("eleventh"))).toBe("full");
        expect(picks.add(photo("camera"))).toBe("full");
        expect(picks.room).toBe(0);
        picks.toggle(photo("3"));
        expect(picks.toggle(photo("eleventh"))).toBe("picked");
    });

    test("take their content once it's prepared, unless put back meanwhile", () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.toggle(photo("b"));
        picks.prepared("b", image(2));
        expect(picks.contents()).toEqual([image(2)]);
        picks.prepared("a", image(1));
        expect(picks.contents()).toEqual([image(1), image(2)]);
        picks.remove("a");
        picks.prepared("a", image(1));
        expect(picks.contents()).toEqual([image(2)]);
    });

    test("show in the composer's tray as their thumbnails, a video with its length", () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.toggle(video("b"));
        expect(picksTray(picks.picks)).toEqual({
            type: "media",
            items: [
                { kind: "image", src: "data:a" },
                { kind: "video", bg: 'center/cover no-repeat url("data:b")', dur: "0:14" },
            ],
        });
    });
});

describe("sending the photos and videos after the first", () => {
    const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };

    test("sends each in its own message, in order", async () => {
        const sendContent = vi.fn(async (): Promise<SendMessageOutcome> => ({ kind: "posted" }));
        expect(await sendMoreMedia({ sendContent }, context, [image(2), image(3)])).toEqual({
            kind: "posted",
        });
        expect(sendContent.mock.calls).toEqual([
            [context, image(2)],
            [context, image(3)],
        ]);
    });

    test("refused, stops, leaving those not sent", async () => {
        const outcomes: SendMessageOutcome[] = [{ kind: "posted" }, { kind: "throttled" }];
        const sendContent = vi.fn(async () => outcomes.shift() ?? { kind: "posted" as const });
        expect(
            await sendMoreMedia({ sendContent }, context, [image(2), image(3), image(4)]),
        ).toEqual({ kind: "refused", reason: "throttled", left: [image(3), image(4)] });
        expect(sendContent).toHaveBeenCalledTimes(2);
    });
});
